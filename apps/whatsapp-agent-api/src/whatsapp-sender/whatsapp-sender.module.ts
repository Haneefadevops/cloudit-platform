import { Module } from '@nestjs/common';
import { WhatsAppSenderService } from './whatsapp-sender.service';

@Module({
  providers: [WhatsAppSenderService],
  exports: [WhatsAppSenderService],
})
export class WhatsAppSenderModule {}
