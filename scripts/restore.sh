#!/usr/bin/env bash
# =============================================================================
# E-Commerce Platform PostgreSQL Database Restore Utility
# Safely restores timestamped backups into target or isolated test environments.
# Enforces strict safety gates preventing accidental production overwrites.
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
    # shellcheck disable=SC1091
    source "$PROJECT_ROOT/.env"
    set +a
fi

DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
PROD_DB_NAME="${DB_NAME:-ecommerce_prod}"

# -----------------------------------------------------------------------------
# 1. Parse Arguments & Validate Input File
# -----------------------------------------------------------------------------
BACKUP_FILE="${1:-}"
TARGET_DB="${2:-ecommerce_restore_test}"
CONFIRM_FLAG="${3:-}"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <path_to_backup_file> [target_database_name] [--confirm-production]"
    echo ""
    echo "Examples:"
    echo "  # Safe isolated test restore (Default target: ecommerce_restore_test):"
    echo "  $0 backups/ecommerce_prod_backup_20261115_120000.sql.gz"
    echo ""
    echo "  # Explicit test database restore:"
    echo "  $0 backups/ecommerce_prod_backup_20261115_120000.sql.gz my_staging_db"
    echo ""
    echo "  # Production restore (Requires confirmation flag):"
    echo "  $0 backups/ecommerce_prod_backup_20261115_120000.sql.gz ecommerce_prod --confirm-production"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    log_fail "Specified backup file does not exist: $BACKUP_FILE"
    exit 1
fi

FILE_SIZE=$(wc -c < "$BACKUP_FILE" | tr -d ' ')
if [ "$FILE_SIZE" -le 100 ]; then
    log_fail "Backup file is empty or invalid (${FILE_SIZE} bytes): $BACKUP_FILE"
    exit 1
fi

echo "============================================================================="
echo "   PostgreSQL Database Restore Utility"
echo "   Source Backup:    $BACKUP_FILE"
echo "   Target Database:  $TARGET_DB"
echo "   Timestamp:        $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "============================================================================="

# -----------------------------------------------------------------------------
# 2. Production Overwrite Safety Gate
# -----------------------------------------------------------------------------
if [ "$TARGET_DB" == "$PROD_DB_NAME" ] || [ "$TARGET_DB" == "ecommerce_prod" ] || [ "$TARGET_DB" == "ecommerce_production" ]; then
    echo ""
    echo -e "${RED}!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!${NC}"
    echo -e "${RED}   CRITICAL SAFETY WARNING: YOU ARE ATTEMPTING TO RESTORE OVER PRODUCTION!  ${NC}"
    echo -e "${RED}   Target Database: $TARGET_DB                                              ${NC}"
    echo -e "${RED}   All existing production tables, orders, and audits will be REPLACED!     ${NC}"
    echo -e "${RED}!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!${NC}"
    echo ""

    if [ "$CONFIRM_FLAG" == "--confirm-production" ]; then
        log_warn "Production overwrite confirmed via CLI flag '--confirm-production'."
    else
        # If running interactively in terminal, require typed phrase
        if [ -t 0 ]; then
            read -r -p "Type 'OVERWRITE_PRODUCTION' to proceed with production restore: " CONFIRM_INPUT
            if [ "$CONFIRM_INPUT" != "OVERWRITE_PRODUCTION" ]; then
                log_fail "Confirmation phrase did not match. Aborting production restore operation."
                exit 1
            fi
        else
            log_fail "Non-interactive shell detected. To overwrite production, you MUST provide '--confirm-production' as the 3rd argument."
            exit 1
        fi
    fi
else
    log_info "Target '$TARGET_DB' is an isolated non-production environment. Proceeding safely."
fi

# -----------------------------------------------------------------------------
# 3. Detect PostgreSQL Environment
# -----------------------------------------------------------------------------
PG_CONTAINER=""
if command -v docker &>/dev/null; then
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^ecommerce-postgres-prod$"; then
        PG_CONTAINER="ecommerce-postgres-prod"
    elif docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^ecommerce-postgres$"; then
        PG_CONTAINER="ecommerce-postgres"
    fi
fi

# -----------------------------------------------------------------------------
# 4. Ensure Target Database Exists
# -----------------------------------------------------------------------------
log_info "Ensuring target database '$TARGET_DB' exists..."

if [ -n "$PG_CONTAINER" ]; then
    # Check if target database exists; if not, create it
    DB_EXISTS=$(docker exec -e PGPASSWORD="$DB_PASSWORD" "$PG_CONTAINER" \
        psql -U "$DB_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$TARGET_DB'" || echo "0")
    
    if [ "$DB_EXISTS" != "1" ]; then
        log_info "Database '$TARGET_DB' does not exist. Creating database..."
        docker exec -e PGPASSWORD="$DB_PASSWORD" "$PG_CONTAINER" \
            psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $TARGET_DB OWNER $DB_USER;" > /dev/null
        log_pass "Created isolated database '$TARGET_DB'."
    fi
else
    DB_EXISTS=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
        -tAc "SELECT 1 FROM pg_database WHERE datname='$TARGET_DB'" || echo "0")
    
    if [ "$DB_EXISTS" != "1" ]; then
        log_info "Database '$TARGET_DB' does not exist. Creating database..."
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
            -c "CREATE DATABASE $TARGET_DB OWNER $DB_USER;" > /dev/null
        log_pass "Created isolated database '$TARGET_DB'."
    fi
fi

# -----------------------------------------------------------------------------
# 5. Restore Database Stream
# -----------------------------------------------------------------------------
log_info "Streaming backup into target database '$TARGET_DB'..."

RESTORE_START=$(date +%s)

if [ -n "$PG_CONTAINER" ]; then
    if [[ "$BACKUP_FILE" =~ \.gz$ ]]; then
        gunzip -c "$BACKUP_FILE" | docker exec -i -e PGPASSWORD="$DB_PASSWORD" "$PG_CONTAINER" \
            psql -U "$DB_USER" -d "$TARGET_DB" --quiet -v ON_ERROR_STOP=1 > /dev/null
    else
        cat "$BACKUP_FILE" | docker exec -i -e PGPASSWORD="$DB_PASSWORD" "$PG_CONTAINER" \
            psql -U "$DB_USER" -d "$TARGET_DB" --quiet -v ON_ERROR_STOP=1 > /dev/null
    fi
else
    if [[ "$BACKUP_FILE" =~ \.gz$ ]]; then
        gunzip -c "$BACKUP_FILE" | PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
            -d "$TARGET_DB" --quiet -v ON_ERROR_STOP=1 > /dev/null
    else
        cat "$BACKUP_FILE" | PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
            -d "$TARGET_DB" --quiet -v ON_ERROR_STOP=1 > /dev/null
    fi
fi

RESTORE_END=$(date +%s)
DURATION=$((RESTORE_END - RESTORE_START))

# -----------------------------------------------------------------------------
# 6. Verification of Restored Entities
# -----------------------------------------------------------------------------
log_info "Verifying restored entity records in '$TARGET_DB'..."

QUERY="SELECT 
  (SELECT COUNT(*) FROM products) AS products,
  (SELECT COUNT(*) FROM orders) AS orders,
  (SELECT COUNT(*) FROM order_items) AS items;"

if [ -n "$PG_CONTAINER" ]; then
    COUNTS=$(docker exec -e PGPASSWORD="$DB_PASSWORD" "$PG_CONTAINER" \
        psql -U "$DB_USER" -d "$TARGET_DB" -tAc "$QUERY" 2>/dev/null || echo "0|0|0")
else
    COUNTS=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
        -d "$TARGET_DB" -tAc "$QUERY" 2>/dev/null || echo "0|0|0")
fi

IFS='|' read -r PROD_COUNT ORDER_COUNT ITEM_COUNT <<< "$COUNTS"

echo "-----------------------------------------------------------------------------"
log_pass "Database restored successfully in ${DURATION}s!"
echo "  Target Database: $TARGET_DB"
echo "  Products Count:  ${PROD_COUNT:-0}"
echo "  Orders Count:    ${ORDER_COUNT:-0}"
echo "  Order Items:     ${ITEM_COUNT:-0}"
echo "============================================================================="

exit 0
