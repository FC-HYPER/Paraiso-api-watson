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

const contextSchema = z.record(z.unknown());

/**
 * Cada linha do `runs/stream` é um evento `{ id, event, data }`. Os campos de
 * `data` variam por tipo de evento, por isso são lidos à parte, só nos eventos
 * que usamos.
 */
const runEventSchema = z.object({
  event: z.string(),
  data: z.record(z.unknown()).default({}),
});

/** Campos que aparecem em vários eventos. Todos opcionais: nenhum evento traz todos. */
const runIdsSchema = z
  .object({
    thread_id: z.string().optional(),
    run_id: z.string().optional(),
    trace_id: z.string().optional(),
  })
  .passthrough();

/** `message.created`: a mensagem completa do assistente, com o contexto da run. */
const messageCreatedSchema = z
  .object({
    message: z
      .object({
        content: z
          .array(
            z
              .object({ response_type: z.string().optional(), text: z.string().optional() })
              .passthrough(),
          )
          .default([]),
        context: contextSchema.nullish(),
      })
      .passthrough(),
  })
  .passthrough();

/**
 * `run.completed` e `done` trazem o contexto final da run. Testado em 21/10/2026:
 * a variável gravada por tool só aparece aqui se estiver em `context_variables`
 * do agente. Ver docs/04-pendencias.md 4.5.
 */
const runCompletedSchema = z.object({ context: contextSchema.nullish() }).passthrough();

/**
 * Tipos de conteúdo cujo `text` vai para o cliente. Resposta vinda da base de
 * conhecimento chega como `conversational_search`, não como `text` (21/10/2026);
 * o `chat/completions` achatava os dois e escondia a diferença.
 */
const TEXT_RESPONSE_TYPES = new Set(['text', 'conversational_search']);

/** Eventos que encerram a run com falha. */
const FAILURE_EVENTS = new Set(['run.failed', 'run.cancelled', 'run.expired', 'error']);

/** O detalhe de falha vai para o log, nunca para o gateway. Limitado para não inundar o log. */
const FAILURE_DETAIL_MAX = 500;

export interface SendMessageParams {
  message: string;
  /** Ausente na primeira mensagem da conversa. */
  threadId?: string;
  /** Contexto do usuário repassado ao agente. */
  context?: Record<string, unknown>;
}

export interface SendMessageResult {
  reply: string;
  /** Contexto final da run, incluindo o que as tools gravaram. */
  context: Record<string, unknown>;
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

interface RunOutcome {
  reply: string;
  context: Record<string, unknown>;
  threadId?: string;
  runId?: string;
  traceId?: string;
  /** Quantos eventos válidos o stream trouxe. Zero significa resposta irreconhecível. */
  eventCount: number;
  /** Recebeu `run.completed`. Sem ele, a run pode ter sido cortada no meio. */
  completed: boolean;
  /** O agente disparou um workflow assíncrono; a resposta virá depois, pela thread. */
  asyncFlow: boolean;
  /** Tipos de conteúdo que não são texto e foram ignorados (formulário, opção etc.). */
  skippedTypes: string[];
  failure?: string;
}

/**
 * Lê o corpo inteiro do `runs/stream`. O formato observado em 21/10/2026 é um
 * JSON por linha; o prefixo `data:` do SSE clássico também é aceito, para o
 * parse não quebrar se a IBM mudar o enquadramento.
 */
function parseRunStream(body: string): RunOutcome {
  const outcome: RunOutcome = {
    reply: '',
    context: {},
    eventCount: 0,
    completed: false,
    asyncFlow: false,
    skippedTypes: [],
  };
  const texts: string[] = [];
  let messageContext: Record<string, unknown> | undefined;
  let finalContext: Record<string, unknown> | undefined;

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^data:\s*/, '');
    if (!line.startsWith('{')) continue;

    let json: unknown;
    try {
      json = JSON.parse(line);
    } catch {
      continue;
    }

    const parsed = runEventSchema.safeParse(json);
    if (!parsed.success) continue;

    const { event, data } = parsed.data;
    outcome.eventCount += 1;

    const ids = runIdsSchema.safeParse(data);
    if (ids.success) {
      outcome.threadId ??= ids.data.thread_id;
      outcome.runId ??= ids.data.run_id;
      outcome.traceId ??= ids.data.trace_id;
    }

    if (event === 'message.created') {
      const created = messageCreatedSchema.safeParse(data);
      if (!created.success) continue;

      for (const item of created.data.message.content) {
        if (item.response_type && TEXT_RESPONSE_TYPES.has(item.response_type) && item.text) {
          texts.push(item.text);
        } else if (item.response_type) {
          outcome.skippedTypes.push(item.response_type);
        }
      }
      messageContext = created.data.message.context ?? messageContext;
    } else if (event === 'run.completed' || event === 'done') {
      outcome.completed ||= event === 'run.completed';
      const completed = runCompletedSchema.safeParse(data);
      if (completed.success && completed.data.context) {
        // `run.completed` chega antes de `done` e tem precedência.
        finalContext ??= completed.data.context;
      }
    } else if (event === 'flow.slot.listen') {
      outcome.asyncFlow = true;
    } else if (FAILURE_EVENTS.has(event)) {
      outcome.failure = `${event}: ${JSON.stringify(data).slice(0, FAILURE_DETAIL_MAX)}`;
    }
  }

  // Mais de uma mensagem na mesma run vira um texto só, como na rota antiga.
  // A Aspa aceita vários itens em `generic`; separar fica para quando houver uso.
  outcome.reply = texts.join('\n\n').trim();
  outcome.context = finalContext ?? messageContext ?? {};

  return outcome;
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
        // `runs/stream` em vez de `chat/completions`: é o único que devolve o
        // contexto gravado pelas tools na própria resposta (`run.completed`).
        // Ver docs/04-pendencias.md 4.5.
        return await fetch(`${env.WXO_INSTANCE_URL}/v1/orchestrate/runs/stream`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agent_id: env.WXO_AGENT_ID,
            message: { role: 'user', content: message },
            // Mantém o estado da conversa do lado do Orchestrate. Ausente na
            // primeira mensagem: a run cria a thread e devolve o id nos eventos.
            ...(threadId && { thread_id: threadId }),
            // Só chega à run, e só volta dela, o que estiver em
            // `context_variables` do agente. Ver docs/04-pendencias.md 4.5.
            ...(context && Object.keys(context).length > 0 && { context }),
          }),
          // Cobre a conexão e a leitura do stream inteiro, não só a primeira resposta.
          signal: AbortSignal.timeout(env.WXO_TIMEOUT_MS),
        });
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

    // O middleware espera a run terminar e responde ao gateway uma vez só; o
    // stream é lido inteiro antes do parse. O timeout do `call` continua valendo.
    let raw: string;
    try {
      raw = await response.text();
    } catch (error) {
      if (isTimeout(error)) {
        throw new OrchestrateError(504, `Agent run timed out after ${env.WXO_TIMEOUT_MS}ms`);
      }
      throw new OrchestrateError(502, 'Network failure while reading the agent stream');
    }

    const run = parseRunStream(raw);
    const ids = `run_id=${run.runId ?? '-'} trace_id=${run.traceId ?? '-'}`;

    if (run.eventCount === 0) {
      throw new OrchestrateError(
        502,
        'Unexpected watsonx Orchestrate response',
        raw.slice(0, FAILURE_DETAIL_MAX),
      );
    }

    if (run.failure) {
      throw new OrchestrateError(502, 'Agent run failed', `${ids} ${run.failure}`);
    }

    if (run.asyncFlow) {
      logger?.warn(`[orchestrate] async flow started, reply will arrive on the thread - ${ids}`);
    }

    if (!run.completed) {
      logger?.warn(`[orchestrate] stream ended without run.completed - ${ids}`);
    }

    if (run.skippedTypes.length > 0) {
      logger?.warn(
        `[orchestrate] non-text content ignored (${run.skippedTypes.join(', ')}) - ${ids}`,
      );
    }

    if (!run.reply) {
      logger?.warn(`[orchestrate] empty reply - ${ids}`);
    }

    return {
      reply: run.reply,
      context: run.context,
      threadId: run.threadId ?? threadId,
      runId: run.runId,
      traceId: run.traceId,
    };
  }
}
