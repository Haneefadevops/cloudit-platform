// Outbound Telegram polling (chat phase). The poller consumes Worker B's
// TelegramBotApiClient and reuses the existing fail-closed webhook pipeline.
export * from './telegram-polling.service';
export * from './telegram-polling.module';
