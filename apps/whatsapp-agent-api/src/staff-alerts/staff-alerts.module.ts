import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppSenderModule } from '../whatsapp-sender/whatsapp-sender.module';
import { StaffAlertsService } from './staff-alerts.service';
import { StaffAlertContactsService } from './staff-alert-contacts.service';
import { StaffAlertContactsController } from './staff-alert-contacts.controller';

@Module({
  imports: [PrismaModule, WhatsAppSenderModule],
  controllers: [StaffAlertContactsController],
  providers: [StaffAlertsService, StaffAlertContactsService],
  exports: [StaffAlertsService],
})
export class StaffAlertsModule {}
