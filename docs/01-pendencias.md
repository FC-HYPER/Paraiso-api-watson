# 1. Pendências

Só o que está em aberto. Atualizado em 27/10/2026 (noite).
Decisões e testes concluídos estão em [02-decisoes.md](02-decisoes.md); ao resolver um item, ele sai
daqui e o que ensinou vai para lá.

---

## 1.1 Externas — dependem de terceiros

| Pendência | Situação |
|---|---|
| André: exibir o resumo ao atendente | A Aspa não mostra o `resumo_encaminhamento` hoje; o André vai propor no desenvolvimento deles. Quando existir, combinar o nome do campo (hoje provisório) |
| André: quando a Aspa zera o contexto | Para a saudação do primeiro contato ("Olá! Que bom receber você por aqui. 🙂 Sou o Habib, assistente virtual da Central Gold. Como posso ajudar hoje?", texto da Jô): saber quando a Aspa deixa de reenviar o `thread_id` (fim da sessão, tempo sem mensagem), para o middleware ou o agente saber que é a primeira mensagem. Perguntado; aguardando |
| Jô: ofensa em dois níveis | Os textos da advertência e do encerramento já vieram da Jô. Falta ela confirmar o encerramento da sessão (`encerrar_sessao`) antes de virar tool (1.3) |
| Jô: datas sem atendimento humano (deixado para depois em 23/10/2026) | Validar a lista `HOLIDAYS` da tool e do middleware. Em aberto: Carnaval e Corpus Christi (ponto facultativo); 8 de setembro (feriado só de Curitiba); 24 e 31 de dezembro |
| Formato do `attachment` | Perguntar à Aspa quando houver anexo (boleto em PDF): o campo recebe a URL direto ou um objeto? Antes de emitir, estender o schema de resposta, senão o Fastify descarta o campo |
| Jô: o que é a Taxa de Notificação | Os KBs só citam o nome (lançamento do Extrato). Com a busca, o Habib inventou que ela "surge quando há notificação de cobrança". Hoje ele não explica e encaminha a Ajuizados (regra TAXA DE NOTIFICAÇÃO). Com o texto da Jô, a explicação entra no `kb_boletos_carnes` e a regra sai |
| Município do Casa Nova (SC) | Nem os KBs nem o site da Paraíso Gold dizem. Serve para conferir a concessionária de água e luz do loteamento (2.4) |
| Webhook `/watson/solicitacao` | O dialog do Watson chama um serviço em Google Cloud Run que envia e-mail, CPF/CNPJ, proposta, telefone e tipo de fatura. Levantar quem mantém e o que faz: precisará virar tool no Orchestrate |

---

## 1.2 Middleware

| Pendência | Prioridade |
|---|---|
| **Publicar em homologação.** Sobem juntos: migração para `runs/stream`, variáveis da Aspa (`aspa-control`), timeout de 120 s, conversão do negrito, transferência quando a tool falha, correção do link da Área do Cliente, retirada da oferta de encaminhamento e da promessa de registro, e dependências corrigidas em 27/10/2026 (`fastify` 5.12.7, `axios` 1.20.0). Só com pedido explícito | **antes do teste ponta a ponta** |
| **Cota do Container Registry estourada** (500 MB do plano gratuito). Limpar os digests sem tag e avaliar subir o plano. **Nunca apagar `:latest`** (produção) nem a `:homolog` em uso | **bloqueia deploy** |
| Confirmar no Code Engine de homologação: o valor da `API_KEY` (é o que a Aspa envia) e que não há `WXO_TIMEOUT_MS` com valor menor, que teria precedência sobre o padrão de 120 s | **antes do teste ponta a ponta** |
| **Thread com histórico apagado.** O Orchestrate apaga o histórico depois de 30 dias por padrão (configurável de 30 a 365 em *Enterprise Controls > Data Retention*). O cliente que volta depois disso manda o `thread_id` antigo, e o middleware devolve 502 para qualquer resposta fora de 2xx. Testar com um `thread_id` inexistente e, se der erro, refazer a chamada sem ele; confirmar a retenção configurada | **antes do teste ponta a ponta** |
| **Trava contra invenção (camada 3), o que falta.** Já existem a correção do link da Área do Cliente e a retirada da promessa de registro. Faltam: e-mail ou telefone fora da lista oficial, e chamada de tool escrita como texto (JSON, "[Transferindo…]"), que não deveriam chegar ao cliente. Nenhum dos dois apareceu nas baterias com o `frontier` | média |
| Cadastrar `NODE_ENV=production` na aplicação de produção, senão o Swagger fica público | **antes da produção** |
| Imagem de produção (`:latest`) tem quase um ano: promover leva um ano de deriva de dependência. Testar em homologação antes | **antes da produção** |
| `@fastify/static <=10.1.1` vulnerável via `@fastify/swagger-ui`; corrigir exige `swagger-ui@6`, breaking. Mitigado por não registrar a documentação em produção | média |
| `fastify-zod@1.4.0` declara peer `fastify@4` e o projeto roda o 5; obriga `--legacy-peer-deps`. Avaliar `fastify-type-provider-zod` | média |
| `zod` 3 vulnerável (alta, consumo de memória em coleção grande). A correção só existe no zod 4, breaking, e o `fastify-zod` depende do 3: resolver junto com a troca acima | média |
| Vulnerabilidades em dependências de dev que só se corrigem com major: `esbuild` (baixa, via `tsup@8`; corrige no `tsup@9`), `@typescript-eslint` antigo (via `@rocketseat/eslint-config@2`; corrige no 3) e `tinypool` (via `vitest@3`; corrige no 5). Não vão para a imagem de produção, mas o Dependabot alerta | baixa |
| Verificar se há gatilho automático de build por push; hoje é preciso **Executar novamente a compilação** | baixa |
| `prettier` acusa `Delete ␍` em todo arquivo (CRLF sem `endOfLine` no `.prettierrc.json`), e `npm run lint` falha por isso | baixa |
| Fixar a imagem base: `node:20-alpine` é tag móvel | baixa |
| Remover `HABIB_API_URL` e `HABIB_BEARER_TOKEN` das variáveis do Code Engine | baixa — ao final |
| Definir se os 3 últimos dígitos preservados no log atendem à política de privacidade do cliente | baixa — compliance |

---

## 1.3 Agente no Orchestrate

| Pendência | Situação |
|---|---|
| **Rodar a bateria dentro do expediente** | A de 27/10/2026 rodou depois das 18h: toda transferência entregou o texto fixo da fila, sem explicação do LLM. Ficaram sem teste real a trava da Taxa de Notificação (não explicar) e a explicação das demais transferências com as instructions novas |
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
