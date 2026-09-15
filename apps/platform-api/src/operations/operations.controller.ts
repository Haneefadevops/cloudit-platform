import {
  Controller,
  Body,
  Get,
  Post,
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
 * Internal-only operations endpoints. Metadata routes are read-only; the sole
 * Phase 9 POST only consumes a PDF-retrieval nonce and cannot mutate a report.
 * Never exposed through a public route; callers present the internal token.
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

  @Get('infrastructure')
  @ApiOperation({
    summary: 'Infrastructure health: endpoints and database (read-only)',
  })
  async getInfrastructure() {
    return this.operationsService.getInfrastructure();
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

  @Get('vercel')
  @ApiOperation({
    summary: 'Vercel analytics: traffic, deployments, domains (read-only)',
  })
  async getVercelAnalytics() {
    return this.operationsService.getVercelAnalytics();
  }

  @Get('imagekit')
  @ApiOperation({
    summary: 'ImageKit analytics: quota usage and utilization (read-only)',
  })
  async getImagekitAnalytics() {
    return this.operationsService.getImagekitAnalytics();
  }

  @Get('backups')
  @ApiOperation({
    summary: 'Backup evidence, restore tests and schedule (read-only)',
  })
  async getBackups() {
    return this.operationsService.getBackups();
  }

  @Get('reports')
  @ApiOperation({
    summary: 'Report metadata, findings and history (read-only)',
  })
  async getReports() {
    return this.operationsService.getReports();
  }

  @Post('reports/:reportKey/pdf-claim')
  @ApiOperation({ summary: 'Atomically claim one private PDF relay request' })
  async claimReportPdf(
    @Param('reportKey') reportKey: string,
    @Body()
    body: {
      issuedAt?: unknown;
      expiresAt?: unknown;
      nonce?: unknown;
      correlationId?: unknown;
      disposition?: unknown;
      signature?: unknown;
    },
  ) {
    return this.operationsService.claimReportPdfRetrieval(reportKey, body);
  }
}
