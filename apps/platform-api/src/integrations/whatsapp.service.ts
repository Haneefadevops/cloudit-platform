import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendMessage(phone: string, message: string): Promise<void> {
    this.logger.log(
      `[WhatsApp placeholder] sendMessage to ${phone}: ${message}`,
    );
  }

  async sendTemplate(
    phone: string,
    templateId: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    this.logger.log(
      `[WhatsApp placeholder] sendTemplate to ${phone} using template ${templateId}`,
      data,
    );
  }
}
