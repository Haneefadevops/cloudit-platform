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

    const account = await this.chatwootService.createAccount(client.name);
    await this.chatwootService.addAdminToAccount(account.id);
    const inbox = await this.chatwootService.createInbox(
      account.id,
      inboxName || `${client.name} WhatsApp`,
    );

    // Seed default labels for handoff categorization
    for (const label of ['ai-handoff', 'urgent', 'complaint']) {
      try {
        await this.chatwootService.createLabel(account.id, label);
      } catch {
        // Label may already exist; ignore
      }
    }

    await this.clientsService.update(id, {
      chatwootAccountId: account.id,
      chatwootInboxId: inbox.id,
      chatwootApiKey: this.chatwootService.getAdminApiKey(),
    });

    return {
      status: 'ok',
      chatwootAccountId: account.id,
      chatwootInboxId: inbox.id,
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
