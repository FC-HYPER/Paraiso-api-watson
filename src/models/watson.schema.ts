import { z } from 'zod';
import { buildJsonSchemas } from 'fastify-zod';

export const watsonRequestSchema = z.object({
  input: z.string(),
  context: z.any().optional(),
});

const watsonResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
});

export type WatsonInput = z.infer<typeof watsonRequestSchema>;

export const { schemas: watsonSchemas, $ref } = buildJsonSchemas(
  {
    watsonRequestSchema,
    watsonResponseSchema,
  },
  { $id: 'watsonSchema' },
);
