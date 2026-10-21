# 4. Pendências

Itens em aberto levantados durante o diagnóstico e a preparação do ambiente.
Atualizado em 21/10/2026.

---

## 4.1 Externas — dependem de terceiros, abrir cedo

Estas têm prazo de espera fora do nosso controle. Solicitar no início, não quando o código ficar
pronto.

### ▸ Aspa — respondido em 11/08/2026 ✅

O e-mail com as três perguntas foi respondido. **As três confirmam o desenho adotado; nenhuma
mudança de código é necessária.**

| Pergunta | Resposta da Aspa | Efeito |
|---|---|---|
| Como leem o `context` da resposta? | *"Lemos de forma genérica, não modificamos e nem esperamos algum valor específico ali dentro"* | Valida transportar o `thread_id` dentro do `context`. A Aspa **não muda uma linha** |
| Leem a resposta em `data.output.generic[0].text`? | *"É completamente configurável. Hoje buscamos em `data.output.generic`, sempre esperamos um array, e enviamos **todas** as mensagens desse array, buscando `text` ou `attachment`"* | Nossa forma atual funciona. Ver os dois desdobramentos abaixo |
| Qual o timeout do gateway? | **3 minutos**, com recomendação de manter dentro de **2 minutos** | Folga enorme. Nosso timeout de 30s passa a ser o elo mais curto da cadeia |

**Desdobramento 1 — o gateway envia o array inteiro.** Podemos devolver **várias mensagens** numa
resposta, e cada item vira uma mensagem no WhatsApp. Hoje sempre emitimos um item só. Não é problema,
mas é capacidade disponível se o agente passar a responder em blocos.

**Desdobramento 2 — a Aspa suporta `attachment`**, que precisa ser uma URL de download **desprotegida**.
Isso é diretamente relevante para o domínio de boletos. ⚠️ Mas o schema de resposta em
[`message.schema.ts`](../src/models/message.schema.ts) declara os itens do `generic` como
`{ response_type, text }`, os dois obrigatórios e sem propriedades adicionais — um campo `attachment`
seria **descartado em silêncio** pelo Fastify, exatamente o bug que apagou o campo `integration` na
implementação antiga. Se um dia o agente devolver anexo, o schema tem que ser estendido primeiro.

**Ainda pendente com eles:** habilitar homologação e apontar o gateway para
`POST /api/orchestrate/message`, enviando o header `apikey`. O valor da chave será passado em call,
não por e-mail.

**Perguntar quando houver necessidade de anexo:** a forma exata que esperam em `attachment` — o campo
recebe a URL direto (`"attachment": "https://…"`) ou um objeto? Sem isso, implementar anexo é chutar
o contrato. Barato de perguntar enquanto o canal está aberto.

### ▸ Webhook `/watson/solicitacao` — definir responsável

O dialog skill atual chama diretamente um serviço em Google Cloud Run
(`/watson/solicitacao`), enviando e-mail, CPF/CNPJ, proposta, telefone e tipo de fatura. Não constava
em nenhuma documentação de arquitetura.

Levantar **quem mantém esse serviço** e **o que ele faz**. Ele precisará virar tool no Orchestrate.

---

## 4.2 Middleware — técnicas

| Pendência | Prioridade |
|---|---|
| Rodar a compilação após cada push (botão *Executar novamente a compilação*) | — |
| Verificar se existe gatilho automático de build por push do Git; se não, avaliar configurar webhook | baixa |
| Remover `HABIB_API_URL` e `HABIB_BEARER_TOKEN` das variáveis do Code Engine | baixa — fazer ao final |
| Definir se os 3 últimos dígitos preservados no log atendem à política de privacidade do cliente | baixa — decisão de compliance, não de código |
| `prettier/prettier` acusa `Delete ␍` em todo arquivo do repositório: os arquivos são CRLF e o `.prettierrc.json` não define `endOfLine`. `npm run lint` falha por isso, não por código. Resolver com `"endOfLine": "crlf"` ou um `--fix` isolado num commit só de formatação | baixa |
| Cota do Container Registry estourada (500 MB do plano gratuito). Limpar os digests sem tag e avaliar subir o plano — com dois ambientes, o gratuito trava a cada poucos deploys. **Nunca apagar `:latest`** (produção) nem a `:homolog` em uso | **bloqueia deploy** |
| `fastify-zod@1.4.0` declara peer `fastify@^4.15.0` e o projeto roda fastify 5. Funciona, mas é combinação não suportada pela biblioteca, e obriga `--legacy-peer-deps` em todo install. Avaliar substituir por `fastify-type-provider-zod`, que suporta fastify 5 | média |
| **Cadastrar `NODE_ENV=production` na aplicação de produção.** A documentação passou a ser registrada só fora de produção, mas o gate depende dessa variável. Sem ela o schema assume o padrão `qas` e o `/documentation` continua público | **antes da produção** |
| `@fastify/static <=10.1.1` segue vulnerável (path traversal, bypass de guarda de rota) via `@fastify/swagger-ui`. Corrigir exige `@fastify/swagger-ui@6`, breaking. Mitigado por não registrar a documentação em produção, mas a dependência continua na imagem e o scanner continua acusando | média |
| Imagem de produção (`:latest`) tem 351 dias. Promover imagem nova leva um ano de deriva de dependência de uma vez — `fastify` de 5.2 para 5.8, entre outros. Testar em homologação antes de promover | **antes da produção** |
| Confirmar o valor da `API_KEY` cadastrada no Code Engine e combinar com a Aspa — a rota nova exige o header | **antes do teste ponta a ponta** |
| Fixar a imagem base: `node:20-alpine` é tag móvel e continua sendo fonte de deriva entre builds | baixa |
| **Migrar o middleware de `chat/completions` para `runs/stream`** (decidido em 21/10/2026, ver 4.5). Ler o stream inteiro e devolver resposta síncrona à Aspa; texto em `message.created` → `data.message.content`; contexto em `run.completed` → `data.context`; `thread_id` passa a ir no corpo, não no header. Repassar `phone` (vindo de `skills["main skill"].user_defined.phone`) no `context`. Remover o comentário de [`orchestrate.service.ts`](../services/orchestrate.service.ts) que diz que o `context` é ignorado | **antes da tool de transferência** |
| **Variáveis da Aspa na resposta.** O `context` da resposta declara só `thread_id`; o Fastify descarta o resto. Declarar `skills["main skill"].user_defined` com lista fechada (`encerrar_sessao`, `distribuicao`, `atendimento_humano`, `menu_aspa`) e validar `distribuicao` contra o mapa aprovado, em vez de passthrough aberto | **antes da tool de transferência** |
| Resposta vazia do agente sai como `generic: [{ text: "" }]`, não `generic: []`. Perguntar ao André o que a Aspa faz com cada forma (transfere? manda balão vazio?) e definir a forma da transferência | **antes da tool de transferência** |
| Erro do Orchestrate ou timeout sai como 5xx sem `generic`. Perguntar ao André como a Aspa trata (cenário "falha no encaminhamento") | **antes do teste ponta a ponta** |
| Perguntar ao André se a Aspa **substitui** o `context` pelo que devolvemos ou **mescla** com o anterior. Se mesclar, `distribuicao` pode continuar valendo no turno seguinte | **antes da tool de transferência** |

### Sobre a `API_KEY`

> **Correção (11/08/2026):** este item afirmava que o valor tinha 2 caracteres e era placeholder.
> **Está errado.** O `.env` local tem uma chave de **44 caracteres**, compatível com 32 bytes em
> base64 — credencial real. Não há chave a gerar. Confirmar apenas se o valor cadastrado no Code
> Engine de homologação é o mesmo, já que é ele que a Aspa precisa enviar.

A comparação em `validate-key.middleware.ts` foi corrigida (comparava `env.APIKEY`, variável
inexistente), então a autenticação **funciona de verdade**. A rota nova aplica o middleware via
`preHandler`; a antiga continua sem autenticação até o cutover.

---

## 4.3 Agente no Orchestrate — fora do escopo do middleware

| Pendência | Contexto |
|---|---|
| `HABIB_BEARER_TOKEN` precisa virar **Connection** no Orchestrate | O token saiu do middleware, mas as tools do Portal vão precisar dele. Não descartar — mudar de lugar |
| Avaliar modelo governado pela IBM (Granite) | O modelo padrão (GPT-OSS 120B) traz aviso de licença de terceiros, *"not governed by IBM"*. O Habib processa CPF, dados de cobrança e textos jurídicos — questão que compliance pode levantar |
| Revisar as **Guidelines** do Habib | **Respondido pela documentação em 21/10/2026: guidelines não servem para regra determinística.** Cada mensagem do cliente e cada resultado de tool dispara uma chamada extra ao LLM só para escolher guidelines (+0,5 a 3 s por turno, cerca de 40% mais chamadas), e essa escolha não vê tools, contexto nem instructions. Usar só para condições visíveis no texto do cliente. O Habib tem 22 guidelines no export de 21/10; as que encaminham para a equipe devem passar para a tool de transferência. Horário de expediente e resposta literal vão para a tool (`audience: user` entrega o texto sem o LLM reescrever) |
| Textos de comunicação obrigatória com resposta literal | Avisos de ajuizamento e regras de renegociação não podem ser parafraseados pela busca semântica. Ver [01-diagnostico.md](01-diagnostico.md), seção 1.5 |
| Triagem: os documentos da Paraíso cobrem o conteúdo dos 6 domínios ou só o comportamento? | Define se a base de conhecimento parte do material novo ou precisa extrair conteúdo do bot atual |
| Modelo de embeddings da base de conhecimento em inglês | O export de 21/10 mostra `ibm/slate-125m-english-rtrvr-v2` com `language: en`, e os KBs estão em português. Pode piorar a busca. Avaliar modelo multilíngue e comparar a recuperação com as mesmas perguntas |
| Instructions do Habib conflitam com as tools | `ESCOPO DESTA VERSÃO` diz que ele não emite boletos nem executa operação, e `AÇÕES PROIBIDAS` proíbe dizer que vai avisar a equipe. Revisar quando a tool de transferência e a de boletos entrarem |
| Agente pode responder `"None"` em vez de chamar a tool | Problema conhecido da IBM (*Known issues*). O middleware precisa tratar junto com a resposta vazia, para não mandar "None" ao cliente |
| Timeout de tool Python | 2 minutos no total, incluindo a subida do ambiente; chamada externa acima de cerca de 90 s estoura. Considerar no workflow de boletos, junto com o limite de 60 s do middleware |
| Workflow assíncrono | Se o workflow de boletos rodar como fluxo assíncrono, o stream encerra com `flow.slot.listen` e a resposta precisa ser buscada em `GET /v1/orchestrate/threads/{thread_id}/messages`. O `runs/stream` sinaliza o caso; o tratamento (consulta repetida dentro do limite de tempo) fica para o workflow de boletos |
| **Remover o teste de contexto do Habib** | Em 21/10/2026 o draft do Habib recebeu a tool `write_context_test` e `context_variables: [phone, habib_test]`. Tirar a tool e o `habib_test` (manter `phone`) quando a tool de transferência entrar, e apagar a tool com `orchestrate tools remove -n write_context_test` |
| Definir quando publicar o Habib no **live** e qual ambiente o middleware chama | O Habib nunca foi publicado (confirmado em 21/10/2026): só existe o draft, e o middleware conversa com ele. Toda mudança no draft aparece na hora para quem testa pela Aspa. Antes da publicação, passar `environment_id` explícito no `runs/stream` (draft em homologação, live em produção), em vez de depender do padrão da API |
| Três agentic workflows sem descrição na instância | `Agentic_workflow_9830mI`, `Agentic_workflow_1_80765M` e `Agentic_workflow_2_4170JI` aparecem em `orchestrate tools list`. Não estão ligados ao Habib. Descobrir quem criou e se ainda servem |
| ⚠️ A API tem a forma da OpenAI, não o comportamento | O array `messages` **não é a conversa** — a conversa é a thread. Enviar histórico no array gasta banda e não muda a resposta. O middleware manda uma mensagem só, de propósito |

---

## 4.4 Documentação

- **[README.md](README.md) e [02-roadmap.md](02-roadmap.md) estão desatualizados.** Foram escritos
  antes do reequilíbrio do escopo e trazem estimativa de "26 a 39 dias · 8 semanas". O prazo do
  projeto é de **28 dias**, aprovado pelo cliente. Os documentos precisam ser alinhados ou marcados
  como superados, para que ninguém os leia como plano vigente.
- `arquitetura-TO-BE.drawio` está fora do versionamento e desatualizado: mostra o middleware
  chamando o Portal do Cliente (não chama mais) e nomeia o próprio middleware de "Orquestrador",
  o que gera ambiguidade com o produto watsonx Orchestrate.

---

## 4.5 Resolvidas

Registradas para não serem reinvestigadas.

| Item | Conclusão |
|---|---|
| Deploy automático por `git push` derruba produção? | **Não.** Não havia build configurado; as aplicações rodavam imagem publicada manualmente |
| Homologação e produção compartilham imagem? | **Sim, compartilhavam** (`:latest` em ambas). Resolvido: homologação agora publica e consome `:homolog` |
| A thread do Orchestrate expira? | Sobreviveu a mais de uma hora, retomando o histórico. Não descarta TTL mais longo |
| A Aspa precisa mudar para receber o `thread_id` no `context`? | **Não.** Confirmado por eles: leem o `context` de forma genérica, não modificam e não esperam campo específico |
| O timeout do gateway aguarda a resposta do Orchestrate? | **Sim, com folga.** O gateway espera 3 minutos e recomenda ficar dentro de 2. A latência medida em homologação foi de 2,1s a 3,5s |
| A integração do Portal do Cliente funcionava? | **Não, em nenhuma das pontas.** Nenhum dos 809 nós do diálogo gravava a variável `integration`, e o schema de resposta descartava o campo. Código removido |
| Logar `run_id` e `trace_id` da resposta do Orchestrate | Implementado no controller da rota nova, junto do `thread_id`, na mesma linha de log |
| Requisição malformada devolvia 500 | O error handler ignorava o `statusCode` do erro do Fastify. Corrigido: 4xx é honrado, 5xx continua virando 500 |
| Por que a imagem nova ficou 35 MB maior que a de produção? | Deriva de dependência, não código novo. O `package.json` não muda desde 05/03/2025 e nenhuma dependência foi adicionada; sem lockfile versionado, cada `npm install --force` reresolvia todos os `^` para a versão mais nova (`typescript` 5.7→5.9, `vite` 6.2→6.4, `fastify` 5.2→5.8). Resolvido: lockfile versionado e `npm ci` no Dockerfile |
| `package-lock.json` não versionado, builds não reprodutíveis | Lockfile versionado e Dockerfile passou a usar `npm ci`. Build multi-stage: a imagem final leva só dependências de produção, e o `node_modules` caiu de 199 MB para 59 MB. Validado rodando o `build/` contra apenas as deps de produção — rota nova, rota antiga, Swagger e log com redaction, todos ok |
| Redaction de CPF e proposta no log (LGPD) | Implementada em [`src/utils/redact.ts`](../src/utils/redact.ts), aplicada no `interceptor-logger` nas duas rotas. Mascara CPF/CNPJ pontuados e sequências de 5+ dígitos, **preservando os 3 últimos** para correlação. Opção de menu numérico (1, 2, 10) não é mascarada. `thread_id`, `run_id` e `trace_id` são preservados, senão perde-se a única forma de investigar. Vale só para o log — a resposta ao gateway sai intacta |
| Como passar dados do cliente (telefone, CPF) ao agente? | **Pelo `context` da requisição. Testado em 21/10/2026.** A conclusão de 11/08 ("o `context` é descartado; o único canal é o texto da mensagem") estava errada: o export do Habib tinha `context_access_enabled: true` com `context_variables: []`, e a lista vazia bloqueava tudo. Com `phone` na lista, a tool `write_context_test` leu o valor pelo `AgentRun` nos dois endpoints (`chat/completions` e `runs/stream`). Não é preciso citar `{phone}` nas instructions: listar basta para a tool, e o telefone fica fora do texto do prompt. O contexto vale só para uma run; o middleware reenvia a cada turno. Não concatenar dado no texto da mensagem (LGPD) |
| Onde volta a variável que a tool grava? | **Testado em 21/10/2026.** Só volta se estiver em `context_variables`; fora da lista, some sem erro (`habib_test` não voltou até ser listado). Depois de listado: no `runs/stream`, em `run.completed` → `data.context`, `done` → `data.context` e `message.created` → `data.message.context`; no `chat/completions`, **não vem na resposta**, só numa segunda chamada a `GET /v1/orchestrate/threads/{thread_id}/messages`, no `context` da última mensagem do assistente (`/v1/threads/...` dá 404). Consequência: `distribuicao`, `atendimento_humano` e `encerrar_sessao` precisam estar em `context_variables` |
| `chat/completions` ou `runs/stream`? | **`runs/stream`, decidido em 21/10/2026.** Uma chamada por mensagem com o contexto documentado no `run.completed`, contra duas no `chat/completions` (resposta e busca na thread, por um endpoint fora da referência da API). Também aceita `environment_id` e sinaliza workflow assíncrono. Implementação em 4.2 |
| O retorno da tool chega intacto ao cliente? | **Não.** Nos testes de 21/10, o LLM recebeu "Phone not received." e respondeu "Desculpe, não consegui processar…", e depois recebeu "Phone received…" e respondeu "Olá! Como posso ajudar você hoje?". Texto que precisa sair literal (mensagens validadas pela Jô, fora do expediente, encaminhamento) vai com `audience: user`, que pela documentação entrega o texto sem o LLM reescrever. Ainda não testado: testar na tool de transferência |
| Por que o bug `env.APIKEY` nunca foi detectado? | `ignoreDeprecations: "6.0"` era inválido no TS 5.7 e impedia o `tsc` de rodar; o `tsup` não faz checagem de tipos. Corrigido |
