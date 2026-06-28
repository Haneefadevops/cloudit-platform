import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventPublisherService } from './event-publisher.service';
import { WebhookService } from './webhook.service';
import { EventsController } from './events.controller';

@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
    }),
  ],
  controllers: [EventsController],
  providers: [EventPublisherService, WebhookService],
  exports: [EventPublisherService, WebhookService],
})
export class EventsModule {}
