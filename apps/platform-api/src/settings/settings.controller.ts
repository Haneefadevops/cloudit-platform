import { Controller, Get, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('settings')
@Controller('settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get organization settings' })
  async findAll(@Query('orgId') orgId: string) {
    return this.settingsService.findAll(orgId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update organization settings' })
  async update(@Query('orgId') orgId: string, @Body() dto: any) {
    return this.settingsService.update(orgId, dto);
  }
}
