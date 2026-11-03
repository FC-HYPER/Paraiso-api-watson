/**
 * Quando uma mensagem começa conversa nova com o Habib (thread nova no Orchestrate).
 *
 * A Aspa reenvia o último `context` que devolvemos, inclusive depois do "Reiniciar"
 * (docs/02-decisoes.md 2.1). Sem esta regra, o cliente ficaria na mesma thread até a
 * retenção do Orchestrate apagá-la. Quem separa as conversas é o middleware:
 *
 * - na entrada, sem `thread_id` ou com a última mensagem há mais de `idleHours`,
 *   a run sai sem `thread_id` e o Orchestrate cria uma thread nova;
 * - na saída, `thread_id` não volta quando a conversa sai do Habib (ver o
 *   controller), e `last_message_at` sempre volta.
 *
 * A mesma marca de conversa nova vai servir à saudação do primeiro contato
 * (docs/01-pendencias.md 1.2).
 */

export type NewConversationReason = 'no_thread' | 'idle';

export interface ConversationState {
  /** `thread_id` a usar na run; ausente em conversa nova. */
  threadId?: string;
  /** Presente só em conversa nova. */
  newConversation?: NewConversationReason;
  /** Horas desde a última mensagem, quando a marca veio no contexto. */
  idleHours?: number;
}

/**
 * Sem `last_message_at` (conversas abertas antes desta versão) ou com valor
 * ilegível, a thread continua: não dá para afirmar que a conversa esfriou, e
 * zerar sem motivo apagaria o histórico de quem está no meio do assunto.
 */
export function resolveConversation(
  context: { thread_id?: unknown; last_message_at?: unknown } | undefined,
  now: Date,
  idleHours: number,
): ConversationState {
  const threadId =
    typeof context?.thread_id === 'string' && context.thread_id !== ''
      ? context.thread_id
      : undefined;

  if (!threadId) return { newConversation: 'no_thread' };

  const last =
    typeof context?.last_message_at === 'string' ? Date.parse(context.last_message_at) : NaN;

  if (Number.isNaN(last)) return { threadId };

  const elapsed = (now.getTime() - last) / 3_600_000;

  if (elapsed > idleHours) return { newConversation: 'idle', idleHours: elapsed };

  return { threadId, idleHours: elapsed };
}
