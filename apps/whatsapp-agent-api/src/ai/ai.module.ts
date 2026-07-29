import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AiService } from './ai.service';
import { AiProvidersController } from './ai-providers.controller';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [AiProvidersController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
