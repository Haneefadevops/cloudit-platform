# Backup & Restore Guide

This guide covers backing up and restoring CloudIT platform data.

## Overview

Backup scripts live in `infra/backups/`:

- `backup.sh` — creates encrypted, compressed backups of PostgreSQL, Redis, n8n, and Uptime Kuma.
- `restore.sh` — restores a backup archive.
- `sync-hetzner.sh` — optional off-site sync to Hetzner Storage Box.
- `docker-compose.yml` — Docker service definitions for running backups manually.

Backups are stored locally at `/opt/backups/local/` by default and logs at `/var/log/cloudit-backup.log`.

---

## Configuration

1. Copy the example environment file:

```bash
cd infra/backups
cp .env.example .env
```

2. Edit `.env` with real credentials:

```bash
POSTGRES_USER=cloudit
POSTGRES_PASSWORD=changeme
REDIS_PASSWORD=changeme
BACKUP_ENCRYPTION_KEY=your-very-strong-random-passphrase
BACKUP_DIR=/opt/backups/local
LOG_FILE=/var/log/cloudit-backup.log
BACKUP_RETENTION_DAYS=7
```

3. Make the scripts executable:

```bash
chmod +x backup.sh restore.sh sync-hetzner.sh
```

---

## Running a Backup Manually

### Option A: On the Docker host (recommended for cron)

```bash
cd infra/backups
sudo ./backup.sh
```

The script will:
- Dump all PostgreSQL databases.
- Export a Redis RDB snapshot (or skip if Redis is cache-only).
- Back up the n8n and Uptime Kuma Docker volumes.
- Compress everything into a `tar.gz` archive.
- Encrypt the archive with GPG if `BACKUP_ENCRYPTION_KEY` is set.
- Delete backups older than 7 days.

### Option B: Using Docker Compose

```bash
cd infra/backups
docker compose up backup
```

---

## Scheduling Backups with Cron

Edit the root crontab:

```bash
sudo crontab -e
```

Add a daily backup at 2 AM:

```cron
0 2 * * * /opt/cloudit/infra/backups/backup.sh >> /var/log/cloudit-backup-cron.log 2>&1
```

Make sure the script path and `.env` file location match your deployment.

---

## Restoring from a Backup

1. List available backups:

```bash
ls -la /opt/backups/local/
```

2. Run the restore script:

```bash
cd infra/backups
sudo ./restore.sh /opt/backups/local/cloudit-backup-20260628-020000.tar.gz.gpg
```

The script will:
- Decrypt the archive if it has a `.gpg` extension.
- Extract the archive.
- Restore PostgreSQL databases.
- Restore Redis, n8n, and Uptime Kuma volumes where applicable.
- Verify PostgreSQL connectivity.

3. Restart services if needed:

```bash
cd infra/n8n && docker compose restart
cd infra/uptime-kuma && docker compose restart
cd infra/redis && docker compose restart
```

---

## Hetzner Storage Box Sync

Off-site sync is optional and can be enabled once you have a Hetzner Storage Box.

### Using rclone (recommended)

1. Install rclone and create a configuration:

```bash
rclone config
```

Name the remote `hetzner` and configure SFTP with your Storage Box credentials.

2. Place the rclone config at `infra/backups/rclone.conf`:

```bash
cp ~/.config/rclone/rclone.conf infra/backups/rclone.conf
```

3. Add to `.env`:

```bash
HETZNER_STORAGE_BOX=backups
```

4. Run the sync:

```bash
cd infra/backups
docker compose --profile sync up sync-hetzner
```

### Using rsync over SSH

1. Add the Storage Box URL to `.env`:

```bash
HETZNER_RSYNC_URL=u12345@u12345.your-storagebox.de:backups
```

2. Run the sync:

```bash
./sync-hetzner.sh
```

---

## Testing the Restore Procedure

Before relying on backups in production, test a full restore in a non-production environment:

1. Spin up a fresh server or VM with the CloudIT Docker stack.
2. Copy a recent backup to `/opt/backups/local/`.
3. Run `restore.sh` with the backup file.
4. Verify:
   - PostgreSQL databases are accessible and contain expected data.
   - n8n workflows are present.
   - Uptime Kuma monitors are present.
   - Applications start and serve traffic correctly.

Schedule this test periodically (e.g. monthly).

---

## Backup Retention

The backup script keeps the last 7 days of backups by default. Change `BACKUP_RETENTION_DAYS` to adjust.

---

## Security Notes

- Keep `BACKUP_ENCRYPTION_KEY` safe and separate from the server. Without it, encrypted backups cannot be restored.
- Do not commit `.env` or `rclone.conf` to Git.
- Restrict access to `/opt/backups/local/` and `/var/log/cloudit-backup.log` to root only.
- Rotate the encryption key periodically and re-backup old archives if needed.
