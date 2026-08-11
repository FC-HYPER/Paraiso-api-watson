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
  WXO_INSTANCE_URL: z
    .string()
    .url()
    .transform((url) => url.replace(/\/+$/, '')),
  WXO_API_KEY: z.string(),
  WXO_AGENT_ID: z.string(),
  // Opcional: tem padrão, por isso não precisa ser cadastrada no Code Engine.
  // O preprocess trata variável cadastrada com valor vazio, que seria convertida
  // para 0 e abortaria toda requisição imediatamente.
  //
  // 60s: o gateway da Aspa espera 3 minutos e recomenda ficar dentro de 2, então
  // somos o elo mais curto da cadeia. Hoje o agente responde em 2 a 4 segundos, mas
  // isso vai subir quando ele passar a chamar tools — e abortar aos 30s uma
  // requisição que o gateway ainda esperaria por dois minutos seria desperdício.
  WXO_TIMEOUT_MS: z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.coerce.number().int().positive().default(60_000),
  ),
});

const _env = envSchema.safeParse(process.env);

if (_env.success === false) {
  console.error('Invalid environment variables', _env.error.format());

  throw new Error('Invalid environment variables');
}

export const env = _env.data;
