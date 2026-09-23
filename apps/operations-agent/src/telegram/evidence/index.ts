// Coordinator-owned chat-phase integration: the real read-only evidence
// binding for the Telegram command layer (observer status + platform
// budget) and the startup registry that publishes the live soak driver to
// it. Synthetic fixtures stay the standalone default inside the commands
// module; this binding replaces them only in AppModule composition.
export * from './observer-status.registry';
export * from './observer-evidence.adapter';
