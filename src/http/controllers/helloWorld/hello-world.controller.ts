import { HellWorldInput } from '@/models/hello-world.schema';
import { FastifyReply, FastifyRequest } from 'fastify';

export async function helloWorldHandler(
  request: FastifyRequest<{ Body: HellWorldInput }>,
  reply: FastifyReply,
) {
  const { name } = request.body;
  return reply.status(200).send({
    data: {
      content: `Hello World, ${name}!`,
    },
    success: true,
  });
}
