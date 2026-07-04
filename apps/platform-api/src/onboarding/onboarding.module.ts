import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { ModulesModule } from '../modules/modules.module';
import { EventsModule } from '../events/events.module';
import { EmailModule } from '../email/email.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({}),
    ModulesModule,
    EventsModule,
    EmailModule,
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
