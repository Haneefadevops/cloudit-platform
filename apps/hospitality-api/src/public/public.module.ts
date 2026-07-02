import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { InvoicesModule } from "../invoices/invoices.module";
import { PaymentsModule } from "../payments/payments.module";
import { PublicController } from "./public.controller";
import { PublicService } from "./public.service";

@Module({
  imports: [EventsModule, InvoicesModule, PaymentsModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
