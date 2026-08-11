import { env } from '@/config/env';
import { z } from 'zod';

const IAM_TOKEN_URL = 'https://iam.cloud.ibm.com/identity/token';

/**
 * O token IAM vale 3600s. Renovamos com 10min de margem porque a requisição pode
 * sair daqui com o token válido e chegar na IBM já vencido (latência, fila,
 * diferença de relógio). Nunca trabalhar no limite.
 */
const TOKEN_SKEW_MS = 10 * 60 * 1000;

const IAM_TIMEOUT_MS = 10_000;

/** Erro tratado: não repassa o corpo cru da IBM para o gateway. */
export class OrchestrateError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = 'OrchestrateError';
  }
}

const iamTokenSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
});

/**
 * Endpoints compatíveis com OpenAI devolvem `content` como texto ou como lista
 * de partes. A instância respondeu com texto, mas as duas formas são aceitas
 * para o parse não quebrar caso o agente passe a emitir partes.
 */
const contentSchema = z.union([
  z.string(),
  z.array(z.object({ type: z.string().optional(), text: z.string().optional() })),
]);

const chatCompletionSchema = z
  .object({
    id: z.string().optional(),
    object: z.string().optional(),
    created: z.number().optional(),
    model: z.string().optional(),
    choices: z
      .array(
        z
          .object({
            index: z.number().optional(),
            finish_reason: z.string().nullish(),
            message: z
              .object({
                role: z.string().optional(),
                content: contentSchema.nullish(),
              })
              .optional(),
          })
          .passthrough(),
      )
      .default([]),
    thread_id: z.string().optional(),
    run_id: z.string().optional(),
    trace_id: z.string().optional(),
  })
  .passthrough();

export interface SendMessageParams {
  message: string;
  /** Ausente na primeira mensagem da conversa. */
  threadId?: string;
  /** Contexto do usuário repassado ao agente. */
  context?: Record<string, unknown>;
}

export interface SendMessageResult {
  reply: string;
  threadId?: string;
  /** Identificam a execução no painel do Orchestrate. Vão para o log. */
  runId?: string;
  traceId?: string;
}

/** Subconjunto do logger do Fastify usado aqui. */
export interface OrchestrateLogger {
  info(message: string): void;
  warn(message: string): void;
}

function extractReply(content: z.infer<typeof contentSchema> | null | undefined): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => part.text ?? '')
      .join('')
      .trim();
  }
  return '';
}

function isTimeout(error: unknown): boolean {
  return (
    error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
  );
}

export class OrchestrateAgent {
  private token?: string;
  private expiresAt = 0;
  /** Evita que N requisições simultâneas disparem N chamadas ao IAM. */
  private inFlight?: Promise<string>;

  private async requestToken(): Promise<string> {
    let response: Response;

    try {
      response = await fetch(IAM_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
          apikey: env.WXO_API_KEY,
        }),
        signal: AbortSignal.timeout(IAM_TIMEOUT_MS),
      });
    } catch (error) {
      if (isTimeout(error)) {
        throw new OrchestrateError(504, 'IAM token request timed out');
      }
      throw new OrchestrateError(502, 'Network failure while requesting IAM token');
    }

    if (!response.ok) {
      throw new OrchestrateError(
        502,
        'Failed to obtain IAM token',
        `HTTP ${response.status}: ${await response.text().catch(() => '')}`,
      );
    }

    const parsed = iamTokenSchema.safeParse(await response.json().catch(() => null));

    if (!parsed.success) {
      throw new OrchestrateError(502, 'Unexpected IAM response');
    }

    this.token = parsed.data.access_token;
    this.expiresAt = Date.now() + parsed.data.expires_in * 1000;

    return this.token;
  }

  private async getToken(force = false, logger?: OrchestrateLogger): Promise<string> {
    if (!force && this.token && Date.now() < this.expiresAt - TOKEN_SKEW_MS) {
      return this.token;
    }

    if (!force && this.inFlight) return this.inFlight;

    logger?.info(`[orchestrate] refreshing IAM token${force ? ' (forced by 401)' : ''}`);

    const pending = this.requestToken();
    this.inFlight = pending;

    try {
      return await pending;
    } finally {
      if (this.inFlight === pending) this.inFlight = undefined;
    }
  }

  async sendMessage(
    { message, threadId, context }: SendMessageParams,
    logger?: OrchestrateLogger,
  ): Promise<SendMessageResult> {
    const call = async (token: string): Promise<Response> => {
      try {
        return await fetch(
          `${env.WXO_INSTANCE_URL}/v1/orchestrate/${env.WXO_AGENT_ID}/chat/completions`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              // Mantém o estado da conversa do lado do Orchestrate.
              ...(threadId && { 'X-IBM-THREAD-ID': threadId }),
            },
            body: JSON.stringify({
              // Uma mensagem só, de propósito. O Orchestrate lê apenas a última
              // mensagem `user`: histórico no array, `role: system` e `developer`
              // são aceitos com 200 e descartados. O histórico vem da thread.
              messages: [{ role: 'user', content: message }],
              // Verificado em 11/08/2026: a plataforma também ignora este campo —
              // o agente não enxerga os valores. Mantido porque custa zero e é o
              // canal previsto pela API. Não gaste tempo depurando por que um dado
              // colocado aqui não chega ao agente. Ver docs/04-pendencias.md 4.3.
              ...(context && Object.keys(context).length > 0 && { context }),
              // Explícito: o padrão da API é true, e streaming quebraria o parse.
              stream: false,
            }),
            signal: AbortSignal.timeout(env.WXO_TIMEOUT_MS),
          },
        );
      } catch (error) {
        if (isTimeout(error)) {
          throw new OrchestrateError(
            504,
            `Agent request timed out after ${env.WXO_TIMEOUT_MS}ms`,
          );
        }
        throw new OrchestrateError(502, 'Network failure while calling the agent');
      }
    };

    let response = await call(await this.getToken(false, logger));

    // Uma tentativa só. Duas falhas seguidas significam credencial errada, não
    // expiração — insistir transforma erro de configuração em tempestade de
    // requisições.
    if (response.status === 401) {
      response = await call(await this.getToken(true, logger));
    }

    if (!response.ok) {
      throw new OrchestrateError(
        502,
        'Failed to communicate with watsonx Orchestrate',
        `HTTP ${response.status}: ${await response.text().catch(() => '')}`,
      );
    }

    const parsed = chatCompletionSchema.safeParse(await response.json().catch(() => null));

    if (!parsed.success) {
      throw new OrchestrateError(502, 'Unexpected watsonx Orchestrate response');
    }

    const body = parsed.data;
    const reply = extractReply(body.choices[0]?.message?.content);

    if (!reply) {
      logger?.warn(
        `[orchestrate] empty reply - run_id=${body.run_id ?? '-'} trace_id=${body.trace_id ?? '-'}`,
      );
    }

    return {
      reply,
      threadId: body.thread_id ?? threadId,
      runId: body.run_id,
      traceId: body.trace_id,
    };
  }
}
