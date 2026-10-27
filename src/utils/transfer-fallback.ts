/**
 * Transferência feita pelo middleware quando a `transfer_to_human` não executa (o
 * executor de tools da IBM falha com `i/o timeout`, 23/10/2026). O stream traz os
 * argumentos que o agente escolheu; com eles o middleware grava o mesmo contexto que
 * a tool gravaria e responde com texto fixo, no lugar do que o LLM improvisou.
 *
 * Expediente, feriados e texto de fora do expediente repetem os de
 * `orchestrate/tools/transfer_to_human.py`: mudar nos dois lugares juntos.
 */
import { ASPA_DESTINATIONS } from '@/utils/aspa-control';

/** Texto aprovado em 23/10/2026. */
export const TRANSFER_FALLBACK_MESSAGE =
  'Vou te encaminhar para a equipe responsável, que continua a conversa por aqui mesmo. ' +
  'Para agilizar, envie seu CPF/CNPJ ou número do contrato.';

/**
 * Fora do expediente a transferência também acontece: a Aspa deixa o atendimento na
 * fila até alguém assumir (André, 23/10/2026). Texto aprovado em 23/10/2026.
 */
export const OUT_OF_HOURS_MESSAGE =
  'Nosso atendimento humano funciona de segunda a sexta-feira, das 9h às 18h, exceto ' +
  'feriados. 🙂 Seu atendimento já está na fila, e a equipe responsável continua a ' +
  'conversa por aqui no próximo horário de atendimento, sem que você precise enviar tudo ' +
  'de novo. Para agilizar, envie seu CPF/CNPJ ou número do contrato.';

/** Fuso fixo de -3h: o Brasil não tem horário de verão desde 2019. */
const UTC_OFFSET_HOURS = -3;
const OPENING_HOUR = 9;
const CLOSING_HOUR = 18;

/** Dias sem atendimento humano, além de sábado e domingo. Mesma lista da tool. */
const HOLIDAYS = new Set([
  '2026-11-02', // Finados
  '2026-11-20', // Consciência Negra
  '2026-12-25', // Natal
  '2027-01-01', // Confraternização Universal
  '2027-02-08', // Carnaval (ponto facultativo: confirmar com a Jô)
  '2027-02-09', // Carnaval (ponto facultativo: confirmar com a Jô)
  '2027-03-26', // Sexta-feira Santa
  '2027-04-21', // Tiradentes
  '2027-05-27', // Corpus Christi (ponto facultativo: confirmar com a Jô)
  '2027-09-07', // Independência
  '2027-09-08', // Nossa Senhora da Luz, feriado de Curitiba (confirmar com a Jô)
  '2027-10-12', // Nossa Senhora Aparecida
  '2027-11-02', // Finados
  '2027-11-15', // Proclamação da República
]);

/** Destino sem equipe na tool: a Aspa manda para o TIME, a fila geral. */
const GENERAL = 'Geral';

export function isWithinBusinessHours(now: Date): boolean {
  // Deslocar o instante e ler em UTC dá a hora local sem depender do fuso da máquina.
  const local = new Date(now.getTime() + UTC_OFFSET_HOURS * 60 * 60 * 1000);
  const weekday = local.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  if (HOLIDAYS.has(local.toISOString().slice(0, 10))) return false;
  const hour = local.getUTCHours();
  return hour >= OPENING_HOUR && hour < CLOSING_HOUR;
}

/** Argumentos da chamada da `transfer_to_human`, como vieram do stream. Não confiáveis. */
export interface TransferArgs {
  destination?: unknown;
  summary?: unknown;
}

export interface TransferFallback {
  /** Texto que vai ao cliente no lugar da resposta do agente. */
  text: string;
  /** Contexto no formato que a tool gravaria, para o `buildAspaControl`. */
  context: Record<string, unknown>;
}

export function buildTransferFallback(args: TransferArgs, now: Date): TransferFallback {
  const context: Record<string, unknown> = { atendimento_humano: true };
  // Destino fora do mapa vai para a fila geral: com `distribuicao` inválida, o
  // `buildAspaControl` descartaria a transferência inteira.
  if (
    typeof args.destination === 'string' &&
    args.destination !== GENERAL &&
    ASPA_DESTINATIONS.has(args.destination)
  ) {
    context.distribuicao = args.destination;
  }
  if (typeof args.summary === 'string') context.handoff_summary = args.summary;

  const text = isWithinBusinessHours(now) ? TRANSFER_FALLBACK_MESSAGE : OUT_OF_HOURS_MESSAGE;
  return { text, context };
}
