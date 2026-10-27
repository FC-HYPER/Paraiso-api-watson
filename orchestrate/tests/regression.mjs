// Bateria de regressão do Habib: roda cada caso N vezes pelo middleware local e confere a
// transferência e o conteúdo da resposta.
//
// Uso (com o middleware no ar em localhost:3333):
//   node orchestrate/tests/regression.mjs [repetições] [saída.json]
//   node orchestrate/tests/regression.mjs reevaluate <saída.json> <resultados-antigos.json>
// O modo reevaluate reaplica o verificador atual a respostas já salvas, sem chamar o agente.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const API_KEY = readFileSync(join(ROOT, '.env'), 'utf8')
  .match(/^API_KEY=(.*)$/m)[1]
  .trim()
  .replace(/^["']|["']$/g, '');
const CASES = JSON.parse(readFileSync(join(HERE, 'regression-cases.json'), 'utf8'));
const CONCURRENCY = 4;
const CLIENT_AREA_URL = 'https://portaldocliente.paraisogold.com.br/portal/login';

// Valem para toda resposta.
const GLOBAL_EXCLUDE = [
  // "Escritura registrada" é termo do KB; o proibido é dizer que registrou o pedido.
  /(pedido|solicitação|atendimento|reclamação|tudo)[^.]{0,30}registrad[oa]|registrei|deixei registrad/i,
  // Protocolo da Prefeitura (alvará) e do Sedex são termos dos KBs; o proibido é dar
  // protocolo ao pedido do cliente.
  /(seu|número de|nº de|n° de) protocolo|abri (um )?protocolo|protocolo (do|de) (seu |sua )?(atendimento|pedido|solicitação)/i,
  /grupo para[ií]so ?gold|para[ií]so ?gold loteamentos/i,
  /posso (te |lhe )?(encaminhar|transferir)|te encaminho|quer que eu (te )?encaminhe/i,
];

async function sendTurn(input, context) {
  const started = Date.now();
  const res = await fetch('http://localhost:3333/api/orchestrate/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: API_KEY },
    body: JSON.stringify({ input, ...(context ? { context } : {}) }),
    // Acima dos 120 s do middleware: se nem ele responder, a conexão travou (ex.: suspensão).
    signal: AbortSignal.timeout(180_000),
  });
  return { status: res.status, seconds: (Date.now() - started) / 1000, body: await res.json() };
}

function transferOf(userDefined) {
  if (!userDefined?.atendimento_humano) return null;
  return userDefined.distribuicao ?? 'Geral';
}

async function runCase(testCase, rep) {
  let context;
  let last;
  const texts = [];
  for (const message of testCase.turns) {
    last = await sendTurn(message, context);
    const data = last.body?.data;
    texts.push((data?.output?.generic ?? []).map((g) => g.text).join('\n'));
    const threadId = data?.context?.thread_id;
    if (!threadId) break;
    context = { thread_id: threadId };
  }
  const data = last.body?.data;
  return evaluate(testCase, rep, {
    status: last.status,
    text: texts.at(-1) ?? '',
    got: transferOf(data?.context?.skills?.['main skill']?.user_defined),
    seconds: last.seconds,
    thread_id: data?.context?.thread_id,
  });
}

function evaluate(testCase, rep, { status, text, got, seconds, thread_id }) {
  const failures = [];
  if (status !== 200) failures.push(`HTTP ${status}`);
  if (got !== testCase.transfer) failures.push(`transfer esperado ${testCase.transfer} obtido ${got}`);
  for (const r of testCase.include ?? []) if (!new RegExp(r, 'i').test(text)) failures.push(`falta /${r}/`);
  for (const r of testCase.exclude ?? []) if (new RegExp(r, 'i').test(text)) failures.push(`contém /${r}/`);
  for (const r of GLOBAL_EXCLUDE) if (r.test(text)) failures.push(`contém ${r}`);
  for (const m of text.matchAll(/\[\*?Área do Cliente\*?\]\(([^)]+)\)/gi))
    if (m[1] !== CLIENT_AREA_URL) failures.push(`link Área do Cliente errado: ${m[1]}`);
  return { id: testCase.id, kb: testCase.kb, rep, ok: failures.length === 0, failures, got, status, seconds, text, thread_id };
}

const [mode, ...args] = process.argv.slice(2);
let results = [];
let outputPath;
if (mode === 'reevaluate') {
  [outputPath] = args;
  const byId = Object.fromEntries(CASES.map((c) => [c.id, c]));
  const previous = JSON.parse(readFileSync(args[1], 'utf8'));
  results = previous.filter((r) => byId[r.id]).map((r) => evaluate(byId[r.id], r.rep, r));
} else {
  const reps = Number(mode ?? 3);
  outputPath = args[0] ?? join(HERE, 'results', `regression-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const queue = CASES.flatMap((c) => Array.from({ length: reps }, (_, i) => [c, i + 1]));
  async function worker() {
    while (queue.length) {
      const [testCase, rep] = queue.shift();
      try {
        results.push(await runCase(testCase, rep));
      } catch (e) {
        results.push({ id: testCase.id, kb: testCase.kb, rep, ok: false, failures: [`erro: ${e.message}`], text: '' });
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

results.sort((a, b) => a.id.localeCompare(b.id) || a.rep - b.rep);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`${results.filter((r) => r.ok).length}/${results.length} ok — ${outputPath}`);
for (const r of results.filter((r) => !r.ok)) {
  console.log(`\nFALHA ${r.id} #${r.rep} [${r.kb}] ${r.failures.join(' | ')}`);
  console.log('  ' + r.text.replace(/\n+/g, ' / ').slice(0, 400));
}
