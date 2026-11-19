/**
 * Saudação do primeiro contato, com o texto da Jô, literal. O agente não garante texto
 * literal, e uma tool com `audience: user` substituiria a resposta à pergunta; por isso
 * ela sai do middleware (docs/02-decisoes.md 2.5).
 *
 * Em conversa nova (`src/utils/conversation.ts`):
 * - mensagem que é só cumprimento ("oi", "boa tarde, tudo bem?") recebe só a saudação,
 *   sem chamar o agente, para não saudar duas vezes;
 * - qualquer outra mensagem recebe a saudação como primeiro item do `generic`, antes da
 *   resposta do Habib.
 */

export const GREETING_TEXT =
  'Olá! Que bom receber você por aqui. 🙂 Sou o Habib, assistente virtual da Central Gold. Como posso ajudar hoje?';

/** Palavras que, sozinhas ou combinadas, formam só um cumprimento. Sem acento. */
const GREETING_WORDS = new Set([
  'oi', 'ola', 'opa', 'eai', 'e', 'ai', 'alo', 'hello', 'hi', 'hey',
  'bom', 'boa', 'dia', 'tarde', 'noite', 'tudo', 'bem', 'td', 'bm', 'blz', 'beleza',
  'como', 'vai', 'voce', 'vc', 'esta', 'ta', 'habib', 'saudacoes', 'pessoal',
]);

/** Pelo menos uma destas: "bem" ou "como vai" sozinhos não são cumprimento claro. */
const GREETING_CORE = new Set(['oi', 'ola', 'opa', 'eai', 'alo', 'hello', 'hi', 'hey', 'dia', 'tarde', 'noite', 'saudacoes']);

/** "oiii", "oie", "olaaa" e "opaa" contam como "oi", "ola" e "opa". */
function canonical(word: string): string {
  if (/^o+i+e?$/.test(word)) return 'oi';
  if (/^o+l+a+$/.test(word)) return 'ola';
  if (/^o+p+a+$/.test(word)) return 'opa';
  return word;
}

export function isGreetingOnly(input: string): boolean {
  const words = input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .replace(/\be ai\b/g, 'eai')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(canonical);

  if (words.length === 0 || words.length > 8) return false;

  return words.every((word) => GREETING_WORDS.has(word)) && words.some((word) => GREETING_CORE.has(word));
}

/**
 * Primeira frase do agente que é só um "Olá!" ou "Oi, tudo bem!", retirada quando a
 * saudação vai antes, para o cliente não ler dois "Olá" seguidos.
 */
const AGENT_OPENING = /^(?:ol[aá]|oi)(?![\p{L}])[^.!?\n]{0,30}[.!]\s+(?=\S)/iu;

export function dropAgentOpening(text: string): string {
  return text.replace(AGENT_OPENING, '');
}
