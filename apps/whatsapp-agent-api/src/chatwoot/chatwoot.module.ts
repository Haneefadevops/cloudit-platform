import { Module, forwardRef } from '@nestjs/common';
import { ChatwootService } from './chatwoot.service';
import { ChatwootController } from './chatwoot.controller';
import { WhatsAppSenderModule } from '../whatsapp-sender/whatsapp-sender.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    WhatsAppSenderModule,
    PrismaModule,
    forwardRef(() => WhatsAppModule),
  ],
  controllers: [ChatwootController],
  providers: [ChatwootService],
  exports: [ChatwootService],
})
export class ChatwootModule {}
