import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppSenderModule } from '../whatsapp-sender/whatsapp-sender.module';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeysController } from './api-keys.controller';
import { TransactionalController } from './transactional.controller';
import { TransactionalService } from './transactional.service';

@Module({
  imports: [WhatsAppSenderModule, PrismaModule, ConfigModule],
  controllers: [TransactionalController, ApiKeysController],
  providers: [TransactionalService, ApiKeyGuard],
})
export class TransactionalModule {}
