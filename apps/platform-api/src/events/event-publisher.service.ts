import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookService } from './webhook.service';
import { EventType } from './event-types';
import { EventPayload } from './event-payloads';

@Injectable()
export class EventPublisherService {
  private readonly logger = new Logger(EventPublisherService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
    private readonly webhookService: WebhookService,
  ) {}

  async publish<T extends EventPayload>(
    eventType: EventType,
    payload: T,
  ): Promise<void> {
    const wrappedPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload,
    };

    this.logger.log(`Emitting event: ${eventType}`);
    this.eventEmitter.emit(eventType, wrappedPayload);

    const settings = await this.getIntegrationSettings();
    const webhookUrl =
      settings?.n8nWebhookUrl || this.webhookService.getWebhookUrl();
    const webhookSecret =
      settings?.n8nWebhookSecret || this.webhookService.getSecret();

    const eventLog = await this.prisma.eventLog.create({
      data: {
        eventType,
        payload: wrappedPayload as any,
        status: 'pending',
        webhookUrl,
      },
    });

    if (!webhookUrl) {
      this.logger.log(
        `No webhook configured for event ${eventType}; skipping remote delivery`,
      );
      await this.prisma.eventLog.update({
        where: { id: eventLog.id },
        data: { status: 'success' },
      });
      return;
    }

    const result = await this.webhookService.sendTo(
      webhookUrl,
      wrappedPayload,
      webhookSecret,
    );

    await this.prisma.eventLog.update({
      where: { id: eventLog.id },
      data: {
        status: result.success ? 'success' : 'failed',
        responseStatus: result.statusCode,
        errorMessage: result.error,
      },
    });

    if (!result.success) {
      this.logger.error(
        `Failed to deliver event ${eventType} after ${result.attempts} attempts`,
      );
    }
  }

  private async getIntegrationSettings() {
    return this.prisma.integrationSetting.findFirst();
  }
}
