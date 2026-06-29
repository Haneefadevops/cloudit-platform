# CloudIT Platform — Architecture

## Overview

CloudIT Platform is a lightweight, self-hosted multi-tenant SaaS platform running on a single Hetzner CX33 server, orchestrated with Docker and Docker Compose.

## Server

- **Provider:** Hetzner
- **Model:** CX33
- **Specs:** 4 vCPU, 8 GB RAM, 80 GB SSD
- **OS:** Ubuntu 24.04 LTS
- **Container runtime:** Docker + Docker Compose
- **Location:** `C:\Project\cloudit-platform` (local development), `/opt/cloudit/cloudit-platform` (server)

## Network Diagram

```
                         Internet
                            |
                    Cloudflare DNS + Proxy
                            |
                          80 / 443
                            |
                       +-----------+
                       |  Traefik  |  Reverse proxy, SSL termination
                       +-----------+
                            |
        +-------------------+-------------------+
        |                   |                   |
   +---------+        +-----------+      +-------------+
   | n8n     |        | Uptime    |      | App services|
   | 5678    |        | Kuma      |      | (API + Web) |
   +---------+        +-----------+      +-------------+
                                                |
                                       +--------+--------+
                                       |                 |
                                  +---------+      +---------+
                                  | Postgres|      |  Redis  |
                                  | 5432    |      | 6379    |
                                  +---------+      +---------+
```

## Services

| Service | Purpose | Public | Memory Limit |
|---------|---------|--------|--------------|
| Traefik | Reverse proxy, HTTPS, Let's Encrypt | Yes (80/443) | 256 MB |
| PostgreSQL | Primary database | No | 1 GB |
| Redis | Cache, sessions, n8n queue | No | 512 MB |
| n8n | Workflow automation | Yes | 1 GB |
| Uptime Kuma | Monitoring & status pages | Yes | 512 MB |
| Platform API | Auth, users, organizations, events | Yes | 1 GB |
| Hospitality API | Hospitality OS backend | Yes | 1 GB |
| OrbitOne API | Digital business cards backend | Yes | 1 GB |
| TouchOrbit HR API | HR management backend | Yes | 1 GB |
| Platform Web | Platform dashboard | Yes | 512 MB |
| Hospitality Web | Hospitality dashboard | Yes | 512 MB |
| OrbitOne Web | Digital business cards dashboard | Yes | 512 MB |
| TouchOrbit HR Web | HR management dashboard | Yes | 512 MB |

## Resource Allocation

Total reserved memory for Docker services is kept under ~6.5 GB to leave room for the OS and spikes.

| Service | Limit | Reservation |
|---------|-------|-------------|
| postgres | 1 GB | 256 MB |
| redis | 512 MB | 128 MB |
| traefik | 256 MB | 64 MB |
| n8n | 1 GB | 256 MB |
| uptime-kuma | 512 MB | 128 MB |
| platform-api | 1 GB | 256 MB |
| hospitality-api | 1 GB | 256 MB |
| orbitone-api | 1 GB | 256 MB |
| touchorbit-api | 1 GB | 256 MB |
| platform-web | 512 MB | 128 MB |
| hospitality-web | 512 MB | 128 MB |
| orbitone-web | 512 MB | 128 MB |
| touchorbit-web | 512 MB | 128 MB |

## Docker Networking

All services connect to the external `cloudit` bridge network. This allows containers to reach each other by container name and keeps the database/cache off the public internet.

## Shared Packages

- `@cloudit/ui` — reusable React + Tailwind components
- `@cloudit/auth` — planned shared authentication helpers
- `@cloudit/database` — planned shared Prisma/connection helpers
- `@cloudit/config` — planned shared environment/configuration utilities

## Domains

| App | Domain |
|-----|--------|
| Traefik Dashboard | `traefik.<DOMAIN>` |
| n8n | `n8n.<DOMAIN>` |
| Uptime Kuma | `status.<DOMAIN>` |
| Platform Web | `app.<DOMAIN>` |
| Platform API | `api-platform.<DOMAIN>` |
| Hospitality Web | `hospitality.<DOMAIN>` |
| Hospitality API | `api-hospitality.<DOMAIN>` |
| OrbitOne Web | `orbitone.<DOMAIN>` |
| OrbitOne API | `api-orbitone.<DOMAIN>` |
| TouchOrbit HR Web | `touchorbit.<DOMAIN>` |
| TouchOrbit HR API | `api-touchorbit.<DOMAIN>` |

## Deployment

Pushes to `master` trigger GitHub Actions, which SSH into the server and run `infra/scripts/deploy.sh`. The script applies migrations, builds images, starts services, and runs health checks. Failed deployments trigger automatic rollback.

## Backups

Daily encrypted backups run via cron using `infra/backups/backup.sh`. Backups include PostgreSQL, Redis, n8n, and Uptime Kuma data. Local retention is 7 days. Off-site sync to Hetzner Storage Box is optional.
