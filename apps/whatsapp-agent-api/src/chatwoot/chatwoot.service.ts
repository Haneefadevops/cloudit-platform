import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatwootAccount {
  id: number;
  name: string;
}

export interface ChatwootInbox {
  id: number;
  name: string;
}

export interface ChatwootContact {
  payload: {
    contact: {
      id: number;
      name: string;
      phone_number: string;
    };
    contact_inbox?: {
      source_id: string;
    };
  };
}

export interface ChatwootConversation {
  id: number;
  inbox_id: number;
  status: string;
}

export interface ChatwootMessage {
  id: number;
  content: string;
  message_type: string;
}

export interface ChatwootUser {
  id: number;
  name: string;
  email: string;
}

@Injectable()
export class ChatwootService {
  private readonly logger = new Logger(ChatwootService.name);

  constructor(private readonly configService: ConfigService) {}

  private get baseUrl(): string {
    return this.configService.get<string>(
      'CHATWOOT_PLATFORM_API_URL',
      'http://chatwoot-rails:3000',
    );
  }

  private get platformApiKey(): string {
    return this.configService.get<string>('CHATWOOT_PLATFORM_API_KEY', '');
  }

  private get adminApiKey(): string {
    return this.configService.get<string>('CHATWOOT_ADMIN_API_KEY', '');
  }

  private get adminUserId(): number | undefined {
    const value = this.configService.get<string>('CHATWOOT_ADMIN_USER_ID', '');
    return value ? Number(value) : undefined;
  }

  private headers(apiKey: string) {
    return {
      'api-access-token': apiKey,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    path: string,
    options: RequestInit,
    apiKey: string,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: this.headers(apiKey),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(
        `Chatwoot API error: ${options.method || 'GET'} ${url} -> ${response.status} ${text}`,
      );
      throw new Error(`Chatwoot API error: ${response.status} ${text}`);
    }

    return response.json() as Promise<T>;
  }

  getPlatformApiKey(): string {
    return this.platformApiKey;
  }

  getAdminApiKey(): string {
    return this.adminApiKey;
  }

  async createAccount(name: string): Promise<ChatwootAccount> {
    return this.request<ChatwootAccount>(
      '/platform/api/v1/accounts',
      {
        method: 'POST',
        body: JSON.stringify({ name }),
      },
      this.platformApiKey,
    );
  }

  async addAdminToAccount(accountId: number): Promise<void> {
    const userId = this.adminUserId;
    if (!userId) {
      this.logger.warn('CHATWOOT_ADMIN_USER_ID not set; skipping account user linking');
      return;
    }
    await this.request(
      `/platform/api/v1/accounts/${accountId}/account_users`,
      {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, role: 'administrator' }),
      },
      this.platformApiKey,
    );
  }

  async createInbox(
    accountId: number,
    name: string,
    channelType = 'api',
  ): Promise<ChatwootInbox> {
    const payload = {
      name,
      channel: { type: channelType, webhook_url: '' },
    };
    return this.request<ChatwootInbox>(
      `/api/v1/accounts/${accountId}/inboxes`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      this.adminApiKey,
    );
  }

  async createContact(
    accountId: number,
    phone: string,
    name?: string,
  ): Promise<ChatwootContact> {
    const payload = {
      phone_number: phone,
      name: name || phone,
    };
    return this.request<ChatwootContact>(
      `/api/v1/accounts/${accountId}/contacts`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      this.adminApiKey,
    );
  }

  async createConversation(
    accountId: number,
    inboxId: number,
    contactId: number,
    content?: string,
  ): Promise<ChatwootConversation> {
    const payload: Record<string, unknown> = {
      inbox_id: inboxId,
      contact_id: contactId,
      status: 'open',
    };
    if (content) {
      payload.messages = [
        { content, message_type: 'incoming', private: false },
      ];
    }
    return this.request<ChatwootConversation>(
      `/api/v1/accounts/${accountId}/conversations`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      this.adminApiKey,
    );
  }

  async sendMessage(
    accountId: number,
    conversationId: number,
    content: string,
    messageType: 'incoming' | 'outgoing' = 'incoming',
  ): Promise<ChatwootMessage> {
    return this.request<ChatwootMessage>(
      `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({
          content,
          message_type: messageType,
          private: false,
        }),
      },
      this.adminApiKey,
    );
  }

  async createAgent(
    accountId: number,
    name: string,
    email: string,
    role = 'agent',
  ): Promise<ChatwootUser> {
    return this.request<ChatwootUser>(
      `/api/v1/accounts/${accountId}/agents`,
      {
        method: 'POST',
        body: JSON.stringify({ name, email, role }),
      },
      this.adminApiKey,
    );
  }

  async getAccount(accountId: number): Promise<ChatwootAccount | null> {
    try {
      return await this.request<ChatwootAccount>(
        `/platform/api/v1/accounts/${accountId}`,
        { method: 'GET' },
        this.platformApiKey,
      );
    } catch {
      return null;
    }
  }

  async createLabel(
    accountId: number,
    title: string,
    color = '#2563eb',
    description = '',
  ): Promise<{ id: number; title: string }> {
    return this.request<{ id: number; title: string }>(
      `/api/v1/accounts/${accountId}/labels`,
      {
        method: 'POST',
        body: JSON.stringify({ title, color, description, show_on_sidebar: true }),
      },
      this.adminApiKey,
    );
  }

  async addLabelsToConversation(
    accountId: number,
    conversationId: number,
    labels: string[],
  ): Promise<void> {
    await this.request(
      `/api/v1/accounts/${accountId}/conversations/${conversationId}/labels`,
      {
        method: 'POST',
        body: JSON.stringify({ labels }),
      },
      this.adminApiKey,
    );
  }
}
