import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsAppSenderService {
  private readonly logger = new Logger(WhatsAppSenderService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendMessage(input: {
    client: { metaAccessToken: string; whatsappPhoneNumberId: string };
    to: string;
    message: string;
  }): Promise<void> {
    const { client, to, message } = input;
    const baseUrl = this.configService.get<string>(
      'META_API_BASE_URL',
      'https://graph.facebook.com/v18.0',
    );
    const url = `${baseUrl}/${client.whatsappPhoneNumberId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${client.metaAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: message },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        `Failed to send WhatsApp message: ${response.status} ${errorText}`,
      );
      throw new Error(`WhatsApp send failed: ${response.status}`);
    }

    this.logger.log(`WhatsApp message sent to ${to}`);
  }
}
