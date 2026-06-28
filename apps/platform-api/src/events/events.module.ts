import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventPublisherService } from './event-publisher.service';
import { WebhookService } from './webhook.service';
import { EventsController } from './events.controller';
import { EventsAdminController } from './events-admin.controller';

@Module({
  imports: [
    JwtModule.register({}),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
    }),
  ],
  controllers: [EventsController, EventsAdminController],
  providers: [EventPublisherService, WebhookService],
  exports: [EventPublisherService, WebhookService],
})
export class EventsModule {}
