// src/services/watson.service.ts
import AssistantV2 from 'ibm-watson/assistant/v2';
import { IamAuthenticator } from 'ibm-watson/auth';
import dotenv from 'dotenv';

dotenv.config();

export class WatsonAssistant {
  private assistant: AssistantV2;
  private assistantId: string;

  constructor() {
    this.assistant = new AssistantV2({
      version: '2024-08-25',
      authenticator: new IamAuthenticator({ apikey: process.env.WATSON_API_KEY || '' }),
    });

    this.assistantId = process.env.WATSON_ASSISTANT_ID || '';
  }

  async sendMessage(input: string, context?: object) {
    const payload: any = {
      assistantId: this.assistantId,
      environmentId: process.env.WATSON_ENVIRONMENT_ID || '',
      input: { message_type: 'text', text: input },
    };

    if (context && Object.keys(context).length > 0) {
      payload.context = context;
    }

    try {
      const response = await this.assistant.messageStateless(payload);
      return response.result;
    } catch (error) {
      console.error('Erro ao comunicar com Watson Assistant:', error);
      throw error;
    }
  }
}
