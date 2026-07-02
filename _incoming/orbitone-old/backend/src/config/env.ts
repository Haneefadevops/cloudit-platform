import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  FRONTEND_ORIGIN: z.string().min(1).default("http://localhost:3000"),
  GOOGLE_CLIENT_ID: z.string().trim().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().trim().min(1).optional(),
  GOOGLE_CALENDAR_REDIRECT_URI: z.string().url().optional(),
  ZOHO_CLIENT_ID: z.string().trim().min(1).optional(),
  ZOHO_CLIENT_SECRET: z.string().trim().min(1).optional(),
  ZOHO_CALENDAR_REDIRECT_URI: z.string().url().optional(),
  ZOHO_ACCOUNTS_BASE_URL: z.string().url().default("https://accounts.zoho.com"),
  ZOHO_CALENDAR_SCOPES: z.string().trim().min(1).default("ZohoCalendar.calendar.ALL,ZohoCalendar.event.ALL"),
  CALENDAR_TOKEN_ENCRYPTION_KEY: z.string().min(32).optional(),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info")
});

export const env = envSchema.parse(process.env);
