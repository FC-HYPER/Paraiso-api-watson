import type { MessageInput, MessageResponse } from '@/models/message.schema';
import { buildAspaControl } from '@/utils/aspa-control';
import { stripHandoffOffer } from '@/utils/handoff-offer';
import { buildTransferFallback } from '@/utils/transfer-fallback';
import { toWhatsAppText } from '@/utils/whatsapp-format';
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
  const threadId = context?.thread_id;

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
      request.log.warn(
        `[orchestrate] transfer done by middleware (${fallback.context.atendimento_humano ? 'handoff' : 'out of hours'}) - run_id=${result.runId ?? '-'}`,
      );
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

    // Sem transferência, a oferta de encaminhar não vai ao cliente: o Habib encaminha
    // ou não encaminha. Ver `src/utils/handoff-offer.ts`.
    if (!fallback && !control.userDefined.atendimento_humano) {
      const offer = stripHandoffOffer(text);
      if (offer.removed) {
        request.log.warn(`[orchestrate] handoff offer removed - run_id=${result.runId ?? '-'}`);
        text = offer.text;
      }
    }

    const noReply = text === '' || text === 'None';

    if (noReply) {
      request.log.warn(
        `[orchestrate] no reply (${text || 'empty'}), sending empty generic - run_id=${result.runId ?? '-'}`,
      );
    }

    // A forma da resposta replica a do Watson para o gateway não precisar mudar o
    // parsing: o texto do agente sai em data.output.generic[0].text, e as variáveis
    // de controle em data.context.skills["main skill"].user_defined.
    const body: MessageResponse = {
      success: true,
      data: {
        output: {
          generic: noReply ? [] : [{ response_type: 'text', text }],
        },
        context: {
          ...(result.threadId && { thread_id: result.threadId }),
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
