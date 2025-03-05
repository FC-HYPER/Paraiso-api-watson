import { WatsonInput } from '@/models/watson.schema';
import { FastifyReply, FastifyRequest } from 'fastify';
import { WatsonAssistant } from 'services/watson.service';

const watsonAssistantInstance = new WatsonAssistant();

export async function sendMessageHandler(
  request: FastifyRequest<{ Body: WatsonInput }>,
  reply: FastifyReply,
) {
  try {
    const { input, context } = request.body;
    const response = await watsonAssistantInstance.sendMessage(input, context);
    
    return reply.status(200).send({
      success: true,
      data: response,
    });
  } catch (error) {
    return reply.status(500).send({
      error: 'Failed to communicate with Watson Assistant',
      details: error,
    });
  }
}
