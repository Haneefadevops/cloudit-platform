import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('organizations')
@Controller('organizations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: 'List my organizations' })
  async findAll(@CurrentUser() user: any) {
    return this.organizationsService.findAll(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create organization' })
  async create(@CurrentUser() user: any, @Body() dto: any) {
    return this.organizationsService.create(user.userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organization by ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.organizationsService.findOne(id, user.userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update organization' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: any,
  ) {
    return this.organizationsService.update(id, user.userId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update organization (alias)' })
  async updatePut(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: any,
  ) {
    return this.organizationsService.update(id, user.userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete organization' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.organizationsService.remove(id, user.userId);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Invite member to organization' })
  async inviteMember(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: any,
  ) {
    return this.organizationsService.inviteMember(id, user.userId, dto);
  }

  @Patch(':id/members/:memberId')
  @ApiOperation({ summary: 'Update member role' })
  async updateMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: any,
    @Body() dto: any,
  ) {
    return this.organizationsService.updateMember(
      id,
      memberId,
      user.userId,
      dto,
    );
  }

  @Delete(':id/members/:memberId')
  @ApiOperation({ summary: 'Remove member from organization' })
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: any,
  ) {
    return this.organizationsService.removeMember(id, memberId, user.userId);
  }
}
