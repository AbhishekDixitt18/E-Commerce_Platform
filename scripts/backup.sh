#!/usr/bin/env bash
# =============================================================================
# E-Commerce Platform PostgreSQL Database Backup Utility
# Generates timestamped, compressed, and integrity-verified backups using pg_dump.
# Protects credentials and applies least-privilege file permissions (0600).
# =============================================================================

set -eo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_pass()  { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_fail()  { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# Load configuration securely from .env if present
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    # Source .env safely ignoring comments and blank lines
    # shellcheck disable=SC1091
    source "$PROJECT_ROOT/.env"
    set +a
fi

# Database parameters with safe fallbacks
DB_NAME="${DB_NAME:-ecommerce_prod}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"

BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_FILENAME="${DB_NAME}_backup_${TIMESTAMP}.sql.gz"
BACKUP_FILEPATH="$BACKUP_DIR/$BACKUP_FILENAME"

echo "============================================================================="
echo "   PostgreSQL Automated Database Backup Utility"
echo "   Target Database:  $DB_NAME"
echo "   Timestamp:        $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "   Backup Directory: $BACKUP_DIR"
echo "============================================================================="

# -----------------------------------------------------------------------------
# 1. Detect Docker Container or Local Database Instance
# -----------------------------------------------------------------------------
PG_CONTAINER=""
if command -v docker &>/dev/null; then
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^ecommerce-postgres-prod$"; then
        PG_CONTAINER="ecommerce-postgres-prod"
    elif docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^ecommerce-postgres$"; then
        PG_CONTAINER="ecommerce-postgres"
    fi
fi

if [ -n "$PG_CONTAINER" ]; then
    log_info "Detected active Docker PostgreSQL container: $PG_CONTAINER"
    
    # Verify database readiness via docker exec
    if ! docker exec "$PG_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" &>/dev/null; then
        log_fail "PostgreSQL in container '$PG_CONTAINER' is not ready or database '$DB_NAME' is unreachable."
        exit 2
    fi

    log_info "Executing pg_dump stream from container '$PG_CONTAINER'..."
    
    # Execute pg_dump inside container and pipe through gzip to host backup file
    # Uses --clean --if-exists --no-owner --no-privileges for universal restoration
    if ! docker exec -e PGPASSWORD="$DB_PASSWORD" "$PG_CONTAINER" \
        pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner --no-privileges | gzip -9 > "$BACKUP_FILEPATH"; then
        log_fail "pg_dump failed during execution in container."
        rm -f "$BACKUP_FILEPATH"
        exit 3
    fi

elif command -v pg_dump &>/dev/null; then
    log_info "Using host pg_dump client to target $DB_HOST:$DB_PORT/$DB_NAME..."
    
    if ! PGPASSWORD="$DB_PASSWORD" pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" &>/dev/null; then
        log_fail "Cannot connect to PostgreSQL at $DB_HOST:$DB_PORT/$DB_NAME."
        exit 2
    fi

    if ! PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --clean --if-exists --no-owner --no-privileges | gzip -9 > "$BACKUP_FILEPATH"; then
        log_fail "pg_dump failed during execution on host."
        rm -f "$BACKUP_FILEPATH"
        exit 3
    fi
else
    log_fail "Neither Docker PostgreSQL container nor host 'pg_dump' utility found."
    exit 1
fi

# -----------------------------------------------------------------------------
# 2. Backup Integrity Verification
# -----------------------------------------------------------------------------
log_info "Verifying backup file integrity..."

if [ ! -f "$BACKUP_FILEPATH" ]; then
    log_fail "Backup file was not created: $BACKUP_FILEPATH"
    exit 4
fi

FILE_SIZE=$(wc -c < "$BACKUP_FILEPATH" | tr -d ' ')
if [ "$FILE_SIZE" -le 100 ]; then
    log_fail "Backup file is suspiciously small or empty (${FILE_SIZE} bytes). Aborting."
    rm -f "$BACKUP_FILEPATH"
    exit 4
fi

# Test gzip integrity
if ! gzip -t "$BACKUP_FILEPATH" 2>/dev/null; then
    log_fail "Gzip integrity check failed! The backup file is corrupted."
    rm -f "$BACKUP_FILEPATH"
    exit 4
fi

# Apply strict security permissions: readable only by file owner (0600)
chmod 600 "$BACKUP_FILEPATH"

# Calculate SHA256 checksum
CHECKSUM="N/A"
if command -v sha256sum &>/dev/null; then
    CHECKSUM=$(sha256sum "$BACKUP_FILEPATH" | awk '{print $1}')
elif command -v shasum &>/dev/null; then
    CHECKSUM=$(shasum -a 256 "$BACKUP_FILEPATH" | awk '{print $1}')
fi

HUMAN_SIZE=$(du -h "$BACKUP_FILEPATH" | awk '{print $1}')

echo "-----------------------------------------------------------------------------"
log_pass "Backup completed and verified successfully!"
echo "  File:     $BACKUP_FILEPATH"
echo "  Size:     $HUMAN_SIZE ($FILE_SIZE bytes)"
echo "  SHA256:   $CHECKSUM"
echo "  Security: File permissions set to 0600 (owner-only access)"
echo "============================================================================="

# Echo path for downstream automation pipelines
echo "$BACKUP_FILEPATH" > "$BACKUP_DIR/latest_backup_path.txt"
exit 0
