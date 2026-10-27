/**
 * Corrige o endereço de links oficiais pelo rótulo. O agente copia links da base, mas
 * às vezes liga o endereço errado ao nome certo: "[Área do Cliente]" saiu com o site
 * institucional em 4 de 4 pedidos de segunda via (23/10/2026), porque o trecho
 * recuperado citava a Área do Cliente sem o endereço e trazia só o do site.
 *
 * Só o endereço do link muda; o texto da resposta fica como o agente escreveu.
 */

const CLIENT_AREA_URL = 'https://portaldocliente.paraisogold.com.br/portal/login';

/** `[rótulo](url)` em Markdown. */
const MARKDOWN_LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Rótulos que nomeiam a Área do Cliente, já sem negrito e em minúsculas. */
const CLIENT_AREA_LABELS = new Set(['área do cliente', 'area do cliente', 'portal do cliente']);

/** Rótulo que é o próprio domínio do portal, como `[portaldocliente.paraisogold.com.br](…)`. */
const CLIENT_AREA_DOMAIN = 'portaldocliente.paraisogold.com.br';

export interface OfficialLinksResult {
  text: string;
  /** Endereços trocados, para o log. */
  fixed: string[];
}

export function fixOfficialLinks(text: string): OfficialLinksResult {
  const fixed: string[] = [];

  const result = text.replace(MARKDOWN_LINK, (link, label: string, url: string) => {
    const name = label.replace(/[*_]/g, '').trim().toLowerCase();
    const isClientArea = CLIENT_AREA_LABELS.has(name) || name.includes(CLIENT_AREA_DOMAIN);
    if (!isClientArea || url === CLIENT_AREA_URL) return link;

    fixed.push(url);
    return `[${label}](${CLIENT_AREA_URL})`;
  });

  return { text: result, fixed };
}
