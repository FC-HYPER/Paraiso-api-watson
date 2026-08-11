# Documentação — Migração Watson Assistant → watsonx Orchestrate

Projeto **Paraíso Gold** · Assistente virtual de WhatsApp
Atualizado em 03/08/2026

## Contexto em uma frase

O assistente virtual da Paraíso Gold roda hoje em **IBM Watson Assistant V2**, intermediado por este
middleware (`api-paraiso-gold`), e será migrado para o **IBM watsonx Orchestrate**.

## Documentos

| # | Documento | Para quem |
|---|---|---|
| 1 | [Diagnóstico do assistente atual](01-diagnostico.md) | Time técnico e de negócio — o que existe hoje e por que a migração é um redesenho |
| 2 | [Roadmap e cronograma](02-roadmap.md) | Cliente e gestão — frentes de trabalho, 8 semanas, premissas |
| 3 | [Middleware: o que muda](03-middleware.md) | Time de desenvolvimento — detalhe técnico da reescrita da API |
| 4 | [Pendências](04-pendencias.md) | Itens em aberto, dependências externas e questões já resolvidas |

> ⚠️ **O prazo do projeto é de 28 dias**, aprovado pelo cliente. As estimativas em
> [02-roadmap.md](02-roadmap.md) e no resumo abaixo são anteriores a essa definição e estão
> desatualizadas — ver [04-pendencias.md](04-pendencias.md), seção 4.4.

## Resumo executivo

O assistente atual é, na essência, uma **base de conhecimento com roteamento para atendimento
humano**, implementada como uma árvore de 809 nós de menu numerado. Os 369 textos de conteúdo são o
ativo real e são preservados integralmente; a árvore de navegação é substituída por um agente do
Orchestrate.

- **Esforço total:** 26 a 39 dias-dev
- **Prazo:** 8 semanas
- **Middleware (código):** 4 a 6 dias — cerca de 15% do projeto

O trabalho está majoritariamente em curadoria de conteúdo, desenho de comportamento e validação —
não em programação.
