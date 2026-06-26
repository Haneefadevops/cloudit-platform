import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';

@Injectable()
export class HealthService {
  private redis: Redis;

  constructor(private readonly prisma: PrismaService) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'redis',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
  }

  async check() {
    const checks: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch (e) {
      checks.database = 'error';
      checks.status = 'degraded';
    }

    try {
      await this.redis.ping();
      checks.redis = 'ok';
    } catch (e) {
      checks.redis = 'error';
      checks.status = 'degraded';
    }

    return checks;
  }
}
