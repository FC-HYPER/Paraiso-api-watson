import type { MessageInput, MessageResponse } from '@/models/message.schema';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { OrchestrateAgent, OrchestrateError } from 'services/orchestrate.service';

const orchestrateAgent = new OrchestrateAgent();

export async function sendMessageHandler(
  request: FastifyRequest<{ Body: MessageInput }>,
  reply: FastifyReply,
) {
  const { input, context } = request.body;
  // O thread_id sai do contexto; o resto segue para o agente.
  const { thread_id: threadId, ...userContext } = context ?? {};

  try {
    const result = await orchestrateAgent.sendMessage(
      { message: input, threadId, context: userContext },
      request.log,
    );

    request.log.info(
      `[orchestrate] thread_id=${result.threadId ?? '-'} run_id=${result.runId ?? '-'} trace_id=${result.traceId ?? '-'}`,
    );

    // A forma da resposta replica a do Watson para o gateway não precisar mudar o
    // parsing: o texto do agente sai em data.output.generic[0].text.
    const body: MessageResponse = {
      success: true,
      data: {
        output: {
          generic: [{ response_type: 'text', text: result.reply }],
        },
        context: {
          ...(result.threadId && { thread_id: result.threadId }),
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
