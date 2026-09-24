// Telegram command layer (Worker B, Phase D). Read-only, deterministic,
// offline: fixed templates rendered from a ReadOnlyEvidencePort, sanitized
// before reply. No network, no mutation.
export * from './chat-responder';
export * from './evidence-views';
export * from './tokens';
export * from './in-memory-evidence';
export * from './telegram-command.service';
export * from './telegram-commands.module';
