import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { IntegrationsController } from './integrations.controller';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [JwtModule.register({}), EventsModule],
  controllers: [WhatsAppController, IntegrationsController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class IntegrationsModule {}
