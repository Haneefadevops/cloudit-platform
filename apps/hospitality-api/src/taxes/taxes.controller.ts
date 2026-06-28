import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TaxesService } from './taxes.service';
import { CreateTaxRateDto } from './dto/create-tax-rate.dto';
import { UpdateTaxRateDto } from './dto/update-tax-rate.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentOrganization } from '../common/decorators/current-organization.decorator';

@ApiTags('taxes')
@Controller('taxes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TaxesController {
  constructor(private readonly taxesService: TaxesService) {}

  @Get()
  @ApiOperation({ summary: 'List tax rates' })
  async findAll(@CurrentOrganization() organizationId: string) {
    return this.taxesService.findAll(organizationId);
  }

  @Get('active')
  @ApiOperation({ summary: 'List active tax rates' })
  async findActive(@CurrentOrganization() organizationId: string) {
    return this.taxesService.findActive(organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tax rate by ID' })
  async findOne(
    @Param('id') id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.taxesService.findOne(id, organizationId);
  }

  @Post()
  @ApiOperation({ summary: 'Create tax rate' })
  async create(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreateTaxRateDto,
  ) {
    return this.taxesService.create(organizationId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update tax rate' })
  async update(
    @Param('id') id: string,
    @CurrentOrganization() organizationId: string,
    @Body() dto: UpdateTaxRateDto,
  ) {
    return this.taxesService.update(id, organizationId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete tax rate' })
  async remove(
    @Param('id') id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.taxesService.remove(id, organizationId);
  }
}
