import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  NotFoundException,
  Param,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { WhatsAppSenderService } from '../whatsapp-sender/whatsapp-sender.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ScopedClientId } from '../common/decorators/scoped-client-id.decorator';
import { AdminGuard } from '../common/guards/admin.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  private readonly logger = new Logger(ConversationsController.name);

  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly senderService: WhatsAppSenderService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  findAll(@Query('status') status: string, @CurrentUser() user: any) {
    if (user.role === 'agent') {
      return this.conversationsService.findAllForAgent(user.userId, status);
    }
    return this.conversationsService.findAll(status);
  }

  /**
   * Support tickets (handed-off conversations) for a client. Staff can query
   * any client; portal users are always scoped to their own.
   */
  @Get('client/:clientId/tickets')
  findTickets(
    @ScopedClientId() clientId: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.conversationsService.findTickets(clientId, { status, search });
  }

  @Get('client/:clientId/tickets/:id')
  async findTicketTranscript(
    @ScopedClientId() clientId: string,
    @Param('id') id: string,
  ) {
    const ticket = await this.conversationsService.findTicketTranscript(
      clientId,
      id,
    );
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.conversationsService.findOne(id);
  }

  @Post(':id/reply')
  async agentReply(
    @Param('id') id: string,
    @Body('content') content: string,
    @CurrentUser() user: any,
  ) {
    const conversation = await this.conversationsService.findOne(id);
    if (!conversation) {
      return { error: 'Conversation not found' };
    }

    // Store agent message
    await this.prisma.message.create({
      data: {
        conversationId: id,
        senderType: 'agent',
        content,
      },
    });

    if (!conversation.customer.phoneNumber) {
      this.logger.warn(`Cannot send WhatsApp message: customer has no phone number`);
      return { status: 'sent' };
    }

    // Send via WhatsApp
    await this.senderService.sendMessage({
      client: {
        metaAccessToken: conversation.client.metaAccessToken,
        whatsappPhoneNumberId: conversation.client.whatsappPhoneNumberId,
      },
      to: conversation.customer.phoneNumber,
      message: content,
    });

    return { status: 'sent' };
  }

  @Put(':id/assign')
  @UseGuards(AdminGuard)
  assignToAgent(
    @Param('id') id: string,
    @Body('assignedToId') assignedToId: string,
  ) {
    return this.conversationsService.assignToAgent(id, assignedToId);
  }

  @Put(':id/resolve')
  resolve(@Param('id') id: string) {
    return this.conversationsService.resolve(id);
  }

  @Post(':id/handoff')
  @UseGuards(AdminGuard)
  handoff(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Body('assignedToId') assignedToId?: string,
  ) {
    return this.conversationsService.handoffToHuman({
      conversationId: id,
      triggeredBy: 'agent',
      reason: reason || 'Manually handed off by agent',
      assignedToId,
    });
  }
}
