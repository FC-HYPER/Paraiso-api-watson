/**
 * Ajuste do texto do agente para a formatação do WhatsApp.
 *
 * O modelo escreve em Markdown, e o WhatsApp usa outra marcação: negrito é
 * `*texto*`, não `**texto**`, e não existe título com `#`. Sem a conversão, o
 * cliente vê os asteriscos duplos e o `#` como texto (docs/04-pendencias.md 4.2).
 *
 * Links em Markdown (`[texto](url)`) ficam como estão: as instructions pedem esse
 * formato, e a decisão de convertê-los depende de como a Aspa entrega o texto.
 */

// `**texto**` e `__texto__`, sem espaço logo dentro dos marcadores, para não
// casar com asterisco solto no meio de uma frase.
const MARKDOWN_BOLD = /(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g;

// `# Título` até `###### Título`, no começo da linha.
const MARKDOWN_HEADING = /^#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm;

export function toWhatsAppText(text: string): string {
  return (
    text
      .replace(MARKDOWN_BOLD, '*$2*')
      // O título pode já vir em negrito (`## **Título**`); tira os asteriscos de
      // volta antes de envolver, para não sair `***Título***`.
      .replace(MARKDOWN_HEADING, (_, title: string) => `*${title.replace(/^\*+|\*+$/g, '')}*`)
  );
}
