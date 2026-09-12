import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OperationsService } from './operations.service';
import { OperationsInternalAuthGuard } from './operations-internal-auth.guard';
import { OperationsExceptionFilter } from './operations-exception.filter';

/**
 * Internal-only read endpoints for the private operations database. Never
 * exposed through a public route; callers must present the internal token.
 */
@ApiTags('operations')
@Controller('operations')
@UseGuards(OperationsInternalAuthGuard)
@UseFilters(OperationsExceptionFilter)
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Per-client operations overview (read-only)' })
  async getOverview() {
    return this.operationsService.getOverview();
  }

  @Get('workflows')
  @ApiOperation({ summary: 'Workflow catalogue with window statistics' })
  async getWorkflows(@Query('window') window?: string) {
    return this.operationsService.getWorkflows(window);
  }

  @Get('workflows/:workflowKey')
  @ApiOperation({ summary: 'Workflow detail with recent executions' })
  async getWorkflow(@Param('workflowKey') workflowKey: string) {
    const detail = await this.operationsService.getWorkflowDetail(workflowKey);
    if (detail === null) {
      throw new NotFoundException('Not found');
    }
    return detail;
  }
}
