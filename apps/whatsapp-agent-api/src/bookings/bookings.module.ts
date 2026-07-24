import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { AvailabilityService } from './availability.service';
import { BookingActionsService } from './booking-actions.service';
import { BookingRemindersService } from './booking-reminders.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppSenderModule } from '../whatsapp-sender/whatsapp-sender.module';

@Module({
  imports: [PrismaModule, WhatsAppSenderModule],
  controllers: [BookingsController],
  providers: [
    BookingsService,
    AvailabilityService,
    BookingActionsService,
    BookingRemindersService,
  ],
  exports: [BookingsService, AvailabilityService, BookingActionsService],
})
export class BookingsModule {}
