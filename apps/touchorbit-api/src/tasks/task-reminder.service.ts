import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class TaskReminderService {
  private readonly logger = new Logger(TaskReminderService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  async dispatch(
    limit: number,
  ): Promise<{ dispatched: number; limit: number }> {
    const result = await this.databaseService.query<{ dispatched: number }>(
      `SELECT create_due_task_reminder_notifications($1) AS dispatched`,
      [limit],
    );
    const dispatched = Number(result.rows[0]?.dispatched ?? 0);
    this.logger.log(`Dispatched ${dispatched} task reminder(s)`);
    return { dispatched, limit };
  }

  validateSecret(secret?: string): void {
    const expected = this.configService.get<string>(
      "TASK_REMINDERS_CRON_SECRET",
    );
    if (expected && secret !== expected) {
      throw new UnauthorizedException("Invalid cron secret");
    }
  }
}
