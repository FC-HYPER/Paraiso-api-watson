import { env } from '@/config/env';
import { loggerConfig } from '@/config/logger';
import fastify from 'fastify';
import buildServer from './app';
import crypto from 'node:crypto';

async function run() {
  const app = fastify({
    logger: {
      ...loggerConfig,
    },
    disableRequestLogging: true,
    genReqId: () => {
      return crypto.randomUUID();
    },
  });
  app.register(buildServer);
  try {
    await app
      .listen({
        port: env.PORT,
        host: '0.0.0.0',
      })
      .then(() => {
        console.log(`🚀 Server running on port ${env.PORT}`);
      });
  } catch (err) {
    app.log.error(err);
    console.error(err);
    process.exit(1);
  }
}
run();
