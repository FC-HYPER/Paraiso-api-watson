# 1. Pendências

Só o que está em aberto. Atualizado em 22/10/2026.
Decisões e testes concluídos estão em [02-decisoes.md](02-decisoes.md); ao resolver um item, ele sai
daqui e o que ensinou vai para lá.

---

## 1.1 Externas — dependem de terceiros

| Pendência | Situação |
|---|---|
| André: exibir o resumo ao atendente | A Aspa não mostra o `resumo_encaminhamento` hoje; o André vai propor no desenvolvimento deles. Quando existir, combinar o nome do campo (hoje provisório) |
| Formato do `attachment` | Perguntar à Aspa quando houver anexo (boleto em PDF): o campo recebe a URL direto ou um objeto? Antes de emitir, estender o schema de resposta, senão o Fastify descarta o campo |
| Webhook `/watson/solicitacao` | O dialog do Watson chama um serviço em Google Cloud Run que envia e-mail, CPF/CNPJ, proposta, telefone e tipo de fatura. Levantar quem mantém e o que faz: precisará virar tool no Orchestrate |
| Jô: datas sem atendimento humano (deixado para depois em 23/10/2026) | Validar a lista `HOLIDAYS` da tool. Em aberto: Carnaval e Corpus Christi (ponto facultativo); 8 de setembro (feriado só de Curitiba); 24 e 31 de dezembro |
| **Jô: texto de fora do expediente** | `OUT_OF_HOURS_MESSAGE` em [`transfer_to_human.py`](../orchestrate/tools/transfer_to_human.py), o único texto fixo da transferência. Enviado à Jô em 23/10/2026; aguardando |
| Jô: texto da guideline de ofensa | Confirmar se tem origem validada ou foi de teste, antes de virar texto literal na tool (1.3). Enviado em 23/10/2026; aguardando |

---

## 1.2 Middleware

| Pendência | Prioridade |
|---|---|
| **Publicar em homologação.** Sobem juntos: migração para `runs/stream`, variáveis da Aspa (`aspa-control`), timeout de 120 s e conversão do negrito. Só com pedido explícito | **antes do teste ponta a ponta** |
| **Cota do Container Registry estourada** (500 MB do plano gratuito). Limpar os digests sem tag e avaliar subir o plano. **Nunca apagar `:latest`** (produção) nem a `:homolog` em uso | **bloqueia deploy** |
| Confirmar no Code Engine de homologação: o valor da `API_KEY` (é o que a Aspa envia) e que não há `WXO_TIMEOUT_MS` com valor menor, que teria precedência sobre o padrão de 120 s | **antes do teste ponta a ponta** |
| **Thread com histórico apagado.** O Orchestrate apaga o histórico depois de 30 dias por padrão (configurável de 30 a 365 em *Enterprise Controls > Data Retention*). O cliente que volta depois disso manda o `thread_id` antigo, e o middleware devolve 502 para qualquer resposta fora de 2xx. Testar com um `thread_id` inexistente e, se der erro, refazer a chamada sem ele; confirmar a retenção configurada | **antes do teste ponta a ponta** |
| **Trava no middleware** (camada 3 contra invenção): e-mail, telefone ou link fora da lista oficial, ou chamada de tool escrita como texto (JSON, "[Transferindo…]"), não vão ao cliente e viram transferência. Prompt não garante; com o `frontier` nenhum dos dois apareceu nas baterias | média |
| Cadastrar `NODE_ENV=production` na aplicação de produção, senão o Swagger fica público | **antes da produção** |
| Imagem de produção (`:latest`) tem quase um ano: promover leva um ano de deriva de dependência. Testar em homologação antes | **antes da produção** |
| `@fastify/static <=10.1.1` vulnerável via `@fastify/swagger-ui`; corrigir exige `swagger-ui@6`, breaking. Mitigado por não registrar a documentação em produção | média |
| `fastify-zod@1.4.0` declara peer `fastify@4` e o projeto roda o 5; obriga `--legacy-peer-deps`. Avaliar `fastify-type-provider-zod` | média |
| Verificar se há gatilho automático de build por push; hoje é preciso **Executar novamente a compilação** | baixa |
| `prettier` acusa `Delete ␍` em todo arquivo (CRLF sem `endOfLine` no `.prettierrc.json`), e `npm run lint` falha por isso | baixa |
| Fixar a imagem base: `node:20-alpine` é tag móvel | baixa |
| Remover `HABIB_API_URL` e `HABIB_BEARER_TOKEN` das variáveis do Code Engine | baixa — ao final |
| Definir se os 3 últimos dígitos preservados no log atendem à política de privacidade do cliente | baixa — compliance |

---

## 1.3 Agente no Orchestrate

| Pendência | Situação |
|---|---|
| **Testes da transferência no `frontier`** | Falta: (1) fora do expediente, porque o `_to_customer` usa `audience: user` e a anotação `assistant` quebrava o `frontier`; (2) valor de quitação, situação do contrato, "já tentei e não consegui", reclamação, inscrição do IPTU, carta rogatória; (3) atendente sem assunto, em dois turnos; (4) ofensa. Anomalia de 22/10: um turno de "Tem lote disponível em Curitiba?" mostrou a chamada da tool no histórico, mas voltou sem `distribuicao` e perguntou "quer que eu faça isso?" |
| Tool de ofensa com `encerrar_sessao` | A guideline "Ofensa direta ou ameaca" é a única que restou. Virar tool com texto literal e `encerrar_sessao` (depende da Jô, 1.1) |
| Habib oferece encaminhamento nos casos sem encaminhamento | "Quanto tempo demora o cálculo da quitação?" termina com "posso te encaminhar" |
| **Habib promete registro ou protocolo** | Não existe mecanismo de registro nem de protocolo. Os KBs mandavam "registrar a solicitação" e "informar o protocolo", contradizendo AÇÕES PROIBIDAS; os trechos saíram dos KBs em 22/10/2026, mas nas baterias com o `frontier` o Habib ainda disse "Já deixei tudo registrado" e, num pedido de LGPD em 23/10/2026, "Seu pedido foi registrado". Confirmado em 23/10/2026 que ainda não existe protocolo: o Habib não promete. Retomar junto com as tools futuras |
| Modelo `frontier`: decisão definitiva | Pesar aderência às regras contra latência (mediana ~12 s, picos de até 55 s). O custo em si não está documentado. Não é governado pela IBM (`provider: openai`), assim como o `gpt-oss`: o Habib processa CPF, cobrança e textos jurídicos, e compliance pode levantar. Alternativa a avaliar: Granite |
| Latência | Acompanhar os picos depois da publicação. Antes do `frontier`, ~8 s; em agosto, 2 a 3,5 s |
| Explicação na transferência é texto do LLM | Com o `frontier`, sai do trecho recuperado da base. Se a Jô quiser garantia, a saída é uma explicação fixa por equipe dentro da tool, entregue literal |
| Contatos oficiais de forma determinística | Camada 2 contra contatos inventados: entregar os contatos validados pela Jô por tool com `audience: user` ou KB próprio. Com a base v2 e o `frontier`, nenhum contato inventado nas baterias, mas o prompt não garante (camada 3 em 1.2) |
| Feriados da tool | A lista `HOLIDAYS` cobre até 31/12/2027. Depois disso, todo dia útil vira expediente, sem aviso. Atualizar todo ano e reimportar |
| **Tool de boletos** | Especificação: identificação do cliente (CPF, contrato, data); pendências que impedem emissão (notificação de cobrança, ação ajuizada, contrato físico pendente, reembolso de IPTU, condomínio ou taxa de lixo a pagar antes); valor mínimo de regularização calculado pela API, nunca pelo Habib. Fontes: catálogo de eventos (`eventos-retorno-whatsapp.pdf`, 15/10/2026, com as mensagens validadas) e `REGRAS_API_ATUAL.md`. Nada disso existe mais nos KBs. Já decidido: o boleto sai pela API via tool, e a tool devolve **conceitos** (`cobranca_juridica_ativa`, `boleto_bloqueado`, `valor_minimo_liberado`), não letras de título (K, P, I, D, X, F, T, Y), para instructions e KBs não dependerem do formato da API |
| Ajustes decididos nas instructions | (1) Nome ao cliente: **Central Gold**, como nos KBs; trocar "ParaísoGold" nas instructions e na descrição do agente. (2) Taxa de transferência: **não informar valor**; tirar o exemplo de `VALORES E CÁLCULOS`, que manda informar a taxa de transferência como valor tabelado |
| Links do Cartório Volpi no KB | No `kb_escritura_registro`, "Sugestões e/ou reclamações: Cartório Volpi" e "Editais: Editais" são links no Word para `https://www.7tabelionatocuritiba.com.br/`. A base lê o texto e não o link, então o endereço não chega ao Habib. Escrever o endereço no texto do `.docx` (pasta `kbs em word v2`) e subir de novo na base |
| Instructions conflitam com a tool de boletos | `ESCOPO DESTA VERSÃO` diz que o Habib não emite boletos. Revisar quando a tool entrar |
| Tools futuras (quitação, rescisão, sessão autenticada) | Saíram dos KBs os trechos "consultar o sistema", "aproveitar a sessão autenticada", "registrar a solicitação" e "informar o protocolo". Retomar quando houver tool para esses fluxos; até lá, o Habib não promete registro nem protocolo |
| Backlog: leitura de documentos enviados pelo cliente | O `kb_contrato_atendimento_assinatura` previa o Habib receber o contrato e apontar os campos a assinar, "dentro da capacidade técnica liberada e testada". Saiu do KB; retomar se o canal passar a receber arquivos |
| `HABIB_BEARER_TOKEN` vira **Connection** no Orchestrate | As tools do Portal vão precisar dele. Não descartar: mudar de lugar |
| Timeout de tool Python | 2 minutos no total, incluindo a subida do ambiente. Considerar no workflow de boletos, junto com os 120 s do middleware |
| Workflow assíncrono | Se o workflow de boletos for assíncrono, o stream encerra com `flow.slot.listen` e a resposta vem por `GET /v1/orchestrate/threads/{thread_id}/messages`. O middleware só loga o caso hoje |
| Publicar o Habib no **live** | Só existe o draft, e toda mudança aparece na hora para quem testa pela Aspa. Antes de publicar, passar `environment_id` explícito no `runs/stream` (draft em homologação, live em produção) |
| Modelo de embeddings em inglês | Sem prioridade: nas baterias com a base v2 a busca trouxe o trecho certo em todas as perguntas. Reavaliar se aparecer busca errada. Candidatos: `ibm/granite-embedding-278m-multilingual`, `intfloat/multilingual-e5-large`, `virtual-model/openai/text-embedding-3-small` |
| Três agentic workflows sem descrição na instância | `Agentic_workflow_9830mI`, `Agentic_workflow_1_80765M` e `Agentic_workflow_2_4170JI`. Não estão ligados ao Habib. Descobrir quem criou e se servem |

---

## 1.4 Documentação

- `arquitetura-TO-BE.drawio` está fora do versionamento e desatualizado: mostra o middleware chamando
  o Portal do Cliente e o chama de "Orquestrador", o que confunde com o watsonx Orchestrate.
