# CloudIT Platform — Disk Management Guide

This guide covers log rotation, cleanup automation, disk monitoring, and Docker resource limits.

## 1. Docker Logging Limits

Every service compose file already limits log size to prevent disks from filling:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

This caps each container to roughly 30 MB of logs.

## 2. Resource Limits

CPU and memory limits are configured in the Docker Compose files:

| Service       | CPU limit | Memory limit | Memory reservation |
|---------------|-----------|--------------|--------------------|
| postgres      | —         | 512 MB       | 128 MB             |
| redis         | —         | 384 MB       | 64 MB              |
| traefik       | 0.5       | 256 MB       | 64 MB              |
| n8n           | 1.0       | 1 GB         | 256 MB             |
| uptime-kuma   | 0.5       | 512 MB       | 128 MB             |
| backup        | 0.5       | 512 MB       | 128 MB             |
| sync-hetzner  | 0.25      | 256 MB       | 64 MB              |

Adjust these values in the relevant `infra/<service>/docker-compose.yml` files to match your server size.

## 3. Cleanup Script

`infra/scripts/cleanup.sh` performs safe housekeeping:

- Prunes unused Docker objects older than `DOCKER_PRUNE_UNTIL` (default 7 days, volumes excluded).
- Removes CloudIT logs older than `LOG_RETENTION_DAYS` (default 14 days).
- Vacuums the systemd journal to `JOURNAL_VACUUM` (default 7 days).
- Removes old core dumps and temporary files.
- Optionally cleans the npm cache.

Run manually:

```bash
/opt/cloudit/infra/scripts/cleanup.sh
```

Preview what it would do with a dry run:

```bash
DRY_RUN=true /opt/cloudit/infra/scripts/cleanup.sh
```

### Cron schedule

```bash
sudo crontab -e
```

```cron
# Weekly cleanup on Sunday at 04:00
0 4 * * 0 /opt/cloudit/infra/scripts/cleanup.sh >> /var/log/cloudit-cleanup.log 2>&1
```

## 4. Disk Check Script

`infra/scripts/disk-check.sh` monitors disk usage for `/`, `/opt/backups`, `/var/log`, and `/var/lib/docker`.

Default thresholds:

- **Warning:** 80% full
- **Critical:** 90% full

When critical, the script automatically triggers `cleanup.sh` and then re-checks usage.

Run manually:

```bash
/opt/cloudit/infra/scripts/disk-check.sh
```

### Cron schedule

```bash
sudo crontab -e
```

```cron
# Disk check every 15 minutes
*/15 * * * * /opt/cloudit/infra/scripts/disk-check.sh >> /var/log/cloudit-disk-check.log 2>&1
```

## 5. Backup Retention

Backups are rotated by `infra/backups/backup.sh` according to `BACKUP_RETENTION_DAYS` (default 7). Keep local backup storage under `/opt/backups/local` below 70% capacity; use the Hetzner sync script for off-site copies.

## 6. Alerting Integration

For production environments, extend `disk-check.sh` to send alerts when it exits with code `1` (warning) or `2` (critical):

- Uptime Kuma push monitor
- n8n webhook → email/Slack/WhatsApp
- `mailx` or `sendmail`

## 7. Quick Checklist

- [ ] Docker log limits are set on every service.
- [ ] Memory/CPU limits match the server capacity.
- [ ] `cleanup.sh` runs weekly via cron.
- [ ] `disk-check.sh` runs every 15 minutes via cron.
- [ ] Backup retention keeps local disk usage healthy.
- [ ] Alerts are wired to warnings/critical events.
