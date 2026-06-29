# CloudIT Platform — Application Security Guide

This document describes the application-level security controls for the CloudIT Platform APIs (`platform-api` and `hospitality-api`).

## 1. Rate Limiting

Both APIs use `@nestjs/throttler` with a global guard.

- **Default limit:** 100 requests per minute per IP (`ttl=60000`, `limit=100`).
- **Login endpoint:** `POST /api/auth/login` is further restricted to **10 requests per minute**.
- **Skipped routes:** `/api/health` and `/api/docs` are excluded from throttling.

Configure via environment variables:

```env
THROTTLE_TTL=60000
THROTTLE_LIMIT=100
```

If the limit is exceeded the API returns HTTP `429 Too Many Requests`:

```json
{
  "success": false,
  "error": {
    "message": "ThrottlerException: Too Many Requests",
    "statusCode": 429,
    "requestId": "..."
  }
}
```

## 2. Security Headers (Helmet)

`helmet` is mounted as the first middleware in `main.ts`. It sets:

- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 0`
- `Content-Security-Policy` (relaxed enough for Swagger UI inline scripts)
- `Referrer-Policy`
- `Cross-Origin-Resource-Policy`
- `Permissions-Policy`

> Note: `crossOriginEmbedderPolicy` is disabled so that Swagger UI continues to work. If you do not serve Swagger in production, tighten this further.

## 3. CORS Whitelist

CORS is enabled with credentials. In production set a comma-separated whitelist instead of `*`:

```env
CORS_ORIGIN=https://app.cloudit.lk,https://admin.cloudit.lk
```

The wildcard `CORS_ORIGIN=*` is accepted for local development only.

## 4. Input Sanitization

All request bodies pass through two global pipes:

1. `ValidationPipe` — validates and strips unknown fields.
2. `XssSanitizationPipe` — strips HTML/JS from string inputs using `xss`.

Password and token fields are explicitly skipped during sanitization so that special characters are preserved.

## 5. Authentication & Authorization

- APIs issue short-lived JWT access tokens.
- Hospitality API protects all routes with a global `JwtAuthGuard` except routes marked `@Public()`.
- Internal service calls require `INTERNAL_API_TOKEN`.
- Keep `JWT_SECRET` and `INTERNAL_API_TOKEN` out of git and rotate them regularly.

## 6. Dependency Vulnerabilities

Run `npm audit` regularly:

```bash
npm audit
npm audit fix
```

The monorepo currently reports known vulnerabilities that should be reviewed and patched in a dedicated maintenance window.

## 7. Secrets Management Checklist

- [ ] `.env` files are in `.gitignore` and never committed.
- [ ] Production secrets are injected at runtime, not stored in images.
- [ ] `JWT_SECRET` is at least 32 random characters.
- [ ] `INTERNAL_API_TOKEN` is unique per environment.
- [ ] `CORS_ORIGIN` is a strict whitelist in production.
- [ ] Rate limits are enforced (default + login).
- [ ] Helmet headers are present on every response.
- [ ] Input sanitization is active.
