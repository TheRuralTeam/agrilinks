import { describe, expect, it } from 'vitest';
import {
  AGENT_CAPABILITIES,
  evaluateAgentAction,
  getAgentCapability,
  isAgentTaskType,
  isAutonomyModeAllowed,
} from './capabilities';

describe('AgriLink agent capability policy', () => {
  it('accepts only the allowlisted task types', () => {
    expect(isAgentTaskType('quote_comparison')).toBe(true);
    expect(isAgentTaskType('run_arbitrary_sql')).toBe(false);
    expect(getAgentCapability('run_arbitrary_sql')).toBeNull();
  });

  it('keeps the task catalog aligned with the migration contract', () => {
    expect(Object.keys(AGENT_CAPABILITIES).sort()).toEqual([
      'admin_review',
      'missing_information_check',
      'notification_draft',
      'quote_comparison',
      'sourcing_intake',
      'supplier_discovery',
    ]);
  });

  it('allows low-risk execution mode only for allowlisted capabilities', () => {
    expect(isAutonomyModeAllowed('quote_comparison', 'execute_low_risk')).toBe(true);
    expect(isAutonomyModeAllowed('admin_review', 'execute_low_risk')).toBe(false);
  });

  it('never executes sensitive business actions autonomously', () => {
    for (const action of [
      'send_notification',
      'publish_or_edit_product',
      'accept_pre_order',
      'set_freight_price',
      'change_stock',
      'confirm_payment',
      'advance_freight',
      'manage_permissions',
      'suspend_account',
    ] as const) {
      const decision = evaluateAgentAction(action, 'execute_low_risk');
      expect(decision.allowed, action).toBe(false);
      expect(decision.requiresHumanApproval, action).toBe(true);
    }
  });

  it('permits only low-risk, non-business side effects in low-risk execution mode', () => {
    expect(evaluateAgentAction('read_only_lookup', 'execute_low_risk').allowed).toBe(true);
    expect(evaluateAgentAction('prepare_draft', 'execute_low_risk').allowed).toBe(true);
    expect(evaluateAgentAction('create_internal_task', 'execute_low_risk').allowed).toBe(true);
    expect(evaluateAgentAction('read_only_lookup', 'observe').allowed).toBe(false);
  });
});
