import { Module } from "@nestjs/common";
import { CalendarEventsController } from "./calendar.controller";
import { CalendarEventsService } from "./calendar.service";

@Module({
  controllers: [CalendarEventsController],
  providers: [CalendarEventsService],
  exports: [CalendarEventsService],
})
export class CalendarEventsModule {}
