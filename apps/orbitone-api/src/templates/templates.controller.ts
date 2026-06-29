import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('templates')
@Controller('templates')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TemplatesController {
  @Get()
  @RequireModule('orbitone', 'templates')
  @ApiOperation({ summary: 'List card templates' })
  findAll() {
    return { message: 'Templates module is enabled', data: [] };
  }
}
