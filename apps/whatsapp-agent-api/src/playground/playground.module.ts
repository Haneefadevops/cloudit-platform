import { Module } from '@nestjs/common';
import { PlaygroundController } from './playground.controller';
import { PlaygroundService } from './playground.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { BookingsModule } from '../bookings/bookings.module';
import { OrdersModule } from '../orders/orders.module';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [PrismaModule, AiModule, KnowledgeBaseModule, BookingsModule, OrdersModule, UsageModule],
  controllers: [PlaygroundController],
  providers: [PlaygroundService],
})
export class PlaygroundModule {}
