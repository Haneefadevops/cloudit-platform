import { Module } from "@nestjs/common";
import { CalendarEventsController, HolidaysController } from "./calendar.controller";
import { CalendarEventsService } from "./calendar.service";

@Module({
  controllers: [CalendarEventsController, HolidaysController],
  providers: [CalendarEventsService],
  exports: [CalendarEventsService],
})
export class CalendarEventsModule {}
