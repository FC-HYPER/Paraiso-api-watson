import { WatsonInput } from '@/models/watson.schema';
import { FastifyReply, FastifyRequest } from 'fastify';
import { WatsonAssistant } from 'services/watson.service';
import { HabibService } from 'services/habib.service';

const watsonAssistantInstance = new WatsonAssistant();
const habibService = new HabibService();

export async function sendMessageHandler(
  request: FastifyRequest<{ Body: WatsonInput }>,
  reply: FastifyReply,
) {
  try {
    const { input, context } = request.body;

    const response = await watsonAssistantInstance.sendMessage(input, context);

    const userDefined = response?.context?.skills?.['main skill']?.user_defined;
    const integration: string | undefined = userDefined?.integration;
    const integrationParams = userDefined?.integration_params ?? {};

    let integrationData = null;

    if (integration === 'historico') {
      integrationData = await habibService.historico(integrationParams);
    } else if (integration === 'abertos') {
      integrationData = await habibService.abertos(integrationParams);
    } else if (integration === 'contexto') {
      integrationData = await habibService.contexto(integrationParams);
    }

    return reply.status(200).send({
      success: true,
      data: response,
      ...(integrationData && { integration: integrationData }),
    });
  } catch (error) {
    return reply.status(500).send({
      error: 'Failed to communicate with Watson Assistant',
      details: error,
    });
  }
}
