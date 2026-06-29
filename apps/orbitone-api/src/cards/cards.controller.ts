import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('cards')
@Controller('cards')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CardsController {
  @Get()
  @RequireModule('orbitone', 'cards')
  @ApiOperation({ summary: 'List business cards' })
  findAll() {
    return { message: 'Cards module is enabled', data: [] };
  }
}
