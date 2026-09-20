/**
 * Real binding for the read model's budget port (operator-plan section 8.3).
 *
 * Maps the platform BudgetService usage ledger onto the sanitized budget
 * summary the portal may render. The binding is read-only: it never records
 * usage and never mutates budget state. `aiEnabled`, `dayCallsMax` and
 * `monthEurCeiling` come from the coordinator-owned AgentConfigService so the
 * portal always shows the enforced limits, not estimates.
 */

import type { AiMaintenanceReadModelOptions } from '../ai/read-model';
import { AgentConfigService } from '../config/agent-config.service';
import { BudgetService } from '../platform/budget/budget.service';

export function budgetSummaryBinding(
  budget: BudgetService,
  config: AgentConfigService,
): AiMaintenanceReadModelOptions['budget'] {
  return {
    summary: () => {
      const c = config.get();
      const month = budget.getMonthSummary();
      return {
        aiEnabled: c.aiEnabled,
        dayCallsUsed: budget.getDaySummary().calls,
        dayCallsMax: c.aiDailyCallMax,
        monthEurUsed: month.estimatedEur.toFixed(6),
        monthEurCeiling: c.aiMonthlyEurCeiling,
      };
    },
  };
}
