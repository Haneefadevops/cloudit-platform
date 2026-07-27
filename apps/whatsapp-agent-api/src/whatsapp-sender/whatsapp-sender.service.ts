import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Template kinds matching the utility templates created in Meta WhatsApp
 * Manager (see docs/THEREPLYTE_GO_LIVE_REVIEW.md, FLAW 2). The default names
 * match the template names in Meta; each can be overridden per environment
 * via the TEMPLATE_* env vars.
 */
export type WhatsAppTemplateKind =
  | 'booking_reminder'
  | 'order_update'
  | 'booking_confirmed'
  | 'general_followup';

const TEMPLATE_ENV_KEYS: Record<WhatsAppTemplateKind, string> = {
  booking_reminder: 'TEMPLATE_BOOKING_REMINDER',
  order_update: 'TEMPLATE_ORDER_UPDATE',
  booking_confirmed: 'TEMPLATE_BOOKING_CONFIRMED',
  general_followup: 'TEMPLATE_GENERAL_FOLLOWUP',
};

/** Meta error code: message rejected because the 24h customer window closed. */
export const META_WINDOW_CLOSED_CODE = 131047;

/** Send failure that carries Meta's error code when one was returned. */
export class WhatsAppSendError extends Error {
  constructor(
    message: string,
    readonly metaCode?: number,
  ) {
    super(message);
    this.name = 'WhatsAppSendError';
  }
}

interface SenderClient {
  metaAccessToken: string;
  whatsappPhoneNumberId: string;
}

@Injectable()
export class WhatsAppSenderService {
  private readonly logger = new Logger(WhatsAppSenderService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendMessage(input: {
    client: SenderClient;
    to: string;
    message: string;
  }): Promise<void> {
    const { client, to, message } = input;

    await this.post(client, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: message },
    });

    this.logger.log(`WhatsApp message sent to ${to}`);
  }

  /**
   * Shows the "typing…" indicator on the customer's phone while the AI
   * prepares its reply. Meta ties it to the incoming message id; the
   * indicator lasts up to 25 seconds or until our reply is sent. It also
   * marks the customer's message as read (blue ticks).
   *
   * Fire-and-forget: a failure (e.g. unsupported API version or expired
   * message id) is logged and swallowed so it never breaks the reply flow.
   */
  async sendTypingIndicator(input: {
    client: SenderClient;
    messageId: string;
  }): Promise<void> {
    const { client, messageId } = input;

    try {
      await this.post(client, {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
        typing_indicator: { type: 'text' },
      });
    } catch (error) {
      this.logger.warn(
        `Typing indicator failed (non-fatal): ${(error as Error).message}`,
      );
    }
  }

  /**
   * Sends a pre-approved Meta template message (type "template"). Used for
   * business-initiated messages outside the 24h customer service window,
   * where free-form messages are rejected by Meta.
   */
  async sendTemplate(input: {
    client: SenderClient;
    to: string;
    templateName: string;
    parameters?: string[];
    languageCode?: string;
  }): Promise<void> {
    const { client, to, templateName, parameters = [], languageCode = 'en' } =
      input;

    await this.post(client, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: [
          {
            type: 'body',
            parameters: parameters.map((text) => ({ type: 'text', text })),
          },
        ],
      },
    });

    this.logger.log(`WhatsApp template "${templateName}" sent to ${to}`);
  }

  /**
   * Free-form first, template as fallback: tries a session message (cheaper
   * service conversation); when Meta rejects it because the 24h window has
   * closed (error 131047), falls back to the configured utility template.
   * Other failures are rethrown without falling back.
   */
  async sendWithTemplateFallback(input: {
    client: SenderClient;
    to: string;
    message: string;
    template: { kind: WhatsAppTemplateKind; parameters: string[] };
    languageCode?: string;
  }): Promise<void> {
    const { client, to, message, template, languageCode } = input;

    try {
      await this.sendMessage({ client, to, message });
      return;
    } catch (error) {
      if (
        !(error instanceof WhatsAppSendError) ||
        error.metaCode !== META_WINDOW_CLOSED_CODE
      ) {
        throw error;
      }
    }

    const templateName = this.resolveTemplateName(template.kind);
    this.logger.log(
      `24h window closed for ${to}; falling back to template "${templateName}"`,
    );
    await this.sendTemplate({
      client,
      to,
      templateName,
      parameters: template.parameters,
      languageCode,
    });
  }

  /** Template name for a kind: env override, else the default Meta name. */
  resolveTemplateName(kind: WhatsAppTemplateKind): string {
    return (
      this.configService.get<string>(TEMPLATE_ENV_KEYS[kind]) || kind
    );
  }

  private async post(
    client: SenderClient,
    body: Record<string, unknown>,
  ): Promise<void> {
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
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        `Failed to send WhatsApp message: ${response.status} ${errorText}`,
      );
      throw new WhatsAppSendError(
        `WhatsApp send failed: ${response.status}`,
        parseMetaErrorCode(errorText),
      );
    }
  }
}

/** Extracts `error.code` from a Meta Graph API error body, when present. */
function parseMetaErrorCode(errorText: string): number | undefined {
  try {
    const parsed = JSON.parse(errorText) as { error?: { code?: unknown } };
    return typeof parsed.error?.code === 'number'
      ? parsed.error.code
      : undefined;
  } catch {
    return undefined;
  }
}
