import { FastifyInstance } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { ZodError } from 'zod';

export async function interceptorLoggerHook(app: FastifyInstance) {
  app.setErrorHandler((error, _, reply) => {
    if (error instanceof ZodError) {
      return reply
        .status(400)
        .send({ success: false, message: 'Validation error', issues: error.format() });
    }

    return reply.status(500).send({
      message: error.message,
      success: false,
    });
  });

  app.addHook('preHandler', (request, _, done) => {
    if (!request.url.includes('documentation')) {
      request.log.info(
        `IN [${request.method}] - ${request.url} ${request.method !== 'GET' ? `- [BODY]: ${JSON.stringify(request.body)}` : ''}`,
      );
    }

    done();
  });
  app.addHook('onSend', (request, reply, payload, done) => {
    if (!request.url.includes('documentation')) {
      request.log.info(
        `OUT: [${request.method}] - ${request.url} - [${reply.statusCode}]  \n ${payload}`,
      );
    }
    done();
  });
}
export default fastifyPlugin(interceptorLoggerHook);
