import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('employees')
@Controller('employees')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EmployeesController {
  @Get()
  @RequireModule('touchorbit', 'employees')
  @ApiOperation({ summary: 'List employees' })
  findAll() {
    return { message: 'Employees module is enabled', data: [] };
  }
}
