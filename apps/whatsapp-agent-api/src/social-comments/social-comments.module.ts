import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { SocialCommentsController } from './social-comments.controller';
import { SocialCommentsService } from './social-comments.service';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [SocialCommentsController],
  providers: [SocialCommentsService],
  exports: [SocialCommentsService],
})
export class SocialCommentsModule {}
