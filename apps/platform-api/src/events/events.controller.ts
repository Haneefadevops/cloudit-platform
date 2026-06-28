import { Controller, Post, Body, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EventPublisherService } from './event-publisher.service';
import { InternalAuthGuard } from '../common/guards/internal-auth.guard';
import { EventType } from './event-types';

class PublishEventDto {
  eventType!: EventType;
  payload!: Record<string, unknown>;
}

@ApiTags('events')
@Controller('events')
export class EventsController {
  private readonly logger = new Logger(EventsController.name);

  constructor(private readonly eventPublisher: EventPublisherService) {}

  @Post('internal')
  @UseGuards(InternalAuthGuard)
  @ApiOperation({ summary: 'Receive an event from an internal service' })
  async receiveInternalEvent(@Body() dto: PublishEventDto) {
    await this.eventPublisher.publish(dto.eventType, dto.payload as any);
    return { success: true };
  }
}
