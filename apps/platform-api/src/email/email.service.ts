import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface InviteEmailInput {
  to: string;
  firstName: string;
  organizationName: string;
  productLabel: string;
  setPasswordUrl: string;
}

export interface WelcomeEmailInput {
  to: string;
  firstName: string;
  organizationName: string;
  productLabel: string;
  loginUrl?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendInvite(input: InviteEmailInput): Promise<void> {
    await this.send({
      to: input.to,
      subject: `Set up your ${input.productLabel} account`,
      template: 'client-onboarding-invite',
      data: {
        ...input,
        previewText: `Set your password for ${input.organizationName}.`,
      },
    });
  }

  async sendWelcome(input: WelcomeEmailInput): Promise<void> {
    await this.send({
      to: input.to,
      subject: `Welcome to ${input.productLabel}`,
      template: 'client-onboarding-welcome',
      data: {
        ...input,
        previewText: `${input.organizationName} is active on ${input.productLabel}.`,
      },
    });
  }

  private async send(payload: {
    to: string;
    subject: string;
    template: string;
    data: Record<string, unknown>;
  }): Promise<void> {
    const webhookUrl = this.configService.get<string>('EMAIL_WEBHOOK_URL');
    const apiKey = this.configService.get<string>('EMAIL_WEBHOOK_API_KEY');

    if (!webhookUrl) {
      this.logger.log(
        `[EMAIL:${payload.template}] ${payload.subject} -> ${payload.to}`,
      );
      this.logger.debug(JSON.stringify(payload.data));
      return;
    }

    await axios.post(webhookUrl, payload, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      timeout: 10000,
    });
  }
}
