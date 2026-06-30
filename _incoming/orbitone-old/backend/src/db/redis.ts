import { Redis } from "ioredis";
import { env } from "../config/env.js";

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1
});

export async function checkRedis() {
  if (redis.status === "end") {
    return false;
  }

  if (redis.status === "wait") {
    await redis.connect();
  }

  return (await redis.ping()) === "PONG";
}
