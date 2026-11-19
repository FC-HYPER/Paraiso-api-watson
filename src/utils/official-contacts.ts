import { stripSentences } from '@/utils/handoff-offer';

/**
 * Retira da resposta a frase com e-mail ou telefone que não está na lista oficial. O
 * prompt proíbe inventar contato, mas não garante (docs/02-decisoes.md 2.3, "Regra
 * fixa"); esta é a camada 3, como a correção do link da Área do Cliente.
 *
 * A lista é a dos KBs validados (`kbs em word v2`) mais a regra CONTATOS OFICIAIS das
 * instructions. Contato novo num KB precisa entrar aqui, senão a frase sai da resposta.
 */

const OFFICIAL_EMAILS = new Set([
  'sac@paraisogold.com.br', // kb_institucional
  'compras@abecker.com.br', // kb_contrato_lote_construcao_terreno
  'posvenda@abecker.com.br', // kb_contrato_lote_construcao_terreno
]);

/** Só dígitos, com DDD e sem o 55. */
const OFFICIAL_PHONES = new Set([
  '4130232882', // (41) 3023-2882, kb_institucional
  '4738420124', // (47) 3842-0124, kb_institucional
  '08006452882', // 0800 645 2882, kb_institucional
  '4130947700', // (41) 3094-7700, Cartório Volpi, kb_escritura_registro
]);

const EMAIL = /[\p{L}\d._%+-]+@[\p{L}\d-]+(?:\.[\p{L}\d-]+)+/gu;

/**
 * Telefone com DDD entre parênteses, com DDD separado por espaço ou hífen, com +55 ou
 * 0800/0300. Número de oito dígitos sem DDD não conta: casaria com intervalo de anos
 * ("2026-2027"). CEP (5-3), CPF e número de contrato sem separador não casam.
 */
const PHONE = new RegExp(
  '(?<![\\d/=.-])(?:' +
    [
      '(?:\\+?55[\\s.-]?)?\\(\\d{2}\\)\\s?9?\\d{4}[\\s.-]?\\d{4}',
      '(?:\\+?55[\\s.-]?)?\\d{2}[\\s.-]9?\\d{4}[\\s.-]\\d{4}',
      '\\+55\\s?\\d{2}\\s?9?\\d{4}[\\s.-]?\\d{4}',
      '0[38]00[\\s.-]?\\d{3}[\\s.-]?\\d{4}',
      '9\\d{4}-\\d{4}',
    ].join('|') +
    ')(?!\\d)',
  'g',
);

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 12 && digits.startsWith('55') ? digits.slice(2) : digits;
}

/** E-mails e telefones do texto que não estão na lista oficial. */
export function findUnofficialContacts(text: string): string[] {
  const emails = (text.match(EMAIL) ?? []).filter(
    (email) => !OFFICIAL_EMAILS.has(email.toLowerCase()),
  );
  const phones = (text.match(PHONE) ?? []).filter(
    (phone) => !OFFICIAL_PHONES.has(normalizePhone(phone)),
  );
  return [...emails, ...phones];
}

/** Texto para quando a resposta inteira era a frase retirada, como pede SEM CONSULTA, SEM RESPOSTA. */
export const NO_INFORMATION_TEXT = 'Não tenho essa informação disponível.';

export interface ContactCheckResult {
  text: string;
  /** Contatos retirados, para o log. Não são dado do cliente: são o que o agente escreveu. */
  removed: string[];
}

export function removeUnofficialContacts(text: string): ContactCheckResult {
  const removed = findUnofficialContacts(text);
  if (removed.length === 0) return { text, removed };

  const unofficial = new RegExp(removed.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));
  const stripped = stripSentences(text, unofficial);

  // `stripSentences` devolve o original quando não sobra nada; aqui o original não
  // pode ir, porque traz o contato inventado.
  return { text: stripped.removed ? stripped.text : NO_INFORMATION_TEXT, removed };
}
