import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentOrganization } from '../common/decorators/current-organization.decorator';

@ApiTags('invoices')
@Controller('invoices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'List invoices' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findAll(
    @CurrentOrganization() organizationId: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.invoicesService.findAll(
      organizationId,
      Number(page) || 1,
      Number(limit) || 20,
      status,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by ID' })
  async findOne(
    @Param('id') id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.invoicesService.findOne(id, organizationId);
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'Get formatted invoice preview' })
  async preview(
    @Param('id') id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.invoicesService.preview(id, organizationId);
  }

  @Post()
  @ApiOperation({ summary: 'Create invoice' })
  async create(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoicesService.create(organizationId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update invoice' })
  async update(
    @Param('id') id: string,
    @CurrentOrganization() organizationId: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(id, organizationId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete invoice' })
  async remove(
    @Param('id') id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.invoicesService.remove(id, organizationId);
  }

  @Post(':id/mark-paid')
  @ApiOperation({ summary: 'Mark invoice as paid' })
  async markPaid(
    @Param('id') id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.invoicesService.markPaid(id, organizationId);
  }
}
