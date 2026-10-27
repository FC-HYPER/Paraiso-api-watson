// Lista as mensagens de uma thread do Orchestrate (só leitura), com o step_history: mostra a
// consulta que o Habib mandou à base, os trechos que voltaram e as chamadas de tool.
//
// Uso: node orchestrate/tests/thread-messages.mjs <thread_id> > thread.json
// O thread_id de cada caso fica no resultado da bateria (regression.mjs).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const env = Object.fromEntries(
  readFileSync(join(ROOT, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.includes('='))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);
const token = await fetch('https://iam.cloud.ibm.com/identity/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${env.WXO_API_KEY}`,
}).then((r) => r.json());
const res = await fetch(`${env.WXO_INSTANCE_URL}/v1/orchestrate/threads/${process.argv[2]}/messages`, {
  headers: { Authorization: `Bearer ${token.access_token}` },
});
if (!res.ok) {
  console.error(`HTTP ${res.status}`);
  process.exit(1);
}
console.log(JSON.stringify(await res.json(), null, 2));
