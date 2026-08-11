# 1. Diagnóstico do assistente atual

Base: export completo do dialog skill `Habib- v1 ParaísoGold-dialog`, versão 98, idioma `pt-br`.

> O arquivo de export **não é versionado** — contém secret de webhook em texto puro e exemplos de
> treino com dado real de cliente. Está coberto pelo `.gitignore`.

---

## 1.1 Arquitetura atual

```
Cliente → WhatsApp → Aspa (gateway)
                       ↓  POST /api/watson/message  { input, context }
              Middleware (api-paraiso-gold, Fastify/Node 20)
                       ↓  AssistantV2.messageStateless
                    IBM Watson Assistant V2
```

O middleware é **stateless**: usa `messageStateless` e devolve o `context` completo
(`return_context: true`). Quem guarda o estado da conversa e o reenvia a cada mensagem é o gateway
da Aspa. Não há banco, cache ou sessão neste serviço.

Arquivos-chave: [`services/watson.service.ts`](../services/watson.service.ts),
[`src/http/controllers/watson/send-message.controller.ts`](../src/http/controllers/watson/send-message.controller.ts).

---

## 1.2 Números do diálogo

| Métrica | Valor |
|---|---|
| Nós de diálogo | **809** (459 standard + 342 response_condition) |
| Desvios de fluxo (`jump_to`) | 658 |
| Variáveis de contexto distintas | 46 |
| Intenções treinadas | 57 (510 exemplos) |
| Entidades | 28 (a maior com 50 valores) |
| Respostas de texto escritas | **369** |
| Condições com lógica composta | 312 |
| Webhooks | 1 |
| Domínios de negócio | 6 — boletos, IPTU, quitação, rescisão, escritura, contrato |

---

## 1.3 O que o assistente realmente é

**Uma URA de menu numérico.** 292 nós são condicionados a `@sys-number` e 99 respostas contêm menu
numerado com emoji (`1️⃣ Sim  2️⃣ Não`). Somados aos 658 `jump_to` e às 46 variáveis de estado
(`menu_atual`, `tentativas_ath`, `consultou_faq`), o que existe é uma máquina de estados construída
manualmente.

**Todo caminho termina em um de três desfechos:**

| Desfecho | Evidência |
|---|---|
| Resposta de conteúdo (FAQ) | 369 respostas de texto em 733 nós de output |
| Transferência para atendimento humano | 11 nós setam `transfere_ath` / `atendimento_humano` |
| Devolução ao menu do gateway | `menu_aspa: true` |

**O assistente não executa transações.** Dois exemplos verificados até o nó final:

- **Rescisão** — coleta banco → agência → conta → CPF do titular e termina em
  *"Transfere para atendimento humano"*. É formulário de triagem, não execução.
- **Emissão de boleto** — define `menu_aspa: true` e devolve o controle ao gateway da Aspa, que
  executa a emissão.

A única ação real do diálogo é um **webhook** para um serviço externo em Cloud Run
(`/watson/solicitacao`), que envia e-mail, CPF/CNPJ, proposta, telefone e tipo de fatura.

> **Conclusão:** o assistente é uma base de conhecimento com roteamento — o caso de uso canônico de
> um agente com knowledge base. A migração é favorável, não hostil.

---

## 1.4 Por que a migração é um redesenho, não um port

Um agente do watsonx Orchestrate funciona pelo princípio oposto ao de uma árvore de diálogo: você
descreve objetivos e ferramentas, e o modelo decide o caminho. **Uma árvore de menus não tem para
onde ser traduzida** — 658 `jump_to` e 46 variáveis de controle simplesmente deixam de existir.

O que se preserva é o **conteúdo**: as 369 respostas, os 6 domínios e as regras de atendimento.

---

## 1.5 O que precisa continuar determinístico

Nem tudo pode ser entregue ao julgamento do modelo:

1. **Identificação antes da transferência.** Hoje o bot só transfere após coletar CPF/CNPJ ou número
   de contrato (`$identifica_cliente = true`), e passa o assunto em `distribuicao` para direcionar a
   fila do atendimento. Sem isso, chega atendimento humano sem identificação.
2. **Horário de expediente.** Regra de timezone real no diálogo:
   `now("America/Sao_Paulo").before("09:00:00")`. Precisa ser regra, não julgamento.
3. **Textos de comunicação obrigatória.** Avisos de ajuizamento de dívida e regras de renegociação
   precisam sair **literais**. Uma base de conhecimento com busca semântica parafraseia por
   natureza — esses trechos exigem resposta fixa. É o ponto de maior atenção do projeto.

---

## 1.6 Achados colaterais

Encontrados durante a análise; não são objetivo da migração, mas precisam de destino.

1. **Integração do Portal do Cliente nunca esteve em uso.** O middleware implementa um roteador que
   lê `context.skills['main skill'].user_defined.integration` e chama a API do Portal
   (`/boletos/historico`, `/boletos/abertos`, `/portal/contexto`). Verificamos os 809 nós:
   **nenhum** grava essa variável. Além disso, o resultado nunca chegaria ao gateway — o schema de
   resposta da API declara apenas `success` e `data`, e o Fastify descarta as demais chaves na
   serialização. O recurso está inativo nas duas pontas.
2. **Webhook não mapeado.** O serviço em Cloud Run chamado diretamente pelo Watson não constava na
   documentação de arquitetura. Falta definir quem o mantém e o que ele faz.
3. **Endpoint sem autenticação.** `POST /api/watson/message` declara apiKey no Swagger mas não
   aplica o middleware de validação. Some com a reescrita — a rota nova nasce autenticada.
4. **Log com dado pessoal.** O interceptor registra corpo da requisição e da resposta integralmente,
   incluindo CPF e proposta em texto puro. Entra no escopo da reescrita (LGPD).
