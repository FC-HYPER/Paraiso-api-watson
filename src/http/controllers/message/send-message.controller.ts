import type { MessageInput, MessageResponse } from '@/models/message.schema';
import { buildAspaControl } from '@/utils/aspa-control';
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

    const control = buildAspaControl(result.context);
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

    // A forma da resposta replica a do Watson para o gateway não precisar mudar o
    // parsing: o texto do agente sai em data.output.generic[0].text, e as variáveis
    // de controle em data.context.skills["main skill"].user_defined.
    const body: MessageResponse = {
      success: true,
      data: {
        output: {
          generic: [{ response_type: 'text', text: toWhatsAppText(result.reply) }],
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
