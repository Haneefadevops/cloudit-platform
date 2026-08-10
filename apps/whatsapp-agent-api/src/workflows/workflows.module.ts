import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { WorkflowRuntimeService } from './workflow-runtime.service';

@Module({
  imports: [PrismaModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService, WorkflowRuntimeService],
  exports: [WorkflowsService, WorkflowRuntimeService],
})
export class WorkflowsModule {}
