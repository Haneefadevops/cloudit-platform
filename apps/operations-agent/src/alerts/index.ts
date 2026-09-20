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
export {
  TelegramSender,
  TelegramSenderOptions,
  TELEGRAM_TEXT_MAX_CHARS,
  TELEGRAM_TEXT_TRUNCATION_SUFFIX,
  TELEGRAM_DESCRIPTION_MAX_CHARS,
  DEFAULT_TELEGRAM_TIMEOUT_MS,
  createTelegramSender,
} from './telegram-sender';
