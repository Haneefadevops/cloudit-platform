import { Module, forwardRef } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { ChatwootModule } from '../chatwoot/chatwoot.module';

@Module({
  imports: [forwardRef(() => ChatwootModule)],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
