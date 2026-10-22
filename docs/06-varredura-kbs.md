# 6. Varredura dos 16 KBs

Revisão de 22/10/2026 dos 16 `.docx` validados (`habib-orchestrate-v1/01-knowledge-base/kbs em word`),
antes de subir a base nova. Objetivo: o KB passa a conter só **fatos que o cliente pode ouvir**.
Regra de sistema, instrução de comportamento e roteamento interno saem do KB, **sempre para um
destino** — nenhum conteúdo se perde.

Por que: o KB é recuperado em pedaços e entregue ao modelo como "conteúdo para responder". Trecho
como "o Habib deve informar o valor retornado pelo sistema" vira resposta ao cliente ou faz o modelo
supor um sistema que ele não tem. Nos testes de 22/10, a mistura das condições gerais de renegociação
com a seção de cobrança jurídica (mesmo documento) produziu a regra errada "24 parcelas" para
contrato ajuizado.

## Como ler

Cada linha aponta um trecho pelo número do parágrafo (`§`, posição no `.docx`) e pelas primeiras
palavras. Trecho não listado fica **como está**.

| Destino | Significado |
|---|---|
| **FATO** | Fica no KB, reescrito como fato para o cliente. A proposta de texto está na linha. O conteúdo é o mesmo; sai só a forma "o Habib deve" |
| **EVT** | Já coberto pelo catálogo de eventos (`eventos-retorno-whatsapp.pdf`, 15/10/2026): vai para a tool de boletos, com a mensagem validada |
| **API** | Já coberto pelo `REGRAS_API_ATUAL.md` (códigos de título, bloqueios, cálculo): vai para a tool de boletos e as futuras |
| **INS** | Regra de comportamento: vai para as instructions. "(existe)" quando um bloco atual já cobre; "(nova)" quando precisa entrar — lista no fim |
| **TRF** | Encaminhamento: coberto pelas `escalation_rules` e pela docstring da `transfer_to_human` (equipe entre parênteses) |
| **SAI** | Nota editorial para quem escreve o KB, sem conteúdo para o cliente |

Princípio da reescrita: uma proibição só vira fato quando o próprio KB afirma o fato. "O Habib não
deve afirmar que o FGTS pode ser usado" vira "O FGTS não pode ser usado", porque o KB diz isso em
outro ponto. "O Habib não deve sugerir recompra" **não** vira "a Central Gold não faz recompra",
porque o KB não afirma isso: vai para INS.

---

## kb_amortizacao — sem mudança

Já está escrito como fato.

## kb_antecipacao

| § | Trecho | Destino | Proposta |
|---|---|---|---|
| 019 | "O pedido deve ser encaminhado à equipe ou ao sistema… O Habib deve informar somente os valores…" | FATO + INS (existe: VALORES E CÁLCULOS) | "O pedido é encaminhado à equipe responsável pelo cálculo, que apresenta os valores." |

## kb_boletos_carnes

| § | Trecho | Destino | Proposta |
|---|---|---|---|
| 056 | "O saldo total pode reunir lançamentos… o Habib deve explicar cada item separadamente…" | FATO | "O saldo total pode reunir lançamentos de naturezas diferentes. Cada item tem natureza própria, e nem todo valor é parcela mensal do contrato." |
| 057 | "Os códigos internos dos tipos de títulos devem ser utilizados pelo Habib…" | API + INS (nova 2) | Sai do KB |
| 063 | "A disponibilidade do botão de emissão depende… o Habib deve consultar o motivo…" | FATO + EVT (seção 3) | "O botão de emissão pode ficar indisponível quando existe alguma pendência no contrato." |
| 083 | "O Habib deve encaminhar o caso para análise e evitar prometer prazo…" | TRF (Boletos) + INS (existe: VALORES E CÁLCULOS) | Sai do KB; §076–082 já explicam o procedimento |
| 085–089 | "O Habib deve utilizar os dados da sessão autenticada… CPF… contrato… data…" | EVT (seções 2 e 6) | Sai do KB |
| 090 | "Para contratos com parcelas vencidas, a emissão pode ficar limitada ao mês corrente. O Habib deve seguir o retorno do sistema…" | FATO + EVT (`solicita_dia_vencimento`) | "Para parcela vencida, o novo vencimento do boleto fica limitado ao mês corrente." |
| 100–104 | "O Habib deve: informar o motivo… orientar o envio… consultar o sistema… encaminhar…" | EVT (seção 4) + TRF (Contrato) | Sai do KB; §098–099 mantêm o fato |
| 105 | "Esse impedimento documental é diferente do bloqueio por Tipo K." | API | Sai do KB |
| 106–115 | Seção "Boleto com Tipo K ativo" inteira (consultar a API, valor mínimo, Tipos P/I/D/X, Aspas) | EVT (`proposta_pendencia_tipo_k`) + API (§4.1 e §7) + TRF (Ajuizados) + INS (existe: O QUE NÃO FAZER) | Substituir por: **"Boleto com notificação de cobrança. Quando o contrato tem notificação de cobrança em aberto, o boleto não é emitido automaticamente, e o atendimento segue com a equipe responsável."** |

## kb_compra_pos_venda

| § | Trecho | Destino | Proposta |
|---|---|---|---|
| 008 | "o Habib deve encaminhar o atendimento ao grupo Comercial no Aspas, que indicará o corretor… responsável pela região" | TRF (Compra) | Sai do KB. ⚠️ Ver divergência D4 |
| 009 | "O Habib não deve informar disponibilidade, preço…" | INS (existe: NÃO INVENTE) | Sai do KB; §002 já diz que os parceiros apresentam disponibilidade e valores |
| 012–018 | "Quando o cliente informar que entregou… ao corretor, o Habib deve: solicitar o comprovante…" | FATO + TRF (Compra) + INS (nova 9) | "Quando a entrada foi paga ao corretor, a Central Gold confere o comprovante do pagamento e o comprovante do repasse feito pelo corretor. Um novo boleto só é emitido depois dessa análise, para evitar cobrança ou pagamento em duplicidade." |
| 022 | "O Habib deve evitar declarações gerais sobre obrigação ou dispensa de CRECI…" | FATO | "A obrigação de CRECI depende de como a negociação ocorreu." |
| 048 | "O Habib deve identificar qual procedimento… antes de afirmar que a procuração é obrigatória…" | TRF (Contrato) | Sai do KB; §034–047 mantêm o fato |
| 065 | "O Habib pode explicar… não deve recomendar a compra como investimento…" | FATO + INS (nova 5) | §057 fica; acrescentar: "A Central Gold não calcula rentabilidade nem promete retorno financeiro." |

## kb_contrato_atendimento_assinatura

| § | Trecho | Destino | Proposta |
|---|---|---|---|
| 004 | "O Habib deve encaminhar a solicitação internamente pelo Aspas…" | TRF (Contrato) | "A alteração só vale depois da aprovação." (§002 já diz que depende de análise) |
| 010 | "Se a atualização não puder ser concluída pelo portal, o Habib deve encaminhar…" | FATO + TRF (Contrato) | "Se a atualização não puder ser concluída pelo portal, ela é feita pela equipe responsável." |
| 017 | "O Habib deve aproveitar os dados disponíveis na sessão autenticada…" | API (futura) | Sai do KB |
| 021 | "O Habib deve confirmar no sistema o estágio do contrato…" | EVT (seção 4) | Sai do KB |
| 044 | "O Habib não deve indicar números fixos de páginas." | FATO | Sai; §043 já diz que as páginas variam |
| 045 | "Quando o recebimento e a leitura de documentos estiverem disponíveis no canal, o Habib poderá…" | SAI | Capacidade futura, vai para o backlog |
| 046 | "…o atendimento deve ser encaminhado ao grupo responsável por contratos no Aspas." | TRF (Contrato) | "Em caso de dúvida sobre os campos, a conferência é feita pela equipe de contratos." |
| 056 | "O Habib deve evitar afirmar que o cônjuge nunca assina…" | FATO | Sai; §055 já diz isso |
| 072 | "O Habib deve consultar o andamento antes de confirmar…" | INS (existe: NÃO INVENTE) | Sai do KB |
| 078 | "O Habib deve confirmar o meio aceito antes de orientar…" | FATO | "O meio de assinatura aceito pode variar conforme o documento." |

## kb_contrato_financeiro

| § | Trecho | Destino | Proposta |
|---|---|---|---|
| 007 | "O Habib não deve afirmar que o cliente perderá automaticamente o valor pago…" | FATO + TRF (Rescisao) | "A perda do valor pago não é automática. Pedidos de cancelamento ou devolução são analisados pela equipe responsável." |
| 015 | "…Por isso, o Habib não deve afirmar que o valor permanecerá exatamente igual…" | FATO | "…Por isso, o valor da parcela pode mudar ao longo do contrato." |
| 023 | "O Habib deve informar o valor apresentado pelo sistema, sem realizar cálculos…" | INS (existe: VALORES E CÁLCULOS) | Sai do KB |
| 030 | "O Habib não deve misturar parcelas mensais e especiais…" | FATO | Sai; §029 já diz isso |
| 039 | "O Habib deve evitar afirmar que todo atraso será negativado automaticamente após 30 dias." | FATO | "Nem todo atraso é negativado automaticamente após 30 dias." |
| 043–047 | "O Habib deve verificar se: o pagamento já foi compensado… Se o prazo tiver transcorrido…" | FATO + TRF (Boletos) | "A exclusão vale para o pagamento compensado de todo o débito que originou o registro. Se o registro continuar depois dos cinco dias úteis, o caso é analisado pela equipe responsável." |
| 050 | "O Habib não deve afirmar que a negativação impede obrigatoriamente…" | FATO | "A negativação não impede obrigatoriamente um empréstimo ou compra: a decisão de conceder crédito é de cada instituição." |
| 054 | "Se as comunicações continuarem após a baixa, o Habib deve encaminhar…" | FATO + TRF (Boletos) | "Se as comunicações continuarem após a baixa, o caso é conferido pela equipe responsável." |
| 068 | "O Habib pode orientar onde localizar os documentos. A forma de declarar…" | FATO | "A forma de declarar deve ser confirmada nas orientações atuais da Receita Federal ou com um contador." |

## kb_contrato_juridico

| § | Trecho | Destino | Proposta |
|---|---|---|---|
| 008 | "…O Habib deve evitar classificá-la juridicamente ou afirmar que qualquer desistência gera perda automática da entrada." | FATO + INS (nova 7) | "…A desistência não gera perda automática da entrada." |
| 010 | "O Habib deve consultar o sistema para confirmar o estágio da proposta…" | EVT (seção 4) | Sai do KB |
| 020 | "O Habib pode explicar as cláusulas… Interpretação jurídica… deve ser encaminhada…" | FATO + TRF (Contrato) | "Interpretação jurídica, alteração de cláusula e análise individual são feitas pela equipe responsável." |
| 030 | "O Habib não deve misturar os custos do registro do compromisso com ITBI…" | FATO | "Os custos do registro do compromisso são diferentes do ITBI, da escritura pública e das demais despesas da transferência definitiva." |
| 042–043 | "O Habib deve solicitar a certidão… Ele não deve explicar os efeitos patrimoniais…" | FATO + TRF (Contrato) + INS (nova 7) | "A participação do cônjuge e os efeitos do regime de bens dependem da análise da certidão atualizada e do contrato pela equipe responsável." |
| 060 | "Se o documento não estiver disponível, o Habib deve encaminhar… no Aspas." | FATO + TRF (Contrato) | "Se o documento não estiver disponível no portal, a equipe de contratos providencia." |
| 071 | "O Habib deve solicitar apenas os dados necessários, aproveitar a sessão autenticada…" | API (futura) + INS (nova) | Sai do KB |
| 077–082 | "Quando o cliente informar que recebeu uma Carta Rogatória, o Habib deve: reconhecer… orientar… evitar… encaminhar… recomendar…" | FATO + TRF (Ajuizados) | "Quem recebe uma Carta Rogatória deve observar os prazos indicados e buscar orientação jurídica de confiança. O caso é tratado pela equipe jurídica." |
| 087 | "Invasão… devem seguir para a intenção e a equipe correspondentes." | TRF (Contrato) | Sai ("intenção" é termo do dialog antigo) |
| 092 | "O Habib não calcula indenização nem define quem receberá… seguir para a equipe jurídica." | FATO + TRF (Ajuizados) | "A indenização e quem recebe os valores dependem do procedimento e são tratados pela equipe jurídica." |
| 097 | "O Habib não deve afirmar que haverá penhora…" | FATO | "A existência de penhora e as consequências jurídicas dependem do caso concreto." |
| 099–102 | Interpelação judicial, com "Resposta sugerida: Vou encaminhar seu atendimento…" | TRF (Ajuizados) | "Quando houver interpelação judicial, o caso é tratado pela equipe responsável." A resposta sugerida sai: o encaminhamento agora é feito pela tool |

## kb_corretores

| § | Trecho | Destino | Proposta |
|---|---|---|---|
| 010 | "O Habib deve encaminhar o interessado ao grupo Comercial no Aspas, evitando divulgar contatos pessoais…" | TRF (Compra) | Sai do KB. ⚠️ Ver divergência D3 |

## kb_institucional

| § | Trecho | Destino | Proposta |
|---|---|---|---|
| 006 | "Mariane e Mário realizam o atendimento telefônico…" | **Decisão sua** | Conflita com O QUE NÃO FAZER (nomes de colaboradores). Opções: manter, ou "A equipe de atendimento telefônico orienta o cliente nas etapas do contrato." |
| 024 | "Sempre que o serviço estiver disponível na Área do Cliente, o Habib deve orientar esse caminho em primeiro lugar." | INS (nova 4) | Sai; §012 já diz que é o canal principal |
| 038 | "…O Habib deve evitar orientar pagamento por meio diferente sem confirmação…" | FATO | "…Pagamento por outro meio depende de confirmação da equipe responsável." |
| 041–046 | "O Habib deve informar somente o prazo… registrar a solicitação; encaminhar… no Aspas…" | INS (existe: NÃO INVENTE e AÇÕES PROIBIDAS) + TRF | Sai; §040 fica. "Registrar a solicitação" contradiz AÇÕES PROIBIDAS |

## kb_iptu

| § | Trecho | Destino | Proposta |
|---|---|---|---|
| 027 | "…lançado separadamente para regularização, identificado como título de natureza I." | FATO + API | "…lançado separadamente para regularização, identificado como IPTU no histórico." |
| 029 | "não deve ser misturado às parcelas contratuais do tipo F" | FATO + API | "não se confunde com as parcelas do contrato" |
| 033 | "A existência de título I não deve ser apresentada como bloqueio automático… observar o retorno da API…" | FATO + API | Vale a regra atual da API (D5): "Quando existe reembolso vencido de IPTU, taxa de lixo ou condomínio pago pela empresa, ele precisa ser pago antes dos demais boletos." |
| 045 | "O Habib não deve calcular parcelas, juros ou quantidade de vencimentos…" | INS (existe: VALORES E CÁLCULOS) | Sai do KB |
| 052 | "O Habib deve encaminhar divergências à equipe responsável e orientar…" | FATO + TRF (IPTU) | "Divergências são analisadas pela equipe responsável, e a atualização deve ser confirmada com a Prefeitura." |
| 069–071 | "Tipo I… Tipo D… Tipo X…" | FATO + API | Tirar os códigos: "IPTU pago pela empresa em nome do cliente; condomínio pago…; taxa de lixo paga…" |
| 072 | "O Habib nunca deve apresentar esses títulos como parcelas contratuais comuns." | FATO | "Esses valores não são parcelas do contrato." |

## kb_quitacao

| § | Trecho | Destino | Proposta |
|---|---|---|---|
| 004 | "O Habib não deve calcular, estimar ou prometer valores de quitação." | INS (existe: VALORES E CÁLCULOS) | Sai; §003 fica |
| 028–029 | "registrados separadamente como títulos I, D ou X… parcelas contratuais do tipo F" | FATO + API | "registrados separadamente, como IPTU, condomínio ou taxa de lixo. Esses valores não se confundem com as parcelas do contrato." |
| 035 | "O Habib deve informar o valor retornado pelo sistema… sem oferecer… desconto adicional." | INS (guideline "exclusão de encargos" → instructions) | Sai; §032–034 mantêm o fato |
| 038–044 | "Quando o cliente solicitar quitação, o Habib deve: identificar… sessão autenticada… registrar… encaminhar à integração…" | TRF (Quitacao) + API (futura) | Sai do KB |
| 045 | "Enquanto o prazo operacional permanecer em até sete dias úteis, o Habib deve informar esse prazo…" | FATO | **"O cálculo da quitação fica pronto em até sete dias úteis."** (o prazo fica) |
| 046 | "Quando o cálculo estiver disponível, o valor e a data de validade devem ser informados…" | FATO | "O cálculo informa o valor e a data de validade." |
| 049–053 | "O sistema deve separar: …" | FATO | "O cálculo separa: …" (a lista fica) |
| 054 | "Quando houver título K ou situação jurídica ativa, o Habib deve encaminhar…" | FATO + TRF (Ajuizados) + EVT | "Com notificação de cobrança ou situação jurídica ativa, a quitação é tratada pela equipe responsável." |
| 061–064 | "O Habib não deve afirmar que o FGTS pode ser utilizado para: …" | FATO | "O FGTS não pode ser utilizado para: …" (a lista fica; §057 de contrato_financeiro afirma o mesmo) |

## kb_renegociacao

| § | Trecho | Destino | Proposta |
|---|---|---|---|
| 008 | "atender às demais condições retornadas pelo sistema" | FATO + API (§6) | "atender às demais condições verificadas pela equipe responsável" |
| 009 | "O atendimento à regra deve ser confirmado pelo sistema ou pela equipe responsável." | FATO | "O atendimento às condições é confirmado pela equipe responsável." |
| 010 | "…o Habib deve informar com clareza que a renegociação ainda não está disponível… pagamentos permitidos pelo sistema…" | FATO + API (§7) | "Quando o contrato não está dentro das condições, a renegociação ainda não está disponível, e seguem os pagamentos permitidos para o contrato." |
| 011 | "O Habib não deve encaminhar pedido de exceção quando a Central Gold não analisa exceções…" | INS (nova 8) | Sai. ⚠️ Ver divergência D6 |
| 013 | "…não pode ser prometida pela equipe de vendas ou pelo Habib." | FATO | "A alteração do plano após a assinatura não é automática e depende de aprovação." |
| 017 | "O Habib deve explicar apenas o procedimento operacional. Dúvidas sobre efeitos jurídicos…" | FATO + TRF (Renegociacao) | "Dúvidas sobre efeitos jurídicos ou cláusulas do novo contrato são tratadas pela equipe responsável." |
| 020–026 | "O sistema deve verificar: situação atual do acordo…" | API | Sai; §019 mantém o fato |
| 027 | "O Habib deve informar somente a alternativa liberada… não deve prometer… nem afirmar que perdeu definitivamente…" | FATO | "O descumprimento de acordo anterior não elimina definitivamente a possibilidade de uma nova renegociação no futuro." |
| 031 | "O Habib deve informar o valor retornado pelo sistema, sem oferecer desconto…" | INS (guideline "exclusão de encargos") | Sai; §029–030 mantêm o fato |
| 034 | "O Habib não deve retirar encargos, alterar vencimentos ou dividir valores…" | INS (existe: VALORES E CÁLCULOS) | Sai; §033 fica |
| 036–041 | "Quando o sistema indicar título K, custas do tipo P, ajuizamento… o Habib deve: evitar… informar… encaminhar… no Aspas…" | FATO + TRF (Ajuizados) + EVT | **"Contrato em cobrança jurídica. Contrato com notificação de cobrança, ajuizamento ou outra situação jurídica tem tratamento específico pela equipe jurídica e não segue a orientação financeira comum."** É este trecho que evita a resposta errada das 24 parcelas |
| 043 | "O Habib não deve fornecer contato pessoal de colaborador… nem interpretar o processo judicial." | INS (existe: O QUE NÃO FAZER) + INS (nova 7) | Sai do KB |
| 046 | "O Habib somente deve afirmar que o contrato está ajuizado… quando… confirmada pelo sistema." | INS (nova 1) | Sai do KB |
| 049 | "Conforme o status retornado pelo sistema, o cliente poderá ter…" | FATO | "Conforme a situação do contrato, as alternativas podem ser:" (a lista §050–054 fica) |
| 055 | "O valor mínimo autorizado deve ser retornado pela API… O Habib não deve calcular…" | API (§7) + INS (existe) | Sai do KB |

## kb_rescisao

| § | Trecho | Destino | Proposta |
|---|---|---|---|
| 004 | "…o pedido deve ser registrado e encaminhado imediatamente… O Habib deve aproveitar os dados…" | FATO + TRF (Rescisao) | "Dentro desse prazo, o pedido é encaminhado imediatamente à equipe responsável." |
| 014 | "O Habib somente deve afirmar que houve rescisão, cancelamento ou ajuizamento quando…" | INS (nova 1) | Sai do KB |
| 023 | "A solicitação deve ser encaminhada internamente à equipe responsável no Aspas." | FATO | "A solicitação é tratada pela equipe responsável." |
| 033 | "O Habib não deve informar prazo de desocupação, multa ou obrigação de retirada…" | FATO | "Prazo de desocupação, multa e retirada de benfeitorias dependem do termo e do contrato de cada cliente." |
| 044 | "O Habib não deve calcular nem estimar o valor da rescisão." | INS (existe: VALORES E CÁLCULOS) | Sai do KB |
| 067 | "…Não deve existir uma seção separada denominada 'rescisão em outros estados'." | SAI | A primeira frase fica |
| 071 | "O Habib não deve prometer aproveitamento automático dos pagamentos anteriores." | FATO | "Os pagamentos do contrato anterior não são aproveitados automaticamente." |
| 073–079 | "Antes de iniciar a rescisão, o Habib pode consultar se existe alguma alternativa… somente as opções autorizadas pelo sistema… não deve sugerir recompra…" | FATO + API (futura) + INS (nova 6) | "Antes da rescisão, podem existir alternativas como: …" (a lista fica) |
| 081–087 | "Ao receber o pedido, o Habib deve: identificar… registrar… encaminhar… informar o protocolo…" | TRF (Rescisao) | Sai. "Informar o protocolo" contradiz AÇÕES PROIBIDAS |

## kb_transferencia

| § | Trecho | Destino | Proposta |
|---|---|---|---|
| 003 | "Antes de orientar o cliente, o Habib deve identificar a situação:" | FATO | "A transferência segue procedimentos diferentes conforme a situação:" (a lista fica) |
| 008–011 | "Tipos de títulos: Tipo T… Tipo Y…" | API | Sai do KB |
| 015 | "O Habib deve indicar a plataforma como caminho principal." | FATO | "A plataforma é o caminho principal para a solicitação." |
| 076 | "O Habib não deve afirmar que a declaração de únicos herdeiros é suficiente nem definir quem possui direito…" | FATO | "A suficiência da declaração de únicos herdeiros e quem tem direito ao contrato dependem da análise da equipe responsável." |
| 091 | "O valor da taxa deve ser confirmado pela plataforma ou pelo sistema antes de ser informado." | FATO | "O valor da taxa é informado pela plataforma." ⚠️ Ver divergência D7 |
| 098 | "O Habib deve informar somente o prazo vigente retornado pelo sistema…" | FATO | "O prazo é informado pela equipe responsável." |
| 101 | "…os pagamentos seguem conforme o contrato e os títulos liberados pelo sistema." | FATO | "…os pagamentos seguem conforme o contrato." |
| 102–103 | "O Habib não deve informar suspensão de boleto sem retorno específico da API… Tipo K…" | API | Sai; §100 mantém o fato |
| 119–120 | "Saldo… devem ser obtidos do contrato, do termo individual, do sistema ou da API. O Habib não deve criar…" | FATO + INS (existe: NÃO INVENTE) | "Saldo, parcelas e encargos constam do contrato e do termo individual de cada caso." |

## kb_contrato_lote_construcao_terreno

| § | Trecho | Destino | Proposta |
|---|---|---|---|
| 009 | "O Habib deve registrar a solicitação e encaminhá-la ao grupo responsável no Aspas…" | TRF (Demarcacao) + INS (existe: O QUE NÃO FAZER) | Sai; §002 fica |
| 015 | "O Habib pode orientar onde solicitar o documento, mas não deve interpretar…" | INS (nova 7) | Sai do KB |
| 033 | "O Habib não deve fornecer uma lista única para todos os municípios." | FATO | "Os requisitos variam conforme o município." |
| 054–059 | "O Habib não deve: calcular a área; prometer abatimento…; usar a palavra 'ressarcimento'; informar ajuste automático… O caso deve ser encaminhado…" | FATO + INS (nova 3) + TRF (Contrato) | "Abatimento, cobrança complementar e ajuste nas parcelas não são automáticos: o caso é analisado pela equipe responsável, com o levantamento técnico e os documentos do imóvel." |
| 069 | "O Habib deve registrar o relato e encaminhar o caso. Ele não deve prometer a retirada do ocupante nem orientar o cliente a entrar no lote." | TRF (Contrato) + INS (nova) | Sai; §062–068 mantêm a orientação ao cliente |
| 083 | "…Os contatos e o prazo devem permanecer sujeitos à revisão da equipe responsável." | SAI | A primeira frase (prazo de 45 dias) fica |
| 106 | "O Habib deve analisar cada empreendimento separadamente." | FATO | "A situação varia conforme o empreendimento:" |
| 124–131 | Seção "Regra para o Habib" | FATO + TRF (Contrato) | A seção sai. O conteúdo já está em §103–123; acrescentar ao fim de §112: "A individualização da matrícula não é automática." |
| 136 | "O Habib deve encaminhar o cliente à Prefeitura, ao profissional responsável e ao cartório…" | FATO | "O pedido envolve a Prefeitura, um profissional habilitado e o cartório competente." |
| 140 | "O Habib deve registrar a solicitação e encaminhá-la…" | TRF (Contrato) | Sai; §138–139 ficam |

## kb_escritura_registro

| § | Trecho | Destino | Proposta |
|---|---|---|---|
| 052 | "…mas o Habib não deve estimar o imposto nem aplicar percentuais genéricos." | INS (existe: VALORES E CÁLCULOS) | Corta a oração final |
| 061 | "O Habib deve evitar calcular ou confirmar a incidência do ITCMD. O atendimento deve ser encaminhado…" | FATO + TRF (Escrituras) | "A incidência do ITCMD é analisada pela equipe responsável, com consulta à Secretaria da Fazenda estadual, ao cartório e ao profissional jurídico ou tributário." |
| 074 | "…Antes de informar multa ou valor, o Habib deve conferir o contrato…" | FATO | "…A multa e o valor dependem do contrato de cada cliente." |
| 105 | "O Habib deve encaminhar a solicitação de parcelamento à equipe responsável…" | TRF (Escrituras) | Sai; §095 e §107 mantêm o fato |

---

## Instructions novas (destino INS "nova")

Regras que hoje só existem nos KBs e não têm bloco nas instructions. Entram junto com a migração das
guidelines (docs/04-pendencias.md, 4.3), porque várias se sobrepõem.

1. Nunca afirmar que o contrato está ajuizado, rescindido ou cancelado: o Habib não tem como
   confirmar. Tratar pelo que o cliente relata (renegociacao §046, rescisao §014).
2. Usar com o cliente os nomes da Área do Cliente (Entrada, Fatura, IPTU, Taxa de Notificação),
   nunca códigos de título (boletos §057).
3. Não usar a palavra "ressarcimento" em diferença de metragem (lote §054–059).
4. Quando o serviço existe na Área do Cliente ou na plataforma de transferência, indicar esse caminho
   primeiro (institucional §024, transferencia §015; guideline "Autoatendimento pelo Portal").
5. Não recomendar a compra como investimento nem calcular rentabilidade (compra §065).
6. Não sugerir recompra do lote pela Central Gold nem dar aconselhamento financeiro pessoal (rescisao §079).
7. Não fazer interpretação jurídica: processo, matrícula, regime de bens, classificação de documento
   (juridico §008, §043; renegociacao §043; lote §015).
8. Não encaminhar pedido de exceção onde a Central Gold não analisa exceção (renegociacao §011). ⚠️ D6
9. Não considerar regularizado um pagamento só pelo relato do cliente ou do corretor (compra §018;
   guideline "Pagamento feito a corretor").
10. Em invasão do lote, não prometer a retirada do ocupante nem orientar o cliente a entrar no lote
    (lote §069).
11. Pedir ao cliente só os dados necessários e não expor informações completas em mensagens
    (juridico §071).

## Próximos passos

O que saiu dos KBs e precisa chegar ao destino. Marcar aqui conforme for feito.

- [x] **Instructions:** as 11 regras entraram em 22/10/2026, junto com a migração das guidelines,
  em `tone_and_style` (vocabulário), `<case_rules>` e `escalation_rules` (D6)
- [x] **escalation_rules (D6):** importado em 22/10/2026
- [ ] **Tool de boletos:** usar como especificação o que saiu com destino EVT e API: identificação
  do cliente (CPF, contrato, data), pendências que impedem emissão (notificação de cobrança/Tipo K,
  ação ajuizada, contrato físico pendente, reembolso de IPTU/condomínio/lixo a pagar antes), nomes
  da Área do Cliente no lugar dos códigos de título (I, D, X, F, P, T, Y), valor mínimo de
  regularização calculado pela API e nunca pelo Habib. Nada disso existe mais no KB; a fonte passa
  a ser o catálogo de eventos e o `REGRAS_API_ATUAL.md`
- [ ] **Tools futuras (quitação, rescisão, sessão autenticada):** os trechos "consultar o sistema",
  "aproveitar a sessão autenticada", "informar o protocolo" e "registrar a solicitação" saíram dos
  KBs. Quando houver tool para esses fluxos, retomar daqui (D10)
- [ ] **Backlog:** leitura de documentos enviados pelo cliente no canal (assinatura §045)
- [ ] **Decisão pendente:** institucional §006, nomes dos colaboradores do atendimento telefônico
- [x] **Base nova:** `base_conhecimento_paraisogold_v2_3364wk`, criada pelo painel em 22/10/2026
  com os 16 `.docx` de `kbs em word v2` e o modelo de embeddings padrão; a v1 foi excluída. Nas
  baterias, a busca trouxe o trecho certo em todas as perguntas, inclusive os contatos oficiais.
  Troca do modelo de embeddings fica sem prioridade enquanto isso se mantiver

---

## Divergências encontradas (só apontadas)

Decisões de 22/10/2026: **D3** desconsiderada (a guideline é da época dos primeiros KBs e será
revista na migração das guidelines); **D5** segue a regra atual da API (iptu §033 reescrito acima);
**D6** ajuste aprovado nas `escalation_rules` (trocar "análise, aprovação ou exceção" por "análise
ou aprovação" e listar em QUANDO NÃO ENCAMINHAR os pedidos sem análise: desconto ou retirada de
encargos, desconto extra na quitação, renegociação quando o cliente informa que não cumpre as
condições); **D10** desconsiderada por enquanto, porque o mecanismo de registro e protocolo não
existe (os trechos saem do KB de qualquer forma, como TRF).

**Aplicado em 22/10/2026** na cópia `kbs em word v2`, por script, a partir dos originais. Cada
operação localizou um único parágrafo pelo texto atual; só `word/document.xml` foi regravado. A
conferência automática confirmou, nos 15 arquivos alterados, que a lista de parágrafos ficou
exatamente a do original com as operações aplicadas, e que as demais partes do `.docx` ficaram
idênticas byte a byte. `kb_amortizacao` não tinha mudança. Nenhum parágrafo dos KBs novos cita
mais o Habib. Os originais em `kbs em word` não foram tocados. Diferenças em relação ao roteiro:
em lote, a frase "A individualização da matrícula não é automática." entrou no fim de §108 (início
da seção do Residencial Fedalto), não de §112; em rescisao, o título "Solicitação de rescisão" saiu
junto com a seção, que ficou vazia; institucional §006 (Mariane e Mário) **não foi alterado**,
aguardando decisão.

| # | Onde | O quê |
|---|---|---|
| D1 | Todos os KBs | Os KBs usam "Central Gold"; as instructions e a descrição do agente usam "ParaísoGold" |
| D2 | institucional §007 e §027; evento `proposta_contrato_pronto_retirada` | KB: atendimento das 9h às 18h. Mensagem do evento: "das 09:00 às 17:00" |
| D3 | kb_corretores; guideline "Disponibilidade e compra de lote" | A guideline manda "apresentar os contatos" das imobiliárias parceiras, mas **nenhum dos 16 KBs validados tem contato de parceiro**. A versão anterior, `kb_corretores.md`, tinha a lista de imobiliárias, com gestores, celulares e e-mails pessoais. A versão validada tirou a lista e diz para evitar contatos "sem confirmação de que permanecem atualizados". `kb_contatos_comerciais.md` e `kb_administradoras_condominio.md` também não têm versão `.docx`. Risco direto de contato inventado, e a base antiga do Orchestrate provavelmente ainda tem a lista |
| D4 | compra §008; guideline "Disponibilidade e compra de lote" | KB: corretor "responsável pela região". Guideline: "não existe área de atuação por parceiro" |
| D5 | iptu §033; evento `pendencias_reembolso_a_regularizar` | KB: IPTU pago pela empresa não bloqueia automaticamente a parcela. Evento: o reembolso vencido precisa ser pago antes dos demais boletos |
| D6 | renegociacao §011; `escalation_rules` | KB: não encaminhar pedido de exceção. Instructions: "pedir análise, aprovação ou exceção" → encaminhar |
| D7 | transferencia §091; `VALORES E CÁLCULOS` | As instructions citam a taxa de transferência como valor tabelado a informar, mas nenhum KB traz o valor: só "é informado pela plataforma" |
| D8 | escritura §066–067 | "Sugestões e/ou reclamações: Cartório Volpi" e "Editais: Editais" eram links no Word. A extração de texto perde o endereço; provavelmente a base também perde |
| D9 | juridico §101 | "Resposta sugerida: Vou encaminhar seu atendimento…" disputa com o fluxo da tool |
| D10 | institucional §043, quitacao §041, rescisao §083 e §086 | "Registrar a solicitação" e "informar o protocolo" contradizem AÇÕES PROIBIDAS |
