// Durable remediation-attempt store — public API (Worker A, Phase H).
// Exported shapes are contractual: Worker B (executor) consumes AttemptStore
// and the record/input types from this barrel; the coordinator wires the
// PgAttemptStore factory in app.module.ts.
export type {
  AttemptResultCode,
  AttemptStatus,
  RemediationAttemptRecord,
  ClaimAttemptInput,
  FinishAttemptStatus,
  FinishAttemptInput,
  AttemptStore,
} from '../attempt-contract';
export { ATTEMPT_STORE, REMEDIATION_ATTEMPT_RESULT_CODES } from '../attempt-contract';
export type { PgAttemptStoreOptions, PgClientLike } from './pg-attempt-store';
export { PgAttemptStore, createPgAttemptStore } from './pg-attempt-store';
