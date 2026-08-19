import { Module } from "@nestjs/common";
import { CustomersModule } from "../customers/customers.module";
import { SlugService } from "../common/lib/slug.service";
import { SchedulingController } from "./scheduling.controller";
import { SchedulingService } from "./scheduling.service";
import { MeetingRecapsService } from "./meeting-recaps.service";
import { MeetingRecapsController } from "./meeting-recaps.controller";
import { MeetingRecapAiProvider } from "./meeting-recap-ai.provider";
import { MeetingRecapAiService } from "./meeting-recap-ai.service";

@Module({
  imports: [CustomersModule],
  controllers: [SchedulingController, MeetingRecapsController],
  providers: [
    SchedulingService,
    MeetingRecapsService,
    MeetingRecapAiProvider,
    MeetingRecapAiService,
    SlugService,
  ],
  exports: [SchedulingService],
})
export class SchedulingModule {}
