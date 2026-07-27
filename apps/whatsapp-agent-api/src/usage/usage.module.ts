import { Module } from '@nestjs/common';
import { UsageController } from './usage.controller';
import { UsageService } from './usage.service';
import { TopUpRequestsService } from './topup-requests.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppSenderModule } from '../whatsapp-sender/whatsapp-sender.module';
import { StaffAlertsModule } from '../staff-alerts/staff-alerts.module';

@Module({
  imports: [PrismaModule, WhatsAppSenderModule, StaffAlertsModule],
  controllers: [UsageController],
  providers: [UsageService, TopUpRequestsService],
  exports: [UsageService],
})
export class UsageModule {}
