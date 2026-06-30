import rateLimit from "express-rate-limit";
import { RedisStore, type SendCommandFn } from "rate-limit-redis";
import { env } from "../config/env.js";
import { redis } from "../db/redis.js";

const sendCommand: SendCommandFn = (...args: string[]) =>
  redis.call(args[0], args.slice(1)) as ReturnType<SendCommandFn>;

function makeStore(prefix: string) {
  return new RedisStore({
    sendCommand,
    prefix: `rl:${prefix}:`
  });
}

const skipInNonProduction = () => env.NODE_ENV !== "production";

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("global"),
  message: { ok: false, error: "Too many requests. Please try again later." },
  skip: (req) => req.path === "/health" || skipInNonProduction()
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("auth"),
  message: { ok: false, error: "Too many authentication attempts. Please try again later." },
  skip: skipInNonProduction
});

export const publicBookingRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("public-booking"),
  message: { ok: false, error: "Too many booking attempts. Please try again later." },
  skip: skipInNonProduction
});
