import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { EventsController } from "./events.controller";
import { EventPublisherService } from "./event-publisher.service";
import { WebhookService } from "./webhook.service";

@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: ".",
    }),
  ],
  controllers: [EventsController],
  providers: [EventPublisherService, WebhookService],
  exports: [EventPublisherService, WebhookService],
})
export class EventsModule {}
