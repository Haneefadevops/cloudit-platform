# CloudIT Platform — Server Hardening Guide

Target: Ubuntu 22.04/24.04 LTS on Hetzner CX33 (4 vCPU, 8 GB RAM, 80 GB SSD)

## 1. Initial Server Setup

### Create a non-root user

```bash
adduser deploy
usermod -aG sudo deploy
```

### Disable root login & password auth

Edit `/etc/ssh/sshd_config`:

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
PermitEmptyPasswords no
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
```

```bash
sudo systemctl restart sshd
```

## 2. Firewall — UFW

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
sudo ufw status verbose
```

**Do NOT expose PostgreSQL (5432) or Redis (6379) to the internet.**

## 3. Fail2ban

```bash
sudo apt update && sudo apt install -y fail2ban
```

Create `/etc/fail2ban/jail.local`:

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
```

```bash
sudo systemctl enable fail2ban
sudo systemctl restart fail2ban
```

## 4. Automatic Security Updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## 5. Docker Installation

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Add deploy user to docker group
sudo usermod -aG docker deploy
newgrp docker

# Install docker-compose-plugin
sudo apt install -y docker-compose-plugin
```

## 6. Directory Structure on Server

```bash
sudo mkdir -p /opt/cloudit
sudo chown deploy:deploy /opt/cloudit
```

Clone the repo:

```bash
cd /opt/cloudit
git clone https://github.com/YOUR_ORG/cloudit-platform.git .
```

Copy real `.env` files (from a secure source, never commit them):

```bash
for svc in traefik postgres redis n8n uptime-kuma; do
  cp infra/$svc/.env.example infra/$svc/.env
  # Now edit each .env with real values
  nano infra/$svc/.env
done
```

## 7. Application-Level Security

The NestJS APIs enforce the following controls:

- **Rate limiting:** 100 req/min globally; 10 req/min for `POST /api/auth/login`.
- **Helmet headers:** security headers on every response.
- **CORS whitelist:** comma-separated origins in `CORS_ORIGIN` (avoid `*` in production).
- **Input sanitization:** `ValidationPipe` + `XssSanitizationPipe` strip malicious input.
- **JWT authentication** with strong secrets stored in environment variables.

See `docs/security.md` for full details.

## 8. Resource Limits & Disk Management

Docker Compose files under `infra/<service>/` define CPU and memory limits. Log rotation is configured per container (`max-size: 10m`, `max-file: 3`).

Automated maintenance scripts:

- `infra/scripts/cleanup.sh` — weekly prune of unused Docker objects and old logs.
- `infra/scripts/disk-check.sh` — disk-usage monitor that triggers cleanup at 90%.

Example cron:

```cron
# Weekly cleanup
0 4 * * 0 /opt/cloudit/infra/scripts/cleanup.sh >> /var/log/cloudit-cleanup.log 2>&1

# Disk check every 15 minutes
*/15 * * * * /opt/cloudit/infra/scripts/disk-check.sh >> /var/log/cloudit-disk-check.log 2>&1
```

See `docs/disk-management.md` for full details.

## 9. Start the Stack

```bash
cd /opt/cloudit
./infra/scripts/start.sh
```

## 10. Setup Backup Cron

```bash
sudo crontab -e
```

Add:

```
# Daily PostgreSQL backup at 3:00 AM
0 3 * * * BACKUP_PASSPHRASE="your-strong-passphrase" /opt/cloudit/infra/scripts/backup.sh >> /var/log/cloudit-backup.log 2>&1
```

## 11. Monitoring Resource Usage

```bash
# Watch live
docker stats

# Or in a loop
watch -n 5 docker stats --no-stream
```

Expected baseline (idle):
- PostgreSQL: ~100-200 MB
- Redis: ~50-100 MB
- n8n: ~200-400 MB
- Uptime Kuma: ~100-200 MB
- Traefik: ~50-100 MB
- **Total idle: ~600 MB - 1 GB**

## 12. Hardening Checklist

- [ ] SSH keys only (no passwords)
- [ ] Root login disabled
- [ ] UFW active, only 22/80/443 open
- [ ] Fail2ban running
- [ ] Automatic security updates enabled
- [ ] Docker non-root user (deploy in docker group)
- [ ] No secrets in git (`.env` files in `.gitignore`)
- [ ] PostgreSQL & Redis not exposed to internet
- [ ] Backups encrypted and rotated
- [ ] Traefik dashboard protected by Basic Auth
- [ ] Rate limiting active on APIs
- [ ] Helmet security headers present
- [ ] CORS whitelist enforced in production
- [ ] Input sanitization active
- [ ] Docker resource limits configured
- [ ] Weekly cleanup cron scheduled
- [ ] Disk-check cron scheduled
