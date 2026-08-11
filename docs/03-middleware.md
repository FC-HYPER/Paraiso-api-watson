# 3. Middleware: o que muda

Documento técnico. Escopo: apenas este repositório (`api-paraiso-gold`).

---

## 3.1 Resumo da mudança

> O middleware **perde responsabilidade de negócio e ganha responsabilidade de infraestrutura**.
> Deixa de decidir *o que* chamar e passa a cuidar de *como* falar com a IBM com segurança e
> resiliência. O saldo do diff é negativo — mas o código que entra é o mais delicado.

| # | Antes (Assistant) | Depois (Orchestrate) | Custo |
|---|---|---|---|
| 1 | SDK `ibm-watson`; `IamAuthenticator` cuidava do token sozinho | REST puro, sem SDK Node oficial. Token IAM (validade 1h) gerenciado por nós: cache, renovação antecipada, retry em 401 | Código novo, sem biblioteca; ponto de falha mais caro |
| 2 | `context` completo em round-trip pelo gateway | `thread_id`; a conversa vive no Orchestrate | Rota, schema e controller novos |
| 3 | Middleware executava as integrações do Portal | Orchestrate executa; `habib.service.ts` sai do repo | Deleção arrasta env, dependências e Swagger |
| 4 | Rota sem autenticação; middleware de apikey comparando variável inexistente | Rota autenticada, middleware corrigido | Falha de segurança existente hoje |
| 5 | Sem timeout, sem retry, `payload: any`, erro da IBM repassado cru | Timeout, retry único, tipagem, erro tratado | O SDK dava parte disso de graça |
| 6 | Log grava corpo e resposta completos (CPF, proposta) | Redaction dos campos sensíveis | LGPD |

---

## 3.2 Como o Orchestrate é chamado

```
POST {WXO_INSTANCE_URL}/v1/orchestrate/{agent_id}/chat/completions
Authorization: Bearer {token IAM}
X-IBM-THREAD-ID: {thread_id}        ← opcional; mantém o estado da conversa
Content-Type: application/json

{ "messages": [{ "role": "user", "content": "..." }],
  "context": { },                    ← contexto do usuário para o agente
  "stream": false }

→ { "id", "object", "created", "model", "choices": [...], "thread_id": "uuid" }
```

**Autenticação (SaaS / IBM Cloud):** troca-se a IAM API key por um bearer token em
`POST https://iam.cloud.ibm.com/identity/token`
(`grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=...`), válido por **3600 s**.

### Verificado contra a instância (10/08/2026)

Teste executado com um agente descartável (`habib_test`) na instância `us-south`:

| Verificação | Resultado |
|---|---|
| Troca da API key por token IAM | HTTP 200 · `expires_in: 3600` |
| `POST .../chat/completions` com `stream: false` | HTTP 200 · ~2,9 s |
| Header `X-IBM-THREAD-ID` mantém o histórico | **Confirmado** — o agente recuperou informação dada na mensagem anterior |
| `thread_id` devolvido na 2ª chamada | Idêntico ao da 1ª |

**Campos reais da resposta** (dois a mais do que a documentação indica):

```
id, object, created, model, choices, thread_id, run_id, trace_id
```

`run_id` e `trace_id` identificam a execução do lado da IBM. **O middleware deve registrá-los no
log** — são eles que permitem correlacionar um atendimento problemático com a execução
correspondente no painel do Orchestrate.

**TTL da thread:** a mesma thread foi retomada com sucesso mais de uma hora depois — o agente ainda
recuperou informação dada na primeira mensagem, e o `thread_id` devolvido continuou o mesmo. Não
descarta um TTL mais longo (dias), mas cobre o padrão de uso do WhatsApp, em que o cliente retoma a
conversa horas depois. Se um TTL for encontrado em produção, tratar a thread expirada abrindo uma
nova de forma transparente em vez de retornar erro.

---

## 3.3 Contrato com o gateway — abordagem adotada

**Decisão: manter o contrato atual e transportar o `thread_id` dentro do `context`.**
Zero mudança do lado da Aspa.

O gateway hoje já guarda o que devolvemos em `context` e reenvia na mensagem seguinte, tratando o
conteúdo como caixa-preta. Aproveitamos esse comportamento: em vez do objeto `context` completo do
Watson (que podia chegar a 250 KB), passa a trafegar apenas o identificador da conversa.

```jsonc
// POST /api/watson/message — forma inalterada
{ "input": "quero ver meus boletos",
  "context": { "thread_id": "abc-123" } }   // ausente na primeira mensagem

// resposta — forma inalterada
{ "success": true,
  "data": { "output": { ... },
            "context": { "thread_id": "abc-123" } } }
```

Fluxo no middleware:

1. Lê `context.thread_id` do body (pode não existir — primeira mensagem da conversa)
2. Envia no header `X-IBM-THREAD-ID` da chamada ao Orchestrate
3. Recebe o `thread_id` na resposta e devolve dentro de `context`

**Único ponto a confirmar com a Aspa:** como ela lê o `context` na resposta. Se pega `data.context`
de forma genérica, funciona sem nenhuma alteração do lado deles.

> **Opção futura (fora do escopo atual):** um contrato novo e mais limpo — `POST /api/v1/message`
> com `message` / `user_id` / `thread_id` no nível raiz. Exige desenvolvimento e teste conjunto com a
> Aspa, e por isso foi adiado.

---

## 3.4 `services/orchestrate.service.ts`

Substitui [`services/watson.service.ts`](../services/watson.service.ts). Duas responsabilidades
separadas: **gerenciar o token IAM** e **chamar o agente**.

### (a) Token IAM

O `IamAuthenticator` do SDK fazia isso sozinho: buscava, cacheava, renovava antes de expirar e
injetava o header. Sem SDK, a lógica é nossa. **Sem renovação, o bot para de responder uma hora após
o deploy**, com `401` no log e nenhuma pista no código de negócio — e "se cura" a cada restart do
container, o que dificulta o diagnóstico.

```ts
private token?: string;
private expiresAt = 0;

private async getToken(force = false): Promise<string> {
  const SKEW_MS = 10 * 60 * 1000;              // renova aos ~50min, não aos 60
  if (!force && this.token && Date.now() < this.expiresAt - SKEW_MS) return this.token;

  const res = await fetch('https://iam.cloud.ibm.com/identity/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey: env.WXO_API_KEY,
    }),
  });
  if (!res.ok) throw new Error(`IAM token failed: ${res.status}`);

  const { access_token, expires_in } = await res.json();
  this.token = access_token;
  this.expiresAt = Date.now() + expires_in * 1000;
  return this.token;
}
```

A margem de 10 min existe porque a requisição pode sair com o token válido e chegar na IBM já
vencido (latência, fila, diferença de relógio). **Nunca trabalhar no limite.**

### (b) Chamada do agente

```ts
async sendMessage(message: string, threadId?: string, context?: object) {
  const call = async (token: string) =>
    fetch(`${env.WXO_INSTANCE_URL}/v1/orchestrate/${env.WXO_AGENT_ID}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(threadId && { 'X-IBM-THREAD-ID': threadId }),
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: message }],
        ...(context && Object.keys(context).length > 0 && { context }),
        stream: false,
      }),
      signal: AbortSignal.timeout(env.WXO_TIMEOUT_MS ?? 30_000),
    });

  let res = await call(await this.getToken());
  if (res.status === 401) res = await call(await this.getToken(true));  // uma vez só
  if (!res.ok) throw new OrchestrateError(res.status, await res.text());

  const body = await res.json();
  return { reply: body.choices?.[0]?.message?.content ?? '', threadId: body.thread_id };
}
```

**Detalhes que não podem escapar:**

- **Retry uma vez só.** Duas falhas seguidas significam credencial errada, não expiração — insistir
  transforma erro de configuração em tempestade de requisições.
- **`stream: false` explícito** — o default da API é `true`, e streaming quebraria o parse.
- **Timeout obrigatório.** O `fetch` do Node não tem timeout por padrão; sem ele, uma requisição
  travada segura a conexão do WhatsApp indefinidamente.
- **Sem `any` no payload** — o service atual usa `payload: any`, o que anula a checagem de tipos.
- **Erro tipado** em vez de repassar o erro cru da IBM ao gateway, que vaza detalhe interno.

---

## 3.5 Demais mudanças no repositório

- **Criar** `src/http/routes/message.route.ts` e
  `src/http/controllers/message/send-message.controller.ts`, registrando em
  [`routes-mapper.ts`](../src/utils/constants/routes-mapper.ts) e
  [`default-paths.ts`](../src/utils/constants/default-paths.ts).
- **Criar** `src/models/message.schema.ts`. **Declarar todos os campos da resposta** no schema 200 —
  a omissão disso foi o que descartou silenciosamente o campo `integration` na implementação atual.
- **Corrigir** [`validate-key.middleware.ts`](../src/http/middlewares/validate-key.middleware.ts):
  compara `env.APIKEY`, mas o schema define `API_KEY`. Aplicar via `preHandler` na rota nova.
- **Deletar** (no cutover, não antes): `services/habib.service.ts`, `services/watson.service.ts`,
  o controller, a rota e o schema antigos.
- **Env** ([`src/config/env/index.ts`](../src/config/env/index.ts)): adicionar `WXO_INSTANCE_URL`,
  `WXO_API_KEY`, `WXO_AGENT_ID`; remover `WATSON_*` e `HABIB_*`. Ler sempre via `env`, nunca
  `process.env` direto. Atualizar `.env.exemple`.
- **Dependências**: remover `ibm-watson` e `ibm-cloud-sdk-core` — o `fetch` nativo do Node 20 basta.
- **Log**: adicionar redaction de CPF e proposta em
  [`interceptor-logger.ts`](../src/http/middlewares/interceptor-logger.ts).

> **Ordem de execução:** construir de forma **aditiva**. A rota nova nasce ao lado da antiga; as
> deleções acontecem no cutover, depois que o gateway migrar. Remover o caminho atual antes disso
> derruba o atendimento em produção.

---

## 3.6 Dependência externa

Rota, schema, correção de autenticação e limpeza podem ser feitos imediatamente. O `orchestrate.service.ts`
precisa de uma instância do Orchestrate com agente publicado para ser validado — sem ela não há como
testar de verdade, e os dois problemas mais caros (expiração do token IAM em 1 h e o formato real da
resposta do agente) só aparecem contra a API real.

Variáveis necessárias: `WXO_INSTANCE_URL`, `WXO_API_KEY`, `WXO_AGENT_ID`.
Obtidas em **Settings → API details** dentro da instância do Orchestrate (a API key só é exibida uma
vez, no momento da geração).

---

## 3.7 Verificação

1. `curl` direto no IAM e depois no `/chat/completions`, fora do código, provando credencial e conectividade
2. `npm run dev` e duas requisições encadeadas — a primeira sem `thread_id`, a segunda reusando o
   devolvido — provando que a conversa mantém contexto
3. Requisição sem header `apikey` deve retornar 401 (hoje passa)
4. Conferir que `reply` e `thread_id` aparecem de fato na resposta HTTP
5. `npx tsc --noEmit` — o `npm run build` (tsup) **não** faz typecheck, e foi por isso que o bug
   `env.APIKEY` sobreviveu. Vale adicionar ao CI.
6. Conversa real via WhatsApp com o gateway apontando para a rota nova

---

## 3.8 Esteira de deploy (configurada em 11/08/2026)

### Ambientes

| Ambiente | Aplicação (Code Engine) | Imagem |
|---|---|---|
| Produção | `paraiso-api-ura-watson-prod` | `private.us.icr.io/watson-paraiso-api/paraiso-api:latest` |
| Homologação | `paraiso-api-ura-watson-homolog` | `private.us.icr.io/watson-paraiso-api/paraiso-api:homolog` |

**As tags separam os ambientes.** Antes desta configuração, as duas aplicações apontavam para a
mesma imagem `:latest` — qualquer build para testar em homologação entraria em produção no próximo
restart de instância. **Nunca publicar em `:latest`** a partir do fluxo de desenvolvimento; produção
só muda por promoção consciente.

### Build automático

A aplicação de homologação tem uma compilação a partir da fonte:

| | |
|---|---|
| Repositório | `github.com/FC-HYPER/Paraiso-api-watson` |
| Branch | `feat/migracao-orchestrate` |
| Autenticação | deploy key SSH já existente no repositório (read-only) |
| Estratégia | Dockerfile (raiz), timeout 10m, recursos `medium` |
| Saída | `private.us.icr.io/watson-paraiso-api/paraiso-api:homolog` |

Ciclo de trabalho: **`git push` na branch → build → deploy em homologação**. Não requer Docker nem
CLI da IBM na máquina do desenvolvedor.

Build completo leva de 3 a 6 minutos, dominado pelo `npm install --force` (o projeto não versiona
`package-lock.json`, então as dependências são resolvidas do zero a cada build).

### ⚠️ Variáveis de ambiente são fail-fast

[`src/config/env/index.ts`](../src/config/env/index.ts) valida o ambiente com Zod e **lança exceção
na inicialização** se faltar qualquer variável obrigatória. O contêiner morre antes de abrir a porta,
e o sintoma no Code Engine é a revisão presa em "Implementando" com tráfego 0%.

Foi o que aconteceu no primeiro build: a imagem anterior de homologação era anterior ao commit
`b0ec88a`, e as variáveis `HABIB_API_URL` e `HABIB_BEARER_TOKEN` nunca haviam sido cadastradas.

**Pendência para produção:** a aplicação de produção provavelmente tem a mesma lacuna. Promover uma
imagem nova para lá sem cadastrar essas variáveis derruba o ambiente real. Conferir antes de
qualquer publicação em produção.

Ao adicionar `WXO_INSTANCE_URL`, `WXO_API_KEY` e `WXO_AGENT_ID` ao schema, cadastrá-las **também**
no CodeEngine — já estão configuradas em homologação. `HABIB_BEARER_TOKEN` e `WXO_API_KEY` devem
ser referenciadas a partir de um Secret, não como valor literal.

### Verificação rápida do ambiente

Um `404` do Fastify em `GET /` (`{"message":"Route GET:/ not found",...}`) é resposta **saudável** —
prova que a aplicação subiu e está roteando. A raiz não existe; as rotas são `/documentation`,
`POST /api/hello-world`, `POST /api/watson/message` e `POST /api/orchestrate/message`.
