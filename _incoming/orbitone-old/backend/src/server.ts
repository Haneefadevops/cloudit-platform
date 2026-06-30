import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { pool } from "./db/postgres.js";
import { redis } from "./db/redis.js";
import { logger } from "./lib/logger.js";
import { handleError } from "./middleware/error.js";
import {
  authRateLimiter,
  globalRateLimiter,
  publicBookingRateLimiter
} from "./middleware/rate-limit.js";
import { healthRouter } from "./routes/health.js";
import { v1Router } from "./routes/v1.js";
import { v2Router } from "./routes/v2.js";

const app = express();

if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(helmet());

const allowedOrigins = env.FRONTEND_ORIGIN.split(",").map((origin) => origin.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
  })
);

app.use(express.json({ limit: "1mb" }));

app.use(globalRateLimiter);

app.use("/health", healthRouter);

if (env.NODE_ENV !== "production") {
  app.use("/api/v1", v1Router);
}

app.use("/api/v2/auth", authRateLimiter);
app.use("/api/v2/book", publicBookingRateLimiter);
app.use("/api/v2", v2Router);

app.use(handleError);

app.use((_req, res) => {
  res.status(404).json({
    ok: false,
    error: "Not found"
  });
});

const server = app.listen(env.PORT, () => {
  logger.info(`OrbitOne backend listening on port ${env.PORT} in ${env.NODE_ENV}`);
});

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down gracefully");
  server.close(async () => {
    await Promise.allSettled([pool.end(), redis.quit()]);
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
