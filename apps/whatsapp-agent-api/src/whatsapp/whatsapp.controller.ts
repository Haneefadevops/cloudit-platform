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
import { PrismaService } from '../prisma/prisma.service';

@Controller('webhooks/whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly whatsappService: WhatsAppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): Promise<string> {
    const globalVerifyToken = this.configService.get<string>('META_VERIFY_TOKEN');

    let valid = false;
    if (globalVerifyToken && token === globalVerifyToken) {
      valid = true;
    } else {
      // Support per-client verify tokens stored on the Client record
      const client = await this.prisma.client.findFirst({
        where: { verifyToken: token },
      });
      valid = !!client;
    }

    if (mode === 'subscribe' && valid) {
      return challenge;
    }

    throw new BadRequestException('Webhook verification failed');
  }

  @Post()
  async receiveWebhook(
    @Body() payload: any,
    @Headers('x-hub-signature-256') signature: string,
    @RawBody() rawBody: Buffer,
  ): Promise<{ status: string }> {
    try {
      // Optional: verify Meta signature for security
      // this.whatsappService.verifySignature(rawBody, signature);
      await this.whatsappService.handleIncomingWebhook(payload);

      // Track the most recent webhook timestamp per phone number ID for status indicators
      const phoneNumberId = payload?.entry?.[0]?.changes?.[0]?.value?.metadata
        ?.phone_number_id as string | undefined;
      if (phoneNumberId) {
        await this.prisma.client.updateMany({
          where: { whatsappPhoneNumberId: phoneNumberId },
          data: {
            metaWebhookStatus: 'active',
            lastWebhookAt: new Date(),
          },
        });
      }
    } catch (error) {
      this.logger.error('Webhook processing error', error);
      // Still return 200 to Meta to avoid retries for non-delivery issues
    }

    return { status: 'ok' };
  }
}
