import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';
import * as fs from 'fs';

export interface HealthCheckResult {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  service: string;
  database: { status: string };
  redis: { status: string };
  disk: { status: string; total: number; used: number; free: number; percent: number };
  memory: { status: string; total: number; used: number; free: number; percent: number };
}

@Injectable()
export class HealthService implements OnModuleDestroy {
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

  async check(): Promise<HealthCheckResult> {
    const checks: HealthCheckResult = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'hospitality-api',
      database: { status: 'ok' },
      redis: { status: 'ok' },
      disk: { status: 'ok', total: 0, used: 0, free: 0, percent: 0 },
      memory: { status: 'ok', total: 0, used: 0, free: 0, percent: 0 },
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      checks.database.status = 'error';
      checks.status = 'degraded';
    }

    try {
      await this.redis.ping();
    } catch (e) {
      checks.redis.status = 'error';
      checks.status = 'degraded';
    }

    try {
      const diskStats = fs.statfsSync('/');
      const blockSize = diskStats.bsize;
      const total = diskStats.blocks * blockSize;
      const free = diskStats.bfree * blockSize;
      const used = total - free;
      const percent = total ? Math.round((used / total) * 100) : 0;
      checks.disk = { status: percent > 90 ? 'error' : percent > 80 ? 'warning' : 'ok', total, used, free, percent };
      if (checks.disk.status === 'error') checks.status = 'degraded';
    } catch (e) {
      checks.disk.status = 'error';
      checks.status = 'degraded';
    }

    try {
      const total = process.memoryUsage().heapTotal;
      const used = process.memoryUsage().heapUsed;
      const free = total - used;
      const percent = total ? Math.round((used / total) * 100) : 0;
      checks.memory = { status: percent > 90 ? 'error' : percent > 80 ? 'warning' : 'ok', total, used, free, percent };
      if (checks.memory.status === 'error') checks.status = 'degraded';
    } catch (e) {
      checks.memory.status = 'error';
      checks.status = 'degraded';
    }

    return checks;
  }

  onModuleDestroy() {
    return this.redis.quit();
  }
}
