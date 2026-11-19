# 1. Pendências

Só o que está em aberto. Atualizado em 19/11/2026.
Decisões e testes concluídos estão em [02-decisoes.md](02-decisoes.md); ao resolver um item, ele sai
daqui e o que ensinou vai para lá.

---

## 1.1 Externas — dependem de terceiros

| Pendência | Situação |
|---|---|
| André: exibir o resumo ao atendente | A Aspa não mostra o `resumo_encaminhamento` hoje; o André vai propor no desenvolvimento deles. Quando existir, combinar o nome do campo (hoje provisório) |
| André: quando a Aspa zera o contexto | Perguntado; aguardando. **Deixou de bloquear a saudação**, que o middleware vai decidir sozinho (1.2). Serve só para saber com que frequência a saudação vai aparecer. Já se sabe que o **Reiniciar** da homologação não zera (02-decisoes.md, 2.1); falta saber de produção (fim da sessão, tempo sem mensagem, volta do atendente) |
| André: o que chega no clique em "Outros Assuntos" (**só produção**; não afeta a homologação, que não tem o menu) | Em produção, a Aspa recebe o cliente com menu próprio ("Como podemos ajudá-lo hoje?": Boletos, Pagamentos, Outros Assuntos) e só passa ao bot no clique em **Outros Assuntos**; a homologação não tem o menu, e a mensagem vai direto ao Habib (03/11/2026). Perguntar se o clique chega ao middleware e com que `input`. Se chegar como texto "Outros Assuntos", hoje o Habib responde a ele como se fosse pergunta. Se chegar com texto fixo, é o gatilho exato da saudação (melhor que a regra de horas). Também pesa na saudação: o cliente já foi recebido pelo menu, então a saudação do Habib é a segunda recepção (validar com a Jô) |
| Ofensa: encerramento e nível 3 | A advertência da Jô está no agente desde 19/11/2026 (02-decisoes.md 2.3). Falta o encerramento ("Como as ofensas continuaram após o aviso, vou encerrar este atendimento. Você poderá retomar o contato mantendo uma comunicação respeitosa."), que ela condicionou a estar previsto no protocolo: perguntar à **Aspa** se existe encerramento de sessão (`encerrar_sessao` já está no schema) ou fazer do nosso lado, zerando a thread. Em aberto nos dois casos: o que acontece se o cliente continuar escrevendo. O nível 3 (registro e encaminhamento interno) depende do **CRM** do cliente, ainda não entregue; até lá, nada de anunciar registro, meios formais ou acionamento de responsáveis |
| Jô: datas sem atendimento humano (deixado para depois em 23/10/2026) | Validar a lista `HOLIDAYS` da tool e do middleware. Em aberto: Carnaval e Corpus Christi (ponto facultativo); 8 de setembro (feriado só de Curitiba); 24 e 31 de dezembro |
| Formato do `attachment` | Perguntar à Aspa quando houver anexo (boleto em PDF): o campo recebe a URL direto ou um objeto? Antes de emitir, estender o schema de resposta, senão o Fastify descarta o campo |
| Jô: confirmar a Taxa de Notificação | Desde 19/11/2026 o Habib explica a Taxa de Notificação com a definição do **tipo K** do DATA POINT da Jô (10/08/2026, item 4.4): "taxas operacionais de notificação, despesas de cobrança e custas previstas no contrato", e continua encaminhando a Ajuizados (regra TAXA DE NOTIFICAÇÃO). Supõe-se que o lançamento "Taxa de Notificação" da Área do Cliente é o tipo K. Falta ela confirmar; se confirmar, a frase pode ir para o `kb_boletos_carnes` |
| Webhook `/watson/solicitacao` | É o **pedido de boleto** do bot antigo (único webhook do dialog v98, nó `do_webhook`, chamado depois de coletar contrato ou e-mail): envia e-mail, CPF/CNPJ, proposta, telefone e tipo de fatura a um serviço no Google Cloud Run, e o bot respondia "Vou gerar o seu boleto e te enviar aqui mesmo em até 2 minutos". O serviço gera o boleto e o envia pelo WhatsApp, fora do bot. Entra na **tool de boletos** (1.3): decidir se ela reaproveita esse serviço ou chama a API direto, quando a API for liberada |

---

## 1.2 Middleware

| Pendência | Prioridade |
|---|---|
| **Publicar em homologação** a separação de conversas (`a7014de`), a saudação, o link em texto simples e a trava de contato (19/11/2026), pelo ciclo de 3.9. Não exige variável nova no Code Engine. Depois, repetir na homologação: `oi` (só a saudação), pergunta em conversa nova (saudação e resposta), link da Área do Cliente, transferência e mensagem seguinte (conversa nova, com saudação) | **antes da apresentação** |
| **Log estruturado por run** (depois da homologação; base para o painel abaixo e para a decisão da base externa, 1.3). Uma linha JSON por run, sem texto livre do cliente: tools chamadas em ordem; `query` da busca na base, mascarada; documento e `score` de cada trecho recuperado, sem o texto; resposta "não tenho essa informação"; duração; transferência (equipe, dentro ou fora do expediente); travas acionadas; falhas (502, 504, vazio/None, `retrying without thread_id`); tokens, se o stream trouxer. Antes, capturar um stream bruto pelo middleware local e confirmar que a busca na base vem nos `run.step.delta` com `query` e `search_results`, como no histórico da thread (2.2) | média |
| **Painel de acompanhamento** sobre o log estruturado, para não depender do log cru. Determinístico (contagens e listas); LLM só numa etapa seguinte, para qualidade, com custo e LGPD a pesar. Opções: IBM Cloud Logs (dashboards prontos, pago); observabilidade do próprio Orchestrate (a investigar primeiro: o que oferece na instância); banco simples (Cloudant tem plano gratuito) com página nossa | baixa |
| Confirmar a retenção de threads configurada (*Enterprise Controls > Data Retention*, de 30 a 365 dias; padrão 30). Perdeu importância: com a conversa recomeçando depois de 24 h sem mensagem (3.4 do 03-middleware.md), a retenção mínima nunca alcança uma conversa ativa, e thread apagada já não derruba a conversa (02-decisoes.md) | baixa |
| **Trava contra invenção (camada 3), o que falta.** Já existem a correção do link da Área do Cliente, a retirada da promessa de registro e a de e-mail ou telefone fora da lista oficial (19/11/2026). Falta a chamada de tool escrita como texto (JSON, "[Transferindo…]"), que não apareceu nas baterias com o `frontier` | baixa |
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
| Encerramento por ofensa | A guideline "Ofensa direta ou ameaca" entrega só a advertência. O encerramento depende do mecanismo (Aspa ou thread zerada) e do protocolo (1.1) |
| Base externa com embedding multilíngue | Decidido em 27/10/2026 ficar com a base interna (só embedding em inglês) e decidir com dados reais: 2 a 4 semanas de conversas medindo respostas "não tenho essa informação" (o middleware pode logar) e transferências erradas. Migrar se aparecerem várias falhas de vocabulário ou se a lista de regras fixas crescer. O contato da IBM se ofereceu para dimensionar Milvus, Elasticsearch ou Astra DB |
| Modelo `frontier`: decisão definitiva | Pesar aderência às regras contra latência (mediana ~12 s, picos de até 55 s). O custo em si não está documentado. Não é governado pela IBM (`provider: openai`), assim como o `gpt-oss`: o Habib processa CPF, cobrança e textos jurídicos, e compliance pode levantar. Alternativa a avaliar: Granite |
| Latência | Acompanhar os picos depois da publicação. Antes do `frontier`, ~8 s; em agosto, 2 a 3,5 s. Cada guideline acrescenta de 0,5 a 3 s |
| Explicação na transferência é texto do LLM | Com o `frontier`, sai do trecho recuperado da base. Se a Jô quiser garantia, a saída é uma explicação fixa por equipe dentro da tool, entregue literal |
| Contatos oficiais de forma determinística | Os contatos validados estão na regra CONTATOS OFICIAIS das instructions, e nenhuma bateria trouxe contato inventado, mas o prompt não garante. A regra de só informar quando o cliente pede também falha: sem a informação (unificação, 2 de 3 em 27/10/2026, antes de a seção ser recuperada; "código de barras" na sonda), o Habib passa os contatos como saída. Camada 2: entregar por tool com `audience: user`; camada 3 em 1.2 |
| Feriados da tool e do middleware | A lista `HOLIDAYS` cobre até 31/12/2027, nos dois lugares. Depois disso, todo dia útil vira expediente, sem aviso. Atualizar todo ano, nos dois, e reimportar a tool |
| **Tool de boletos** | Depende da liberação da API pelo cliente; a Jô sabe que esta versão não consulta a API (19/11/2026). Especificação: identificação do cliente (CPF, contrato, data); pendências que impedem emissão (notificação de cobrança, ação ajuizada, contrato físico pendente, reembolso de IPTU, condomínio ou taxa de lixo a pagar antes); valor mínimo de regularização calculado pela API, nunca pelo Habib. Fontes: catálogo de eventos (`eventos-retorno-whatsapp.pdf`, 15/10/2026, com as mensagens validadas) e `REGRAS_API_ATUAL.md`. Nada disso existe mais nos KBs. Já decidido: o boleto sai pela API via tool, e a tool devolve **conceitos** (`cobranca_juridica_ativa`, `boleto_bloqueado`, `valor_minimo_liberado`), não letras de título (K, P, I, D, X, F, T, Y), para instructions e KBs não dependerem do formato da API |
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
