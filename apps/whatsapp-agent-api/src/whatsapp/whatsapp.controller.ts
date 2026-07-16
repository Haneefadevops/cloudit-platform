import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Headers,
  BadRequestException,
  Logger,
  RawBody,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppService } from './whatsapp.service';

@Controller('webhooks/whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly whatsappService: WhatsAppService,
  ) {}

  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const verifyToken = this.configService.get<string>('META_VERIFY_TOKEN');

    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }

    throw new BadRequestException('Webhook verification failed');
  }

  @Post()
  async receiveWebhook(
    @Body() payload: unknown,
    @Headers('x-hub-signature-256') signature: string,
    @RawBody() rawBody: Buffer,
  ): Promise<{ status: string }> {
    try {
      // Optional: verify Meta signature for security
      // this.whatsappService.verifySignature(rawBody, signature);
      await this.whatsappService.handleIncomingWebhook(payload);
    } catch (error) {
      this.logger.error('Webhook processing error', error);
      // Still return 200 to Meta to avoid retries for non-delivery issues
    }

    return { status: 'ok' };
  }
}
