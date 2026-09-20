/**
 * AI read-model bindings (Worker B, Phase F).
 *
 * Real adapters that bind the Phase E read-model ports in src/ai/read-model.ts
 * to the actual platform services, so the coordinator can replace the
 * fail-closed defaults wired in AiModule/app.module.ts. Read-only: none of
 * these bindings can mutate budget, kill-switch, findings or drift state.
 */

export { budgetSummaryBinding } from './budget-summary.binding';
export { killSwitchStatesBinding } from './kill-switch-states.binding';
export { findingsBinding } from './findings.binding';
export { driftBinding } from './drift.binding';
