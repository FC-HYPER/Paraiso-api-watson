# 1. Pendências

Só o que está em aberto. Atualizado em 03/11/2026.
Decisões e testes concluídos estão em [02-decisoes.md](02-decisoes.md); ao resolver um item, ele sai
daqui e o que ensinou vai para lá.

---

## 1.1 Externas — dependem de terceiros

| Pendência | Situação |
|---|---|
| André: exibir o resumo ao atendente | A Aspa não mostra o `resumo_encaminhamento` hoje; o André vai propor no desenvolvimento deles. Quando existir, combinar o nome do campo (hoje provisório) |
| André: quando a Aspa zera o contexto | Perguntado; aguardando. **Deixou de bloquear a saudação**, que o middleware vai decidir sozinho (1.2). Serve só para saber com que frequência a saudação vai aparecer. Já se sabe que o **Reiniciar** da homologação não zera (02-decisoes.md, 2.1); falta saber de produção (fim da sessão, tempo sem mensagem, volta do atendente) |
| André: o que chega no clique em "Outros Assuntos" | Em produção, a Aspa recebe o cliente com menu próprio ("Como podemos ajudá-lo hoje?": Boletos, Pagamentos, Outros Assuntos) e só passa ao bot no clique em **Outros Assuntos**; a homologação não tem o menu, e a mensagem vai direto ao Habib (03/11/2026). Perguntar se o clique chega ao middleware e com que `input`. Se chegar com texto fixo, é o gatilho exato da saudação (melhor que a regra de horas) e, nesse turno, o middleware responde só a saudação. Também muda o texto: o cliente já foi recebido pelo menu, então a saudação do Habib é a segunda recepção (validar com a Jô) |
| Jô: ofensa em dois níveis | Os textos da advertência e do encerramento já vieram da Jô. Falta ela confirmar o encerramento da sessão (`encerrar_sessao`) antes de virar tool (1.3) |
| Jô: datas sem atendimento humano (deixado para depois em 23/10/2026) | Validar a lista `HOLIDAYS` da tool e do middleware. Em aberto: Carnaval e Corpus Christi (ponto facultativo); 8 de setembro (feriado só de Curitiba); 24 e 31 de dezembro |
| Formato do `attachment` | Perguntar à Aspa quando houver anexo (boleto em PDF): o campo recebe a URL direto ou um objeto? Antes de emitir, estender o schema de resposta, senão o Fastify descarta o campo |
| Jô: o que é a Taxa de Notificação | Os KBs só citam o nome (lançamento do Extrato). Com a busca, o Habib inventou que ela "surge quando há notificação de cobrança". Hoje ele não explica e encaminha a Ajuizados (regra TAXA DE NOTIFICAÇÃO). Com o texto da Jô, a explicação entra no `kb_boletos_carnes` e a regra sai |
| Webhook `/watson/solicitacao` | O dialog do Watson chama um serviço em Google Cloud Run que envia e-mail, CPF/CNPJ, proposta, telefone e tipo de fatura. Levantar quem mantém e o que faz: precisará virar tool no Orchestrate |

---

## 1.2 Middleware

| Pendência | Prioridade |
|---|---|
| **Publicar em homologação** a separação de conversas de 03/11/2026 (`last_message_at`, thread nova depois de 24 h sem mensagem e na saída do Habib; 03-middleware.md 3.4), pelo ciclo de 3.9. Não exige variável nova no Code Engine. Depois, repetir na homologação: transferência, Reiniciar e `oi`, que deve chegar **sem** `thread_id` ao Orchestrate | **antes da produção** |
| **Saudação do primeiro contato** (decidido em 03/11/2026 fazer do nosso lado). Texto da Jô, literal: "Olá! Que bom receber você por aqui. 🙂 Sou o Habib, assistente virtual da Central Gold. Como posso ajudar hoje?". Hoje não existe: num "Oi", o Habib responde texto livre (CONVERSA SOCIAL). **A detecção já existe**: `resolveConversation` marca conversa nova (sem `thread_id`, ou mais de 24 h sem mensagem; 03-middleware.md 3.4). Falta: pôr a saudação como **primeiro item** do `generic`, antes da resposta do Habib, quando a conversa for nova; e, quando a mensagem for só um cumprimento, responder só a saudação sem chamar o agente, para não saudar duas vezes. Não pela data da thread (o UUID não traz data, e consultá-la seria uma chamada a mais por turno), nem pelo agente (prompt não garante texto literal; tool com `audience: user` substituiria a resposta à pergunta). Depende do texto validado pela Jô, que muda se o clique em "Outros Assuntos" (1.1) for o gatilho | média |
| **Link em Markdown aparece cru no WhatsApp** (teste ponta a ponta, 03/11/2026): o cliente vê `[Área do Cliente](https://…/portal/login)`. Converter em `whatsapp-format.ts` para `texto: url`, **depois** da trava do link oficial, que depende do Markdown. Mudar também 3.5 do 03-middleware.md | média |
| **Log estruturado por run** (base para o painel abaixo e para a decisão da base externa, 1.3). Uma linha JSON por run, sem texto livre do cliente: tools chamadas em ordem; `query` da busca na base, mascarada; documento e `score` de cada trecho recuperado, sem o texto; resposta "não tenho essa informação"; duração; transferência (equipe, dentro ou fora do expediente); travas acionadas; falhas (502, 504, vazio/None, `retrying without thread_id`); tokens, se o stream trouxer. Antes, capturar um stream bruto pelo middleware local e confirmar que a busca na base vem nos `run.step.delta` com `query` e `search_results`, como no histórico da thread (2.2) | média |
| **Painel de acompanhamento** sobre o log estruturado, para não depender do log cru. Determinístico (contagens e listas); LLM só numa etapa seguinte, para qualidade, com custo e LGPD a pesar. Opções: IBM Cloud Logs (dashboards prontos, pago); observabilidade do próprio Orchestrate (a investigar primeiro: o que oferece na instância); banco simples (Cloudant tem plano gratuito) com página nossa | baixa |
| Confirmar a retenção de threads configurada (*Enterprise Controls > Data Retention*, de 30 a 365 dias; padrão 30). Perdeu importância: com a conversa recomeçando depois de 24 h sem mensagem (3.4 do 03-middleware.md), a retenção mínima nunca alcança uma conversa ativa, e thread apagada já não derruba a conversa (02-decisoes.md) | baixa |
| **Trava contra invenção (camada 3), o que falta.** Já existem a correção do link da Área do Cliente e a retirada da promessa de registro. Faltam: e-mail ou telefone fora da lista oficial, e chamada de tool escrita como texto (JSON, "[Transferindo…]"), que não deveriam chegar ao cliente. Nenhum dos dois apareceu nas baterias com o `frontier` | média |
| Cadastrar `NODE_ENV=production` na aplicação de produção, senão o Swagger fica público | **antes da produção** |
| Imagem de produção (`:latest`) tem quase um ano: promover leva um ano de deriva de dependência. Testar em homologação antes | **antes da produção** |
| `@fastify/static <=10.1.1` vulnerável via `@fastify/swagger-ui`; corrigir exige `swagger-ui@6`, breaking. Mitigado por não registrar a documentação em produção | média |
| `fastify-zod@1.4.0` declara peer `fastify@4` e o projeto roda o 5; obriga `--legacy-peer-deps`. Avaliar `fastify-type-provider-zod` | média |
| `zod` 3 vulnerável (alta, consumo de memória em coleção grande). A correção só existe no zod 4, breaking, e o `fastify-zod` depende do 3: resolver junto com a troca acima | média |
| Vulnerabilidades em dependências de dev que só se corrigem com major: `esbuild` (baixa, via `tsup@8`; corrige no `tsup@9`), e `@typescript-eslint` antigo (via `@rocketseat/eslint-config@2`; corrige no 3). Não vão para a imagem de produção, mas o Dependabot alerta. `vite`, `vite-tsconfig-paths` e `vitest` saíram em 28/10/2026, sem uso, e com eles o alerta 2 (moderado, `vitest`) e o crítico do `tinypool`; o alerta da `main` só fecha quando a branch entrar nela | baixa |
| Verificar se há gatilho automático de build por push; hoje é preciso **Executar novamente a compilação** | baixa |
| `prettier` acusa `Delete ␍` em todo arquivo (CRLF sem `endOfLine` no `.prettierrc.json`), e `npm run lint` falha por isso | baixa |
| Fixar a imagem base: `node:20-alpine` é tag móvel | baixa |
| Remover `HABIB_API_URL` e `HABIB_BEARER_TOKEN` das variáveis do Code Engine | baixa — ao final |
| Definir se os 3 últimos dígitos preservados no log atendem à política de privacidade do cliente | baixa — compliance |

---

## 1.3 Agente no Orchestrate

| Pendência | Situação |
|---|---|
| Tool de ofensa com `encerrar_sessao` | A guideline "Ofensa direta ou ameaca" continua. Virar tool com os textos da Jô (advertência e encerramento) e `encerrar_sessao`, depois da confirmação dela (1.1) |
| Base externa com embedding multilíngue | Decidido em 27/10/2026 ficar com a base interna (só embedding em inglês) e decidir com dados reais: 2 a 4 semanas de conversas medindo respostas "não tenho essa informação" (o middleware pode logar) e transferências erradas. Migrar se aparecerem várias falhas de vocabulário ou se a lista de regras fixas crescer. O contato da IBM se ofereceu para dimensionar Milvus, Elasticsearch ou Astra DB |
| Modelo `frontier`: decisão definitiva | Pesar aderência às regras contra latência (mediana ~12 s, picos de até 55 s). O custo em si não está documentado. Não é governado pela IBM (`provider: openai`), assim como o `gpt-oss`: o Habib processa CPF, cobrança e textos jurídicos, e compliance pode levantar. Alternativa a avaliar: Granite |
| Latência | Acompanhar os picos depois da publicação. Antes do `frontier`, ~8 s; em agosto, 2 a 3,5 s. Cada guideline acrescenta de 0,5 a 3 s |
| Explicação na transferência é texto do LLM | Com o `frontier`, sai do trecho recuperado da base. Se a Jô quiser garantia, a saída é uma explicação fixa por equipe dentro da tool, entregue literal |
| Contatos oficiais de forma determinística | Os contatos validados estão na regra CONTATOS OFICIAIS das instructions, e nenhuma bateria trouxe contato inventado, mas o prompt não garante. A regra de só informar quando o cliente pede também falha: sem a informação (unificação, 2 de 3 em 27/10/2026, antes de a seção ser recuperada; "código de barras" na sonda), o Habib passa os contatos como saída. Camada 2: entregar por tool com `audience: user`; camada 3 em 1.2 |
| Feriados da tool e do middleware | A lista `HOLIDAYS` cobre até 31/12/2027, nos dois lugares. Depois disso, todo dia útil vira expediente, sem aviso. Atualizar todo ano, nos dois, e reimportar a tool |
| **Tool de boletos** | Especificação: identificação do cliente (CPF, contrato, data); pendências que impedem emissão (notificação de cobrança, ação ajuizada, contrato físico pendente, reembolso de IPTU, condomínio ou taxa de lixo a pagar antes); valor mínimo de regularização calculado pela API, nunca pelo Habib. Fontes: catálogo de eventos (`eventos-retorno-whatsapp.pdf`, 15/10/2026, com as mensagens validadas) e `REGRAS_API_ATUAL.md`. Nada disso existe mais nos KBs. Já decidido: o boleto sai pela API via tool, e a tool devolve **conceitos** (`cobranca_juridica_ativa`, `boleto_bloqueado`, `valor_minimo_liberado`), não letras de título (K, P, I, D, X, F, T, Y), para instructions e KBs não dependerem do formato da API |
| Instructions conflitam com a tool de boletos | `ESCOPO DESTA VERSÃO` diz que o Habib não emite boletos. Revisar quando a tool entrar |
| Tools futuras (quitação, rescisão, sessão autenticada) | Saíram dos KBs os trechos "consultar o sistema", "aproveitar a sessão autenticada", "registrar a solicitação" e "informar o protocolo". Retomar quando houver tool para esses fluxos; até lá, o Habib não promete registro nem protocolo, e o middleware retira a promessa se ela aparecer |
| Backlog: leitura de documentos enviados pelo cliente | O `kb_contrato_atendimento_assinatura` previa o Habib receber o contrato e apontar os campos a assinar, "dentro da capacidade técnica liberada e testada". Saiu do KB; retomar se o canal passar a receber arquivos |
| `HABIB_BEARER_TOKEN` vira **Connection** no Orchestrate | As tools do Portal vão precisar dele. Não descartar: mudar de lugar |
| Timeout de tool Python | 2 minutos no total, incluindo a subida do ambiente. Considerar no workflow de boletos, junto com os 120 s do middleware |
| Workflow assíncrono | Se o workflow de boletos for assíncrono, o stream encerra com `flow.slot.listen` e a resposta vem por `GET /v1/orchestrate/threads/{thread_id}/messages`. O middleware só loga o caso hoje |
| Publicar o Habib no **live** | Só existe o draft, e toda mudança aparece na hora para quem testa pela Aspa. Antes de publicar, passar `environment_id` explícito no `runs/stream` (draft em homologação, live em produção) |
| Três agentic workflows sem descrição na instância | `Agentic_workflow_9830mI`, `Agentic_workflow_1_80765M` e `Agentic_workflow_2_4170JI`. Não estão ligados ao Habib. Descobrir quem criou e se servem |

---

## 1.4 Documentação

- `arquitetura-TO-BE.drawio` está fora do versionamento e desatualizado: mostra o middleware chamando
  o Portal do Cliente e o chama de "Orquestrador", o que confunde com o watsonx Orchestrate.
