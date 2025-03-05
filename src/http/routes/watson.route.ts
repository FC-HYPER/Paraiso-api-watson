import { paths } from '@/utils/constants/default-paths';
import type { FastifyInstance } from 'fastify';
import { $ref, watsonSchemas, WatsonInput } from '@/models/watson.schema';
import { sendMessageHandler } from '../controllers/watson/send-message.controller';

export async function watsonRoute(app: FastifyInstance) {
  for (const schema of watsonSchemas) {
    app.addSchema(schema);
  }

  app.post<{ Body: WatsonInput }>(
    `${paths.watson}/message`,
    {
      schema: {
        tags: ['SendMessage'],
        body: $ref('watsonRequestSchema'),
        response: {
          200: $ref('watsonResponseSchema'),
        },
        security: [
          {
            apiKey: [],
          },
        ],
      },
      preHandler: [],
    },
    //@ts-ignore
    sendMessageHandler,
  );
}
