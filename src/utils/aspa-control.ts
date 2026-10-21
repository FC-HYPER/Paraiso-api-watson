/**
 * Tradução do contexto da run do Orchestrate para as variáveis de controle da Aspa
 * (`data.context.skills["main skill"].user_defined`).
 *
 * Esta é a última barreira antes de a Aspa mover um cliente real: só passa o que
 * estiver na lista fechada e com valor válido. Um valor fora do mapa (inventado pelo
 * modelo, digitado errado numa tool) é descartado e logado, nunca repassado.
 */

/**
 * Valores de `distribuicao` aprovados pela Jô em 20/10/2026 e configurados pelo
 * André na Aspa. Mesma lista do `Destination` em
 * `orchestrate/tools/transfer_to_human.py`: mudar nos dois lugares juntos.
 * "Financeiro" fica de fora de propósito (contas a pagar interno).
 */
export const ASPA_DESTINATIONS = new Set([
  'Boletos',
  'Quitacao',
  'Rescisao',
  'Renegociacao',
  'Transferencia',
  'Contrato',
  'IPTU',
  'Escrituras',
  'Compra',
  'Ajuizados',
  'Demarcacao',
  'Reclamacao',
]);

/** O resumo vai para a tela do atendente; limitado para não carregar texto desgovernado. */
const SUMMARY_MAX = 500;

export interface AspaUserDefined {
  distribuicao?: string;
  atendimento_humano?: boolean;
  encerrar_sessao?: boolean;
  menu_aspa?: boolean;
  resumo_encaminhamento?: string;
}

export interface AspaControl {
  /** Vazio quando nenhuma variável de controle deve ir à Aspa. */
  userDefined: AspaUserDefined;
  /** Motivos de descarte, para o log. Nunca vão ao gateway. */
  rejected: string[];
}

export function buildAspaControl(context: Record<string, unknown>): AspaControl {
  const userDefined: AspaUserDefined = {};
  const rejected: string[] = [];

  const { distribuicao, atendimento_humano: humanRequested } = context;

  if (distribuicao !== undefined) {
    if (typeof distribuicao === 'string' && ASPA_DESTINATIONS.has(distribuicao)) {
      // A transferência sempre leva os dois juntos, como o Dialog faz hoje.
      userDefined.distribuicao = distribuicao;
      userDefined.atendimento_humano = true;

      const summary = context.handoff_summary;
      if (typeof summary === 'string' && summary.trim()) {
        userDefined.resumo_encaminhamento = summary.trim().slice(0, SUMMARY_MAX);
      }
    } else {
      rejected.push(`distribuicao fora do mapa: ${JSON.stringify(distribuicao)}`);
    }
  } else if (humanRequested !== undefined) {
    // Humano geral, sem equipe: suspenso até o André confirmar quem recebe.
    // A Jô não quer rota genérica sem responsável.
    rejected.push('atendimento_humano sem distribuicao');
  }

  if (context.encerrar_sessao === true) userDefined.encerrar_sessao = true;
  if (context.menu_aspa === true) userDefined.menu_aspa = true;

  return { userDefined, rejected };
}
