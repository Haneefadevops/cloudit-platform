import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { InternalAuthGuard } from '../common/guards/internal-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CustomFieldsService } from './custom-fields.service';
import { UpsertCustomFieldDto } from './dto/custom-field.dto';

@ApiTags('custom-fields')
@Controller('custom-fields')
export class CustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  @Get('organizations/:orgId')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  list(
    @Param('orgId') orgId: string,
    @Query('product') product?: string,
    @Query('entity') entity?: string,
  ) {
    return this.customFieldsService.list(orgId, product, entity);
  }

  @Post('organizations/:orgId')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  upsert(@Param('orgId') orgId: string, @Body() dto: UpsertCustomFieldDto) {
    return this.customFieldsService.upsert(orgId, dto);
  }

  @Delete('organizations/:orgId/:id')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  remove(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.customFieldsService.remove(orgId, id);
  }

  @Public()
  @Get('internal/:orgId')
  @UseGuards(InternalAuthGuard)
  @ApiOperation({ summary: 'Internal: product custom fields for an org' })
  listInternal(
    @Param('orgId') orgId: string,
    @Query('product') product?: string,
    @Query('entity') entity?: string,
  ) {
    return this.customFieldsService.list(orgId, product, entity);
  }
}
