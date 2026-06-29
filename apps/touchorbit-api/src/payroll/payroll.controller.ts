import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('payroll')
@Controller('payroll')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PayrollController {
  @Get()
  @RequireModule('touchorbit', 'payroll')
  @ApiOperation({ summary: 'List payroll records' })
  findAll() {
    return { message: 'Payroll module is enabled', data: [] };
  }
}
