# 4. Pendências

Itens em aberto levantados durante o diagnóstico e a preparação do ambiente.
Atualizado em 11/08/2026.

---

## 4.1 Externas — dependem de terceiros, abrir cedo

Estas têm prazo de espera fora do nosso controle. Solicitar no início, não quando o código ficar
pronto.

### ▸ E-mail para a Aspa (duas perguntas de uma vez)

**1. Habilitar WhatsApp em homologação.** Precisamos de um número de teste apontando para a
aplicação `paraiso-api-ura-watson-homolog`, para validar o fluxo ponta a ponta pelo WhatsApp real.
Envolve o time deles e possivelmente um número novo.

**2. Como a Aspa lê o `context` da nossa resposta?**

> *"Vocês leem o `context` da resposta de forma genérica — guardam e devolvem como veio — ou esperam
> campos específicos dentro dele?"*

Essa resposta valida a decisão de transportar o `thread_id` dentro do `context` sem alterar o
contrato (ver [03-middleware.md](03-middleware.md), seção 3.3). Se a leitura for genérica, a Aspa
**não precisa mudar uma linha**. Se não for, o desenho muda.

### ▸ Webhook `/watson/solicitacao` — definir responsável

O dialog skill atual chama diretamente um serviço em Google Cloud Run
(`/watson/solicitacao`), enviando e-mail, CPF/CNPJ, proposta, telefone e tipo de fatura. Não constava
em nenhuma documentação de arquitetura.

Levantar **quem mantém esse serviço** e **o que ele faz**. Ele precisará virar tool no Orchestrate.

---

## 4.2 Middleware — técnicas

| Pendência | Prioridade |
|---|---|
| Rodar a compilação após cada push (botão *Executar novamente a compilação*) | — |
| Verificar se existe gatilho automático de build por push do Git; se não, avaliar configurar webhook | baixa |
| Remover `HABIB_API_URL` e `HABIB_BEARER_TOKEN` das variáveis do Code Engine | baixa — fazer ao final |
| Logar `run_id` e `trace_id` da resposta do Orchestrate | média |
| Redaction de CPF e proposta no `interceptor-logger` (LGPD) | média |
| `API_KEY` atual tem 2 caracteres — gerar chave real e combinar com a Aspa | **antes da produção** |
| `package-lock.json` não é versionado; `npm install --force` resolve dependências do zero a cada build, sem reprodutibilidade | baixa |

### Sobre a `API_KEY`

O valor configurado tem 2 caracteres — é placeholder, não credencial. A comparação em
`validate-key.middleware.ts` foi corrigida (comparava `env.APIKEY`, variável inexistente), então a
autenticação **agora funciona de verdade**. Gerar uma chave real exige combinar o valor com a Aspa,
o que tem prazo de espera — tratar junto com o item 4.1.

---

## 4.3 Agente no Orchestrate — fora do escopo do middleware

| Pendência | Contexto |
|---|---|
| `HABIB_BEARER_TOKEN` precisa virar **Connection** no Orchestrate | O token saiu do middleware, mas as tools do Portal vão precisar dele. Não descartar — mudar de lugar |
| Avaliar modelo governado pela IBM (Granite) | O modelo padrão (GPT-OSS 120B) traz aviso de licença de terceiros, *"not governed by IBM"*. O Habib processa CPF, dados de cobrança e textos jurídicos — questão que compliance pode levantar |
| Investigar se **Guidelines** resolvem as regras determinísticas | A aba Behavior do agente tem "Guidelines" (regras estruturadas, distintas das instructions). Pode cobrir identificação antes do handoff, horário de expediente e resposta literal — reduzindo trabalho no middleware |
| Textos de comunicação obrigatória com resposta literal | Avisos de ajuizamento e regras de renegociação não podem ser parafraseados pela busca semântica. Ver [01-diagnostico.md](01-diagnostico.md), seção 1.5 |
| Triagem: os documentos da Paraíso cobrem o conteúdo dos 6 domínios ou só o comportamento? | Define se a base de conhecimento parte do material novo ou precisa extrair conteúdo do bot atual |

---

## 4.4 Documentação

- **[README.md](README.md) e [02-roadmap.md](02-roadmap.md) estão desatualizados.** Foram escritos
  antes do reequilíbrio do escopo e trazem estimativa de "26 a 39 dias · 8 semanas". O prazo do
  projeto é de **28 dias**, aprovado pelo cliente. Os documentos precisam ser alinhados ou marcados
  como superados, para que ninguém os leia como plano vigente.
- `arquitetura-TO-BE.drawio` está fora do versionamento e desatualizado: mostra o middleware
  chamando o Portal do Cliente (não chama mais) e nomeia o próprio middleware de "Orquestrador",
  o que gera ambiguidade com o produto watsonx Orchestrate.

---

## 4.5 Resolvidas

Registradas para não serem reinvestigadas.

| Item | Conclusão |
|---|---|
| Deploy automático por `git push` derruba produção? | **Não.** Não havia build configurado; as aplicações rodavam imagem publicada manualmente |
| Homologação e produção compartilham imagem? | **Sim, compartilhavam** (`:latest` em ambas). Resolvido: homologação agora publica e consome `:homolog` |
| A thread do Orchestrate expira? | Sobreviveu a mais de uma hora, retomando o histórico. Não descarta TTL mais longo |
| A integração do Portal do Cliente funcionava? | **Não, em nenhuma das pontas.** Nenhum dos 809 nós do diálogo gravava a variável `integration`, e o schema de resposta descartava o campo. Código removido |
| Por que o bug `env.APIKEY` nunca foi detectado? | `ignoreDeprecations: "6.0"` era inválido no TS 5.7 e impedia o `tsc` de rodar; o `tsup` não faz checagem de tipos. Corrigido |
