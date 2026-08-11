import { buildJsonSchemas } from 'fastify-zod';
import { z } from 'zod';

/**
 * Contrato preservado do `/api/watson/message`: o `thread_id` viaja dentro de
 * `context`, que o gateway da Aspa trata como caixa-preta — guarda o que
 * devolvemos e reenvia na mensagem seguinte. Ver docs/03-middleware.md 3.3.
 *
 * `passthrough` porque o gateway pode carregar outras chaves no contexto; elas
 * seguem para o agente. Sem isso o Fastify as descartaria.
 */
const messageContextSchema = z.object({ thread_id: z.string().optional() }).passthrough();

const messageRequestSchema = z.object({
  input: z.string(),
  context: messageContextSchema.optional(),
});

/**
 * TODOS os campos precisam estar declarados aqui. O Fastify serializa pelo schema
 * e descarta em silêncio o que não estiver declarado — foi assim que o campo
 * `integration` desapareceu na implementação atual.
 *
 * ⚠️ Antes de emitir anexo, estenda `generic` aqui primeiro. O gateway da Aspa
 * percorre o array inteiro e aceita `text` **ou** `attachment` (URL de download
 * desprotegida), mas um campo `attachment` adicionado só no controller seria
 * descartado na serialização, sem erro nenhum. Confirmar antes com a Aspa a forma
 * exata que eles esperam. Ver docs/04-pendencias.md 4.1.
 */
const messageResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    output: z.object({
      generic: z.array(
        z.object({
          response_type: z.string(),
          text: z.string(),
        }),
      ),
    }),
    context: z.object({
      thread_id: z.string().optional(),
    }),
  }),
});

const messageErrorSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type MessageInput = z.infer<typeof messageRequestSchema>;
export type MessageResponse = z.infer<typeof messageResponseSchema>;

export const { schemas: messageSchemas, $ref } = buildJsonSchemas(
  {
    messageRequestSchema,
    messageResponseSchema,
    messageErrorSchema,
  },
  { $id: 'messageSchema' },
);
