#!/bin/bash
set -euo pipefail

# Daily encrypted PostgreSQL backup with 7-day retention.
# Run via cron: 0 3 * * * /opt/cloudit/infra/scripts/backup.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BACKUP_DIR="${PROJECT_ROOT}/infra/backups"
ENV_FILE="${PROJECT_ROOT}/infra/postgres/.env"

# Encryption passphrase (set in environment or .env)
BACKUP_PASSPHRASE="${BACKUP_PASSPHRASE:-}"
RETENTION_DAYS=7

# Timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/postgres_backup_${TIMESTAMP}.sql.gz.gpg"

echo "[backup] Starting PostgreSQL backup at $(date)"

# Load env
if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "$ENV_FILE"
    set +a
fi

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Check passphrase
if [[ -z "$BACKUP_PASSPHRASE" ]]; then
    echo "[backup] WARNING: BACKUP_PASSPHRASE not set — backup will NOT be encrypted!"
    BACKUP_FILE="${BACKUP_DIR}/postgres_backup_${TIMESTAMP}.sql.gz"
fi

# Run pg_dump from the running postgres container
CONTAINER_NAME="postgres"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "[backup] ERROR: PostgreSQL container '${CONTAINER_NAME}' is not running!"
    exit 1
fi

if [[ -n "$BACKUP_PASSPHRASE" ]]; then
    docker exec -i "$CONTAINER_NAME" pg_dumpall -U "${POSTGRES_USER:-cloudit}" \
        | gzip \
        | gpg --symmetric --cipher-algo AES256 --compress-algo 0 --passphrase "$BACKUP_PASSPHRASE" --batch --yes -o "$BACKUP_FILE"
    echo "[backup] Encrypted backup created: $BACKUP_FILE"
else
    docker exec -i "$CONTAINER_NAME" pg_dumpall -U "${POSTGRES_USER:-cloudit}" \
        | gzip > "$BACKUP_FILE"
    echo "[backup] Unencrypted backup created: $BACKUP_FILE"
fi

# Cleanup old backups
echo "[backup] Removing backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -type f -name "postgres_backup_*.sql.gz*" -mtime +${RETENTION_DAYS} -delete

echo "[backup] Done at $(date). Current backups:"
ls -lh "$BACKUP_DIR"
