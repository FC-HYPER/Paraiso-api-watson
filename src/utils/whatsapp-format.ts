/**
 * Ajuste do texto do agente para a formatação do WhatsApp.
 *
 * O modelo escreve em Markdown, e o WhatsApp usa outra marcação: negrito é
 * `*texto*`, não `**texto**`, e não existe título com `#`. Sem a conversão, o
 * cliente vê os asteriscos duplos e o `#` como texto (docs/03-middleware.md 3.5).
 *
 * Links em Markdown (`[texto](url)`) não mudam aqui: a trava do link oficial
 * (`official-links.ts`) depende desse formato. Eles viram texto simples no fim, com
 * `plainLinks`, porque o WhatsApp mostra o Markdown cru (teste ponta a ponta,
 * 03/11/2026).
 */

// `**texto**` e `__texto__`, sem espaço logo dentro dos marcadores, para não
// casar com asterisco solto no meio de uma frase.
const MARKDOWN_BOLD = /(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g;

// `# Título` até `###### Título`, no começo da linha.
const MARKDOWN_HEADING = /^#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm;

/** `[rótulo](url)`, o mesmo formato que `official-links.ts` lê. */
const MARKDOWN_LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/**
 * `[Área do Cliente](https://…)` vira `Área do Cliente: https://…`, e o WhatsApp torna
 * a URL clicável sozinho. Rótulo que já é o endereço, com ou sem `https://`, vira só a
 * URL. `mailto:` e `tel:` saem do endereço.
 */
/**
 * URL colada no `*` que fecha um negrito: `*Área do Cliente: https://…*` sai de
 * `**[Área do Cliente](…)**`, e o WhatsApp levaria o asterisco para dentro do link
 * (bateria de 19/11/2026). O negrito fecha antes da URL.
 */
const BOLD_ENDING_IN_URL = /\*([^*\n]*?)(https?:\/\/[^\s*]+?)\*/g;

export function plainLinks(text: string): string {
  return convertLinks(text).replace(BOLD_ENDING_IN_URL, (_, before: string, url: string) => {
    const label = before.trimEnd();
    return label ? `*${label}* ${url}` : url;
  });
}

function convertLinks(text: string): string {
  return text.replace(MARKDOWN_LINK, (_, label: string, url: string) => {
    const target = url.replace(/^(?:mailto|tel):/i, '');
    const bare = (value: string) =>
      value
        .replace(/[*_]/g, '')
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/\/$/, '')
        .toLowerCase();
    return bare(label) === bare(target) ? target : `${label}: ${target}`;
  });
}

export function toWhatsAppText(text: string): string {
  return (
    text
      .replace(MARKDOWN_BOLD, '*$2*')
      // O título pode já vir em negrito (`## **Título**`); tira os asteriscos de
      // volta antes de envolver, para não sair `***Título***`.
      .replace(MARKDOWN_HEADING, (_, title: string) => `*${title.replace(/^\*+|\*+$/g, '')}*`)
  );
}
