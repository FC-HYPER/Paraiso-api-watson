# 2. Roadmap e cronograma

Documento de apresentação ao cliente. Base técnica em [01-diagnostico.md](01-diagnostico.md).

---

## 2.1 O que muda e o que se preserva

**Preservado integralmente:**

- As **369 respostas de conteúdo** — o ativo mais caro, resultado de anos de ajuste com clientes reais
- Os 6 domínios de negócio e sua estrutura
- As regras de atendimento: identificação antes da transferência, direcionamento por assunto, horário
- Os textos de comunicação obrigatória (regras de renegociação, avisos de ajuizamento)

**O que muda:**

- O cliente deixa de navegar por menu numerado (*digite 1, 2, 3*) e passa a perguntar em linguagem natural
- O conteúdo sai da árvore de menus e vai para uma base de conhecimento pesquisável
- O roteamento deixa de ser máquina de estados manual e passa a ser decidido pelo agente

Essa mudança **é o motivo da migração**. Manter a árvore de menus não exigiria trocar de plataforma.

---

## 2.2 Frentes de trabalho

| Frente | Esforço | O que é |
|---|---|---|
| Curadoria de conteúdo | 4–6 d | Extrair as 369 respostas dos 809 nós, deduplicar, organizar por domínio |
| Base de conhecimento | 5–7 d | Estruturar o conteúdo para busca semântica |
| Instruções do agente | 5–8 d | Definir comportamento e roteamento nos 6 domínios |
| Regras determinísticas | 2–3 d | Identificação obrigatória, fila de distribuição, horário, textos literais |
| Integrações (tools) | 2–3 d | Conexões com os sistemas de apoio |
| Middleware (API) | 4–6 d | Nova comunicação com a IBM, autenticação, contrato com o gateway |
| Calibração e homologação | 8–12 d | Ajuste do comportamento contra casos reais |
| **Total** | **26–39 dias-dev** | |

---

## 2.3 Cronograma — 8 semanas

| Semana | Entrega |
|---|---|
| **1** | Provisionamento do ambiente, inventário do conteúdo e **definição dos critérios de aceite** |
| **2–3** | Base de conhecimento construída — os 6 domínios |
| **4** | Agente configurado: instruções e roteamento por domínio |
| **5** | Regras determinísticas (identificação, distribuição, horário) e integrações |
| **6** | Middleware — nova API de comunicação com a IBM *(em paralelo)* |
| **7** | Calibração contra a lista de casos reais |
| **8** | Homologação com o negócio, publicação e transição do gateway |

**Entrega faseada:** o primeiro domínio (**boletos**, o de maior volume — 15 das 57 intenções) é
validado já na **semana 3**, e não na 8. O cliente vê resultado cedo, o rumo é corrigido antes de
replicar nos outros cinco domínios, e o risco fica contido.

---

## 2.4 Por que 8 semanas

1. **O volume é real.** 809 nós, 57 intenções e 369 respostas não foram construídos em poucas
   semanas. A proposta reconstrói esse acervo em 8 semanas justamente porque o conteúdo é
   aproveitado — não se parte do zero.

2. **O trabalho não é de programação.** A parte de código (o middleware) são 4 a 6 dias — cerca de
   15% do projeto. O esforço está em curadoria de conteúdo, desenho de comportamento e validação. É
   o que menos parece "desenvolvimento" e o que mais determina a qualidade do resultado.

3. **A calibração é uma fase, não uma sobra.** O comportamento de um agente não é previsível como o
   de um menu — isso é característica da tecnologia, não defeito da implementação. Por isso tem 8 a
   12 dias reservados e **encerra por critério objetivo**: uma lista de 30 a 50 conversas reais,
   definida com o time do cliente na semana 1, com meta de aprovação acordada.

---

## 2.5 Premissas do prazo

As 8 semanas assumem:

- Ambiente watsonx Orchestrate provisionado e credenciais disponíveis **na semana 1** — sem isso, a
  contagem começa depois
- Um interlocutor de negócio disponível para validar conteúdo e critérios de aceite
- Gateway (Aspa) disponível para a transição na semana 8
- Escopo dos 6 domínios atuais, sem inclusão de novos assuntos

---

## 2.6 Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Textos jurídicos parafraseados pela busca semântica | Alto | Resposta fixa para os trechos de comunicação obrigatória; validação jurídica na semana 7 |
| Calibração sem critério de aceite | Alto | Lista fechada de casos definida na semana 1; encerramento por meta acordada |
| Provisionamento do ambiente atrasar | Médio | Abrir o pedido no primeiro dia; trava a semana 1 inteira |
| Agenda do gateway (Aspa) para a transição | Médio | Comunicar o contrato novo assim que fechado (semana 6), não na semana 8 |
| Webhook externo sem responsável definido | Médio | Levantar na semana 1 quem mantém o serviço em Cloud Run |
| Perda de previsibilidade vs. menu numerado | Médio | Regras determinísticas nos pontos críticos (seção 1.5 do diagnóstico) |
