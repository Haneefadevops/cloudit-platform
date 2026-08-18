import { Module } from "@nestjs/common";
import { CustomersModule } from "../customers/customers.module";
import { SlugService } from "../common/lib/slug.service";
import { SchedulingController } from "./scheduling.controller";
import { SchedulingService } from "./scheduling.service";

@Module({
  imports: [CustomersModule],
  controllers: [SchedulingController],
  providers: [SchedulingService, SlugService],
  exports: [SchedulingService],
})
export class SchedulingModule {}
