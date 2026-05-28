import { env } from '@/config/env';

interface HistoricoParams {
  proposta?: string;
  cpf?: string;
  limit?: number;
  paid_only?: boolean;
  session_token?: string;
}

interface AbertosParams {
  proposta?: string;
  cpf?: string;
  limit?: number;
  overdue_only?: boolean;
  strict_open_only?: boolean;
  session_token?: string;
}

interface ContextoParams {
  session_token: string;
}

export class HabibService {
  private baseUrl: string;
  private token: string;

  constructor() {
    this.baseUrl = env.HABIB_API_URL;
    this.token = env.HABIB_BEARER_TOKEN;
  }

  private async post(path: string, params: Record<string, unknown>) {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        body.append(key, String(value));
      }
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${this.token}`,
      },
      body: body.toString(),
    });

    return response.json();
  }

  async historico(params: HistoricoParams) {
    return this.post('/boletos/historico', params as Record<string, unknown>);
  }

  async abertos(params: AbertosParams) {
    return this.post('/boletos/abertos', params as Record<string, unknown>);
  }

  async contexto(params: ContextoParams) {
    return this.post('/portal/contexto', params as Record<string, unknown>);
  }
}
