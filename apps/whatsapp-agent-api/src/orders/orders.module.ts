import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderActionsService } from './order-actions.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppSenderModule } from '../whatsapp-sender/whatsapp-sender.module';

@Module({
  imports: [PrismaModule, WhatsAppSenderModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderActionsService],
  exports: [OrdersService, OrderActionsService],
})
export class OrdersModule {}
