import { Module } from '@nestjs/common';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { OperationsDataService } from './operations-data.service';

@Module({
  controllers: [OperationsController],
  providers: [OperationsService, OperationsDataService],
})
export class OperationsModule {}
