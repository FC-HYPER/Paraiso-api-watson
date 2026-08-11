import { config } from 'dotenv';

import { z } from 'zod';

if (process.env.NODE_ENV === 'test') {
  config({ path: '.env.test', override: true });
} else {
  config();
}

export const envSchema = z.object({
  NODE_ENV: z.enum(['local', 'qas', 'test', 'production']).default('qas'),
  PORT: z.coerce.number().default(3333),
  API_KEY: z.string(),
  API_QAS_URL: z.string(),
  API_PRD_URL: z.string(),
  API_QAS_DESCRIPTION: z.string().optional(),
  API_PRD_DESCRIPTION: z.string().optional(),
  WATSON_API_KEY: z.string(),
  WATSON_ASSISTANT_ID: z.string(),
  WATSON_ENVIRONMENT_ID: z.string(),
});

const _env = envSchema.safeParse(process.env);

if (_env.success === false) {
  console.error('Invalid environment variables', _env.error.format());

  throw new Error('Invalid environment variables');
}

export const env = _env.data;
