#!/bin/bash
set -euo pipefail

# Restore PostgreSQL from a backup file.
# Usage: ./restore.sh <path-to-backup-file>

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/infra/postgres/.env"
BACKUP_PASSPHRASE="${BACKUP_PASSPHRASE:-}"

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <path-to-backup-file>"
    echo ""
    echo "Examples:"
    echo "  $0 ../backups/postgres_backup_20240115_030000.sql.gz.gpg"
    echo "  BACKUP_PASSPHRASE='mysecret' $0 ../backups/postgres_backup_20240115_030000.sql.gz.gpg"
    exit 1
fi

BACKUP_FILE="$1"

if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "[restore] ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Load env
if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "$ENV_FILE"
    set +a
fi

CONTAINER_NAME="postgres"

echo "[restore] WARNING: This will OVERWRITE the current database!"
read -rp "Are you sure? Type 'yes' to continue: " CONFIRM

if [[ "$CONFIRM" != "yes" ]]; then
    echo "[restore] Aborted."
    exit 0
fi

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "[restore] ERROR: PostgreSQL container '${CONTAINER_NAME}' is not running!"
    exit 1
fi

echo "[restore] Restoring from: $BACKUP_FILE"

if [[ "$BACKUP_FILE" == *.gpg ]]; then
    if [[ -z "$BACKUP_PASSPHRASE" ]]; then
        read -rsp "Enter backup passphrase: " BACKUP_PASSPHRASE
        echo ""
    fi
    gpg --decrypt --passphrase "$BACKUP_PASSPHRASE" --batch --yes "$BACKUP_FILE" \
        | gunzip \
        | docker exec -i "$CONTAINER_NAME" psql -U "${POSTGRES_USER:-cloudit}" -d postgres
else
    gunzip -c "$BACKUP_FILE" \
        | docker exec -i "$CONTAINER_NAME" psql -U "${POSTGRES_USER:-cloudit}" -d postgres
fi

echo "[restore] Restore completed at $(date)."
