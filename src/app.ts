import routesMapper from '@/utils/constants/routes-mapper';
import { FastifyInstance } from 'fastify';

import { interceptorLoggerHook } from '@/http/middlewares/interceptor-logger';
import { buildSwaggerOpenApi } from '@/config/swagger';
import { helloWorldSchemas } from '@/models/hello-world.schema';

export default async function (app: FastifyInstance) {
  app.register(interceptorLoggerHook);
  helloWorldSchemas.forEach((schema) => app.addSchema(schema));
  app.register(buildSwaggerOpenApi);

  routesMapper.forEach((route) => {
    app.register(route);
  });
  app.ready(() => {
    console.log(app.printRoutes());
  });
}
