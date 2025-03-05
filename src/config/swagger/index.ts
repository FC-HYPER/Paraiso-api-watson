import { env } from '@/config/env';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { FastifyInstance } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { withRefResolver } from 'fastify-zod';

interface IServer {
  url: string;
  description: string | undefined;
}
function buildServersSchema() {
  const servers: IServer[] = [];

  if (env.NODE_ENV === 'local') {
    servers.unshift({
      url: `http://localhost:${env.PORT}`,
      description: 'Localhost',
    });
  } else {
    servers.push(
      { url: env.API_QAS_URL, description: env.API_QAS_DESCRIPTION },
      { url: env.API_PRD_URL, description: env.API_PRD_DESCRIPTION },
    );
  }
  return servers;
}
export async function buildSwaggerOpenApi(app: FastifyInstance) {
  await app.register(
    fastifySwagger,
    withRefResolver({
      openapi: {
        openapi: '3.0.0',
        info: {
          title: 'API - Chatbot Paraíso URA',
          version: '1',
        },
        servers: buildServersSchema(),
        paths: {},
        tags: [{ name: 'HelloWorld' }, { name: 'SendMessage' }],
        components: {
          securitySchemes: {
            apiKey: {
              type: 'apiKey',
              name: 'apiKey',
              in: 'header',
            },
          },
        },
      },
    }),
  );

  await app.register(fastifySwaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject) => {
      return swaggerObject;
    },
    transformSpecificationClone: true,
  });
}

export default fastifyPlugin(buildSwaggerOpenApi);
