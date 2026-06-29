import { Controller, Get, Patch, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisherService } from '../events/event-publisher.service';

class UpdateIntegrationSettingsDto {
  n8nWebhookUrl?: string;
  n8nWebhookSecret?: string;
  aiProvider?: string;
  aiApiKey?: string;
  whatsappApiKey?: string;
  whatsappPhoneNumberId?: string;
}

@ApiTags('admin-integrations')
@Controller('admin/integrations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class IntegrationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get current integration settings' })
  async getSettings() {
    let settings = await this.prisma.integrationSetting.findFirst();
    if (!settings) {
      settings = await this.prisma.integrationSetting.create({
        data: {
          n8nWebhookUrl: null,
          n8nWebhookSecret: null,
          aiProvider: 'none',
          aiApiKey: null,
          whatsappApiKey: null,
          whatsappPhoneNumberId: null,
        },
      });
    }
    return settings;
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update integration settings' })
  async updateSettings(@Body() dto: UpdateIntegrationSettingsDto) {
    const existing = await this.prisma.integrationSetting.findFirst();
    const id = existing?.id;

    const data: Record<string, unknown> = {};
    if (dto.n8nWebhookUrl !== undefined)
      data.n8nWebhookUrl = dto.n8nWebhookUrl || null;
    if (dto.n8nWebhookSecret !== undefined)
      data.n8nWebhookSecret = dto.n8nWebhookSecret || null;
    if (dto.aiProvider !== undefined) data.aiProvider = dto.aiProvider;
    if (dto.aiApiKey !== undefined) data.aiApiKey = dto.aiApiKey || null;
    if (dto.whatsappApiKey !== undefined)
      data.whatsappApiKey = dto.whatsappApiKey || null;
    if (dto.whatsappPhoneNumberId !== undefined)
      data.whatsappPhoneNumberId = dto.whatsappPhoneNumberId || null;

    if (id) {
      return this.prisma.integrationSetting.update({ where: { id }, data });
    }

    return this.prisma.integrationSetting.create({ data });
  }

  @Post('test-webhook')
  @ApiOperation({ summary: 'Send a test event to the configured n8n webhook' })
  async testWebhook() {
    const settings = await this.getSettings();

    if (!settings.n8nWebhookUrl) {
      return { success: false, message: 'n8n webhook URL not configured' };
    }

    await this.eventPublisher.publish('user.login', {
      userId: 'test',
      email: 'test@example.com',
      timestamp: new Date().toISOString(),
    });

    return { success: true, message: 'Test event published' };
  }
}
