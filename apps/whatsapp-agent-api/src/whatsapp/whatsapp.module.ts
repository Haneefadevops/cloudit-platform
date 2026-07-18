import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { AiModule } from '../ai/ai.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { CustomersModule } from '../customers/customers.module';
import { ClientsModule } from '../clients/clients.module';
import { WhatsAppSenderModule } from '../whatsapp-sender/whatsapp-sender.module';
import { ChatwootModule } from '../chatwoot/chatwoot.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';

@Module({
  imports: [
    AiModule,
    ConversationsModule,
    CustomersModule,
    ClientsModule,
    WhatsAppSenderModule,
    ChatwootModule,
    KnowledgeBaseModule,
  ],
  controllers: [WhatsAppController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
