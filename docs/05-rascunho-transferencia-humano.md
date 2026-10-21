# 5. Rascunho — transferência para atendimento humano

> **Rascunho de 02/10/2026.** Registra a conversa de desenho. Nada aqui foi implementado no
> middleware nem importado no Orchestrate. Decisões marcadas como **aberta** dependem de resposta.

---

## 5.1 Contrato da Aspa (documento "Integração IA ParaísoGold", 24/08/2026)

A Aspa lê `data.context.skills["main skill"].user_defined` a cada resposta. Qualquer variável abaixo
tira o atendimento da IA:

| Variável | Efeito |
|---|---|
| `encerrar_sessao = true` | Arquiva o atendimento (IA resolveu) |
| `emitir_boleto = true` | Leva ao fluxo de emissão de boletos da Aspa |
| `menu_aspa = true` | Leva ao menu inicial do autoatendimento |
| `distribuicao = "<fila>"` | Transfere para a fila humana. Aceitas: Boletos, Quitacao, Rescisao, Transferencia, Renegociacao, Contrato, IPTU, Escrituras, Compra |
| `atendimento_humano = true` | Transfere para o humano geral, sem fila |

**Fallback:** `data.output.generic` vazio faz a Aspa transferir para humano.
A Aspa envia o telefone em `context.skills["main skill"].user_defined.phone`.

## 5.2 Decisões tomadas

- **Toda transferência é ao vivo.** Nenhum KB deve registrar solicitação ou protocolo.
- **O agente decide *quando*; a tool decide *se pode*.** O gatilho nunca é determinístico: quem chama a
  tool é o LLM, guiado por instructions, description da tool e Guidelines. O determinismo está na tool
  (identificação, expediente, fila válida).
- **Uma tool só:** `transferir_humano(fila, documento)`, em
  [`orchestrate/tools/transferir_humano.py`](../orchestrate/tools/transferir_humano.py).
- **Sinal para o middleware:** a tool devolve `TRANSFERENCIA_OK` e manda o agente responder
  `[[ASPA:<fila>]]`. O middleware extrai o marcador e monta o contrato da Aspa.
  *Hipótese a validar:* a documentação da IBM não diz se o resultado de uma tool aparece na resposta
  do chat completions. Se não aparecer, o marcador no texto é o caminho.
- **Dados do cliente:** na V1 o agente os pede na conversa (o Orchestrate só lê a última mensagem `user`).
- **Expediente:** segunda a sexta, 9h às 18h (`kb_institucional`).
- **Valor `atendimento_humano`** para o que não tem fila.

## 5.3 Categorias novas a pedir à Aspa

| Categoria | Cenários |
|---|---|
| `Juridico` | Carta Rogatória, interpelação judicial, desapropriação, LGPD, menor de idade, cobrança jurídica (K, custas P, ajuizamento) |
| `Lote` | Demarcação, diferença de metragem, invasão/ocupação, dano ambiental, contas de água e energia, individualização de matrícula |
| `Financeiro` | Amortização, antecipação, negativação que persiste, cobrança após a baixa |

Enquanto a Aspa não habilitar, o middleware deve cair em `atendimento_humano = true` (variável de
ambiente com as filas habilitadas).

## 5.4 Mapa dos 16 KBs para as filas

| Fila | Cenários |
|---|---|
| Boletos | Pagou e a baixa não apareceu, pagamento por outro meio, boleto suspenso com divergência |
| Compra | Comprar lote, corretores, entrada entregue ao corretor |
| Contrato | Data de vencimento, cadastro, conferência de documento, segunda via indisponível |
| Escrituras | Parcelar escritura e registro, ITCMD |
| IPTU | Regularização pela empresa, pagamento duplicado, endereço divergente |
| Quitacao | Cálculo de quitação |
| Renegociacao | Pedido de renegociação |
| Rescisao | Arrependimento (7 dias), distrato, cancelamento/devolução |
| Transferencia | Falecimento do titular |
| Juridico / Lote / Financeiro | Ver 5.3 |
| geral | Dúvidas institucionais e o que não se encaixa |

**Não encaminhar:** pedido de exceção, desconto ou retirada de multa/juros (renegociação); desconto
extra na quitação.

## 5.5 Mudanças previstas no middleware

1. `message.schema.ts`: o `context` da resposta precisa aceitar `skills["main skill"].user_defined`.
   Sem isso o Fastify descarta a variável em silêncio (mesmo bug do `integration`).
2. Extrair o marcador `[[ASPA:<fila>]]` do texto e removê-lo antes de responder.
3. Lista de filas habilitadas (variável de ambiente); fila fora dela vira `atendimento_humano`.
4. Resposta vazia do agente deve sair como `generic: []` para ativar o fallback da Aspa, em vez de
   `{ text: '' }`.

## 5.6 Códigos de título (K, P, I, D, X, T, Y, F)

Aparecem em 5 KBs (boletos, iptu, quitacao, renegociacao, transferencia), pressupondo uma API que o
agente consulta. **Essa API ainda precisa ser mapeada com a Paraíso.** O código do Portal que existia
no middleware (`historico`, `abertos`, `contexto`) não é essa API e sai do repositório.

**Direção:** a tool de consulta devolve **conceitos**, não letras (`cobranca_juridica_ativa`,
`boleto_bloqueado`, `valor_minimo_liberado`). Quem traduz K/P/I/D/X é a tool, então instructions e KBs
não dependem do formato final da API.

## 5.7 Ordem de trabalho

1. Fixar os contratos das tools (nome, parâmetros, retorno).
2. Escrever instructions e Guidelines (poucas: cada uma custa uma chamada de LLM por turno).
3. Criar as tools com retorno simulado e testar no agente. É aqui que o experimento do marcador roda.
4. Trocar o stub pela tool real quando a API for mapeada.
5. Workflow determinístico só para sequências fixas de vários passos (boleto).

## 5.8 Perguntas abertas para a Aspa

- O texto do `generic` é enviado ao cliente antes de a transferência ser executada?
- O que a Aspa faz com `{ success: false }` (erros 502/504 do middleware)?
- Habilitar as categorias `Juridico`, `Lote` e `Financeiro`.
- **Decidido:** o boleto sai pela API, via tool no Orchestrate, e não pelo fluxo `emitir_boleto` da
  Aspa. O formato de consumo da API está sendo alinhado com o Bruno.

## 5.10 Canais alternativos ao marcador no texto (a validar)

Pesquisados em 02/10/2026; **nenhum confirmado na prática**. Ordem de preferência:

1. `POST /v1/orchestrate/runs/stream`: devolve `RunEvent` com `run.step.*`, que podem trazer
   chamada e resposta de tool (`step_details`). Documentado; o conteúdo exato dos eventos não foi lido.
2. Respostas com `step_history` / `step_details` (relato de terceiros, não na doc oficial).
3. API de threads (`/v1/threads/{id}/messages`): a página do endpoint não foi localizada.
4. `response_type` `connect_to_agent` / `channel_transfer` no schema, sem doc de como emitir.

Context variables são **somente de entrada** (do app para o agente); não há doc de tool escrevendo
contexto de volta ao cliente. Se nenhum canal estruturado funcionar, fica o marcador no texto.

## 5.9 Retenção do histórico da thread

Fonte: documentação de produto da IBM, *Configuring data retention*
(`agentic_control_plane/controls/configuring-data-retention.html`). Não consta na referência da API.

- Histórico de chat: padrão de **30 dias**, configurável de **30 a 365**, em
  *Manage > Controls > Enterprise Controls > Data Retention*.
- "Older messages are automatically deleted and can no longer be accessed."
- **Não especificado:** se a contagem parte da criação ou da última atividade, e o que acontece
  quando um cliente volta com um `thread_id` cujas mensagens já foram apagadas.
- **A testar:** `X-IBM-THREAD-ID` com UUID inexistente na homologação. O middleware hoje devolve 502
  para qualquer resposta fora de 2xx e não abre thread nova.
