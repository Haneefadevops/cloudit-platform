import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { WorkflowsService } from './workflows.service';

@Controller('workflows')
@UseGuards(JwtAuthGuard, AdminGuard)
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Get(':clientId')
  findAll(@Param('clientId') clientId: string) {
    return this.workflowsService.findAll(clientId);
  }

  @Post(':clientId')
  create(@Param('clientId') clientId: string, @Body() body: CreateWorkflowDto) {
    return this.workflowsService.create(clientId, body);
  }

  @Put(':clientId/:id')
  update(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @Body() body: UpdateWorkflowDto,
  ) {
    return this.workflowsService.update(clientId, id, body);
  }

  @Delete(':clientId/:id')
  remove(@Param('clientId') clientId: string, @Param('id') id: string) {
    return this.workflowsService.remove(clientId, id);
  }
}
