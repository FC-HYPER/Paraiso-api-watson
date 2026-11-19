import { env } from '@/config/env';
import type { MessageInput, MessageResponse } from '@/models/message.schema';
import { buildAspaControl } from '@/utils/aspa-control';
import { resolveConversation } from '@/utils/conversation';
import { dropAgentOpening, GREETING_TEXT, isGreetingOnly } from '@/utils/greeting';
import { stripHandoffOffer } from '@/utils/handoff-offer';
import { removeUnofficialContacts } from '@/utils/official-contacts';
import { fixOfficialLinks } from '@/utils/official-links';
import { removeRegistrationClaim } from '@/utils/registration-claim';
import { buildTransferFallback } from '@/utils/transfer-fallback';
import { plainLinks, toWhatsAppText } from '@/utils/whatsapp-format';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { OrchestrateAgent, OrchestrateError } from 'services/orchestrate.service';
import { z } from 'zod';

const orchestrateAgent = new OrchestrateAgent();

/**
 * Onde a Aspa coloca os dados do contato. Leitura tolerante: um contexto fora
 * desse formato não pode derrubar a requisição, só deixa de repassar o dado.
 */
const aspaContextSchema = z
  .object({
    skills: z
      .object({
        'main skill': z
          .object({
            user_defined: z
              .object({ phone: z.union([z.string(), z.number()]).optional() })
              .passthrough()
              .optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

/**
 * Só segue para o agente o que ele precisa, em nomes planos. A run só aceita
 * o que estiver em `context_variables` do agente, e o contexto da Aspa tem
 * chaves com espaço (`main skill`), que a IBM desaconselha.
 */
function buildAgentContext(context: unknown): Record<string, unknown> {
  const parsed = aspaContextSchema.safeParse(context);
  const phone = parsed.success
    ? parsed.data.skills?.['main skill']?.user_defined?.phone
    : undefined;

  return phone !== undefined && phone !== '' ? { phone: String(phone) } : {};
}

export async function sendMessageHandler(
  request: FastifyRequest<{ Body: MessageInput }>,
  reply: FastifyReply,
) {
  const { input, context } = request.body;
  const now = new Date();
  const conversation = resolveConversation(context, now, env.CONVERSATION_IDLE_HOURS);
  const threadId = conversation.threadId;

  if (conversation.newConversation === 'idle') {
    request.log.info(
      `[conversation] new conversation: idle ${conversation.idleHours?.toFixed(1)}h, previous thread_id=${context?.thread_id}`,
    );
  } else if (conversation.newConversation === 'no_marker') {
    request.log.info(
      `[conversation] new conversation: no last_message_at, previous thread_id=${context?.thread_id}`,
    );
  }

  // Conversa nova que começa só com um cumprimento: a resposta é a saudação, sem
  // chamar o agente. Sem run não há thread; `greeted` evita saudar de novo na mensagem
  // seguinte, que já chega com a pergunta. Ver src/utils/greeting.ts.
  if (conversation.greet && isGreetingOnly(input)) {
    request.log.info('[conversation] greeting only, agent not called');

    const body: MessageResponse = {
      success: true,
      data: {
        output: { generic: [{ response_type: 'text', text: GREETING_TEXT }] },
        context: { last_message_at: now.toISOString(), greeted: true },
      },
    };

    return reply.status(200).send(body);
  }

  try {
    const result = await orchestrateAgent.sendMessage(
      { message: input, threadId, context: buildAgentContext(context) },
      request.log,
    );

    // Só as chaves: os valores podem trazer dado pessoal (telefone).
    request.log.info(
      `[orchestrate] thread_id=${result.threadId ?? '-'} run_id=${result.runId ?? '-'} trace_id=${result.traceId ?? '-'} context_keys=${Object.keys(result.context).join(',') || '-'}`,
    );

    // A tool de transferência não executou: o middleware faz a transferência que ela
    // faria, e o texto que o LLM improvisou ("não consegui transferir", contatos) não
    // vai ao cliente. Ver `src/utils/transfer-fallback.ts`.
    const fallback = result.failedTransfer
      ? buildTransferFallback(result.failedTransfer, new Date())
      : undefined;

    if (fallback) {
      request.log.warn(`[orchestrate] transfer done by middleware - run_id=${result.runId ?? '-'}`);
    }

    const control = buildAspaControl(fallback?.context ?? result.context);
    const hasControl = Object.keys(control.userDefined).length > 0;

    if (control.rejected.length > 0) {
      request.log.error(
        `[aspa] control variables rejected: ${control.rejected.join('; ')} - run_id=${result.runId ?? '-'}`,
      );
    }

    if (hasControl) {
      // A equipe não é dado pessoal; o resumo pode ser, e fica fora do log.
      request.log.info(
        `[aspa] control=${Object.keys(control.userDefined).join(',')} distribuicao=${control.userDefined.distribuicao ?? '-'}`,
      );
    }

    // Resposta vazia e o "None" que o agente às vezes devolve no lugar de chamar
    // uma tool (problema conhecido da IBM) não vão ao cliente: `generic` vazio faz
    // a Aspa transferir para o TIME, a fila geral (André, 22/10/2026).
    let text = fallback?.text ?? toWhatsAppText(result.reply).trim();

    const links = fixOfficialLinks(text);
    if (links.fixed.length > 0) {
      request.log.warn(
        `[orchestrate] official link fixed (${links.fixed.join(', ')}) - run_id=${result.runId ?? '-'}`,
      );
      text = links.text;
    }

    // Sem transferência, a oferta de encaminhar não vai ao cliente: o Habib encaminha
    // ou não encaminha. Ver `src/utils/handoff-offer.ts`.
    if (!fallback && !control.userDefined.atendimento_humano) {
      const offer = stripHandoffOffer(text);
      if (offer.removed) {
        request.log.warn(`[orchestrate] handoff offer removed - run_id=${result.runId ?? '-'}`);
        text = offer.text;
      }
    }

    // Não existe registro nem protocolo: a afirmação não vai ao cliente. Ver
    // `src/utils/registration-claim.ts`.
    if (!fallback) {
      const claim = removeRegistrationClaim(text, control.userDefined.atendimento_humano === true);
      if (claim.removed) {
        request.log.warn(
          `[orchestrate] registration claim removed - run_id=${result.runId ?? '-'}`,
        );
        text = claim.text;
      }
    }

    // E-mail ou telefone fora da lista oficial não vai ao cliente. Ver
    // `src/utils/official-contacts.ts`.
    if (!fallback) {
      const contacts = removeUnofficialContacts(text);
      if (contacts.removed.length > 0) {
        request.log.warn(
          `[orchestrate] unofficial contact removed (${contacts.removed.join(', ')}) - run_id=${result.runId ?? '-'}`,
        );
        text = contacts.text;
      }
    }

    const noReply = text === '' || text === 'None';

    if (noReply) {
      request.log.warn(
        `[orchestrate] no reply (${text || 'empty'}), sending empty generic - run_id=${result.runId ?? '-'}`,
      );
    }

    // Por último, porque as travas acima leem o Markdown: o WhatsApp mostraria
    // `[texto](url)` cru. Ver `src/utils/whatsapp-format.ts`.
    text = plainLinks(text);

    // Conversa nova: a saudação vai antes da resposta, como item próprio. Com
    // `generic` vazio não vai nada, porque o vazio é o sinal de transferência à Aspa.
    const generic: MessageResponse['data']['output']['generic'] = [];
    if (!noReply) {
      if (conversation.greet) {
        generic.push({ response_type: 'text', text: GREETING_TEXT });
        text = dropAgentOpening(text);
      }
      generic.push({ response_type: 'text', text });
    }

    // A conversa sai do Habib na transferência e no `generic` vazio, que a Aspa
    // trata como transferência para o TIME. Sem o `thread_id`, a volta ao bot
    // começa thread nova: a conversa com o atendente não passa pelo Orchestrate,
    // e retomar a thread daria ao Habib um histórico incompleto. O id antigo fica
    // na linha `[orchestrate]` acima. Ver src/utils/conversation.ts.
    const handedOff = noReply || control.userDefined.atendimento_humano === true;

    // A forma da resposta replica a do Watson para o gateway não precisar mudar o
    // parsing: o texto do agente sai em data.output.generic[0].text, e as variáveis
    // de controle em data.context.skills["main skill"].user_defined.
    const body: MessageResponse = {
      success: true,
      data: {
        output: { generic },
        context: {
          ...(result.threadId && !handedOff && { thread_id: result.threadId }),
          last_message_at: now.toISOString(),
          ...(hasControl && {
            skills: { 'main skill': { user_defined: control.userDefined } },
          }),
        },
      },
    };

    return reply.status(200).send(body);
  } catch (error) {
    if (error instanceof OrchestrateError) {
      request.log.error(`[orchestrate] ${error.message} - ${error.detail ?? 'no detail'}`);

      return reply.status(error.status).send({
        success: false,
        message: error.message,
      });
    }

    request.log.error(
      `[orchestrate] unexpected error: ${error instanceof Error ? error.message : String(error)}`,
    );

    return reply.status(500).send({
      success: false,
      message: 'Failed to process the message',
    });
  }
}
