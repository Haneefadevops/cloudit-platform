# CloudIT Platform

Lightweight self-hosted multi-tenant SaaS platform running on a single Hetzner CX33 server (4 vCPU, 8 GB RAM, 80 GB SSD).

Built with **Docker + Docker Compose**, **NestJS**, **Next.js**, **Tailwind CSS**, **Prisma**, **PostgreSQL**, **Redis**, **Traefik**, **n8n**, and **Uptime Kuma**.

## Table of Contents

- [What's Inside](#whats-inside)
- [Quick Start (Local)](#quick-start-local)
- [How to Deploy](#how-to-deploy)
- [How to Add a New App](#how-to-add-a-new-app)
- [Backup & Restore](#backup--restore)
- [Useful Commands](#useful-commands)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Documentation](#documentation)
- [Sprint Completion](#sprint-completion)
- [Contributing](#contributing)
- [License](#license)

## What's Inside

| Service | Purpose | Public? |
|---------|---------|---------|
| **Traefik** | Reverse proxy, HTTPS, Let's Encrypt | Yes (80/443) |
| **PostgreSQL** | Primary database | No |
| **Redis** | Caching, n8n queue | No |
| **n8n** | Workflow automation | Yes |
| **Uptime Kuma** | Monitoring & status pages | Yes |
| **Platform API** | Auth, users, organizations, events | Yes |
| **Platform Web** | Platform dashboard | Yes |
| **Hospitality API** | Hospitality OS backend | Yes |
| **Hospitality Web** | Hospitality dashboard | Yes |
| **OrbitOne API** | Digital business cards backend | Yes |
| **OrbitOne Web** | Digital business cards dashboard | Yes |
| **TouchOrbit HR API** | HR management backend | Yes |
| **TouchOrbit HR Web** | HR management dashboard | Yes |

## Quick Start (Local)

```bash
git clone https://github.com/YOUR_ORG/cloudit-platform.git
cd cloudit-platform

# Copy example env files (edit with real values before deploying)
for svc in traefik postgres redis n8n uptime-kuma platform-api hospitality-api orbitone-api touchorbit-api platform-web hospitality-web orbitone-web touchorbit-web; do
  cp infra/$svc/.env.example infra/$svc/.env 2>/dev/null || cp apps/$svc/.env.example apps/$svc/.env 2>/dev/null
done

# Start everything
./infra/scripts/start.sh
```

Services will be available (add to `/etc/hosts` for local dev):
- `http://traefik.localhost:8080` — Traefik dashboard
- `https://n8n.localhost` — n8n
- `https://status.localhost` — Uptime Kuma
- `https://app.localhost` — Platform Web
- `https://hospitality.localhost` — Hospitality Web
- `https://orbitone.localhost` — OrbitOne Web
- `https://touchorbit.localhost` — TouchOrbit HR Web

## How to Deploy

See the full [Deployment Guide](docs/deployment-guide.md) for:
- GitHub Actions setup
- Manual deployment
- Rollbacks
- Maintenance mode
- Health checks

Quick summary:

1. Follow the [Server Hardening Guide](docs/server-hardening.md).
2. Add GitHub secrets: `SSH_PRIVATE_KEY`, `SERVER_IP`, `SERVER_USER`.
3. Add GitHub variable: `DOMAIN`.
4. Push to `master`. GitHub Actions deploys automatically.

## How to Add a New App

See [docs/new-app-guide.md](docs/new-app-guide.md) for a complete checklist.

Minimal template for `infra/myapp/docker-compose.yml`:

```yaml
version: "3.8"

services:
  myapp:
    image: myapp:latest
    container_name: myapp
    restart: unless-stopped
    environment:
      - MYAPP_KEY=${MYAPP_KEY}
    networks:
      - cloudit
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.myapp.rule=Host(`myapp.cloudit.example.com`)"
      - "traefik.http.routers.myapp.entrypoints=websecure"
      - "traefik.http.routers.myapp.tls.certresolver=cloudflare"
      - "traefik.http.services.myapp.loadbalancer.server.port=8080"
    healthcheck:
      test: ["CMD-SHELL", "curl -fsS http://localhost:8080/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 256M

networks:
  cloudit:
    external: true
```

## Backup & Restore

### Create a backup

```bash
BACKUP_PASSPHRASE="your-strong-passphrase" ./infra/backups/backup.sh
```

Backups are stored in `/opt/backups/local/` with 7-day retention.

### Restore from backup

```bash
BACKUP_PASSPHRASE="your-strong-passphrase" ./infra/backups/restore.sh /opt/backups/local/<backup-file>
```

See [docs/backup-restore.md](docs/backup-restore.md) for details.

## Useful Commands

```bash
# Start everything
./infra/scripts/start.sh

# Stop everything
./infra/scripts/stop.sh

# Deploy manually
DOMAIN=cloudit.example.com ./infra/scripts/deploy.sh

# Health checks
DOMAIN=cloudit.example.com ./infra/scripts/health-check.sh

# Maintenance mode
./infra/scripts/maintenance.sh on
./infra/scripts/maintenance.sh off

# View resource usage
docker stats

# View logs
docker logs -f platform-api
docker logs -f traefik

# Restart a single service
cd infra/n8n && docker compose restart
```

## Project Structure

```
cloudit-platform/
├── .github/workflows/
│   ├── deploy.yml              # Production CI/CD
│   └── pr-checks.yml           # PR checks
├── apps/
│   ├── hospitality-api/        # Hospitality OS API
│   ├── hospitality-web/        # Hospitality OS dashboard
│   ├── orbitone-api/           # OrbitOne API
│   ├── orbitone-web/           # OrbitOne dashboard
│   ├── platform-api/           # Core platform API
│   ├── platform-web/           # Platform dashboard
│   ├── touchorbit-api/         # TouchOrbit HR API
│   └── touchorbit-web/         # TouchOrbit HR dashboard
├── docs/
│   ├── architecture.md             # Architecture overview
│   ├── backup-restore.md           # Backup procedures
│   ├── deployment-guide.md         # Deployment procedures
│   ├── disk-management.md          # Cleanup and monitoring
│   ├── environment-setup.md        # Environment variable templates
│   ├── incident-recovery.md        # Incident runbook
│   ├── new-app-guide.md            # Quick checklist for adding an app
│   ├── new-saas-product-guide.md   # Full SaaS onboarding guide
│   ├── routing-examples.md         # Traefik routing patterns
│   ├── security.md                 # Application security
│   ├── server-hardening.md         # Server setup guide
│   └── shared-packages.md          # Shared package usage
├── infra/
│   ├── backups/                # Backup scripts
│   ├── docker-compose.network.yml
│   ├── hospitality-api/        # Hospitality API compose
│   ├── hospitality-web/        # Hospitality Web compose
│   ├── orbitone-api/           # OrbitOne API compose
│   ├── orbitone-web/           # OrbitOne Web compose
│   ├── maintenance/            # Maintenance page compose
│   ├── touchorbit-api/         # TouchOrbit HR API compose
│   └── touchorbit-web/         # TouchOrbit HR Web compose
│   ├── n8n/
│   ├── platform-api/           # Platform API compose
│   ├── platform-web/           # Platform Web compose
│   ├── postgres/
│   ├── redis/
│   ├── scripts/                # deploy.sh, rollback.sh, etc.
│   ├── traefik/
│   └── uptime-kuma/
├── packages/
│   └── ui/                     # Shared UI components
├── .gitignore
├── README.md
└── package.json
```

## Architecture

See [docs/architecture.md](docs/architecture.md) for the full architecture description, resource allocation, and network diagram.

High-level flow:

```
Internet → Cloudflare → Traefik → App services → PostgreSQL / Redis
```

## Documentation

- [Deployment Guide](docs/deployment-guide.md)
- [Server Hardening](docs/server-hardening.md)
- [Security](docs/security.md)
- [Backup & Restore](docs/backup-restore.md)
- [Disk Management](docs/disk-management.md)
- [Incident Recovery](docs/incident-recovery.md)
- [New App Guide](docs/new-app-guide.md)
- [New SaaS Product Onboarding Guide](docs/new-saas-product-guide.md)
- [Architecture](docs/architecture.md)
- [Routing Examples](docs/routing-examples.md)
- [Shared Packages](docs/shared-packages.md)
- [Environment Setup](docs/environment-setup.md)
- [AI & Automation Setup](docs/ai-automation-setup.md)
- [n8n Workflows](docs/n8n-workflows.md)

## Sprint Completion

| Sprint | Status |
|--------|--------|
| Sprint 3 — Shared Frontend Foundation | ✅ Complete |
| Sprint 4 — Hospitality OS MVP | ✅ Complete |
| Sprint 5 — Platform Admin & Multi-tenancy | ✅ Complete |
| Sprint 6 — DevOps, Security & Reliability | ✅ Complete |
| Sprint 7 — Future Product Readiness | ✅ Complete |

> **All sprints complete.** The platform is ready for further product development and deployment.

## Contributing

1. Create a feature branch from `master`.
2. Make changes following the existing app patterns.
3. Run builds and lint for the affected workspaces.
4. Update relevant documentation (`docs/`) and this README if needed.
5. Open a pull request; PR checks must pass before merging.

See [docs/new-saas-product-guide.md](docs/new-saas-product-guide.md) for adding new SaaS products.

## License

MIT — see [LICENSE](LICENSE) (placeholder; add a `LICENSE` file when distributing).
