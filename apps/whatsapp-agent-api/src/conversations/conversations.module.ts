import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { WhatsAppSenderModule } from '../whatsapp-sender/whatsapp-sender.module';
import { ChatwootModule } from '../chatwoot/chatwoot.module';

@Module({
  imports: [WhatsAppSenderModule, ChatwootModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
