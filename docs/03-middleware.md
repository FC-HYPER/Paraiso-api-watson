# 3. Middleware: como funciona

Referência técnica deste repositório (`api-paraiso-gold`). Descreve o código como está; decisões e
testes que levaram a ele estão em [02-decisoes.md](02-decisoes.md); o que está em aberto, em
[01-pendencias.md](01-pendencias.md).

O middleware é a ponte entre o gateway da Aspa (WhatsApp) e o agente Habib no watsonx Orchestrate.
Não tem regra de negócio: autentica o gateway, repassa a mensagem, lê a resposta do agente e a
devolve no formato que a Aspa já entende.

---

## 3.1 Visão geral

```
Cliente → WhatsApp → Aspa (gateway)
                       ↓  POST /api/orchestrate/message  { input, context }   · header apikey
              Middleware (Fastify, Node 20)
                       ↓  token IAM (cache) + POST /v1/orchestrate/runs/stream
                 watsonx Orchestrate → agente Habib (draft)
```

| Rota | Situação |
|---|---|
| `POST /api/orchestrate/message` | **Rota atual.** Autenticada pelo header `apikey` |
| `POST /api/watson/message` | Rota do Watson Assistant, sem autenticação. Fica até o cutover (3.10) |
| `GET /documentation` | Swagger. Registrado só fora de produção (`NODE_ENV != production`) |
| `POST /api/hello-world` | Verificação simples |

Arquivos principais:

| Arquivo | Papel |
|---|---|
| [`services/orchestrate.service.ts`](../services/orchestrate.service.ts) | Token IAM, chamada ao `runs/stream` e leitura dos eventos |
| [`src/http/controllers/message/send-message.controller.ts`](../src/http/controllers/message/send-message.controller.ts) | Monta o contexto do agente, chama o service e responde ao gateway |
| [`src/utils/aspa-control.ts`](../src/utils/aspa-control.ts) | Traduz o contexto da run para as variáveis de controle da Aspa |
| [`src/utils/whatsapp-format.ts`](../src/utils/whatsapp-format.ts) | Converte o Markdown do agente para a marcação do WhatsApp |
| [`src/models/message.schema.ts`](../src/models/message.schema.ts) | Schemas de entrada e saída da rota |
| [`src/utils/redact.ts`](../src/utils/redact.ts) | Mascaramento de dado pessoal no log |
| [`src/config/env/index.ts`](../src/config/env/index.ts) | Variáveis de ambiente, validadas na subida |

---

## 3.2 Contrato com o gateway

O contrato é o mesmo da rota do Watson, para a Aspa não mudar o parsing. O gateway trata `context`
como caixa-preta: guarda o que devolvemos e reenvia na mensagem seguinte. É por ali que viaja o
`thread_id` da conversa (confirmado pela Aspa em 11/08/2026).

```jsonc
// requisição
{ "input": "Meu contrato foi ajuizado",
  "context": {
    "thread_id": "f03dea36-…",                       // ausente na primeira mensagem
    "skills": { "main skill": { "user_defined": { "phone": "5541…" } } } } }

// resposta
{ "success": true,
  "data": {
    "output": { "generic": [ { "response_type": "text", "text": "…" } ] },
    "context": {
      "thread_id": "f03dea36-…",
      "skills": { "main skill": { "user_defined": {   // só quando há variável de controle
        "distribuicao": "Ajuizados",
        "atendimento_humano": true,
        "resumo_encaminhamento": "renegociação de contrato ajuizado" } } } } } }
```

- **A Aspa lê `data.output.generic` inteiro** e envia cada item como uma mensagem, com `text` ou
  `attachment`. Hoje sempre vai um item só.
- **Todo campo da resposta precisa estar declarado em
  [`message.schema.ts`](../src/models/message.schema.ts).** O Fastify serializa pelo schema e
  descarta em silêncio o que não estiver lá; foi assim que o campo `integration` sumiu na versão
  antiga. Antes de emitir `attachment`, estender o schema e combinar o formato com a Aspa.
- **Ordem na Aspa:** quando a resposta traz `distribuicao`, a transferência é registrada primeiro e
  a mensagem de `generic` é enviada em seguida; o atendente já recebe a conversa com ela.
- **O `context` é substituído a cada turno:** a Aspa reenvia exatamente o que devolvemos na última
  resposta e não guarda nada do lado dela.
- **`phone`** vem completo, `55` + DDD + número.
- **`generic` vazio e resposta de erro** (4xx/5xx) fazem a Aspa tirar a conversa do agente e
  transferir para o TIME, que funciona como fila geral: aparece para todos até alguém assumir.

---

## 3.3 Chamada ao Orchestrate

### Token IAM

A API key do Orchestrate é trocada por um bearer token em `https://iam.cloud.ibm.com/identity/token`,
válido por 3600 s. O service guarda o token e:

- renova com **10 minutos de margem**, porque a requisição pode sair com o token válido e chegar
  vencida;
- compartilha uma única renovação entre requisições simultâneas (`inFlight`);
- em `401`, força uma renovação e tenta **uma vez só**: duas falhas seguidas são credencial errada,
  e insistir vira tempestade de requisições;
- dá 10 s de timeout para o IAM.

Sem renovação, o bot pararia de responder uma hora depois do deploy e "se curaria" a cada restart.

### `runs/stream`

```
POST {WXO_INSTANCE_URL}/v1/orchestrate/runs/stream
Authorization: Bearer {token}

{ "agent_id": "…", "message": { "role": "user", "content": "…" },
  "thread_id": "…",              ← ausente na primeira mensagem; a run cria a thread
  "context": { "phone": "…" } }  ← só se houver
```

O middleware lê o stream inteiro (um JSON por linha; o prefixo `data:` do SSE também é aceito) e
só então responde ao gateway. Eventos usados:

| Evento | O que se tira dele |
|---|---|
| `message.created` | O texto da resposta: itens com `response_type` `text` ou `conversational_search`. Outros tipos são ignorados e logados. Várias mensagens na mesma run viram um texto só |
| `run.completed` (ou `done`) | O contexto final da run, com o que as tools gravaram. Tem precedência sobre o contexto do `message.created` |
| `run.step.delta` | As etapas da run: `tool_calls` (nome e argumentos) e `tool_response`. Se a `transfer_to_human` foi chamada e nenhuma resposta dela veio como lista (o executor de tools da IBM falhou), o service expõe `failedTransfer` com os argumentos da chamada |
| `flow.slot.listen` | Workflow assíncrono: a resposta virá depois, pela thread. Hoje só é logado |
| `run.failed`, `run.cancelled`, `run.expired`, `error` | Falha da run: vira 502 |
| Qualquer evento | `thread_id`, `run_id` e `trace_id`, que vão para o log |

**Por que `runs/stream` e não `chat/completions`:** é o único que devolve o contexto gravado pelas
tools na própria resposta. O array `messages` do `chat/completions` não é a conversa (a conversa é a
thread), e o middleware manda uma mensagem só, de propósito.

---

## 3.4 Contexto

### Entrada: o que vai ao agente

Só o `phone`, lido de `context.skills["main skill"].user_defined.phone` e repassado com nome plano
(`{ "phone": "…" }`). A leitura é tolerante: contexto em outro formato não derruba a requisição, só
deixa de repassar o dado. Dado do cliente vai pelo `context`, nunca concatenado no texto da
mensagem (LGPD).

**Regra do Orchestrate:** uma variável só entra na run, e só volta dela, se estiver em
`context_variables` do agente. Hoje o Habib lista `phone`, `distribuicao`, `atendimento_humano` e
`handoff_summary`. Variável fora da lista some sem erro.

### Saída: o que volta à Aspa

[`aspa-control.ts`](../src/utils/aspa-control.ts) é a última barreira antes de a Aspa mover um
cliente real. Só passa o que estiver na lista fechada e com valor válido:

| Contexto da run | `user_defined` da Aspa | Regra |
|---|---|---|
| `distribuicao` | `distribuicao` + `atendimento_humano: true` | Só os 12 valores aprovados (Boletos, Quitacao, Rescisao, Renegociacao, Transferencia, Contrato, IPTU, Escrituras, Compra, Ajuizados, Demarcacao, Reclamacao). Fora disso, inclusive "Financeiro", é descartado e logado como erro |
| `handoff_summary` | `resumo_encaminhamento` | Só junto com uma transferência (equipe válida ou fila geral); até 500 caracteres; fora do log |
| `atendimento_humano` sem `distribuicao` | `atendimento_humano: true` | Fila geral: a Aspa manda para o TIME. É o destino `Geral` da `transfer_to_human` |
| `encerrar_sessao`, `menu_aspa` | iguais | Só quando `true` |

> A lista de equipes existe em dois lugares: aqui e no `Destination` de
> [`transfer_to_human.py`](../orchestrate/tools/transfer_to_human.py). Mudar nos dois juntos.

---

## 3.5 Texto ao cliente

[`whatsapp-format.ts`](../src/utils/whatsapp-format.ts) converte o Markdown do agente antes de
responder: `**texto**` e `__texto__` viram `*texto*` (negrito do WhatsApp), e títulos com `#` viram
uma linha em negrito. Asterisco solto (`5 * 3`) não é tocado. Links em Markdown (`[texto](url)`)
ficam como estão, porque as instructions pedem esse formato.

Depois da conversão, o controller aplica, nesta ordem, as travas que o prompt não garante:

| Etapa | Arquivo | O que faz |
|---|---|---|
| Transferência pela falha da tool | [`transfer-fallback.ts`](../src/utils/transfer-fallback.ts) | Com `failedTransfer`, o middleware faz a transferência que a tool não fez: grava `atendimento_humano`, a `distribuicao` (se a equipe for válida e não for `Geral`) e o resumo, e **troca a resposta** pelo texto padrão. Fora do expediente (seg–sex, 9h–18h, UTC-3, `HOLIDAYS` como na tool), também transfere, com o texto da fila, igual ao da tool. As etapas seguintes não se aplicam a esse texto |
| Link da Área do Cliente | [`official-links.ts`](../src/utils/official-links.ts) | Link em Markdown com rótulo "Área do Cliente" ou "Portal do Cliente", ou apontando para `portaldocliente.paraisogold.com.br`, passa a apontar para `https://portaldocliente.paraisogold.com.br/portal/login` |
| Oferta de encaminhamento | [`handoff-offer.ts`](../src/utils/handoff-offer.ts) | Sem transferência, a frase "posso te encaminhar…" sai: o Habib encaminha ou não encaminha |
| Promessa de registro | [`registration-claim.ts`](../src/utils/registration-claim.ts) | "Registrei", "deixei registrado", "seu pedido foi registrado" saem, porque não existe registro nem protocolo. Com transferência, a resposta inteira vira o texto padrão da transferência |

As frases são retiradas inteiras; uma linha que sobra só com emoji ou pontuação também sai, e, se não
sobrar nada, fica o texto original. Cada trava gera um aviso no log com o `run_id`.

---

## 3.6 Erros e timeout

| Situação | Resposta ao gateway |
|---|---|
| Sem header `apikey` ou com valor errado | 401 |
| Corpo inválido | 4xx do Fastify |
| Timeout na chamada ou na leitura do stream | 504, sem `generic` |
| Falha no IAM, na rede, run com falha ou stream irreconhecível | 502, sem `generic` |
| Erro inesperado | 500, sem `generic` |

O corpo de erro é sempre `{ success: false, message }` em inglês, sem o detalhe da IBM, que vai só
para o log.

**Timeout de 120 s** (`WXO_TIMEOUT_MS`), cobrindo a conexão e a leitura do stream inteiro. O gateway
da Aspa espera até 3 minutos e recomenda ficar dentro de 2. O agente responde em ~12 s, mas teve
picos de até 55 s em 22/10/2026.

**Resposta vazia ou "None"** (o agente às vezes devolve "None" em vez de chamar uma tool, problema conhecido da IBM) sai como `generic: []`, e a Aspa transfere para o TIME, a fila geral. Gera um aviso no log.

---

## 3.7 Log e LGPD

- O interceptor grava corpo de entrada e de saída das duas rotas com **mascaramento**: CPF e CNPJ
  pontuados e sequências de 5 ou mais dígitos, preservando os 3 últimos para correlação. Opção de
  menu (1, 2, 10) não é mascarada. Vale só para o log; a resposta ao gateway sai intacta.
- `thread_id`, `run_id` e `trace_id` nunca são mascarados: são o que permite achar a execução no
  painel do Orchestrate.
- Do contexto, o log mostra **só as chaves**. O resumo do encaminhamento fica fora do log.

---

## 3.8 Variáveis de ambiente

[`src/config/env/index.ts`](../src/config/env/index.ts) valida o ambiente com Zod na subida. Se
faltar uma variável obrigatória, o contêiner morre antes de abrir a porta, e o sintoma no Code
Engine é a revisão presa em "Implementando" com tráfego 0%. **Cadastrar no Code Engine antes de
publicar uma imagem que exija variável nova.**

| Variável | Obrigatória | Uso |
|---|---|---|
| `API_KEY` | sim | Valor que a Aspa envia no header `apikey` |
| `WXO_INSTANCE_URL` | sim | URL da instância do Orchestrate (barra final é removida) |
| `WXO_API_KEY` | sim | API key do Orchestrate, trocada pelo token IAM. Referenciar de um Secret |
| `WXO_AGENT_ID` | sim | Id do agente Habib |
| `WXO_TIMEOUT_MS` | não | Padrão 120000. Vazio conta como ausente. Se cadastrada no Code Engine, tem precedência |
| `NODE_ENV` | não | Padrão `qas`. **Produção precisa de `production`**, senão o Swagger fica público |
| `PORT` | não | Padrão 3333 |
| `API_QAS_URL`, `API_PRD_URL` | sim | Servidores listados no Swagger |
| `WATSON_API_KEY`, `WATSON_ASSISTANT_ID`, `WATSON_ENVIRONMENT_ID` | sim | Rota antiga; saem no cutover |

`WXO_*` ficam em **Settings → API details** da instância do Orchestrate; a API key só aparece uma
vez, ao ser gerada.

---

## 3.9 Esteira de deploy

| Ambiente | Aplicação (Code Engine) | Imagem |
|---|---|---|
| Produção | `paraiso-api-ura-watson-prod` | `private.us.icr.io/watson-paraiso-api/paraiso-api:latest` |
| Homologação | `paraiso-api-ura-watson-homolog` | `private.us.icr.io/watson-paraiso-api/paraiso-api:homolog` |

**As tags separam os ambientes.** Nunca publicar em `:latest` a partir do fluxo de
desenvolvimento: produção só muda por promoção consciente.

A homologação tem uma compilação a partir da fonte:

| | |
|---|---|
| Repositório | `github.com/FC-HYPER/Paraiso-api-watson` |
| Branch | `feat/migracao-orchestrate` |
| Autenticação | deploy key SSH (read-only) |
| Estratégia | Dockerfile da raiz, multi-stage, `npm ci --legacy-peer-deps` com lockfile versionado |
| Saída | `…/paraiso-api:homolog` |

Ciclo: `git push` na branch e **Executar novamente a compilação** no Code Engine (não há gatilho
automático confirmado). A imagem final leva só dependências de produção. O `--legacy-peer-deps`
existe porque o `fastify-zod` declara peer `fastify@4` e o projeto roda o 5.

**Verificação rápida:** um `404` do Fastify em `GET /` é resposta saudável: a aplicação subiu e está
roteando.

---

## 3.10 Rota antiga e cutover

A rota do Watson continua de pé até a Aspa migrar de vez. Construímos de forma aditiva: remover o
caminho antigo antes disso derruba o atendimento em produção. No cutover, saem juntos:

- [`services/watson.service.ts`](../services/watson.service.ts), a rota, o controller e o schema
  `watson`, e o registro deles em `routes-mapper.ts` e `app.ts`;
- as variáveis `WATSON_*` do schema, do `.env.exemple` e do Code Engine;
- as dependências `ibm-watson` e `ibm-cloud-sdk-core`.

---

## 3.11 Como testar localmente

```bash
npx tsx src/server.ts        # sobe na porta 3333 com o .env local

curl -X POST http://localhost:3333/api/orchestrate/message \
  -H "Content-Type: application/json" -H "apikey: $API_KEY" \
  --data-binary @corpo.json  # corpo em arquivo: acento passado inline quebra o Content-Length no Windows
```

Para seguir a mesma conversa, reenviar o `thread_id` devolvido dentro de `context`. Antes de
commitar, rodar `npx tsc --noEmit`: o `npm run build` (tsup) não faz checagem de tipos.

**O middleware local conversa com o draft do Habib**, o mesmo que a homologação usa. Um teste local
gera conversa real no Orchestrate, e uma transferência dentro do expediente registra `distribuicao`
de verdade no contexto.
