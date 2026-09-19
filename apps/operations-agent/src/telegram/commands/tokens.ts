/**
 * DI tokens for the Telegram command layer.
 *
 * TELEGRAM_COMMAND_HANDLER is owned by the webhook module so the webhook's
 * injection token and the commands module's provider are guaranteed to be the
 * same identity (coordinator integration alignment).
 */
export { TELEGRAM_COMMAND_HANDLER } from '../webhook/telegram-webhook.module';
export const TELEGRAM_EVIDENCE_PORT = 'TELEGRAM_EVIDENCE_PORT';
