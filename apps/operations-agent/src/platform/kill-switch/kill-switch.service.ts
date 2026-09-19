/**
 * Kill switches (operator-plan section 11.4).
 *
 * Gates every capability behind the coordinator-owned AgentConfigService
 * switches. All switches default to disabled (fail closed). The 'repair'
 * capability additionally requires BOTH the emergency repair-master switch
 * and the automatic-remediation switch, so no single flag can enable repair.
 *
 * Denials are typed results with fixed, safe messages - never raw config
 * values beyond the capability/reason code, and never stack traces.
 */

import { Injectable } from '@nestjs/common';
import { AgentConfigService } from '../../config/agent-config.service';

export type Capability = 'ai' | 'telegram' | 'auto-remediation' | 'repair';

export type KillSwitchDenialReason =
  | 'AI_DISABLED'
  | 'TELEGRAM_COMMANDS_DISABLED'
  | 'AUTO_REMEDIATION_DISABLED'
  | 'REPAIR_MASTER_DISABLED';

export type GateDecision =
  | { readonly allowed: true; readonly capability: Capability }
  | {
      readonly allowed: false;
      readonly capability: Capability;
      readonly reason: KillSwitchDenialReason;
      /** Fixed safe message; contains no config internals or stack trace. */
      readonly message: string;
    };

export const CAPABILITIES: readonly Capability[] = ['ai', 'telegram', 'auto-remediation', 'repair'];

/** Typed error for callers that prefer exceptions over decision objects. */
export class KillSwitchDeniedError extends Error {
  readonly code = 'KILL_SWITCH_DENIED' as const;
  readonly capability: Capability;
  readonly reason: KillSwitchDenialReason;

  constructor(decision: Extract<GateDecision, { allowed: false }>) {
    super(decision.message);
    this.name = 'KillSwitchDeniedError';
    this.capability = decision.capability;
    this.reason = decision.reason;
    Object.freeze(this);
  }
}

@Injectable()
export class KillSwitchService {
  constructor(private readonly config: AgentConfigService) {}

  /**
   * Evaluates the full switch chain for a capability. Default (all switches
   * off) denies everything.
   */
  check(capability: Capability): GateDecision {
    const c = this.config.get();
    let denied: KillSwitchDenialReason | null = null;
    switch (capability) {
      case 'ai':
        if (!c.aiEnabled) denied = 'AI_DISABLED';
        break;
      case 'telegram':
        if (!c.telegramCommandsEnabled) denied = 'TELEGRAM_COMMANDS_DISABLED';
        break;
      case 'auto-remediation':
        if (!c.autoRemediationEnabled) denied = 'AUTO_REMEDIATION_DISABLED';
        break;
      case 'repair':
        // Repair requires BOTH switches: the emergency repair-master switch
        // AND automatic remediation. Either off denies repair.
        if (!c.repairMasterEnabled) denied = 'REPAIR_MASTER_DISABLED';
        else if (!c.autoRemediationEnabled) denied = 'AUTO_REMEDIATION_DISABLED';
        break;
    }
    if (denied === null) {
      return { allowed: true, capability };
    }
    return {
      allowed: false,
      capability,
      reason: denied,
      message: `capability "${capability}" is disabled by kill switch (${denied})`,
    };
  }

  /** Convenience gate that throws a typed, safe denial error when disabled. */
  assertCanRun(capability: Capability): void {
    const decision = this.check(capability);
    if (!decision.allowed) {
      throw new KillSwitchDeniedError(decision);
    }
  }
}
