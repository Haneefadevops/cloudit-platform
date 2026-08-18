import { Module, forwardRef } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { WhatsAppSenderModule } from '../whatsapp-sender/whatsapp-sender.module';
import { ChatwootModule } from '../chatwoot/chatwoot.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    WhatsAppSenderModule,
    forwardRef(() => ChatwootModule),
    AiModule,
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
