/**
 * Política de capacidades do núcleo multiagente AgriLink.
 *
 * Este módulo é deliberadamente puro: não acede ao Supabase nem executa ações.
 * A autorização final continua a pertencer ao backend/RPC de negócio.
 */

export const AGENT_TASK_TYPES = [
  'sourcing_intake',
  'supplier_discovery',
  'quote_comparison',
  'missing_information_check',
  'notification_draft',
  'admin_review',
] as const;

export type AgentTaskType = (typeof AGENT_TASK_TYPES)[number];
export type AgentRiskLevel = 'low' | 'medium' | 'high';
export type AgentAutonomyMode = 'observe' | 'suggest' | 'execute_low_risk';

export type AgentActionType =
  | 'read_only_lookup'
  | 'prepare_draft'
  | 'create_internal_task'
  | 'send_notification'
  | 'publish_or_edit_product'
  | 'accept_pre_order'
  | 'set_freight_price'
  | 'change_stock'
  | 'confirm_payment'
  | 'advance_freight'
  | 'manage_permissions'
  | 'suspend_account';

export interface AgentCapability {
  taskType: AgentTaskType;
  riskLevel: AgentRiskLevel;
  allowedModes: readonly AgentAutonomyMode[];
  description: string;
}

export interface AgentPolicyDecision {
  allowed: boolean;
  requiresHumanApproval: boolean;
  reason: string;
}

const LOW_RISK_MODES = ['observe', 'suggest', 'execute_low_risk'] as const;
const CONSULTATIVE_MODES = ['observe', 'suggest'] as const;

export const AGENT_CAPABILITIES: Readonly<Record<AgentTaskType, AgentCapability>> = {
  sourcing_intake: {
    taskType: 'sourcing_intake',
    riskLevel: 'low',
    allowedModes: LOW_RISK_MODES,
    description: 'Validar e estruturar um pedido de sourcing sem alterar dados comerciais.',
  },
  supplier_discovery: {
    taskType: 'supplier_discovery',
    riskLevel: 'low',
    allowedModes: LOW_RISK_MODES,
    description: 'Pesquisar fornecedores e publicações existentes, sem os contactar automaticamente.',
  },
  quote_comparison: {
    taskType: 'quote_comparison',
    riskLevel: 'low',
    allowedModes: LOW_RISK_MODES,
    description: 'Comparar cotações existentes com base nos dados verificados da plataforma.',
  },
  missing_information_check: {
    taskType: 'missing_information_check',
    riskLevel: 'low',
    allowedModes: LOW_RISK_MODES,
    description: 'Identificar campos em falta e pedir esclarecimentos sem alterar a encomenda.',
  },
  notification_draft: {
    taskType: 'notification_draft',
    riskLevel: 'low',
    allowedModes: LOW_RISK_MODES,
    description: 'Preparar um rascunho de notificação; o envio é uma ação separada.',
  },
  admin_review: {
    taskType: 'admin_review',
    riskLevel: 'high',
    allowedModes: CONSULTATIVE_MODES,
    description: 'Preparar evidências e recomendações para decisão de um administrador humano.',
  },
};

const ACTION_POLICIES: Readonly<Record<AgentActionType, {
  riskLevel: AgentRiskLevel;
  autonomousExecutionAllowed: boolean;
  requiresHumanApproval: boolean;
}>> = {
  read_only_lookup: { riskLevel: 'low', autonomousExecutionAllowed: true, requiresHumanApproval: false },
  prepare_draft: { riskLevel: 'low', autonomousExecutionAllowed: true, requiresHumanApproval: false },
  create_internal_task: { riskLevel: 'low', autonomousExecutionAllowed: true, requiresHumanApproval: false },
  send_notification: { riskLevel: 'medium', autonomousExecutionAllowed: false, requiresHumanApproval: true },
  publish_or_edit_product: { riskLevel: 'high', autonomousExecutionAllowed: false, requiresHumanApproval: true },
  accept_pre_order: { riskLevel: 'high', autonomousExecutionAllowed: false, requiresHumanApproval: true },
  set_freight_price: { riskLevel: 'high', autonomousExecutionAllowed: false, requiresHumanApproval: true },
  change_stock: { riskLevel: 'high', autonomousExecutionAllowed: false, requiresHumanApproval: true },
  confirm_payment: { riskLevel: 'high', autonomousExecutionAllowed: false, requiresHumanApproval: true },
  advance_freight: { riskLevel: 'high', autonomousExecutionAllowed: false, requiresHumanApproval: true },
  manage_permissions: { riskLevel: 'high', autonomousExecutionAllowed: false, requiresHumanApproval: true },
  suspend_account: { riskLevel: 'high', autonomousExecutionAllowed: false, requiresHumanApproval: true },
};

export function isAgentTaskType(value: string): value is AgentTaskType {
  return (AGENT_TASK_TYPES as readonly string[]).includes(value);
}

export function getAgentCapability(taskType: string): AgentCapability | null {
  return isAgentTaskType(taskType) ? AGENT_CAPABILITIES[taskType] : null;
}

export function evaluateAgentAction(
  action: AgentActionType,
  autonomyMode: AgentAutonomyMode,
): AgentPolicyDecision {
  const policy = ACTION_POLICIES[action];

  if (autonomyMode === 'observe') {
    return {
      allowed: false,
      requiresHumanApproval: policy.requiresHumanApproval,
      reason: 'O modo de observação não permite executar ações.',
    };
  }

  if (autonomyMode === 'suggest') {
    return {
      allowed: false,
      requiresHumanApproval: policy.requiresHumanApproval,
      reason: 'O modo consultivo permite apenas apresentar uma recomendação.',
    };
  }

  if (!policy.autonomousExecutionAllowed || policy.riskLevel !== 'low') {
    return {
      allowed: false,
      requiresHumanApproval: true,
      reason: 'A política proíbe execução autónoma desta ação; é necessária decisão humana e validação no backend.',
    };
  }

  return {
    allowed: true,
    requiresHumanApproval: false,
    reason: 'Ação de baixo risco permitida pela política; o backend deve validar a autorização e a idempotência.',
  };
}

/**
 * Um modo configurado não pode conceder mais autonomia do que a capacidade
 * permite. Não substitui autorização de utilizador, RLS ou validação de RPC.
 */
export function isAutonomyModeAllowed(
  taskType: AgentTaskType,
  autonomyMode: AgentAutonomyMode,
): boolean {
  return AGENT_CAPABILITIES[taskType].allowedModes.includes(autonomyMode);
}
