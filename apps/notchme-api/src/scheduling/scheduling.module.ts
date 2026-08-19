import { Module } from "@nestjs/common";
import { CustomersModule } from "../customers/customers.module";
import { SlugService } from "../common/lib/slug.service";
import { SchedulingController } from "./scheduling.controller";
import { SchedulingService } from "./scheduling.service";
import { MeetingRecapsService } from "./meeting-recaps.service";
import { MeetingRecapsController } from "./meeting-recaps.controller";

@Module({
  imports: [CustomersModule],
  controllers: [SchedulingController, MeetingRecapsController],
  providers: [SchedulingService, MeetingRecapsService, SlugService],
  exports: [SchedulingService],
})
export class SchedulingModule {}
