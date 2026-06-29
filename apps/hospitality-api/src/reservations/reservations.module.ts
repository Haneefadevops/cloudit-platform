import { Module } from "@nestjs/common";
import { ReservationsController } from "./reservations.controller";
import { ReservationsService } from "./reservations.service";
import { InvoicesModule } from "../invoices/invoices.module";
import { EventsModule } from "../events/events.module";

@Module({
  imports: [InvoicesModule, EventsModule],
  controllers: [ReservationsController],
  providers: [ReservationsService],
})
export class ReservationsModule {}
