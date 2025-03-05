import { buildJsonSchemas } from 'fastify-zod';
import { z } from 'zod';

const helloWordRequestSchema = z.object({
  name: z.string(),
});

const helloWorldResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    content: z.string(),
  }),
  message: z.string().optional(),
});

export type HellWorldInput = z.infer<typeof helloWordRequestSchema>;

export const { schemas: helloWorldSchemas, $ref } = buildJsonSchemas(
  {
    helloWordRequestSchema,
    helloWorldResponseSchema,
  },
  {
    $id: 'helloWorldSchema',
  },
);
