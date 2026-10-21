from ibm_watsonx_orchestrate.agent_builder.tools import tool
from ibm_watsonx_orchestrate.run import AgentRun


@tool
def write_context_test(context: AgentRun) -> str:
    """Test tool for context variables. Use only when the user writes 'teste de contexto'."""
    phone = context.request_context.get("phone")
    context.request_context["habib_test"] = "ok"
    if phone:
        return f"Phone received, ending in {str(phone)[-4:]}."
    return "Phone not received."
