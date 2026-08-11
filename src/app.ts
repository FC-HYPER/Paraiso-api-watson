import { env } from '@/config/env';
import routesMapper from '@/utils/constants/routes-mapper';
import { FastifyInstance } from 'fastify';

import { interceptorLoggerHook } from '@/http/middlewares/interceptor-logger';
import { buildSwaggerOpenApi } from '@/config/swagger';
import { helloWorldSchemas } from '@/models/hello-world.schema';
import { messageSchemas } from '@/models/message.schema';
import { watsonSchemas } from '@/models/watson.schema';

export default async function (app: FastifyInstance) {
  app.register(interceptorLoggerHook);
  helloWorldSchemas.forEach((schema) => app.addSchema(schema));
  watsonSchemas.forEach((schema) => app.addSchema(schema));
  messageSchemas.forEach((schema) => app.addSchema(schema));

  // Documentação fora de produção. O `/documentation` não tem autenticação: expõe o
  // contrato inteiro da API a qualquer um, e o `@fastify/static` que serve os
  // arquivos do Swagger UI tem path traversal e bypass de guarda de rota em aberto
  // (corrigir exige subir para swagger-ui@6, breaking). Não registrar em produção
  // elimina a exposição em vez de administrá-la.
  //
  // ⚠️ Depende de `NODE_ENV=production` estar cadastrada na aplicação de produção.
  // Sem isso o schema assume o padrão `qas` e a documentação continua publicada.
  if (env.NODE_ENV !== 'production') {
    app.register(buildSwaggerOpenApi);
  }

  routesMapper.forEach((route) => {
    app.register(route);
  });
  app.ready(() => {
    console.log(app.printRoutes());
  });
}
