import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthService } from './health.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @ApiOperation({ summary: 'Liveness check' })
  live() {
    return {
      status: 'ok',
      service: 'platform-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Health check' })
  async check(@Res() response: Response) {
    const result = await this.healthService.check();
    const statusCode =
      result.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    return response.status(statusCode).json(result);
  }
}
