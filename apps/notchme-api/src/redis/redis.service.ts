import { Injectable, OnModuleDestroy, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis, { type ChainableCommander } from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>("REDIS_URL");

    if (url) {
      this.redis = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
    } else {
      const host = this.configService.get<string>("REDIS_HOST") || "redis";
      const port = Number(this.configService.get<string>("REDIS_PORT")) || 6379;
      const password = this.configService.get<string>("REDIS_PASSWORD");

      this.redis = new Redis({
        host,
        port,
        password: password || undefined,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
    }
  }

  get client(): Redis {
    return this.redis;
  }

  async check(): Promise<boolean> {
    if (this.redis.status === "end") {
      return false;
    }
    if (this.redis.status === "wait") {
      await this.redis.connect();
    }
    return (await this.redis.ping()) === "PONG";
  }

  async pipeline(): Promise<ChainableCommander> {
    if (this.redis.status === "wait") {
      await this.redis.connect();
    }
    return this.redis.pipeline();
  }

  onModuleDestroy() {
    if (this.redis.status !== "end") {
      return this.redis.quit();
    }
  }
}
