import { FastifyInstance } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { ZodError } from 'zod';

/**
 * Erros de validação do Fastify chegam aqui com `statusCode` 400. Sem honrar esse
 * valor, requisição malformada virava 500 e o gateway não distinguia erro dele de
 * falha da IBM. Restrito a 4xx: 5xx continua respondendo 500, para não expor
 * status interno.
 */
function clientErrorStatus(error: unknown): number | undefined {
  const status = (error as { statusCode?: unknown } | null)?.statusCode;

  return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined;
}

export async function interceptorLoggerHook(app: FastifyInstance) {
  app.setErrorHandler((error, _, reply) => {
    if (error instanceof ZodError) {
      return reply
        .status(400)
        .send({ success: false, message: 'Validation error', issues: error.format() });
    }

    return reply.status(clientErrorStatus(error) ?? 500).send({
      message: error instanceof Error ? error.message : 'Internal server error',
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
