/**
 * Afirmação de que o pedido foi registrado. Não existe registro nem protocolo, e as
 * instructions e o retorno da tool proíbem dizer isso; mesmo assim o `frontier` ainda
 * escreve "Já registrei o que você trouxe" e "Seu pedido foi registrado" (23/10/2026).
 *
 * "Escritura registrada" e "boletos registrados no CPF" são termos dos KBs e não
 * casam: o padrão exige quem registrou (eu) ou o que foi registrado (o pedido).
 */
import { stripSentences } from '@/utils/handoff-offer';
import { TRANSFER_FALLBACK_MESSAGE } from '@/utils/transfer-fallback';

const REGISTRATION_CLAIM = new RegExp(
  '(?<!\\p{L})(?:' +
    [
      'registrei',
      'deixei (tudo )?registrad[oa]',
      '(pedido|solicitação|atendimento|reclamação|demanda|caso)[^.!?\\n]{0,30}(foi|está|ficou|fica|foram) registrad[oa]s?',
    ].join('|') +
    ')',
  'iu',
);

export interface RegistrationClaimResult {
  text: string;
  removed: boolean;
}

/**
 * Com transferência, a afirmação costuma vir na mesma frase que avisa que a equipe
 * continua a conversa; tirar a frase tiraria o aviso. Por isso a resposta inteira vira
 * o texto aprovado da transferência. Sem transferência, só a frase sai.
 */
export function removeRegistrationClaim(text: string, handoff: boolean): RegistrationClaimResult {
  if (!REGISTRATION_CLAIM.test(text)) return { text, removed: false };
  if (handoff) return { text: TRANSFER_FALLBACK_MESSAGE, removed: true };
  return stripSentences(text, REGISTRATION_CLAIM);
}
