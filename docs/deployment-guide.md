# CloudIT Platform — Deployment Guide

This guide covers how the CloudIT Platform is deployed to the Hetzner server and how to manage rollbacks, maintenance mode, and staging.

## Overview

- **Branch:** `master` is the production branch.
- **CI/CD:** GitHub Actions (`.github/workflows/deploy.yml`) deploys on every push to `master`.
- **Server path:** `/opt/cloudit/cloudit-platform`
- **Runtime:** Docker + Docker Compose on a single Ubuntu server.

## Required GitHub Secrets & Variables

Go to **Settings → Secrets and variables → Actions**.

### Secrets

| Secret | Description |
|--------|-------------|
| `SSH_PRIVATE_KEY` | Private key for the `deploy` user on the server |
| `SERVER_IP` | Hetzner server IP address |
| `SERVER_USER` | Usually `deploy` |

### Variables

| Variable | Description |
|----------|-------------|
| `DOMAIN` | Root domain, e.g. `cloudit.example.com` |

## Deployment Flow

1. Push to `master`.
2. GitHub Actions checks out the code, installs Node dependencies, and builds shared packages.
3. Actions SSH into the server and runs `infra/scripts/deploy.sh`.
4. `deploy.sh`:
   - Pulls the latest code.
   - Runs `infra/scripts/predeploy.sh` to check and apply Prisma migrations.
   - Tags current app images as `:previous` for rollback.
   - Starts/restarts infrastructure services.
   - Builds and starts the four app services.
   - Prunes old Docker resources.
5. Actions runs `infra/scripts/health-check.sh`.
6. If health checks fail, Actions automatically runs `infra/scripts/rollback.sh`.
7. Deployment result is appended to `/var/log/cloudit-deploy.log` on the server.

## Manual Deployment

Only use this when you need to deploy outside of GitHub Actions.

```bash
ssh deploy@YOUR_SERVER_IP
cd /opt/cloudit/cloudit-platform
DOMAIN=cloudit.example.com ./infra/scripts/deploy.sh
```

## Pre-Deployment Migrations

`infra/scripts/predeploy.sh` runs:

```bash
npx prisma migrate status
npx prisma migrate deploy
```

For both `platform-api` and `hospitality-api`. The deployment stops if migrations are pending or fail.

You can also run it manually:

```bash
./infra/scripts/predeploy.sh
```

## Health Checks

`infra/scripts/health-check.sh` verifies these public endpoints:

- `https://api-platform.<DOMAIN>/api/health`
- `https://api-hospitality.<DOMAIN>/api/health`
- `https://app.<DOMAIN>`
- `https://hospitality.<DOMAIN>`

Run manually:

```bash
DOMAIN=cloudit.example.com ./infra/scripts/health-check.sh
```

## Rollback

If a deployment is unhealthy, roll back to the previous app images:

```bash
./infra/scripts/rollback.sh
```

This script:

1. Stops the maintenance page if active.
2. Retags `:previous` images back to `:latest`.
3. Recreates app containers from the previous images.

> **Note:** Infrastructure services (Postgres, Redis, Traefik, n8n, Uptime Kuma) are not rolled back by this script.

## Maintenance Mode

Enable maintenance mode before risky operations:

```bash
./infra/scripts/maintenance.sh on
```

This stops the app services and serves a maintenance page on all app domains.

Disable maintenance mode (redeploys apps):

```bash
./infra/scripts/maintenance.sh off
```

## Staging Deployment (Optional)

To add a staging environment:

1. Create a `staging` branch.
2. Duplicate `.github/workflows/deploy.yml` as `deploy-staging.yml`.
3. Trigger on `push: branches: [staging]`.
4. Update the server path and domain variables for staging.
5. Use separate server or separate Traefik labels (e.g. `staging-app.<DOMAIN>`).

Keep staging as close to production as possible and run the same health checks.

## Troubleshooting

| Issue | Command |
|-------|---------|
| View deployment log | `tail -f /var/log/cloudit-deploy.log` |
| View app logs | `docker logs -f platform-api` |
| Check service status | `docker ps` |
| Restart one app | `cd infra/platform-api && docker compose restart` |
| Check migrations | `cd apps/platform-api && npx prisma migrate status` |
