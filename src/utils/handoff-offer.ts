/**
 * Retira da resposta a frase em que o agente oferece encaminhar ("posso te
 * encaminhar", "me avise que te encaminho", "é só me avisar"). Pelas instructions o
 * Habib encaminha ou não encaminha, nunca oferece; mesmo assim o `frontier` oferece
 * nas perguntas que não transferem (quitação e IPTU em 4 de 4 respostas, 23/10/2026).
 * Aplicar só quando não houve transferência.
 */

/**
 * Frases de oferta de encaminhamento ou de ação que o agente não tem. Início de
 * palavra por lookbehind: o `\b` do JavaScript não reconhece letra acentuada ("é só").
 */
const OFFER_PATTERN = new RegExp(
  '(?<!\\p{L})(?:' +
    [
      '(posso|podemos) (te |lhe |o |a )?(encaminhar|transferir|direcionar)',
      '(te|lhe) (encaminho|transfiro|direciono)(?!\\p{L})',
      'quer que eu (te |lhe )?(encaminhe|transfira|direcione)',
      '(deseja|gostaria de|quer) ser (encaminhad|transferid|direcionad)',
      '(é só|basta) me (avisar|dizer|falar|chamar)',
      'me (avise|diga|fale|chame) que(?!\\p{L})',
    ].join('|') +
    ')',
  'iu',
);

/** Fim de frase seguido de espaço; pontos de URL e de número não têm espaço depois. */
const SENTENCE_BREAK = /(?<=[.!?…])\s+/;

/** Linha que, sem a frase retirada, sobrou só com emoji ou pontuação. */
const LEFTOVER = /^(?:[\s\p{Extended_Pictographic}.!?…,;:-]|️|‍)*$/u;

export interface OfferStripResult {
  text: string;
  removed: boolean;
}

export function stripHandoffOffer(text: string): OfferStripResult {
  return stripSentences(text, OFFER_PATTERN);
}

/**
 * Retira as frases que casam com `pattern`; as linhas sem nenhuma ficam idênticas.
 * Usada também pela trava de afirmação de registro (`registration-claim.ts`).
 */
export function stripSentences(text: string, pattern: RegExp): OfferStripResult {
  let removed = false;

  const lines = text.split('\n').flatMap((line) => {
    if (!pattern.test(line)) return [line];

    const kept = line.split(SENTENCE_BREAK).filter((sentence) => !pattern.test(sentence));
    removed = true;
    const rebuilt = kept.join(' ');
    return LEFTOVER.test(rebuilt) ? [] : [rebuilt];
  });

  if (!removed) return { text, removed };

  const stripped = lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Resposta que era só a frase retirada fica como está: vazia, viraria `generic`
  // vazio, e a Aspa transferiria para o TIME.
  return stripped ? { text: stripped, removed } : { text, removed: false };
}
