# CloudIT Platform

Lightweight self-hosted platform running on a single Hetzner CX33 server (4 vCPU, 8 GB RAM).

## What's Inside

| Service | Purpose | Public? |
|---------|---------|---------|
| **Traefik** | Reverse proxy, HTTPS, Let's Encrypt | Yes (80/443) |
| **PostgreSQL** | Primary database | No |
| **Redis** | Caching, n8n queue | No |
| **n8n** | Workflow automation | Yes |
| **Uptime Kuma** | Monitoring & status pages | Yes |

## Quick Start (Local)

```bash
git clone https://github.com/YOUR_ORG/cloudit-platform.git
cd cloudit-platform

# Copy example env files (edit with real values before deploying)
for svc in traefik postgres redis n8n uptime-kuma; do
  cp infra/$svc/.env.example infra/$svc/.env
done

# Start everything
./infra/scripts/start.sh
```

Services will be available (add to `/etc/hosts` for local dev):
- `http://traefik.localhost:8080` — Traefik dashboard
- `https://n8n.localhost` — n8n
- `https://status.localhost` — Uptime Kuma

## How to Deploy

### 1. Server Setup

Follow the [Server Hardening Guide](docs/server-hardening.md) to configure your Hetzner server.

### 2. GitHub Actions Secrets

Add these secrets to your GitHub repo (`Settings → Secrets and variables → Actions`):

| Secret | Description |
|--------|-------------|
| `SSH_PRIVATE_KEY` | Private key for the `deploy` user on the server |
| `SERVER_IP` | Your Hetzner server IP |
| `SERVER_USER` | Usually `deploy` |

Add this variable:

| Variable | Description |
|----------|-------------|
| `DOMAIN` | Your root domain, e.g. `cloudit.example.com` |

### 3. Push to Main

```bash
git push origin main
```

GitHub Actions will deploy automatically.

### 4. DNS Setup

Point these A/AAAA records to your server IP:

```
traefik.cloudit.example.com  →  YOUR_SERVER_IP
n8n.cloudit.example.com      →  YOUR_SERVER_IP
status.cloudit.example.com   →  YOUR_SERVER_IP
```

## How to Add a New App

1. **Create a folder**: `mkdir infra/myapp`
2. **Add `.env.example`**: Document all required env vars
3. **Add `docker-compose.yml`**:
   - Connect to the `cloudit` external network
   - Add Traefik labels for routing
   - Set `restart: unless-stopped` and resource limits
   - Add a healthcheck
4. **Update `start.sh`** to include your new service
5. **Update README** with your app's domain

### Minimal docker-compose template:

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
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/health"]
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
BACKUP_PASSPHRASE="your-strong-passphrase" ./infra/scripts/backup.sh
```

Backups are stored in `infra/backups/` with 7-day retention.

### Restore from backup

```bash
BACKUP_PASSPHRASE="your-strong-passphrase" ./infra/scripts/restore.sh infra/backups/postgres_backup_YYYYMMDD_HHMMSS.sql.gz.gpg
```

## Useful Commands

```bash
# Start everything
./infra/scripts/start.sh

# Stop everything
./infra/scripts/stop.sh

# View resource usage
docker stats

# View logs
docker logs -f traefik
docker logs -f n8n
docker logs -f postgres

# Restart a single service
cd infra/n8n && docker-compose restart
```

## Project Structure

```
cloudit-platform/
├── .github/workflows/
│   └── deploy.yml              # GitHub Actions CI/CD
├── docs/
│   └── server-hardening.md     # Server setup guide
├── infra/
│   ├── backups/                # Backup storage
│   ├── docker-compose.network.yml  # Shared Docker network
│   ├── n8n/
│   │   ├── .env.example
│   │   └── docker-compose.yml
│   ├── postgres/
│   │   ├── .env.example
│   │   ├── docker-compose.yml
│   │   └── init/
│   ├── redis/
│   │   ├── .env.example
│   │   └── docker-compose.yml
│   ├── scripts/
│   │   ├── backup.sh
│   │   ├── restore.sh
│   │   ├── start.sh
│   │   └── stop.sh
│   ├── traefik/
│   │   ├── .env.example
│   │   ├── docker-compose.yml
│   │   ├── traefik.yml
│   │   └── dynamic/
│   │       └── middlewares.yml
│   └── uptime-kuma/
│       ├── .env.example
│       └── docker-compose.yml
├── .gitignore
└── README.md
```

## License

MIT
