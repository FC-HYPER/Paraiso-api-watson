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

**3. Apontar o gateway para a rota nova.** A rota do Orchestrate é
`POST /api/orchestrate/message` — nasceu ao lado da atual, que continua no ar. Requer o header
`apikey` (a rota antiga não exigia).

Para não obrigar mudança de parsing, a resposta **replica a forma do Watson**: o texto do agente sai
em `data.output.generic[0].text` com `response_type: "text"`. Vale confirmar junto com a pergunta 2 —
se a Aspa lê esse caminho, a migração é só troca de URL e inclusão do header.

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
| Definir se os 3 últimos dígitos preservados no log atendem à política de privacidade do cliente | baixa — decisão de compliance, não de código |
| `prettier/prettier` acusa `Delete ␍` em todo arquivo do repositório: os arquivos são CRLF e o `.prettierrc.json` não define `endOfLine`. `npm run lint` falha por isso, não por código. Resolver com `"endOfLine": "crlf"` ou um `--fix` isolado num commit só de formatação | baixa |
| Cota do Container Registry estourada (500 MB do plano gratuito). Limpar os digests sem tag e avaliar subir o plano — com dois ambientes, o gratuito trava a cada poucos deploys. **Nunca apagar `:latest`** (produção) nem a `:homolog` em uso | **bloqueia deploy** |
| `fastify-zod@1.4.0` declara peer `fastify@^4.15.0` e o projeto roda fastify 5. Funciona, mas é combinação não suportada pela biblioteca, e obriga `--legacy-peer-deps` em todo install. Avaliar substituir por `fastify-type-provider-zod`, que suporta fastify 5 | média |
| Imagem de produção (`:latest`) tem 351 dias. Promover imagem nova leva um ano de deriva de dependência de uma vez — `fastify` de 5.2 para 5.8, entre outros. Testar em homologação antes de promover | **antes da produção** |
| `API_KEY` atual tem 2 caracteres — gerar chave real e combinar com a Aspa | **antes da produção** |
| Fixar a imagem base: `node:20-alpine` é tag móvel e continua sendo fonte de deriva entre builds | baixa |

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
| Como passar dados do cliente (telefone, CPF) ao agente? | **O Orchestrate lê apenas a última mensagem `user`.** Testado direto na API, sem o middleware, com a mesma pergunta e o mesmo agente: dado em `context` → não vê; `role: system` → não vê; `role: developer` → não vê; mensagem `user` anterior no array → não vê; **na própria mensagem `user` → vê** (respondeu "Marina Toledo"). Todos retornaram HTTP 200 — o descarte é silencioso. Consequência: o único canal para entregar dado ao agente hoje é o texto da mensagem. Capturar contexto no middleware não resolve. Se virar necessidade, concatenar com lista explícita de campos, só na primeira mensagem da thread, e tratar a LGPD (CPF entra no histórico guardado na IBM e no log). Não afeta o `thread_id`, que viaja no header `X-IBM-THREAD-ID` e está validado |
| ⚠️ A API tem a forma da OpenAI, não o comportamento | O array `messages` **não é a conversa** — a conversa é a thread. Enviar histórico no array gasta banda e não muda a resposta. O middleware manda uma mensagem só, de propósito |

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
| Logar `run_id` e `trace_id` da resposta do Orchestrate | Implementado no controller da rota nova, junto do `thread_id`, na mesma linha de log |
| Requisição malformada devolvia 500 | O error handler ignorava o `statusCode` do erro do Fastify. Corrigido: 4xx é honrado, 5xx continua virando 500 |
| Por que a imagem nova ficou 35 MB maior que a de produção? | Deriva de dependência, não código novo. O `package.json` não muda desde 05/03/2025 e nenhuma dependência foi adicionada; sem lockfile versionado, cada `npm install --force` reresolvia todos os `^` para a versão mais nova (`typescript` 5.7→5.9, `vite` 6.2→6.4, `fastify` 5.2→5.8). Resolvido: lockfile versionado e `npm ci` no Dockerfile |
| `package-lock.json` não versionado, builds não reprodutíveis | Lockfile versionado e Dockerfile passou a usar `npm ci`. Build multi-stage: a imagem final leva só dependências de produção, e o `node_modules` caiu de 199 MB para 59 MB. Validado rodando o `build/` contra apenas as deps de produção — rota nova, rota antiga, Swagger e log com redaction, todos ok |
| Redaction de CPF e proposta no log (LGPD) | Implementada em [`src/utils/redact.ts`](../src/utils/redact.ts), aplicada no `interceptor-logger` nas duas rotas. Mascara CPF/CNPJ pontuados e sequências de 5+ dígitos, **preservando os 3 últimos** para correlação. Opção de menu numérico (1, 2, 10) não é mascarada. `thread_id`, `run_id` e `trace_id` são preservados, senão perde-se a única forma de investigar. Vale só para o log — a resposta ao gateway sai intacta |
| Por que o bug `env.APIKEY` nunca foi detectado? | `ignoreDeprecations: "6.0"` era inválido no TS 5.7 e impedia o `tsc` de rodar; o `tsup` não faz checagem de tipos. Corrigido |
