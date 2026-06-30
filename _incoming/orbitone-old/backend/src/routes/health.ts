import { Router } from "express";
import { checkPostgres } from "../db/postgres.js";
import { checkRedis } from "../db/redis.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const [postgres, redis] = await Promise.allSettled([checkPostgres(), checkRedis()]);

  const data = {
    service: "orbitone-backend",
    postgres: postgres.status === "fulfilled" && postgres.value,
    redis: redis.status === "fulfilled" && redis.value
  };

  const healthy = data.postgres && data.redis;

  res.status(healthy ? 200 : 503).json({
    ok: healthy,
    data
  });
});
