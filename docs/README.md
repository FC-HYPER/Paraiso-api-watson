# Documentação — Migração Watson Assistant → watsonx Orchestrate

Projeto **Paraíso Gold** · Habib, assistente virtual de WhatsApp
Atualizado em 22/10/2026

O Habib, que rodava no **IBM Watson Assistant V2**, foi refeito como agente no **IBM watsonx
Orchestrate**. Este repositório é o middleware entre o gateway da Aspa (WhatsApp) e o agente; o
agente, as tools e a configuração da base de conhecimento ficam em [`../orchestrate`](../orchestrate).

## Documentos

| Documento | Para quê |
|---|---|
| [01-pendencias.md](01-pendencias.md) | **Comece por aqui.** Só o que está em aberto: dependências externas, middleware e agente |
| [02-decisoes.md](02-decisoes.md) | O que já foi decidido ou comprovado em teste, por tema. Consultar antes de reinvestigar ou mudar algo |
| [03-middleware.md](03-middleware.md) | Como o middleware funciona: contrato com a Aspa, chamada ao Orchestrate, contexto, erros, variáveis e deploy |
O prazo do projeto é de **28 dias**, aprovado pelo cliente.
