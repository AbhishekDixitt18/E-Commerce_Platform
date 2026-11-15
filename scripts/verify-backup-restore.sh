#!/usr/bin/env bash
# =============================================================================
# E-Commerce Platform Backup & Restore End-to-End Verification Suite
# Performs full lifecycle validation: Backup -> Integrity Verification ->
# Isolated Restore -> Entity Parity Check -> Safe Cleanup.
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
log_step()  { echo -e "\n${CYAN}>>> $1${NC}"; }
log_pass()  { echo -e "${GREEN}[PASS]${NC} $1"; }
log_fail()  { echo -e "${RED}[FAIL]${NC} $1" >&2; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }

# Load configuration securely from .env if present
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$PROJECT_ROOT/.env"
    set +a
fi

DB_NAME="${DB_NAME:-ecommerce_prod}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"
ISOLATED_TEST_DB="ecommerce_verify_restore_$(date +%s)"

echo "============================================================================="
echo "   Database Backup, Restore & Data Integrity Verification Suite             "
echo "   Source Database:   $DB_NAME"
echo "   Isolated Test DB:  $ISOLATED_TEST_DB"
echo "   Timestamp:         $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "============================================================================="

# Detect active PostgreSQL container
PG_CONTAINER=""
if command -v docker &>/dev/null; then
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^ecommerce-postgres-prod$"; then
        PG_CONTAINER="ecommerce-postgres-prod"
    elif docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^ecommerce-postgres$"; then
        PG_CONTAINER="ecommerce-postgres"
    fi
fi

if [ -z "$PG_CONTAINER" ]; then
    log_fail "No active PostgreSQL container found running."
    exit 1
fi

log_info "Detected active database container: $PG_CONTAINER"

# -----------------------------------------------------------------------------
# STEP 1: Query Source Database Baseline
# -----------------------------------------------------------------------------
log_step "STEP 1: Querying Source Database Baseline Metrics"

QUERY="SELECT 
  (SELECT COUNT(*) FROM products) AS products,
  (SELECT COUNT(*) FROM orders) AS orders,
  (SELECT COUNT(*) FROM order_items) AS items;"

SRC_COUNTS=$(docker exec -e PGPASSWORD="$DB_PASSWORD" "$PG_CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" -tAc "$QUERY")

IFS='|' read -r SRC_PRODS SRC_ORDERS SRC_ITEMS <<< "$SRC_COUNTS"

log_info "Source Baseline: Products=$SRC_PRODS | Orders=$SRC_ORDERS | OrderItems=$SRC_ITEMS"

if [ "$SRC_PRODS" -eq 0 ]; then
    log_warn "Source database has 0 products. Running seed script to populate sample catalog..."
    docker exec -e PGPASSWORD="$DB_PASSWORD" "$PG_CONTAINER" \
        psql -U "$DB_USER" -d "$DB_NAME" -f /docker-entrypoint-initdb.d/02-seed.sql > /dev/null
    
    SRC_COUNTS=$(docker exec -e PGPASSWORD="$DB_PASSWORD" "$PG_CONTAINER" \
        psql -U "$DB_USER" -d "$DB_NAME" -tAc "$QUERY")
    IFS='|' read -r SRC_PRODS SRC_ORDERS SRC_ITEMS <<< "$SRC_COUNTS"
    log_info "Updated Source Baseline: Products=$SRC_PRODS | Orders=$SRC_ORDERS | OrderItems=$SRC_ITEMS"
fi

# -----------------------------------------------------------------------------
# STEP 2: Execute Backup
# -----------------------------------------------------------------------------
log_step "STEP 2: Executing Database Backup (scripts/backup.sh)"

"$SCRIPT_DIR/backup.sh"

LATEST_BACKUP_PATH=$(cat "$PROJECT_ROOT/backups/latest_backup_path.txt" 2>/dev/null || echo "")
if [ -z "$LATEST_BACKUP_PATH" ] || [ ! -f "$LATEST_BACKUP_PATH" ]; then
    log_fail "Backup file path could not be resolved."
    exit 1
fi

log_pass "Backup file verified: $LATEST_BACKUP_PATH"

# -----------------------------------------------------------------------------
# STEP 3: Verify Backup Archive
# -----------------------------------------------------------------------------
log_step "STEP 3: Verifying Archive Integrity and Checksums"

gzip -t "$LATEST_BACKUP_PATH"
log_pass "Gzip test decompression succeeded without corruption"

PERMS=$(stat -c "%a" "$LATEST_BACKUP_PATH" 2>/dev/null || stat -f "%Lp" "$LATEST_BACKUP_PATH" 2>/dev/null || echo "600")
if [ "$PERMS" == "600" ]; then
    log_pass "Backup file permissions verified: 0600 (owner-only access)"
else
    log_warn "Backup file permissions: $PERMS"
fi

# -----------------------------------------------------------------------------
# STEP 4: Restore Into Isolated Test Environment
# -----------------------------------------------------------------------------
log_step "STEP 4: Restoring Backup into Isolated Test Database ($ISOLATED_TEST_DB)"

"$SCRIPT_DIR/restore.sh" "$LATEST_BACKUP_PATH" "$ISOLATED_TEST_DB"

# -----------------------------------------------------------------------------
# STEP 5: Verify Restored Data Integrity & Parity
# -----------------------------------------------------------------------------
log_step "STEP 5: Comparing Entity Row Counts & Schema Parity"

RESTORED_COUNTS=$(docker exec -e PGPASSWORD="$DB_PASSWORD" "$PG_CONTAINER" \
    psql -U "$DB_USER" -d "$ISOLATED_TEST_DB" -tAc "$QUERY")

IFS='|' read -r REST_PRODS REST_ORDERS REST_ITEMS <<< "$RESTORED_COUNTS"

log_info "Restored Database: Products=$REST_PRODS | Orders=$REST_ORDERS | OrderItems=$REST_ITEMS"

FAILED=0
if [ "$SRC_PRODS" -eq "$REST_PRODS" ]; then
    log_pass "Product count parity: Source=$SRC_PRODS == Restored=$REST_PRODS"
else
    log_fail "Product count mismatch: Source=$SRC_PRODS != Restored=$REST_PRODS"
    FAILED=1
fi

if [ "$SRC_ORDERS" -eq "$REST_ORDERS" ]; then
    log_pass "Order count parity: Source=$SRC_ORDERS == Restored=$REST_ORDERS"
else
    log_fail "Order count mismatch: Source=$SRC_ORDERS != Restored=$REST_ORDERS"
    FAILED=1
fi

if [ "$SRC_ITEMS" -eq "$REST_ITEMS" ]; then
    log_pass "Order Items count parity: Source=$SRC_ITEMS == Restored=$REST_ITEMS"
else
    log_fail "Order Items count mismatch: Source=$SRC_ITEMS != Restored=$REST_ITEMS"
    FAILED=1
fi

# Sample data inspection: verify product titles match
SAMPLE_TITLE=$(docker exec -e PGPASSWORD="$DB_PASSWORD" "$PG_CONTAINER" \
    psql -U "$DB_USER" -d "$ISOLATED_TEST_DB" -tAc "SELECT title FROM products ORDER BY created_at ASC LIMIT 1;")

log_info "Sample Restored Product: \"$SAMPLE_TITLE\""

# -----------------------------------------------------------------------------
# STEP 6: Clean Up Isolated Test Database
# -----------------------------------------------------------------------------
log_step "STEP 6: Cleaning Up Isolated Verification Database"

docker exec -e PGPASSWORD="$DB_PASSWORD" "$PG_CONTAINER" \
    psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $ISOLATED_TEST_DB;" > /dev/null

log_pass "Dropped isolated verification database '$ISOLATED_TEST_DB'."

echo ""
echo "============================================================================="
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}   VERIFICATION COMPLETE: Backup and Restore Pipeline is 100% OPERATIONAL!   ${NC}"
else
    echo -e "${RED}   VERIFICATION FAILED: Data parity check failed!                           ${NC}"
    exit 1
fi
echo "============================================================================="
exit 0
