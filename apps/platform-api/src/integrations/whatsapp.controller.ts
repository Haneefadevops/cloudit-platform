import { Controller, Get, Post, Body, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { WhatsAppService } from './whatsapp.service';
import { SendMessageDto, SendTemplateDto } from './dto/send-message.dto';

@ApiTags('whatsapp')
@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private readonly whatsappService: WhatsAppService,
    private readonly configService: ConfigService,
  ) {}

  @Get('webhook')
  @ApiOperation({ summary: 'Verify WhatsApp webhook subscription (Meta)' })
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const expectedToken = this.configService.get<string>(
      'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
    );

    if (mode === 'subscribe' && token && token === expectedToken) {
      this.logger.log('WhatsApp webhook verified');
      return challenge;
    }

    this.logger.warn('WhatsApp webhook verification failed');
    return { error: 'Verification failed' };
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Receive WhatsApp webhook events (Meta)' })
  receiveWebhook(@Body() payload: unknown) {
    this.logger.log('Received WhatsApp webhook payload:', payload);
    return { received: true };
  }

  @Post('send-message')
  @ApiOperation({ summary: 'Send a WhatsApp message (placeholder)' })
  async sendMessage(@Body() dto: SendMessageDto) {
    await this.whatsappService.sendMessage(dto.phone, dto.message);
    return { success: true };
  }

  @Post('send-template')
  @ApiOperation({ summary: 'Send a WhatsApp template (placeholder)' })
  async sendTemplate(@Body() dto: SendTemplateDto) {
    await this.whatsappService.sendTemplate(
      dto.phone,
      dto.templateId,
      dto.data,
    );
    return { success: true };
  }
}
