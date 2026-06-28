import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookService } from './webhook.service';
import { EventPublisherService } from './event-publisher.service';

@ApiTags('admin-events')
@Controller('admin/events')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EventsAdminController {
  private readonly logger = new Logger(EventsAdminController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookService: WebhookService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List event logs with pagination and filters' })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('eventType') eventType?: string,
    @Query('status') status?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page || '1', 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (eventType) where.eventType = eventType;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.eventLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      this.prisma.eventLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry a failed or pending webhook' })
  async retry(@Param('id') id: string) {
    const eventLog = await this.prisma.eventLog.findUnique({ where: { id } });
    if (!eventLog) {
      throw new NotFoundException('Event log not found');
    }

    if (eventLog.status === 'success') {
      throw new BadRequestException('Event already delivered successfully');
    }

    const result = await this.webhookService.sendTo(
      eventLog.webhookUrl || this.webhookService.getWebhookUrl(),
      eventLog.payload,
      this.webhookService.getSecret(),
    );

    const updated = await this.prisma.eventLog.update({
      where: { id },
      data: {
        status: result.success ? 'success' : 'failed',
        responseStatus: result.statusCode ?? null,
        errorMessage: result.error ?? null,
      },
    });

    return { success: result.success, eventLog: updated };
  }

  @Post('test-webhook')
  @ApiOperation({ summary: 'Send a test event to the configured n8n webhook' })
  async testWebhook() {
    const payload = {
      userId: 'test',
      email: 'test@example.com',
      timestamp: new Date().toISOString(),
    };
    await this.eventPublisher.publish('user.login', payload);
    return { success: true, message: 'Test event published' };
  }
}
