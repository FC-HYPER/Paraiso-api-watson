/**
 * Mascaramento de dado pessoal para o log (LGPD).
 *
 * O interceptor grava corpo da requisição e da resposta integralmente, e o corpo
 * é o que o cliente digitou no WhatsApp — CPF e número de proposta caem no log em
 * texto puro. Aqui eles são mascarados **apenas para o log**; a resposta enviada
 * ao gateway continua intacta.
 */

/** Mantém os 3 últimos dígitos, o bastante para correlacionar sem guardar o número. */
function maskDigits(value: string): string {
  const digits = value.replace(/\D/g, '');

  return digits.length > 3 ? `***${digits.slice(-3)}` : '***';
}

const SENSITIVE_PATTERNS: RegExp[] = [
  // CPF pontuado: 000.000.000-00
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
  // CNPJ pontuado: 00.000.000/0000-00
  /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g,
  // Sequências longas de dígitos: CPF/CNPJ sem pontuação, proposta, contrato.
  // A partir de 5 dígitos para não mascarar opção de menu numérico (1, 2, 10).
  /\b\d{5,}\b/g,
];

/**
 * Chaves preservadas: são os identificadores que permitem correlacionar um
 * atendimento com a execução no painel do Orchestrate. Mascará-los tiraria a única
 * forma de investigar um problema.
 */
const PRESERVED_KEYS = new Set(['thread_id', 'run_id', 'trace_id', 'id']);

export function redactText(text: string): string {
  return SENSITIVE_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, maskDigits), text);
}

/** Percorre o objeto mascarando strings, exceto sob as chaves preservadas. */
export function redact(value: unknown): unknown {
  if (typeof value === 'string') return redactText(value);

  if (Array.isArray(value)) return value.map(redact);

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        PRESERVED_KEYS.has(key) ? item : redact(item),
      ]),
    );
  }

  return value;
}

/**
 * Versão para o `onSend`, onde o payload já é string JSON. Se não for JSON válido
 * (página do Swagger, texto de erro), cai no mascaramento direto do texto.
 */
export function redactPayload(payload: unknown): string {
  if (typeof payload !== 'string') return JSON.stringify(redact(payload));

  try {
    return JSON.stringify(redact(JSON.parse(payload)));
  } catch {
    return redactText(payload);
  }
}
