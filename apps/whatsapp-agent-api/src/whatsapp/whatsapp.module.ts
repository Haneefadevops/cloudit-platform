import { Module, forwardRef } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { MediaService } from './media.service';
import { AiModule } from '../ai/ai.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { CustomersModule } from '../customers/customers.module';
import { ClientsModule } from '../clients/clients.module';
import { WhatsAppSenderModule } from '../whatsapp-sender/whatsapp-sender.module';
import { ChatwootModule } from '../chatwoot/chatwoot.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { BookingsModule } from '../bookings/bookings.module';
import { OrdersModule } from '../orders/orders.module';
import { UsageModule } from '../usage/usage.module';
import { StaffAlertsModule } from '../staff-alerts/staff-alerts.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { SocialCommentsModule } from '../social-comments/social-comments.module';

@Module({
  imports: [
    AiModule,
    forwardRef(() => ConversationsModule),
    CustomersModule,
    ClientsModule,
    WhatsAppSenderModule,
    forwardRef(() => ChatwootModule),
    KnowledgeBaseModule,
    BookingsModule,
    OrdersModule,
    UsageModule,
    StaffAlertsModule,
    WorkflowsModule,
    SocialCommentsModule,
  ],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, MediaService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
