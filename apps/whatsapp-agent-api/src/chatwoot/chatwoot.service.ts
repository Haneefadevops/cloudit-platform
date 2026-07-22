import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

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

export interface ChatwootWebhook {
  id: number;
  url: string;
  subscriptions: string[];
}

@Injectable()
export class ChatwootService implements OnModuleInit {
  private readonly logger = new Logger(ChatwootService.name);

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureInstallationBranding();
  }

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

  private get chatwootDatabaseUrl(): string | undefined {
    return this.configService.get<string>('CHATWOOT_DATABASE_URL');
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
    // Ensure E.164 format: strip whitespace and prepend + if missing
    const normalized = phone.trim().replace(/\s/g, '');
    const e164 = normalized.startsWith('+') ? normalized : `+${normalized}`;

    const payload = {
      phone_number: e164,
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
    history?: Array<{ content: string; senderType: string }>,
  ): Promise<ChatwootConversation> {
    // Create the conversation first
    const conversation = await this.request<ChatwootConversation>(
      `/api/v1/accounts/${accountId}/conversations`,
      {
        method: 'POST',
        body: JSON.stringify({
          inbox_id: inboxId,
          contact_id: contactId,
          status: 'open',
        }),
      },
      this.adminApiKey,
    );

    // Populate history messages one by one — Chatwoot does not always accept
    // the messages array on conversation creation.
    // Mark these as private notes so Chatwoot does not echo them back to WhatsApp.
    if (history && history.length > 0) {
      for (const msg of history) {
        try {
          await this.sendMessage(
            accountId,
            conversation.id,
            `${msg.senderType === 'customer' ? 'Customer' : 'AI'}: ${msg.content}`,
            'outgoing',
            true,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to add history message to Chatwoot conversation ${conversation.id}: ${(error as Error).message}`,
          );
        }
      }
    }

    if (content) {
      await this.sendMessage(
        accountId,
        conversation.id,
        content,
        'outgoing',
        true,
      );
    }

    return conversation;
  }

  async sendMessage(
    accountId: number,
    conversationId: number,
    content: string,
    messageType: 'incoming' | 'outgoing' = 'incoming',
    isPrivate = false,
  ): Promise<ChatwootMessage> {
    return this.request<ChatwootMessage>(
      `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({
          content,
          message_type: messageType,
          private: isPrivate,
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

  async createWebhook(
    accountId: number,
    url: string,
    subscriptions: string[] = [
      'message_created',
      'conversation_status_changed',
      'conversation_updated',
    ],
  ): Promise<ChatwootWebhook> {
    return this.request<ChatwootWebhook>(
      `/api/v1/accounts/${accountId}/webhooks`,
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'TheReplyte WhatsApp Bridge',
          url,
          subscriptions,
        }),
      },
      this.adminApiKey,
    );
  }

  async createAccountAdmin(
    accountId: number,
    email: string,
    name?: string,
    role = 'administrator',
  ): Promise<ChatwootUser> {
    return this.request<ChatwootUser>(
      `/api/v1/accounts/${accountId}/agents`,
      {
        method: 'POST',
        body: JSON.stringify({
          name: name || email,
          email,
          role,
        }),
      },
      this.adminApiKey,
    );
  }

  /**
   * Brand the Chatwoot installation as TheReplyte (name, brand URL, optional logo).
   * Writes directly to Chatwoot's installation_configs table; the setting is
   * instance-wide, so it applies to every client account automatically.
   * Idempotent — runs on every API start and simply re-applies the same values.
   * Note: Chatwoot caches these configs (GlobalConfig); restart chatwoot-rails
   * once after the first apply for the change to become visible.
   */
  async ensureInstallationBranding(): Promise<void> {
    const databaseUrl = this.chatwootDatabaseUrl;
    if (!databaseUrl) {
      this.logger.warn(
        'CHATWOOT_DATABASE_URL not set; skipping Chatwoot installation branding.',
      );
      return;
    }

    const brandName = this.configService.get<string>(
      'CHATWOOT_BRAND_NAME',
      'TheReplyte',
    );
    const brandUrl = this.configService.get<string>(
      'CHATWOOT_BRAND_URL',
      'https://thereplyte.com',
    );
    const logoUrl = this.configService.get<string>(
      'CHATWOOT_BRAND_LOGO_URL',
      '',
    );

    const entries: Array<[string, string]> = [
      ['INSTALLATION_NAME', brandName],
      ['BRAND_NAME', brandName],
      ['BRAND_URL', brandUrl],
    ];
    if (logoUrl) {
      entries.push(['LOGO', logoUrl], ['LOGO_DARK', logoUrl]);
    }

    let pool: Pool | undefined;
    try {
      pool = new Pool({ connectionString: databaseUrl, max: 1 });
      const jsonColumn = await this.installationConfigUsesJson(pool);
      const cast = jsonColumn ? '::jsonb' : '';
      for (const [name, value] of entries) {
        const serialized = jsonColumn
          ? JSON.stringify({ value })
          : this.serializeInstallationConfigValue(value);
        // UPDATE first so this works whether or not a unique index on `name` exists.
        const result = await pool.query(
          `UPDATE installation_configs
           SET serialized_value = $2${cast}, updated_at = NOW()
           WHERE name = $1`,
          [name, serialized],
        );
        if (!result.rowCount) {
          await pool.query(
            `INSERT INTO installation_configs
               (name, serialized_value, locked, created_at, updated_at)
             VALUES ($1, $2${cast}, false, NOW(), NOW())`,
            [name, serialized],
          );
        }
      }
      this.logger.log(
        `Applied Chatwoot installation branding: ${brandName} (${entries.length} keys)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to apply Chatwoot installation branding: ${(error as Error).message}`,
      );
    } finally {
      await pool?.end();
    }
  }

  /**
   * Newer Chatwoot versions store installation_configs.serialized_value as
   * jsonb ({"value": ...}); older versions use YAML text. Detect once per run.
   */
  private async installationConfigUsesJson(pool: Pool): Promise<boolean> {
    const result = await pool.query(
      `SELECT data_type
       FROM information_schema.columns
       WHERE table_name = 'installation_configs'
         AND column_name = 'serialized_value'`,
    );
    const dataType = (result.rows[0]?.data_type as string | undefined) ?? '';
    return dataType === 'json' || dataType === 'jsonb';
  }

  /**
   * YAML fallback for older Chatwoot versions where serialized_value is a text
   * column holding a Ruby-serialized hash ({ value: ... }). A double-quoted
   * scalar is always valid YAML, so this parses identically to what Chatwoot
   * itself writes.
   */
  private serializeInstallationConfigValue(value: string): string {
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `---\n:value: "${escaped}"\n`;
  }

  /**
   * Auto-confirm a Chatwoot user by setting confirmed_at in the Chatwoot database.
   * This bypasses SMTP email verification so client admins can log in immediately.
   */
  async confirmUserByEmail(email: string): Promise<void> {
    const databaseUrl = this.chatwootDatabaseUrl;
    if (!databaseUrl) {
      this.logger.warn(
        'CHATWOOT_DATABASE_URL not set; cannot auto-confirm Chatwoot user. SMTP verification will be required.',
      );
      return;
    }

    let pool: Pool | undefined;
    try {
      pool = new Pool({ connectionString: databaseUrl, max: 1 });
      const result = await pool.query(
        `UPDATE users
         SET confirmed_at = NOW(),
             confirmation_token = NULL,
             unconfirmed_email = NULL,
             updated_at = NOW()
         WHERE email = $1
           AND confirmed_at IS NULL
         RETURNING id`,
        [email],
      );

      if (result.rowCount && result.rowCount > 0) {
        this.logger.log(`Auto-confirmed Chatwoot user ${email}`);
      } else {
        this.logger.warn(
          `Could not auto-confirm Chatwoot user ${email}; user may not exist or already confirmed`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to auto-confirm Chatwoot user ${email}: ${(error as Error).message}`,
      );
    } finally {
      await pool?.end();
    }
  }
}
