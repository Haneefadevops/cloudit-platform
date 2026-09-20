/**
 * Real binding for the read model's kill-switch port (operator-plan 11.4).
 *
 * Evaluates the live KillSwitchService gate chain for each of the four
 * capabilities the portal may display. The 'repair' capability already
 * requires BOTH the repair-master and auto-remediation switches inside the
 * service, so the boolean surfaced here reflects the enforced gate, not raw
 * config flags. Read-only: nothing can be toggled through this binding.
 */

import type { AiMaintenanceReadModelOptions } from '../ai/read-model';
import { KillSwitchService } from '../platform/kill-switch/kill-switch.service';

export function killSwitchStatesBinding(
  killSwitches: KillSwitchService,
): AiMaintenanceReadModelOptions['killSwitches'] {
  return {
    states: () => ({
      aiEnabled: killSwitches.check('ai').allowed,
      telegramCommandsEnabled: killSwitches.check('telegram').allowed,
      autoRemediationEnabled: killSwitches.check('auto-remediation').allowed,
      repairMasterEnabled: killSwitches.check('repair').allowed,
    }),
  };
}
