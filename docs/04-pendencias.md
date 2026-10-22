# 4. Pendências

Itens em aberto levantados durante o diagnóstico e a preparação do ambiente.
Atualizado em 22/10/2026.

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

**Feito (confirmado em 22/10/2026):** a Aspa habilitou a homologação apontando o gateway para
`POST /api/orchestrate/message`, com o header `apikey`. ⚠️ A homologação ainda roda a versão com
`chat/completions`; ao publicar a migração para `runs/stream` e a tool de transferência, os testes
pela Aspa passam a transferir de verdade dentro do expediente.

**Enviado em 22/10/2026, aguardando resposta** (André ou Felipe): habilidade do
`atendimento_humano` sem `distribuicao` e destino de `"Outros"`; se o `context` é substituído ou
mesclado; exibição de `resumo_encaminhamento` ao atendente; habilidade sem atendente disponível;
tratamento de `generic: [{ "text": "" }]` e para qual habilidade vai a transferência por resposta
vazia; tratamento de 502/504 sem `generic`; formato de `user_defined.phone`.

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
| **Publicar em homologação a migração para `runs/stream`.** Implementada e testada localmente em 21/10/2026: o serviço lê o stream inteiro (um JSON por linha), tira o texto do `message.created` e o contexto do `run.completed`, e trata `run.failed`/`error` como 502; o controller repassa só o `phone` (de `skills["main skill"].user_defined.phone`) e loga apenas as chaves do contexto. No teste, o contexto voltou com `phone,habib_test`, a thread manteve o histórico entre turnos e o telefone saiu mascarado no log. Também testado: resposta da base de conhecimento (chega como `conversational_search`, não `text`; o primeiro parse a descartava e devolvia texto vazio, corrigido); mensagem sem contexto; `thread_id` criado pelo `chat/completions` (continua funcionando, então conversas abertas na Aspa sobrevivem à troca); timeout (504 com `WXO_TIMEOUT_MS=1500`); `npm run build` | **antes da tool de transferência** |
| Latência do agente subiu para 4 a 8 s | Medido em 21/10/2026 com o mesmo agente e as mesmas perguntas nos dois endpoints: `chat/completions` 4,1 / 8,4 / 7,4 s, `runs/stream` 3,8 / 5,5 / 8,4 s. Não é a migração; em agosto eram 2,1 a 3,5 s. Suspeitas: as 22 guidelines (uma chamada extra ao LLM por turno) e a busca na base. A tool soma mais alguns segundos. Ainda dentro dos 60 s, mas medir de novo depois de revisar as guidelines. Em 22/10/2026, cinco transferências seguidas (busca, tool e resposta escrita pelo LLM): 4,4 a 10,4 s, com um ponto fora da curva de **50,9 s** na primeira | média |
| Trava contra chamada de tool escrita como texto | Em 22/10/2026, em 2 de 3 execuções o Habib escreveu a transferência como texto ao cliente (um JSON com `destination` e `summary`, e em outra "[Transferindo para a equipe responsável]") em vez de chamar a tool: o cliente recebe o texto e ninguém é transferido. Reduzido nas instructions (chamar a tool antes de escrever qualquer coisa), mas o prompt não garante. Avaliar no middleware: resposta com JSON de tool ou marcador de transferência não vai ao cliente e vira transferência. Mesmo plano da camada 3 contra contatos inventados (4.3) | média |
| **Publicar em homologação as variáveis da Aspa na resposta.** Implementado e testado localmente em 21/10/2026: [`aspa-control.ts`](../src/utils/aspa-control.ts) traduz o contexto da run para `skills["main skill"].user_defined` com lista fechada (`distribuicao`, `atendimento_humano`, `encerrar_sessao`, `menu_aspa`, `resumo_encaminhamento`). `distribuicao` fora dos 12 valores (inclusive "Financeiro") é descartada e logada como erro; `atendimento_humano` sem equipe também, até o André confirmar o humano geral. A lista de equipes existe em dois lugares (middleware e tool): mudar juntos | **antes do teste ponta a ponta** |
| Negrito em Markdown chega errado ao WhatsApp | Em 21/10/2026 o Habib respondeu "das **09:00 às 18:00**". O WhatsApp usa `*texto*`; o `**` aparece literal para o cliente. Corrigir nas instructions (o FORMATO já pede links em Markdown) ou converter no middleware | média |
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
| Revisar as **Guidelines** do Habib | **Respondido pela documentação em 21/10/2026: guidelines não servem para regra determinística.** Cada mensagem do cliente e cada resultado de tool dispara uma chamada extra ao LLM só para escolher guidelines (+0,5 a 3 s por turno, cerca de 40% mais chamadas), e essa escolha não vê tools, contexto nem instructions. Usar só para condições visíveis no texto do cliente. O Habib tem 22 guidelines no export de 21/10. **Plano decidido em 21/10: zerar as guidelines**, porque basta uma para cada turno pagar a chamada extra. Destinos: tool de transferência (pedido de valor, situação do contrato, atendente humano, já tentou, notificação/jurídico, renegociação, inscrição do IPTU); tool com texto literal e `encerrar_sessao` (ofensa ou ameaça); instructions (portal, arras, troca de lote, disponibilidade, interesse comercial, exclusão de encargos, pagamento a corretor, exaltado, nome do atendente, terceiro, mais de um lote, pedido vago); descartar (fora de escopo e "não oferecer encaminhamento", que não funcionam como guideline). A guideline "Situação específica do contrato" tem `action` copiada da `condition` e não manda fazer nada. Fazer depois da tool de transferência e medir latência e respostas antes e depois, com as mesmas perguntas |
| Textos de comunicação obrigatória com resposta literal | Avisos de ajuizamento e regras de renegociação não podem ser parafraseados pela busca semântica. Ver [01-diagnostico.md](01-diagnostico.md), seção 1.5 |
| Triagem: os documentos da Paraíso cobrem o conteúdo dos 6 domínios ou só o comportamento? | Define se a base de conhecimento parte do material novo ou precisa extrair conteúdo do bot atual |
| **A base de conhecimento do Orchestrate está desatualizada** | Confirmado em 22/10/2026: a base `base_conhecimento_paraisogold_3684ZC` foi carregada pelo painel antes da validação dos 16 KBs e nunca foi atualizada. Nos testes de transferência o Habib citou trechos que não existem em nenhum dos 16 KBs nem na revisão de 28/09 ("procure seu advogado para que ele entre em contato com o advogado da empresa", repetido quase igual em duas sessões; "sentença, termo de acordo ou petição inicial"). Também aplicou as condições gerais de renegociação (24 parcelas pagas) a contrato ajuizado. **Plano decidido:** (1) varredura dos 16 KBs, sem perder conteúdo: cada trecho de regra de sistema ou API e cada instrução de comportamento ("O Habib deve…") é removido por já estar no mapa da API de boletos, movido para instructions ou tool, ou mantido. Medição de 22/10: 1.226 parágrafos, 68 citam sistema, API, valor retornado, status ou tipo de título (renegociação 13, boletos 13, quitação 10, transferência 9, IPTU 7) e cerca de 100 instruem o Habib diretamente; (2) base nova, em docx, com o modelo de embeddings padrão; (3) medir com as mesmas perguntas; (4) trocar o modelo de embeddings se a medição pedir. A base antiga só sai depois que a nova estiver ligada ao Habib: o draft é o que a Aspa usa. Traduzir os KBs para inglês foi descartado: toda resposta sairia traduzida, ou seja, parafraseada, e o texto validado é o português |
| Modelo de embeddings da base de conhecimento em inglês | O export de 21/10 mostra `ibm/slate-125m-english-rtrvr-v2` com `language: en`, e os KBs estão em português. Pode piorar a busca. Avaliar modelo multilíngue e comparar a recuperação com as mesmas perguntas. **Levantado em 22/10/2026:** não há como listar os modelos de embeddings da instância (`orchestrate models list -a` só traz LLMs, e `GET /v1/orchestrate/models` volta vazio). A documentação só garante `embeddings_model_name` e o padrão inglês; `chunk_size`, `chunk_overlap` e `language` aparecem apenas no exemplo com OpenSearch. Candidatos a testar em base nova, que não afeta o Habib até ser ligada: `ibm/granite-embedding-278m-multilingual` (da IBM, ajuda na questão de compliance), `intfloat/multilingual-e5-large` e `virtual-model/openai/text-embedding-3-small` (o único multilíngue citado na documentação). O `chunk_size: 400` do `habib.yaml` é do `chat_with_docs`, desligado, e não da base. Para ver o chunking real, exportar a base depois de criada (`orchestrate knowledge-bases export`) |
| **Explicação antes da transferência é escrita pelo LLM** | Desde 22/10/2026 a `transfer_to_human` devolve instrução ao LLM (`audience: assistant`), e ele escreve a explicação da regra e o aviso de encaminhamento. Em 4 de 5 execuções a explicação saiu imprecisa: regra errada, "definidos na documentação" (viola o MASCARAMENTO TÉCNICO) e trechos da base desatualizada. Reavaliar depois da base nova. Se continuar, a saída é uma explicação fixa por equipe dentro da tool, entregue literal |
| ⚠️ **O Habib inventou contatos** | Em 21/10/2026, à pergunta "Qual o prazo para pedir a escritura depois de quitar o lote?", respondeu com `atendimento@paraisogold.com.br` e `(41) 3221-1234`. Nenhum dos dois está nos 16 KBs nem nos trechos recuperados pela busca (thread `05361435-62b9-4f9e-8dc1-4f5e1fd8d743`). Contraria a regra ORIGEM OBRIGATÓRIA das instructions. Na mesma bateria, outra resposta disse "Não encontrei na documentação", contrariando o MASCARAMENTO TÉCNICO. As regras no prompt não estão segurando; levar à revisão do agente antes de qualquer piloto. **Causa provável:** os contatos reais (`sac@paraisogold.com.br`, `(41) 3023-2882`, em `kb_institucional.docx`) não vieram na busca, e as instructions afirmam que "dados institucionais existem e são recuperáveis" e mandam terminar "com o contato ou link exatos": o modelo completa o padrão. **Plano em três camadas:** (1) instructions passam a encaminhar pela Aspa quando faltar o dado, em vez de exigir contato; (2) contatos oficiais validados pela Jô entregues de forma determinística (tool com `audience: user` ou KB próprio); (3) trava no middleware: e-mail, telefone ou link fora da lista oficial bloqueia a mensagem e transfere. Só a camada 3 garante o resultado |
| **Feriados da tool de transferência são cadastrados à mão** | A lista `HOLIDAYS` em [`transfer_to_human.py`](../orchestrate/tools/transfer_to_human.py) cobre de 02/11/2026 a 31/12/2027. Depois disso, a tool volta a tratar todo dia útil como expediente, sem aviso. Atualizar a lista todo ano, antes de virar o ano, e reimportar a tool |
| **Confirmar com a Jô as datas sem atendimento humano** | Validar a lista de feriados da tool. Em aberto: Carnaval e Corpus Christi (ponto facultativo, não feriado nacional); 8 de setembro (Nossa Senhora da Luz, feriado só de Curitiba); 24 e 31 de dezembro (expediente normal, meio período ou sem atendimento?) |
| Validar com a Jô o texto de fora do expediente | Só esse texto continua fixo e literal (`OUT_OF_HOURS_MESSAGE` em [`transfer_to_human.py`](../orchestrate/tools/transfer_to_human.py)): reescrito, o LLM poderia prometer um encaminhamento que não acontece. O aviso de encaminhamento deixou de ser fixo em 22/10/2026 e passou a ser escrito pelo LLM, para vir junto da explicação |
| Avisar o André que o resumo do encaminhamento vai no contexto | A tool grava `handoff_summary`, e o middleware vai repassar junto com `distribuicao`. Combinar o nome do campo em `user_defined` e se a Aspa consegue exibi-lo ao atendente |
| Instructions do Habib conflitam com as tools | `ESCOPO DESTA VERSÃO` diz que ele não emite boletos nem executa operação. Revisar quando a tool de boletos entrar. (`AÇÕES PROIBIDAS` e `DADOS FALTANTES` foram ajustados para a transferência em 22/10/2026) |
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
| O texto em `generic` chega ao cliente quando a resposta também traz `distribuicao`? | **Sim. Resposta do André (Aspa):** a transferência é registrada primeiro no banco da Aspa e em seguida a mensagem é enviada ao cliente; para o atendente, a conversa só aparece depois do envio das mensagens. A mensagem de encaminhamento da `transfer_to_human` chega ao cliente e já está no histórico quando o atendente assume |
| Como fazer o Habib chamar a `transfer_to_human`? | **Resolvido em 22/10/2026.** "Meu contrato foi ajuizado e eu quero renegociar a dívida" respondia pela base e não transferia: as `escalation_rules` não citavam a tool e mandavam encerrar quando a base cobria o assunto. As regras foram reescritas com a lista de quando encaminhar (a equipe continua só na docstring da tool, para não haver duas listas). Com explicação antes da chamada, o modelo encerrava o turno no texto e escrevia a chamada em vez de executá-la (1 de 3 transferiu). Invertida a ordem: a tool é chamada primeiro e devolve instrução ao LLM (`audience: assistant`), que escreve a explicação e o aviso depois. Resultado: 5 de 5 transferiram para `Ajuizados`, com resumo "renegociação de contrato ajuizado". A qualidade da explicação segue em aberto (4.3) |
| Texto fixo é exigência do Orchestrate? | **Não.** Pela documentação de resposta de tool, `audience: user` entrega o texto sem o LLM raciocinar sobre ele, e `audience: assistant` deixa o LLM ler e escrever a resposta final. Texto fixo é escolha nossa, para o que não pode ser parafraseado |
| Por que o bug `env.APIKEY` nunca foi detectado? | `ignoreDeprecations: "6.0"` era inválido no TS 5.7 e impedia o `tsc` de rodar; o `tsup` não faz checagem de tipos. Corrigido |
