import { LoggerService, LogLevel } from "@nestjs/common";

export class JsonLogger implements LoggerService {
  private logLevelPriority: Record<string, number> = {
    debug: 0,
    verbose: 1,
    log: 2,
    warn: 3,
    error: 4,
  };

  constructor(private readonly minLevel: LogLevel = "log") {}

  private shouldLog(level: LogLevel): boolean {
    return this.logLevelPriority[level] >= this.logLevelPriority[this.minLevel];
  }

  private write(
    level: LogLevel,
    message: unknown,
    ...optionalParams: unknown[]
  ) {
    if (!this.shouldLog(level)) return;

    const logEntry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (optionalParams.length > 0) {
      const context = optionalParams.find((p) => typeof p === "string");
      if (context) logEntry.context = context;

      const stack = optionalParams.find((p) => typeof p === "object");
      if (stack) logEntry.details = stack;
    }

    const output = JSON.stringify(logEntry);
    if (level === "error") {
      console.error(output);
    } else if (level === "warn") {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  log(message: unknown, ...optionalParams: unknown[]) {
    this.write("log", message, ...optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]) {
    this.write("error", message, ...optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]) {
    this.write("warn", message, ...optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]) {
    this.write("debug", message, ...optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]) {
    this.write("verbose", message, ...optionalParams);
  }
}
