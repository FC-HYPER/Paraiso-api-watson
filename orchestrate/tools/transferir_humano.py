from datetime import datetime
from zoneinfo import ZoneInfo

from ibm_watsonx_orchestrate.agent_builder.tools import tool, ToolPermission

# Filas aceitas pela Aspa em `distribuicao`, mais "geral" (atendimento_humano).
FILAS = [
    "Boletos",
    "Quitacao",
    "Rescisao",
    "Transferencia",
    "Renegociacao",
    "Contrato",
    "IPTU",
    "Escrituras",
    "Compra",
    # Categorias novas, ainda nao habilitadas na Aspa. Ate la o middleware cai em geral.
    "Juridico",
    "Lote",
    "Financeiro",
    "geral",
]

# Atendimento: segunda a sexta, 9h as 18h (kb_institucional).
EXPEDIENTE_INICIO = 9
EXPEDIENTE_FIM = 18


@tool(
    name="transferir_humano",
    permission=ToolPermission.READ_ONLY,
    description=(
        "Transfere o cliente, ao vivo, para um atendente humano. Use apenas nos casos "
        "que as instrucoes do agente mandam encaminhar. So chame depois de ter o CPF/CNPJ "
        "ou numero do contrato do cliente. Se a ferramenta devolver pedido de informacao "
        "ou aviso de horario, repasse ao cliente e NAO diga que transferiu. Se devolver "
        "TRANSFERENCIA_OK, responda exatamente o texto indicado."
    ),
)
def transferir_humano(fila: str, documento: str) -> str:
    """Valida identificacao e expediente e solicita a transferencia.

    Args:
        fila: Fila de destino. Um de: Boletos, Quitacao, Rescisao, Transferencia,
            Renegociacao, Contrato, IPTU, Escrituras, Compra, Juridico, Lote,
            Financeiro, geral.
        documento: CPF/CNPJ ou numero do contrato informado pelo cliente.

    Returns:
        Texto para o agente seguir. TRANSFERENCIA_OK se a transferencia foi aceita.
    """
    if fila not in FILAS:
        return f"Fila invalida. Escolha uma de: {', '.join(FILAS)}."

    if not "".join(ch for ch in documento if ch.isdigit()):
        return "Identificacao ausente. Peca ao cliente o CPF/CNPJ ou numero do contrato."

    agora = datetime.now(ZoneInfo("America/Sao_Paulo"))
    if agora.weekday() >= 5 or not EXPEDIENTE_INICIO <= agora.hour < EXPEDIENTE_FIM:
        return (
            f"Fora do expediente (segunda a sexta, {EXPEDIENTE_INICIO}h as "
            f"{EXPEDIENTE_FIM}h). Informe o horario ao cliente e nao transfira."
        )

    return f"TRANSFERENCIA_OK fila={fila}. Responda exatamente: [[ASPA:{fila}]]"
