# CloudIT Platform — How to Add a New App

This guide explains how to add a new SaaS product (e.g. CloudIT CRM) to the CloudIT Platform monorepo.

## 1. Create the API App

```bash
mkdir apps/crm-api
cp -r apps/hospitality-api/* apps/crm-api/
```

Then customize:

- `apps/crm-api/package.json` — rename to `@cloudit/crm-api`, set `PORT=3007`.
- `apps/crm-api/prisma/schema.prisma` — set database `crm` and add product-specific models.
- `apps/crm-api/src/main.ts` — update title/port.
- `apps/crm-api/Dockerfile` — update exposed port if needed.
- `apps/crm-api/.env.example` — set `DATABASE_URL` to `postgresql://.../crm`.

## 2. Create the Web App

```bash
mkdir apps/crm-web
cp -r apps/platform-web/* apps/crm-web/
```

Then customize:

- `apps/crm-web/package.json` — rename to `@cloudit/crm-web`.
- `apps/crm-web/.env.example` — point `NEXT_PUBLIC_API_URL` to `https://api-crm.<DOMAIN>`.
- `apps/crm-web/next.config.js` — ensure standalone output.

## 3. Add Docker Compose

Create `infra/crm-api/docker-compose.yml` and `infra/crm-web/docker-compose.yml`.

Use this template and adjust the service name, image, host, and port:

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
    networks:
      - cloudit
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.crm-api.rule=Host(`api-crm.${DOMAIN:-cloudit.lk}`)"
      - "traefik.http.routers.crm-api.entrypoints=websecure"
      - "traefik.http.routers.crm-api.tls.certresolver=cloudflare"
      - "traefik.http.services.crm-api.loadbalancer.server.port=3007"
    healthcheck:
      test: ["CMD-SHELL", "curl -fsS http://localhost:3007/api/health || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 1G

networks:
  cloudit:
    external: true
```

## 4. Add the Database

Create the database automatically on PostgreSQL startup by adding it to `infra/postgres/init/`:

```sql
CREATE DATABASE crm;
```

Or run manually:

```bash
docker exec -it postgres psql -U cloudit -c "CREATE DATABASE crm;"
```

## 5. Add Traefik Routing

The Docker Compose labels already define the route. Ensure DNS records exist:

```
api-crm.cloudit.example.com  →  YOUR_SERVER_IP
crm.cloudit.example.com      →  YOUR_SERVER_IP
```

## 6. Update Deployment Scripts

Add the new services to:

- `infra/scripts/deploy.sh` — build and start the new apps.
- `infra/scripts/rollback.sh` — tag and rollback the new images.
- `infra/scripts/maintenance.sh` — stop/start the new apps in maintenance mode.
- `infra/scripts/health-check.sh` — add new public endpoints.

## 7. Update Root Workspaces

Ensure the new apps are included in root `package.json` workspaces (they are if under `apps/*`).

## 8. Add CI/CD Steps

Update `.github/workflows/pr-checks.yml` and `.github/workflows/deploy.yml` to include the new apps.

## 9. Update Backup & Monitoring

- Add the new database to `infra/backups/backup.sh` if not using `pg_dumpall`.
- Add the new app domains to Uptime Kuma.
- Add health endpoints to backup verification.

## 10. Documentation

- Add the new product to `README.md`.
- Update `docs/architecture.md`.
- Add product-specific docs under `docs/` if needed.

## Checklist

- [ ] API app created and builds
- [ ] Web app created and builds
- [ ] Database created
- [ ] Prisma schema and migrations added
- [ ] Docker Compose files created
- [ ] Traefik labels and DNS records configured
- [ ] Deployment scripts updated
- [ ] CI/CD workflows updated
- [ ] Backups include new data
- [ ] Monitoring checks added
- [ ] Documentation updated
