import { Module } from "@nestjs/common";
import { PublicBookingController } from "./public-booking.controller";
import { SchedulingModule } from "../scheduling/scheduling.module";
import { AnalyticsModule } from "../analytics/analytics.module";

@Module({
  imports: [SchedulingModule, AnalyticsModule],
  controllers: [PublicBookingController],
})
export class PublicBookingModule {}
