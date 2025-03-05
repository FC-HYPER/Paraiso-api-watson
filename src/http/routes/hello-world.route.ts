import { helloWorldHandler } from '@/http/controllers/helloWorld/hello-world.controller';
import { validateApiKey } from '@/http/middlewares/validate-key.middleware';
import { $ref } from '@/models/hello-world.schema';
import { paths } from '@/utils/constants/default-paths';
import { FastifyInstance } from 'fastify';

export async function helloWorldRoute(app: FastifyInstance) {
  app.post(
    paths.helloWord,
    {
      schema: {
        tags: ['HelloWorld'],
        body: $ref('helloWordRequestSchema'),
        response: {
          200: $ref('helloWorldResponseSchema'),
        },
        security: [
          {
            apiKey: [],
          },
        ],
      },
      preHandler: [validateApiKey],
    },
    //@ts-ignore
    helloWorldHandler,
  );
}
