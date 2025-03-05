import { env } from '@/config/env';
import { FastifyReply, FastifyRequest } from 'fastify';

export async function validateApiKey(request: FastifyRequest, reply: FastifyReply) {
  if (request.headers.apikey !== env.APIKEY) {
    return reply.status(401).send({
      success: 'false',
      message: 'Wrong API key or missing',
    });
  }
}
