/**
 * Quando uma mensagem começa conversa nova com o Habib (thread nova no Orchestrate).
 *
 * A Aspa reenvia o último `context` que devolvemos, inclusive depois do "Reiniciar"
 * (docs/02-decisoes.md 2.1). Sem esta regra, o cliente ficaria na mesma thread até a
 * retenção do Orchestrate apagá-la. Quem separa as conversas é o middleware:
 *
 * - na entrada, sem `thread_id`, sem a marca `last_message_at` ou com a última
 *   mensagem há mais de `idleHours`, a run sai sem `thread_id` e o Orchestrate cria
 *   uma thread nova;
 * - na saída, `thread_id` não volta quando a conversa sai do Habib (ver o
 *   controller), e `last_message_at` sempre volta.
 *
 * A mesma marca decide a saudação do primeiro contato (`src/utils/greeting.ts`).
 */

export type NewConversationReason = 'no_thread' | 'no_marker' | 'idle';

export interface ConversationState {
  /** `thread_id` a usar na run; ausente em conversa nova. */
  threadId?: string;
  /** Presente só em conversa nova. */
  newConversation?: NewConversationReason;
  /** Horas desde a última mensagem, quando a marca veio no contexto. */
  idleHours?: number;
  /**
   * A resposta abre com a saudação. É conversa nova, a não ser que a resposta
   * anterior, dentro do prazo, tenha sido só a saudação (`greeted` no contexto): a
   * thread ainda não existe nesse caso, e saudar de novo seria saudar duas vezes.
   */
  greet: boolean;
}

/**
 * `thread_id` sem `last_message_at` é contexto gravado antes desta marca existir
 * (03/11/2026). Só a homologação tem esse caso, porque a produção ainda não passa pelo
 * Orchestrate, e lá ele é o telefone de teste preso a uma thread antiga: conta como
 * conversa nova. Marca ilegível também.
 */
export function resolveConversation(
  context: { thread_id?: unknown; last_message_at?: unknown; greeted?: unknown } | undefined,
  now: Date,
  idleHours: number,
): ConversationState {
  const threadId =
    typeof context?.thread_id === 'string' && context.thread_id !== ''
      ? context.thread_id
      : undefined;

  const last =
    typeof context?.last_message_at === 'string' ? Date.parse(context.last_message_at) : NaN;
  const elapsed = Number.isNaN(last) ? undefined : (now.getTime() - last) / 3_600_000;
  const idle = elapsed !== undefined && elapsed > idleHours;

  if (!threadId) {
    const alreadyGreeted = context?.greeted === true && elapsed !== undefined && !idle;
    return { newConversation: 'no_thread', idleHours: elapsed, greet: !alreadyGreeted };
  }

  if (elapsed === undefined) return { newConversation: 'no_marker', greet: true };

  if (idle) return { newConversation: 'idle', idleHours: elapsed, greet: true };

  return { threadId, idleHours: elapsed, greet: false };
}
