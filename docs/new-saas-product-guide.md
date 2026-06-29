# CloudIT Platform — New SaaS Product Onboarding Guide

This guide explains how to add a brand-new SaaS product (e.g. CloudIT CRM) to the CloudIT Platform monorepo, from local development to production deployment.

---

## Overview

Every CloudIT product follows the same shape:

- **API app** — NestJS + Prisma (`apps/<product>-api`)
- **Web app** — Next.js + Tailwind + `@cloudit/ui` (`apps/<product>-web`)
- **Dedicated database** — PostgreSQL (`<product>`)
- **Dedicated subdomain** — `<product>.${DOMAIN}` and `api-<product>.${DOMAIN}`
- **Infra compose files** — `infra/<product>-api/docker-compose.yml` and `infra/<product>-web/docker-compose.yml`

---

## Step 1 — Create the API App

```bash
mkdir apps/crm-api
cp -r apps/platform-api/* apps/crm-api/
```

Customize:

- [ ] `apps/crm-api/package.json`
  - Rename to `@cloudit/crm-api` (or `crm-api` to match older apps)
  - Pick the next free API port (see [Port allocation](#port-allocation))
- [ ] `apps/crm-api/.env.example`
  - `PORT=3008`
  - `DATABASE_URL=postgresql://cloudit:changeme@postgres:5432/crm?schema=public`
  - `CORS_ORIGIN=http://localhost:<web-port>,https://crm.${DOMAIN:-cloudit.lk}`
- [ ] `apps/crm-api/prisma/schema.prisma`
  - Set `output = "../node_modules/@prisma/client-crm"`
  - Add product-specific models
- [ ] `apps/crm-api/src/main.ts`
  - Update API title, description, and default port
- [ ] `apps/crm-api/src/health/health.service.ts`
  - Update `service` name to `crm-api`
- [ ] `apps/crm-api/Dockerfile`
  - Update `EXPOSE` to match `PORT`

Run a local build:

```bash
npx prisma generate --schema=apps/crm-api/prisma/schema.prisma
npm run build --workspace=@cloudit/crm-api
```

---

## Step 2 — Create the Web App

```bash
mkdir apps/crm-web
cp -r apps/orbitone-web/* apps/crm-web/
```

Customize:

- [ ] `apps/crm-web/package.json`
  - Rename to `@cloudit/crm-web`
  - Set `dev` / `start` ports to the next free web port
- [ ] `apps/crm-web/.env.example`
  - `NEXT_PUBLIC_API_URL=https://api-crm.${DOMAIN:-cloudit.lk}`
- [ ] `apps/crm-web/src/app/layout.tsx`
  - Update title and description
- [ ] `apps/crm-web/src/app/page.tsx`
  - Replace landing content

Build locally:

```bash
npm run build --workspace=@cloudit/ui
npm run build --workspace=@cloudit/crm-web
```

---

## Step 3 — Add the Database

Add the database to PostgreSQL initialization:

```sql
-- infra/postgres/init/01-create-databases.sql
CREATE DATABASE crm;
GRANT ALL PRIVILEGES ON DATABASE crm TO cloudit;
```

If PostgreSQL is already running, create it manually:

```bash
docker exec -it postgres psql -U cloudit -c "CREATE DATABASE crm;"
```

---

## Step 4 — Add Prisma Schema & Migrations

1. Define models in `apps/crm-api/prisma/schema.prisma`.
2. Generate a migration SQL file:

   ```bash
   mkdir -p apps/crm-api/prisma/migrations/20260101000000_init
   npx prisma migrate diff \
     --from-empty \
     --to-schema-datamodel apps/crm-api/prisma/schema.prisma \
     --script \
     --output apps/crm-api/prisma/migrations/20260101000000_init/migration.sql
   ```

3. Create `apps/crm-api/prisma/migrations/migration_lock.toml`:

   ```toml
   # Please do not manually edit this file.
   provider = "postgresql"
   ```

4. Generate the client:

   ```bash
   npx prisma generate --schema=apps/crm-api/prisma/schema.prisma
   ```

---

## Step 5 — Add Docker Compose

Create `infra/crm-api/docker-compose.yml`:

```yaml
version: "3.8"

services:
  crm-api:
    build:
      context: ../../apps/crm-api
      dockerfile: Dockerfile
    image: cloudit/crm-api:latest
    container_name: crm-api
    restart: unless-stopped
    env_file:
      - ../../apps/crm-api/.env
    environment:
      - NODE_ENV=production
      - PORT=3008
    networks:
      - cloudit
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.crm-api.rule=Host(`api-crm.${DOMAIN:-cloudit.lk}`)"
      - "traefik.http.routers.crm-api.entrypoints=websecure"
      - "traefik.http.routers.crm-api.tls.certresolver=cloudflare"
      - "traefik.http.services.crm-api.loadbalancer.server.port=3008"
    healthcheck:
      test: ["CMD-SHELL", "curl -fsS http://localhost:3008/api/health || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 30s
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.25'
          memory: 256M

networks:
  cloudit:
    external: true
```

Create `infra/crm-web/docker-compose.yml` using `infra/orbitone-web/docker-compose.yml` as a template. Update service name, image, container name, host rule, and port.

Create `infra/crm-web/Dockerfile` (root-context) using `infra/orbitone-web/Dockerfile` as a template.

---

## Step 6 — Add Traefik Routing

The Docker Compose labels above already define the routes. Ensure the labels include:

```yaml
- "traefik.enable=true"
- "traefik.http.routers.<name>.rule=Host(`<subdomain>.${DOMAIN:-cloudit.lk}`)"
- "traefik.http.routers.<name>.entrypoints=websecure"
- "traefik.http.routers.<name>.tls.certresolver=cloudflare"
- "traefik.http.services.<name>.loadbalancer.server.port=<PORT>"
```

For details see `docs/routing-examples.md`.

---

## Step 7 — Add DNS Records

In Cloudflare (or your DNS provider), point the new subdomains to the server IP:

| Type | Name | Target |
|------|------|--------|
| A | `crm` | `<SERVER_IP>` |
| A | `api-crm` | `<SERVER_IP>` |

Enable Cloudflare proxy if you want caching/WAF.

---

## Step 8 — Add to CI/CD Workflow

Update `.github/workflows/pr-checks.yml`:

```yaml
- name: Generate Prisma clients
  run: |
    npx prisma generate --schema=apps/platform-api/prisma/schema.prisma
    npx prisma generate --schema=apps/hospitality-api/prisma/schema.prisma
    npx prisma generate --schema=apps/orbitone-api/prisma/schema.prisma
    npx prisma generate --schema=apps/touchorbit-api/prisma/schema.prisma
    npx prisma generate --schema=apps/crm-api/prisma/schema.prisma

- name: Type check / build APIs
  run: |
    npm run build --workspace=platform-api
    npm run build --workspace=hospitality-api
    npm run build --workspace=@cloudit/orbitone-api
    npm run build --workspace=@cloudit/touchorbit-api
    npm run build --workspace=@cloudit/crm-api

- name: Build web apps
  run: |
    npm run build --workspace=platform-web
    npm run build --workspace=hospitality-web
    npm run build --workspace=@cloudit/orbitone-web
    npm run build --workspace=@cloudit/touchorbit-web
    npm run build --workspace=@cloudit/crm-web
```

The `deploy.yml` workflow uses `infra/scripts/deploy.sh`, so update the app list there:

```bash
# infra/scripts/deploy.sh
app_services=(platform-api hospitality-api orbitone-api touchorbit-api crm-api platform-web hospitality-web orbitone-web touchorbit-web crm-web)
```

Also update:

- `infra/scripts/rollback.sh`
- `infra/scripts/maintenance.sh`
- `infra/scripts/predeploy.sh`
- `infra/scripts/health-check.sh`
- `infra/scripts/start.sh`
- `infra/scripts/stop.sh`

---

## Step 9 — Add to Backup Scripts

The backup script uses `pg_dumpall`, which already backs up all databases. No change is required unless you want app-specific backup verification.

If you add app-specific verification, update `infra/backups/backup.sh` or create a new verification step.

---

## Step 10 — Add Monitoring Checks

Add the new public endpoints to `infra/scripts/health-check.sh`:

```bash
endpoints=(
  # ... existing endpoints ...
  "https://api-crm.${DOMAIN}/api/health"
  "https://crm.${DOMAIN}"
)
```

Also add the new domains to Uptime Kuma via its web UI.

---

## Step 11 — Deploy

1. Ensure `.env` files exist on the server for both new apps.
2. Run the deployment script:

   ```bash
   DOMAIN=cloudit.lk ./infra/scripts/deploy.sh
   ```

3. Run health checks:

   ```bash
   DOMAIN=cloudit.lk ./infra/scripts/health-check.sh
   ```

---

## Port Allocation

Use unique ports to avoid local conflicts. Current allocation:

| App | API Port | Web Port |
|-----|----------|----------|
| platform | 3001 | 3000 |
| hospitality | 3002 | 3003 |
| orbitone | 3004 | 3005 |
| touchorbit | 3006 | 3007 |
| next (crm example) | 3008 | 3009 |

---

## Resource Estimation (per app)

| Component | RAM Limit | CPU Limit | Disk |
|-----------|-----------|-----------|------|
| API container | 1 GB | 1.0 | ~200 MB image |
| Web container | 512 MB | 0.5 | ~150 MB image |
| Database | shared Postgres | shared | ~50 MB per empty DB |

The Hetzner CX33 (4 vCPU, 8 GB RAM, 80 GB SSD) currently reserves ~6.5 GB for Docker, leaving headroom for spikes.

---

## Common Pitfalls & Solutions

### Prisma client collision

**Problem:** Two apps generate `@prisma/client` into the same path and cause EPERM errors.

**Solution:** Use a unique output path in every schema:

```prisma
output = "../node_modules/@prisma/client-crm"
```

### Web build cannot find `@cloudit/ui`

**Problem:** Next.js fails to resolve `@cloudit/ui` during Docker build.

**Solution:** Use a root-context Dockerfile, build `@cloudit/ui` first, then copy the built package into the app workspace. See `infra/orbitone-web/Dockerfile`.

### DNS not resolving

**Problem:** `https://crm.cloudit.lk` returns 404.

**Solution:**
- Check Cloudflare DNS records exist and point to the server IP.
- Verify the container is on the `cloudit` network.
- Verify Traefik labels include `traefik.enable=true`.

### Health check fails

**Problem:** Container keeps restarting.

**Solution:**
- Ensure `PORT` env var matches the exposed port.
- Ensure the app listens on `0.0.0.0`, not `localhost`.
- Check logs: `docker logs -f crm-api`.

### Missing `.env` on server

**Problem:** `docker compose` fails with "env file not found".

**Solution:** Copy `.env.example` to `.env` on the server and fill in real secrets before deploying.

---

## Final Checklist

- [ ] API app created and builds locally
- [ ] Web app created and builds locally
- [ ] Database added to PostgreSQL init
- [ ] Prisma schema and migration files added
- [ ] Docker Compose files created
- [ ] Traefik labels and DNS records configured
- [ ] Deployment scripts updated
- [ ] CI/CD workflow updated
- [ ] Health-check endpoints added
- [ ] Monitoring domains added
- [ ] README and architecture docs updated
- [ ] No secrets committed

---

## See Also

- `docs/new-app-guide.md` — shorter checklist version
- `docs/routing-examples.md` — Traefik routing deep dive
- `docs/shared-packages.md` — shared package usage
- `docs/environment-setup.md` — env var templates
- `docs/architecture.md` — architecture overview
