import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger.js";

export function handleError(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    const message = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    res.status(400).json({ ok: false, error: `Validation error: ${message}` });
    return;
  }

  if (err.message?.startsWith("Origin") && err.message?.includes("not allowed by CORS")) {
    logger.warn({ origin: _req.headers.origin }, "CORS request rejected");
    res.status(403).json({ ok: false, error: "Forbidden" });
    return;
  }

  logger.error({ err }, "Unhandled error");
  res.status(500).json({ ok: false, error: "Internal server error." });
}
