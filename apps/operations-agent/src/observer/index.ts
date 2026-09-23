// Soak driver — public API. Read-only observation: bounded SELECT-only
// evidence reads feeding the deterministic supervisor and the alert engine.
// Exported shapes are contractual: evals under test/observer-evals are
// written against them blind.
export {
  EvidenceSourceOptions,
  PgClientLike,
  EvidenceSource,
  createEvidenceSource,
} from './evidence-source';
export {
  SoakDriverOptions,
  TickOutcome,
  ObserverAuditEvent,
  ObserverStatusSnapshot,
  SoakDriver,
} from './soak-driver';
