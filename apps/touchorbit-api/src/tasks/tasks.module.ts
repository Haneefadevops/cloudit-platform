import { Module } from "@nestjs/common";
import { TasksController } from "./tasks.controller";
import { TaskReminderService } from "./task-reminder.service";

@Module({
  controllers: [TasksController],
  providers: [TaskReminderService],
  exports: [TaskReminderService],
})
export class TasksModule {}
