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
import { FeatureFlagsService } from './feature-flags.service';
import { SetFeatureFlagDto } from './dto/feature-flag.dto';

@ApiTags('feature-flags')
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Get('organizations/:orgId')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  list(@Param('orgId') orgId: string, @Query('product') product?: string) {
    return this.featureFlagsService.list(orgId, product);
  }

  @Post('organizations/:orgId')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  set(@Param('orgId') orgId: string, @Body() dto: SetFeatureFlagDto) {
    return this.featureFlagsService.set(orgId, dto);
  }

  @Delete('organizations/:orgId/:id')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  remove(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.featureFlagsService.remove(orgId, id);
  }

  @Public()
  @Get('internal/:orgId')
  @UseGuards(InternalAuthGuard)
  @ApiOperation({ summary: 'Internal: product feature flags for an org' })
  listInternal(@Param('orgId') orgId: string, @Query('product') product?: string) {
    return this.featureFlagsService.list(orgId, product);
  }
}
