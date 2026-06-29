import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('attendance')
@Controller('attendance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AttendanceController {
  @Get()
  @RequireModule('touchorbit', 'attendance')
  @ApiOperation({ summary: 'List attendance records' })
  findAll() {
    return { message: 'Attendance module is enabled', data: [] };
  }
}
