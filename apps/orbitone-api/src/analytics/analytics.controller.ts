import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  @Get()
  @RequireModule('orbitone', 'analytics')
  @ApiOperation({ summary: 'List card analytics' })
  findAll() {
    return { message: 'Analytics module is enabled', data: [] };
  }
}
