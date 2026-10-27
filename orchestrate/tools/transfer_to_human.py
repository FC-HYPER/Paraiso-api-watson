from datetime import date, datetime, timedelta, timezone
from typing import Literal

from ibm_watsonx_orchestrate.agent_builder.tools import tool
from ibm_watsonx_orchestrate.run import AgentRun, Annotations, Role, TextContent, ToolResult

# Valores de `distribuicao` aprovados pela Jô em 20/10/2026 e configurados pelo André na Aspa.
# "Financeiro" fica de fora de propósito: é contas a pagar interno. "Geral" não é equipe: é o
# TIME da Aspa, a fila que todos veem (23/10/2026), e não grava `distribuicao`.
GENERAL = "Geral"
Destination = Literal[
    "Boletos",
    "Quitacao",
    "Rescisao",
    "Renegociacao",
    "Transferencia",
    "Contrato",
    "IPTU",
    "Escrituras",
    "Compra",
    "Ajuizados",
    "Demarcacao",
    "Reclamacao",
    "Geral"
]

# Atendimento humano: segunda a sexta, das 9h às 18h (kb_institucional), fora os feriados abaixo.
# Fuso fixo de -3h: o Brasil não tem horário de verão desde 2019, e o `zoneinfo` depende de
# uma base de fusos que pode não existir no ambiente onde o Orchestrate roda a tool.
TIMEZONE = timezone(timedelta(hours=-3), "America/Sao_Paulo")
OPENING_HOUR = 9
CLOSING_HOUR = 18

# Dias sem atendimento humano, além de sábado e domingo. Lista a validar com a Jô e a
# atualizar todo ano: depois de 31/12/2027 a tool volta a tratar todo dia útil como expediente.
HOLIDAYS = {
    date(2026, 11, 2),   # Finados
    date(2026, 11, 20),  # Consciência Negra
    date(2026, 12, 25),  # Natal
    date(2027, 1, 1),    # Confraternização Universal
    date(2027, 2, 8),    # Carnaval (ponto facultativo: confirmar com a Jô)
    date(2027, 2, 9),    # Carnaval (ponto facultativo: confirmar com a Jô)
    date(2027, 3, 26),   # Sexta-feira Santa
    date(2027, 4, 21),   # Tiradentes
    date(2027, 5, 27),   # Corpus Christi (ponto facultativo: confirmar com a Jô)
    date(2027, 9, 7),    # Independência
    date(2027, 9, 8),    # Nossa Senhora da Luz, feriado de Curitiba (confirmar com a Jô)
    date(2027, 10, 12),  # Nossa Senhora Aparecida
    date(2027, 11, 2),   # Finados
    date(2027, 11, 15),  # Proclamação da República
}

# Fora do expediente a transferência também acontece: a Aspa deixa o atendimento na fila até
# alguém assumir (André, 23/10/2026). O texto vai literal, para o LLM não prometer prazo.
# Aprovado em 23/10/2026. Mesmo texto em src/utils/transfer-fallback.ts.
OUT_OF_HOURS_MESSAGE = (
    "Nosso atendimento humano funciona de segunda a sexta-feira, das 9h às 18h, exceto "
    "feriados. 🙂 Seu atendimento já está na fila, e a equipe responsável continua a "
    "conversa por aqui no próximo horário de atendimento, sem que você precise enviar tudo "
    "de novo. Para agilizar, envie seu CPF/CNPJ ou número do contrato."
)



# Na transferência, quem escreve ao cliente é o LLM, para poder explicar a regra antes de
# avisar o encaminhamento. Este texto é instrução para ele, não vai ao cliente.
HANDOFF_INSTRUCTION = (
    "Transferência feita. Agora escreva a resposta ao cliente. Se ele pediu atendente, "
    "disse que já tentou e não conseguiu ou fez reclamação, não explique nada. Nos demais "
    "casos, explique em até três frases a regra geral do assunto usando somente os trechos "
    "da base consultados nesta mensagem, sem acrescentar documentos, prazos, canais ou "
    "procedimentos que não estejam neles e sem afirmar o que vale para o caso dele. Se a "
    "base não foi consultada nesta mensagem ou não trouxe o assunto, não explique. Termine "
    "dizendo que a equipe responsável continua a conversa por aqui mesmo e já vai ver o que "
    "foi conversado, então ele não precisa repetir nada. Se o cliente ainda não informou o "
    "CPF/CNPJ ou o número do contrato nesta conversa, peça na última frase que ele envie, para "
    "a equipe já receber o atendimento identificado. Não cite o nome da equipe, setores nem "
    "contatos. Não diga que o pedido foi registrado nem cite protocolo."
)


def _to_customer(text: str) -> ToolResult:
    """Texto que vai literal ao cliente (audience user), sem passar pelo raciocínio do LLM."""
    return ToolResult(
        content=[TextContent(text=text, annotations=Annotations(audience=[Role.USER]))]
    )

def _to_agent(text: str) -> ToolResult:
    """Texto só para o LLM (audience assistant): ele lê e escreve a resposta ao cliente."""
    return ToolResult(content=[TextContent(text=text)])

def _within_business_hours(now: datetime) -> bool:
    if now.weekday() >= 5 or now.date() in HOLIDAYS:
        return False
    return OPENING_HOUR <= now.hour < CLOSING_HOUR


@tool
def transfer_to_human(context: AgentRun, destination: Destination, summary: str) -> ToolResult:
    """Transfere o cliente, ao vivo, para a equipe humana responsável pelo assunto.

    Use apenas quando as instruções mandarem encaminhar. Não use para responder perguntas
    que a base de conhecimento cobre. Chame antes de escrever qualquer texto ao cliente e,
    depois, siga o que o retorno disser.

    Escolha a equipe pelo assunto real do cliente:
    - Boletos: emissão, segunda via e atualização de boleto, pagamento não compensado,
      baixa, cobrança depois da baixa, Pix ou outro meio, negativação não retirada,
      apoio no boleto do Tipo R.
    - Quitacao: quitação, amortização, antecipação.
    - Rescisao: arrependimento, rescisão, distrato, locação, encerrar o contrato para
      trocar de lote, rescisão de contrato ajuizado.
    - Renegociacao: renegociação de contrato não ajuizado.
    - Transferencia: transferência de titularidade, falecimento do titular.
    - Contrato: preparação e assinatura, segunda via de contrato que não está disponível na Área do Cliente, vencimento contratual,
      documentos, cláusulas, menor de idade, metragem, invasão, água e luz, matrícula,
      planta, alvará, atualização cadastral que não se resolve pelo portal.
    - IPTU: IPTU, condomínio, taxa de lixo.
    - Escrituras: escritura, registro, ITBI, ITCMD, dúvidas sobre o aditivo do Tipo R.
    - Compra: compra de lote, corretores, confirmação da compra, pós-venda, comprar
      outro lote.
    - Ajuizados: ajuizamento, atraso severo, Tipo K, interpelação, carta rogatória,
      desapropriação, renegociação de contrato ajuizado.
    - Demarcacao: demarcação e piquete.
    - Reclamacao: reclamações, insatisfação, pedido de supervisão.
    - Geral: o que não se encaixa em nenhuma equipe acima, como pedido relacionado à
      LGPD e dano ambiental ou movimentação de terra no lote, e pedido de atendente
      quando o cliente não diz o assunto.

    Args:
        destination: Equipe de destino, conforme a lista acima.
        summary: Uma frase com o que o cliente precisa, preservando a natureza real do
            assunto, por exemplo "rescisão de contrato ajuizado". Sem CPF, telefone ou
            outro dado pessoal.
    """
    handoff = {"atendimento_humano": True, "handoff_summary": summary}
    # Sem equipe, a Aspa manda para o TIME, a fila geral.
    if destination != GENERAL:
        handoff["distribuicao"] = destination
    context.request_context.update(handoff)

    if not _within_business_hours(datetime.now(TIMEZONE)):
        return _to_customer(OUT_OF_HOURS_MESSAGE)

    return _to_agent(HANDOFF_INSTRUCTION)

