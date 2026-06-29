# CloudIT Platform — Incident Recovery Guide

This guide covers common production incidents and step-by-step recovery procedures.

## 1. Database Connection Failure

### Symptoms
- API health check reports `database: error`
- Apps return HTTP 500 with database errors
- PostgreSQL container not running

### Recovery

1. Check container status:
   ```bash
   docker ps
   docker logs postgres
   ```
2. If stopped, start it:
   ```bash
   cd infra/postgres && docker compose up -d
   ```
3. Verify connectivity:
   ```bash
   docker exec -it postgres pg_isready -U cloudit
   ```
4. If the database is corrupt, restore from the latest backup:
   ```bash
   BACKUP_PASSPHRASE="your-passphrase" ./infra/scripts/restore.sh /opt/backups/local/<backup-file>
   ```
5. Re-run migrations if needed:
   ```bash
   ./infra/scripts/predeploy.sh
   ```

## 2. Redis Failure

### Symptoms
- Health check reports `redis: error`
- n8n queue stops processing
- Sessions/cache errors

### Recovery

1. Check Redis:
   ```bash
   docker logs redis
   docker exec -it redis redis-cli ping
   ```
2. Restart Redis:
   ```bash
   cd infra/redis && docker compose restart
   ```
3. If Redis data is lost, it should rebuild from cache misses. Verify n8n reconnects.

## 3. Disk Full

### Symptoms
- Health check reports `disk: error`
- PostgreSQL cannot write
- Docker build fails

### Recovery

1. Check disk usage:
   ```bash
   df -h
   ```
2. Run cleanup:
   ```bash
   ./infra/scripts/cleanup.sh
   ```
3. If still full, identify large directories:
   ```bash
   du -sh /opt/backups/local /var/lib/docker /var/log
   ```
4. Manually remove old backups or logs if safe.
5. Investigate recurring cause and adjust retention.

## 4. Memory Exhaustion

### Symptoms
- Server becomes slow or unresponsive
- Containers killed by OOM
- `docker ps` shows containers restarting

### Recovery

1. Check memory:
   ```bash
   free -h
   docker stats --no-stream
   ```
2. Identify the heaviest container and restart it:
   ```bash
   docker restart <container>
   ```
3. If resource limits are too tight, edit the relevant `docker-compose.yml` and redeploy.
4. Consider scaling up the server or splitting services.

## 5. SSL Certificate Expiry

### Symptoms
- Browsers show certificate warnings
- Traefik logs show ACME errors

### Recovery

1. Check certificate status in Traefik dashboard.
2. Verify DNS records point to the server.
3. Restart Traefik to force renewal:
   ```bash
   cd infra/traefik && docker compose restart
   ```
4. If Cloudflare token expired, update `CF_API_EMAIL` / `CF_API_KEY` in `infra/traefik/.env`.
5. Check `/letsencrypt/acme.json` permissions.

## 6. Deployment Failure

### Symptoms
- GitHub Actions deploy job failed
- New code not live
- Health checks failing after deploy

### Recovery

1. Check the GitHub Actions log.
2. SSH to the server and view the deploy log:
   ```bash
   tail -f /var/log/cloudit-deploy.log
   ```
3. If health checks failed, GitHub Actions should have run rollback automatically. Verify:
   ```bash
   docker ps
   ./infra/scripts/health-check.sh
   ```
4. If rollback did not trigger or failed, run it manually:
   ```bash
   ./infra/scripts/rollback.sh
   ```
5. To deploy a fix, push a new commit to `master`.

## 7. Migration Failure

### Symptoms
- `predeploy.sh` exits with an error
- Prisma migrate fails

### Recovery

1. Check the migration error:
   ```bash
   cd apps/platform-api && npx prisma migrate status
   ```
2. If a migration is partially applied, resolve manually in a safe maintenance window.
3. For drift, baseline if necessary:
   ```bash
   npx prisma migrate resolve --applied <migration_name>
   ```
4. Never modify already-applied migrations. Add a new migration to fix.

## 8. Maintenance Mode Stuck

### Symptoms
- Maintenance page remains visible after `maintenance.sh off`

### Recovery

1. Stop the maintenance container:
   ```bash
   cd infra/maintenance && docker compose down
   ```
2. Start app services:
   ```bash
   ./infra/scripts/deploy.sh
   ```
3. Verify endpoints:
   ```bash
   ./infra/scripts/health-check.sh
   ```

## Escalation

- **Server provider:** Hetzner
- **Domain/DNS:** Cloudflare
- **Repository:** https://github.com/Haneefadevops/cloudit-platform.git
- **On-call contact:** *(placeholder — update with real contacts)*

## Post-Incident Checklist

- [ ] Incident root cause documented
- [ ] Fix applied and deployed
- [ ] Health checks pass
- [ ] Monitoring alerts reviewed
- [ ] Runbook updated if needed
