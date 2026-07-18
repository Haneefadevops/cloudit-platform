import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsService } from './clients.service';
import { ChatwootService } from '../chatwoot/chatwoot.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('clients')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ClientsController {
  private readonly logger = new Logger(ClientsController.name);

  constructor(
    private readonly clientsService: ClientsService,
    private readonly chatwootService: ChatwootService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  findAll() {
    return this.clientsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.clientsService.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.clientsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }

  @Post(':id/chatwoot-setup')
  async setupChatwoot(
    @Param('id') id: string,
    @Body('inboxName') inboxName?: string,
  ) {
    const client = await this.clientsService.findOne(id);
    if (!client) {
      return { error: 'Client not found' };
    }

    // 1. Create the Chatwoot account for this client
    const account = await this.chatwootService.createAccount(client.name);

    // 2. Link the platform super admin so we can manage the account
    await this.chatwootService.addAdminToAccount(account.id);

    // 3. Create the WhatsApp/API inbox
    const inbox = await this.chatwootService.createInbox(
      account.id,
      inboxName || `${client.name} WhatsApp`,
    );

    // 4. Configure the Chatwoot webhook so agent replies reach TheReplyte
    const webhookUrl = `${this.configService.get(
      'API_PUBLIC_URL',
      'https://api.thereplyte.com',
    )}/api/webhooks/chatwoot`;
    const webhook = await this.chatwootService.createWebhook(account.id, webhookUrl);

    // 5. Seed default labels for handoff categorization
    for (const label of ['ai-handoff', 'urgent', 'complaint']) {
      try {
        await this.chatwootService.createLabel(account.id, label);
      } catch {
        // Label may already exist; ignore
      }
    }

    // 6. Create the client admin user in Chatwoot and auto-confirm the email
    let chatwootAdminUserId: number | undefined;
    if (client.adminEmail) {
      try {
        const adminUser = await this.chatwootService.createAccountAdmin(
          account.id,
          client.adminEmail,
          client.adminEmail,
          'administrator',
        );
        chatwootAdminUserId = adminUser.id;
        await this.chatwootService.confirmUserByEmail(client.adminEmail);
      } catch (error) {
        this.logger.warn(
          `Failed to create/confirm Chatwoot admin for ${client.adminEmail}: ${(error as Error).message}`,
        );
      }
    }

    await this.clientsService.update(id, {
      chatwootAccountId: account.id,
      chatwootInboxId: inbox.id,
      chatwootApiKey: this.chatwootService.getAdminApiKey(),
      chatwootAdminUserId,
      webhookUrl,
    });

    return {
      status: 'ok',
      chatwootAccountId: account.id,
      chatwootInboxId: inbox.id,
      webhookId: webhook.id,
      webhookUrl,
      chatwootAdminUserId,
    };
  }

  @Post(':id/chatwoot-agents')
  async syncAgents(@Param('id') id: string) {
    const client = await this.clientsService.findOne(id);
    if (!client) {
      return { error: 'Client not found' };
    }
    if (!client.chatwootAccountId) {
      return { error: 'Chatwoot account not set up for this client' };
    }

    const agents = await this.prisma.user.findMany({
      where: { clientId: id, chatwootUserId: null },
    });

    let synced = 0;
    for (const agent of agents) {
      try {
        const chatwootUser = await this.chatwootService.createAgent(
          client.chatwootAccountId,
          agent.name,
          agent.email,
          agent.role === 'admin' ? 'administrator' : 'agent',
        );
        await this.prisma.user.update({
          where: { id: agent.id },
          data: { chatwootUserId: chatwootUser.id },
        });
        synced++;
      } catch (error) {
        this.logger.warn(
          `Failed to sync agent ${agent.email}: ${(error as Error).message}`,
        );
      }
    }

    return { status: 'ok', synced };
  }

  @Get(':id/chatwoot-status')
  async chatwootStatus(@Param('id') id: string) {
    const client = await this.clientsService.findOne(id);
    if (!client) {
      return { error: 'Client not found' };
    }

    if (!client.chatwootAccountId) {
      return { connected: false, accountId: null };
    }

    const account = await this.chatwootService.getAccount(
      client.chatwootAccountId,
    );

    return {
      connected: !!account,
      accountId: client.chatwootAccountId,
      accountName: account?.name,
    };
  }

}
