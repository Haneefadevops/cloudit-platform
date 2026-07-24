import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AgentsModule } from './agents/agents.module';
import { ClientsModule } from './clients/clients.module';
import { CustomersModule } from './customers/customers.module';
import { ConversationsModule } from './conversations/conversations.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { ChatwootModule } from './chatwoot/chatwoot.module';
import { AiModule } from './ai/ai.module';
import { HealthModule } from './health/health.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { KnowledgeBaseModule } from './knowledge-base/knowledge-base.module';
import { CannedResponsesModule } from './canned-responses/canned-responses.module';
import { PlaygroundModule } from './playground/playground.module';
import { BookingsModule } from './bookings/bookings.module';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AppConfigModule,
    PrismaModule,
    AuthModule,
    AgentsModule,
    ClientsModule,
    CustomersModule,
    ConversationsModule,
    WhatsAppModule,
    ChatwootModule,
    AiModule,
    HealthModule,
    AnalyticsModule,
    KnowledgeBaseModule,
    CannedResponsesModule,
    PlaygroundModule,
    BookingsModule,
    OrdersModule,
  ],
})
export class AppModule {}
