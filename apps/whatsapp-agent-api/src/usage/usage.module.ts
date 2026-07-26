import { Module } from '@nestjs/common';
import { UsageController } from './usage.controller';
import { UsageService } from './usage.service';
import { TopUpRequestsService } from './topup-requests.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppSenderModule } from '../whatsapp-sender/whatsapp-sender.module';

@Module({
  imports: [PrismaModule, WhatsAppSenderModule],
  controllers: [UsageController],
  providers: [UsageService, TopUpRequestsService],
  exports: [UsageService],
})
export class UsageModule {}
