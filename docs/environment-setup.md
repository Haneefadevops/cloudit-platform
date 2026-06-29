# CloudIT Platform — Environment Setup

This document provides a template for environment variables in new apps and explains how to manage secrets in development and production.

---

## New App `.env.example` Template

Every new app should include an `.env.example` file. Copy it to `.env` and fill in real values before running locally or deploying.

### API App Template

```bash
# Server
PORT=3004

# Database
DATABASE_URL=postgresql://cloudit:changeme@postgres:5432/myapp?schema=public

# Cache
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=changeme

# Auth
JWT_SECRET=your-jwt-secret-here

# CORS (comma-separated whitelist; use * only for local dev)
CORS_ORIGIN=http://localhost:3000,https://myapp.cloudit.lk

# Internal API communication
PLATFORM_API_URL=http://platform-api:3001/api
INTERNAL_API_TOKEN=your-internal-api-token-here

# Rate limiting (default: 100 req/min)
THROTTLE_TTL=60000
THROTTLE_LIMIT=100

# Optional integrations
N8N_WEBHOOK_URL=https://n8n.cloudit.lk/webhook/cloudit-events
N8N_WEBHOOK_SECRET=your-n8n-webhook-secret-here
```

### Web App Template

```bash
# Public API base URL (used by the browser)
NEXT_PUBLIC_API_URL=https://api-myapp.cloudit.lk

# Public app name
NEXT_PUBLIC_APP_NAME=CloudIT MyApp
```

---

## Required vs Optional Variables

### Required for all apps

| Variable | Why |
|----------|-----|
| `PORT` | The port the container listens on. Must match the Traefik `loadbalancer.server.port`. |
| `DATABASE_URL` | PostgreSQL connection string. Each app uses its own database. |
| `JWT_SECRET` | Must match across all APIs so tokens issued by `platform-api` are valid everywhere. |
| `CORS_ORIGIN` | Whitelist of allowed frontend origins. Use `*` only for local experimentation. |

### Required for APIs only

| Variable | Why |
|----------|-----|
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Cache, session store, and health checks. |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | Rate limiting. Defaults are safe if omitted. |
| `INTERNAL_API_TOKEN` | Secures service-to-service calls (verify against platform-api). |

### Optional

| Variable | Why |
|----------|-----|
| `N8N_WEBHOOK_URL` / `N8N_WEBHOOK_SECRET` | Only needed if the app emits webhook events. |
| `PLATFORM_API_URL` | Needed if the app calls platform-api endpoints. |

---

## How to Generate Secrets

### JWT Secret

Generate a strong random string:

```bash
openssl rand -base64 48
```

Use the same value for `JWT_SECRET` in every API app so tokens are cross-valid.

### Internal API Token

```bash
openssl rand -hex 32
```

Store this in `INTERNAL_API_TOKEN` for every API and in GitHub Secrets if workflows need it.

### Database Password

```bash
openssl rand -base64 24
```

Update both `infra/postgres/.env` and each app's `DATABASE_URL`.

### N8N Webhook Secret

```bash
openssl rand -hex 32
```

Only needed for apps that publish events to n8n.

---

## Managing Environment Variables in Production

### On the Server

1. App `.env` files live next to their `docker-compose.yml` files. For example:

   ```
   /opt/cloudit/cloudit-platform/apps/orbitone-api/.env
   /opt/cloudit/cloudit-platform/apps/orbitone-web/.env
   ```

2. The deploy script (`infra/scripts/deploy.sh`) picks up these files via `env_file` in Docker Compose.

3. Do **not** commit `.env` files. They are listed in `.gitignore`.

### In GitHub Actions

Use repository secrets/variables for deployment context:

| Name | Type | Purpose |
|------|------|---------|
| `SSH_PRIVATE_KEY` | Secret | SSH into the Hetzner server |
| `SERVER_IP` | Secret | Server IP address |
| `SERVER_USER` | Secret | SSH username |
| `DOMAIN` | Variable | Domain used by Traefik labels |

The workflow passes `DOMAIN` to the server before running `deploy.sh`.

### Rotating Secrets

1. Generate a new secret locally.
2. Update the `.env` file on the server (or GitHub Secret if used by CI).
3. Restart the affected service:

   ```bash
   docker compose -f infra/<app>/docker-compose.yml up -d --force-recreate
   ```

4. If rotating `JWT_SECRET`, rotate it for **all APIs at the same time** and force users to log in again.

---

## Local Development Setup

1. Copy all example env files:

   ```bash
   for svc in traefik postgres redis n8n uptime-kuma platform-api hospitality-api orbitone-api touchorbit-api platform-web hospitality-web orbitone-web touchorbit-web; do
     cp infra/$svc/.env.example infra/$svc/.env 2>/dev/null || cp apps/$svc/.env.example apps/$svc/.env 2>/dev/null
   done
   ```

2. Edit the copied `.env` files with real secrets.
3. Start infrastructure:

   ```bash
   ./infra/scripts/start.sh
   ```

4. Start apps:

   ```bash
   START_APPS=true ./infra/scripts/start.sh
   ```

---

## Environment Checklist for New Apps

- [ ] `.env.example` created
- [ ] `PORT` unique across all apps
- [ ] `DATABASE_URL` points to a dedicated database
- [ ] `JWT_SECRET` shared with other APIs
- [ ] `CORS_ORIGIN` whitelists the correct frontend URL
- [ ] `INTERNAL_API_TOKEN` set if calling platform-api
- [ ] Docker Compose `env_file` path is correct
- [ ] `.env` added to `.gitignore`

---

## See Also

- `docs/new-app-guide.md`
- `docs/routing-examples.md`
- `infra/scripts/deploy.sh`
