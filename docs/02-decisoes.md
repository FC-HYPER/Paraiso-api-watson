# 2. Decisões e aprendizados

O que já foi decidido ou comprovado em teste, para não ser reinvestigado nem desfeito sem motivo.
Itens em aberto estão em [01-pendencias.md](01-pendencias.md); o funcionamento do middleware, em
[03-middleware.md](03-middleware.md).

---

## 2.1 Aspa (gateway do WhatsApp)

| Assunto | Decisão ou resposta |
|---|---|
| Como a Aspa lê o `context` da resposta | *"Lemos de forma genérica, não modificamos e nem esperamos algum valor específico ali dentro"* (11/08/2026). O `thread_id` viaja dentro do `context` e a Aspa não muda nada |
| Onde a Aspa lê o texto | Em `data.output.generic`, sempre um array: envia **todas** as mensagens, buscando `text` ou `attachment` (11/08/2026). `attachment` precisa ser URL de download desprotegida. Hoje sempre vai um item só |
| Timeout do gateway | Espera até **3 minutos** e recomenda ficar dentro de **2** (11/08/2026). O middleware usa 120 s |
| Texto em `generic` junto com `distribuicao` | A Aspa registra a transferência e em seguida envia a mensagem; o atendente já recebe a conversa com ela (André, 22/10/2026) |
| Homologação | A Aspa aponta a homologação para `POST /api/orchestrate/message` com o header `apikey` (confirmado em 22/10/2026) |
| `context` substituído ou mesclado | **Substituído.** A Aspa reenvia o `context` exatamente como o devolvemos na última resposta e não guarda registro (André, 22/10/2026). Uma `distribuicao` não persiste no turno seguinte: o middleware só lê o `phone` da entrada e só devolve o controle da run atual |
| Formato do telefone | `user_defined.phone` vem completo: `55` + DDD + número (André, 22/10/2026) |
| `atendimento_humano` sem `distribuicao` | Transfere para o **TIME**, não para uma habilidade. Não existe destino "Outros" configurado (André, 22/10/2026) |
| `generic` vazio e erro do middleware | Os dois tiram a conversa do agente e transferem para o TIME (André, 22/10/2026; o documento "Integração IA ParaísoGold" já dizia isso do `generic` vazio) |
| Distribuição dentro da habilidade | Prefere quem está online; sem ninguém online, distribui igualmente entre os usuários da habilidade (André, 22/10/2026). A transferência sempre chega a alguém: o bloqueio fora do expediente na `transfer_to_human` é escolha nossa, não limitação da Aspa |
| Resumo do encaminhamento ao atendente | A Aspa não exibe hoje; o André vai propor no desenvolvimento deles (22/10/2026). O middleware já envia `resumo_encaminhamento` |
| Boleto: API ou fluxo `emitir_boleto` da Aspa | **Pela API, via tool no Orchestrate.** O `emitir_boleto` não é usado. Formato de consumo alinhado com o Bruno |
| Equipes de `distribuicao` | 12 valores aprovados pela Jô em 20/10/2026 e configurados pelo André: Boletos, Quitacao, Rescisao, Renegociacao, Transferencia, Contrato, IPTU, Escrituras, Compra, Ajuizados, Demarcacao, Reclamacao. "Financeiro" fica de fora (contas a pagar interno) |

---

## 2.2 API do Orchestrate

| Assunto | Decisão ou aprendizado |
|---|---|
| `chat/completions` ou `runs/stream` | **`runs/stream`** (21/10/2026). Uma chamada por mensagem, com o contexto gravado pelas tools no `run.completed`. O `chat/completions` não traz esse contexto na resposta: exigiria uma segunda chamada a `GET /v1/orchestrate/threads/{id}/messages`, fora da referência da API. O `runs/stream` também aceita `environment_id` e sinaliza workflow assíncrono |
| A API tem a forma da OpenAI, não o comportamento | O array `messages` **não é a conversa**: a conversa é a thread. Mandar histórico no array gasta banda e não muda a resposta. O middleware manda uma mensagem só |
| Duração da thread | Retomada com sucesso mais de uma hora depois, com o histórico. A retenção configurada (30 dias por padrão) está nas pendências |
| Como passar dado do cliente ao agente | **Pelo `context` da requisição** (21/10/2026). Não concatenar no texto da mensagem (LGPD). O contexto vale para uma run; o middleware reenvia a cada turno |
| `context_variables` | Uma variável só entra na run, e só volta dela, se estiver em `context_variables` do agente. Fora da lista, some sem erro: com `context_access_enabled: true` e lista vazia, nada passava. Não é preciso citar `{var}` nas instructions para a tool ler |
| Onde volta o que a tool grava | No `runs/stream`: `run.completed` → `data.context`, `done` → `data.context` e `message.created` → `data.message.context` |
| Onde aparece a busca na base no histórico da thread | Como chamada da ferramenta `base_conhecimento_paraisogold_v2` no `step_history` (`frontier`) ou como conteúdo `conversational_search` com `search_results` (`gpt-oss`). Não aparece nas etapas de tool do `gpt-oss` |

---

## 2.3 Agente Habib

### Modelo

| Assunto | Aprendizado |
|---|---|
| `groq/openai/gpt-oss-120b` | Faz **uma única chamada de ferramenta por turno**: em 19 turnos medidos em 22/10/2026, ou consultou a base, ou chamou a `transfer_to_human`, nunca as duas. Quando transferia, escrevia a explicação de memória (inventou RG e CPF, "72 h", "Área do Cliente" como canal de renegociação); quando consultava, respondia sem transferir, inclusive no caso do ajuizado |
| `watsonx-orchestrate/frontier` | Em uso desde 22/10/2026. Faz busca, transferência e explicação no mesmo turno: em 9 turnos de transferência, 8 consultaram a base antes, e a explicação saiu do trecho recuperado. Segue melhor as regras de caso. Uns 5 s mais lento. O Orchestrate trocou o estilo para `react_intrinsic` sozinho. Reporta `provider: openai`. **Não é o modelo Premier** cobrado à parte: o Premier está desligado na instância (`are-premier-models-enabled: false`), e com ele desligado nenhum agente roda modelo Premier |

### Retorno de tool

| Assunto | Aprendizado |
|---|---|
| O retorno da tool chega intacto ao cliente? | **Não**, por padrão o LLM reescreve (21/10/2026: recebeu "Phone received…" e respondeu "Olá! Como posso ajudar?"). `audience: user` entrega o texto literal, sem o LLM raciocinar; `audience: assistant` deixa o LLM ler e escrever. Texto fixo não é exigência da plataforma: é escolha nossa para o que não pode ser parafraseado |
| `frontier` com `audience: assistant` | **Quebra** (22/10/2026): todo turno de transferência terminava em "I have encountered an error. Please try again.", sem detalhe no stream, embora a transferência fosse registrada. Sem a anotação (`TextContent` simples), funciona. O `audience: user` ainda não foi testado no `frontier` |
| Docstring de tool | Nada no formato `nome (tipo):` nem `Palavra:` dentro de `Args`, senão o ADK lê como parâmetro |

### Transferência

| Assunto | Aprendizado |
|---|---|
| Fazer o modelo chamar a tool | As `escalation_rules` precisam dizer que encaminhar **é** chamar a `transfer_to_human`; sem isso, "encaminhar" vira um texto que o modelo escreve. A equipe fica só na docstring da tool, para não haver duas listas |
| Explicar antes de chamar a tool | Faz o modelo encerrar o turno no texto e escrever a chamada como texto (JSON ou "[Transferindo…]") em vez de executá-la. A ordem certa é consultar a base, chamar a tool e só então escrever |
| Explicação e aviso de encaminhamento | Escritos pelo LLM depois da tool, a partir da instrução que ela devolve. A Jô quer explicação antes da transferência, não transferência seca. Fora do expediente, o texto é literal, porque reescrito poderia prometer um encaminhamento que não acontece |
| Pedido sem análise prevista | Desconto ou retirada de multa, juros ou correção, desconto extra na quitação e renegociação quando o cliente diz que não cumpre as condições são explicados e **não** encaminhados, como mandam os KBs |

### Instructions e guidelines

| Assunto | Aprendizado |
|---|---|
| Guidelines | Cada mensagem e cada resultado de tool disparam uma chamada extra ao LLM só para escolher guidelines, e essa escolha não vê tools, contexto nem instructions. Servem só para condição visível no texto do cliente, nunca para regra determinística. Em 22/10/2026, 21 das 22 saíram (eram remendos de testes antigos): as de encaminhamento já estavam nas `escalation_rules`, e as demais viraram regra em `tone_and_style` ou `<case_rules>` **só quando havia base nos KBs validados**. Fica a de ofensa, até virar tool. Tirá-las quase não mudou a latência (8,8 → 8,1 s) |
| Conflito entre regras | O modelo segue a regra **mais específica** sobre o assunto. Cada regra de caso precisa dizer a ação (encaminhar ou não), e frase genérica não pode contradizer a lista de encaminhamento (ex.: "dúvida sobre como um processo funciona" fazia "Como faço para renegociar?" não ser transferido) |
| Regra fixa | Vai para tool ou middleware, não para o prompt. Proibição no prompt reduz, mas não garante: contatos inventados e chamada escrita como texto continuaram aparecendo com regra explícita |

---

## 2.4 Base de conhecimento

| Assunto | Decisão ou aprendizado |
|---|---|
| Conteúdo | A base parte dos **16 KBs validados pela Jô**, revisados em 22/10/2026. Os `.docx` revisados estão em `paraiso - docs orchestrate habib/…/01-knowledge-base/kbs em word v2`; os originais validados, em `kbs em word`, intocados |
| **Como escrever e manter um KB** | O KB contém só **fatos que o cliente pode ouvir**, porque é recuperado em pedaços e entregue ao modelo como conteúdo para responder: "o Habib deve informar o valor retornado pelo sistema" vira resposta ou faz o modelo supor um sistema que não tem. Ao receber um KB novo ou alterado: regra de sistema ou de API vai para a tool (catálogo de eventos e `REGRAS_API_ATUAL.md`); comportamento ("o Habib deve…") vai para as instructions; encaminhamento ("encaminhar ao grupo X") vai para a docstring da `transfer_to_human`. Nada se apaga sem destino. Uma proibição só vira fato quando o próprio KB afirma o fato: "o Habib não deve afirmar que o FGTS pode ser usado" vira "o FGTS não pode ser usado", porque o KB diz isso em outro ponto; "o Habib não deve sugerir recompra" não vira "a Central Gold não faz recompra" e vai para as instructions |
| Roteiro da revisão de 22/10/2026 | Parágrafo por parágrafo, com o texto antigo, o novo e o destino de cada trecho, e a conferência automática de que nada fora da lista mudou. Está no histórico do git: `docs/06-varredura-kbs.md`, commit `f7d308c` (`git show f7d308c:docs/06-varredura-kbs.md`) |
| KB contra a API | Quando o KB diverge da regra atual da API, vale a API. Ex.: o reembolso vencido de IPTU, condomínio ou taxa de lixo precisa ser pago antes dos demais boletos, como diz o evento `pendencias_reembolso_a_regularizar` |
| Base atual | `base_conhecimento_paraisogold_v2_3364wk`, criada pelo painel em 22/10/2026 e versionada em [`base_conhecimento_v2.yaml`](../orchestrate/knowledge_bases/base_conhecimento_v2.yaml). A antiga (`…_3684ZC`) tinha sido carregada antes da validação, fazia o Habib citar trechos que não existem nos KBs e foi excluída |
| Criar base pelo painel na tela do agente | O painel liga a base ao agente na hora. O `habib.yaml` fica desatualizado até ser corrigido à mão; um import com o YAML antigo religaria a base anterior. Fonte da verdade do agente: o YAML |
| Traduzir os KBs para inglês | Descartado: toda resposta sairia traduzida, ou seja, parafraseada, e o texto validado é o português. Para alinhar idioma, troca-se o modelo de embeddings |
| Modo da base | Já é o **Dynamic**, o recomendado (`query_source: Agent` e `generation.enabled: false`): a base devolve trechos ao agente, que decide o que fazer e pode chamar outras ferramentas no mesmo turno |
| Formato dos arquivos | `.docx` serve e é o que a Jô edita. O que pesa na busca é a estrutura: cada trecho chega ao modelo sem o título da seção, então seção que depende de outra se mistura (ex.: condições gerais de renegociação aplicadas a contrato ajuizado) |
| Configuração exportada | `chunk_size` 400, `chunk_overlap` 50, `ibm/slate-125m-english-rtrvr-v2`, `language: en`. Não há como listar os modelos de embeddings da instância (`models list -a` só traz LLMs; `GET /v1/orchestrate/models` volta vazio) |

---

## 2.5 Middleware

| Assunto | Decisão ou aprendizado |
|---|---|
| `API_KEY` | O `.env` local tem uma chave real de 44 caracteres (32 bytes em base64), não placeholder. A comparação em `validate-key.middleware.ts` comparava uma variável inexistente (`env.APIKEY`) e foi corrigida |
| Checagem de tipos | O `npm run build` (tsup) não faz checagem de tipos; o bug do `env.APIKEY` sobreviveu por isso. Rodar `npx tsc --noEmit` antes de commitar |
| Integração do Portal do Cliente | Nunca funcionou: nenhum dos 809 nós do diálogo gravava a variável `integration`, e o schema de resposta descartava o campo. Código removido |
