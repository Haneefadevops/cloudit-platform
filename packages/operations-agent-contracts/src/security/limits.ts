/**
 * Hard limits enforced fail-closed by the security validators. Every value
 * is deliberately conservative; callers must not raise them without a
 * coordinator-approved spec change.
 */
export const SECURITY_LIMITS = {
  /** Maximum nesting depth of a raw (pre-validation) payload. */
  MAX_EVIDENCE_DEPTH: 24,
  /** Maximum serialized size (JSON string length) of a raw payload. */
  MAX_INPUT_BYTES: 64 * 1024,
  /** Maximum number of evidence items in one batch. */
  MAX_BATCH_ITEMS: 512,
  /** Maximum length of an evidence id / nonce string. */
  MAX_ID_LENGTH: 128,
} as const;
