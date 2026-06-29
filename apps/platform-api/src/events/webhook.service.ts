import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import * as crypto from 'crypto';

export interface WebhookResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  attempts: number;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly configService: ConfigService) {}

  getWebhookUrl(): string | undefined {
    return this.configService.get<string>('N8N_WEBHOOK_URL');
  }

  getSecret(): string | undefined {
    return this.configService.get<string>('N8N_WEBHOOK_SECRET');
  }

  isConfigured(): boolean {
    return !!this.getWebhookUrl();
  }

  signPayload(payload: unknown, secret: string): string {
    const body =
      typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  verifySignature(
    payload: unknown,
    signature: string,
    secret: string,
  ): boolean {
    const expected = this.signPayload(payload, secret);
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(signature, 'hex'),
      );
    } catch {
      return false;
    }
  }

  async send(payload: unknown): Promise<WebhookResult> {
    return this.sendTo(this.getWebhookUrl(), payload, this.getSecret());
  }

  async sendTo(
    url: string | undefined,
    payload: unknown,
    secret?: string,
  ): Promise<WebhookResult> {
    if (!url) {
      return {
        success: false,
        error: 'Webhook URL not configured',
        attempts: 0,
      };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-CloudIT-Event': 'true',
    };

    if (secret) {
      headers['X-CloudIT-Signature'] = this.signPayload(payload, secret);
    }

    const maxAttempts = 3;
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await axios.post(url, payload, {
          headers,
          timeout: 10000,
        });
        this.logger.log(
          `Webhook delivered to ${url} (status ${response.status})`,
        );
        return {
          success: true,
          statusCode: response.status,
          attempts: attempt,
        };
      } catch (error) {
        const axiosError = error as AxiosError;
        lastError = axiosError.message;
        this.logger.warn(
          `Webhook attempt ${attempt}/${maxAttempts} failed: ${lastError}`,
        );
        if (attempt < maxAttempts) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          await this.delay(backoffMs);
        }
      }
    }

    return { success: false, error: lastError, attempts: maxAttempts };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
