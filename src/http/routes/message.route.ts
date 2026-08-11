import { sendMessageHandler } from '@/http/controllers/message/send-message.controller';
import { validateApiKey } from '@/http/middlewares/validate-key.middleware';
import { $ref, type MessageInput } from '@/models/message.schema';
import { paths } from '@/utils/constants/default-paths';
import type { FastifyInstance } from 'fastify';

export async function messageRoute(app: FastifyInstance) {
  app.post<{ Body: MessageInput }>(
    `${paths.orchestrate}/message`,
    {
      schema: {
        tags: ['Orchestrate'],
        description:
          'Sends the customer message to the watsonx Orchestrate agent. The thread_id travels inside `context`.',
        body: $ref('messageRequestSchema'),
        response: {
          200: $ref('messageResponseSchema'),
          400: $ref('messageErrorSchema'),
          500: $ref('messageErrorSchema'),
          502: $ref('messageErrorSchema'),
          504: $ref('messageErrorSchema'),
        },
        security: [
          {
            apiKey: [],
          },
        ],
      },
      preHandler: [validateApiKey],
    },
    sendMessageHandler,
  );
}
