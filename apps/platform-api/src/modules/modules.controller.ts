import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ModulesService, ModuleToggleDto } from './modules.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { InternalAuthGuard } from '../common/guards/internal-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('modules')
@Controller('modules')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @Get('registry')
  @ApiOperation({ summary: 'List all products and available modules' })
  getRegistry() {
    return this.modulesService.getRegistry();
  }

  @Get('me')
  @ApiOperation({ summary: 'Get modules for my current organization' })
  async getMyModules(
    @CurrentUser() user: any,
    @Query('orgId') orgId?: string,
  ) {
    const targetOrgId = orgId || user?.orgId || user?.organizationId;
    return this.modulesService.findByOrganization(targetOrgId);
  }

  @Get('organizations/:orgId')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Get modules for an organization (super admin)' })
  async findByOrganization(@Param('orgId') orgId: string) {
    return this.modulesService.findByOrganization(orgId);
  }

  @Put('organizations/:orgId')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Update modules for an organization (super admin)' })
  async setModules(
    @Param('orgId') orgId: string,
    @Body() toggles: ModuleToggleDto[],
  ) {
    return this.modulesService.setModules(orgId, toggles);
  }

  @Get('internal/:orgId')
  @UseGuards(InternalAuthGuard)
  @ApiOperation({ summary: 'Internal: get modules for an organization' })
  async findByOrganizationInternal(@Param('orgId') orgId: string) {
    return this.modulesService.findByOrganization(orgId);
  }
}
