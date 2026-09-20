// Deterministic Telegram alert engine — public API (Worker A, Phase F).
// Exported shapes are contractual: Worker C writes evals against them blind.
export {
  AlertMessage,
  DigestEntry,
  AlertAction,
  AlertDecision,
  AlertEngineOptions,
  AlertEngine,
} from './alert-engine';
export {
  AlertDispatchAuditEvent,
  AlertAuditResultCode,
  ALERT_AUDIT_SUMMARY_MAX_CHARS,
  buildAlertAuditEvent,
  resultCodeOf,
} from './alert-audit';
export {
  ALERT_TEXT_MAX_CHARS,
  DigestPeriod,
  DigestLineInput,
  renderRedAlert,
  renderRecovery,
  renderDigest,
} from './templates';
