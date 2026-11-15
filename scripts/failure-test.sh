#!/usr/bin/env bash
# =============================================================================
# E-Commerce Platform SRE Controlled Failure & Recovery Verification Script
# Simulates application crash/outage, verifies failover/502 state, restores service,
# and verifies end-to-end recovery of health probes, readiness, and metrics.
# =============================================================================

set -eo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

TARGET_HOST="${1:-http://127.0.0.1}"

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_step()  { echo -e "\n${CYAN}>>> $1${NC}"; }
log_pass()  { echo -e "${GREEN}[PASS]${NC} $1"; }
log_fail()  { echo -e "${RED}[FAIL]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }

echo "============================================================================="
echo "   Site Reliability Engineering (SRE): Controlled Failure & Recovery Test   "
echo "   Target Host: $TARGET_HOST"
echo "   Timestamp:   $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "============================================================================="

# Detect active container name
APP_CONTAINER=""
if docker ps --format '{{.Names}}' | grep -q "^ecommerce-api-prod$"; then
    APP_CONTAINER="ecommerce-api-prod"
elif docker ps --format '{{.Names}}' | grep -q "^ecommerce-api$"; then
    APP_CONTAINER="ecommerce-api"
else
    log_fail "No active E-Commerce API container found running!"
    echo "Running containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    exit 1
fi

log_info "Detected active application container: $APP_CONTAINER"

# -----------------------------------------------------------------------------
# PHASE 1: Pre-Failure Baseline Check
# -----------------------------------------------------------------------------
log_step "PHASE 1: Verifying Pre-Failure Health Baseline"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET_HOST/health" || echo "000")
if [ "$HTTP_STATUS" -eq 200 ]; then
    log_pass "Baseline Liveness Check (/health) returned HTTP 200 OK"
else
    log_fail "Baseline check failed with status $HTTP_STATUS"
    exit 1
fi

READY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET_HOST/ready" || echo "000")
if [ "$READY_STATUS" -eq 200 ]; then
    log_pass "Baseline Database Readiness Check (/ready) returned HTTP 200 OK"
else
    log_warn "Readiness returned status $READY_STATUS"
fi

METRICS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET_HOST/metrics" || echo "000")
if [ "$METRICS_STATUS" -eq 200 ]; then
    log_pass "Baseline Prometheus Metrics Check (/metrics) returned HTTP 200 OK"
else
    log_warn "Metrics returned status $METRICS_STATUS"
fi

# -----------------------------------------------------------------------------
# PHASE 2: Inject Controlled Failure (Stop Application Container)
# -----------------------------------------------------------------------------
log_step "PHASE 2: Injecting Controlled Failure (Stopping $APP_CONTAINER)"

log_info "Stopping container: $APP_CONTAINER..."
docker stop "$APP_CONTAINER" > /dev/null
log_pass "Container $APP_CONTAINER successfully stopped."

# -----------------------------------------------------------------------------
# PHASE 3: Verify Application Failure State
# -----------------------------------------------------------------------------
log_step "PHASE 3: Verifying Application Failure Detection"

# Through Nginx proxy, expect HTTP 502 Bad Gateway; if direct port, expect curl failure
OUTAGE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$TARGET_HOST/health" || echo "000")

if [ "$OUTAGE_STATUS" -eq 502 ]; then
    log_pass "Simulated outage verified: Nginx returned HTTP 502 Bad Gateway (Upstream Down)"
elif [ "$OUTAGE_STATUS" -eq 000 ] || [ "$OUTAGE_STATUS" -ge 500 ]; then
    log_pass "Simulated outage verified: Request failed as expected (HTTP $OUTAGE_STATUS / Connection Refused)"
else
    log_fail "Unexpected status code during outage: $OUTAGE_STATUS"
    exit 1
fi

# -----------------------------------------------------------------------------
# PHASE 4: Self-Healing / Service Recovery
# -----------------------------------------------------------------------------
log_step "PHASE 4: Initiating Service Recovery (Restarting $APP_CONTAINER)"

log_info "Starting container: $APP_CONTAINER..."
docker start "$APP_CONTAINER" > /dev/null

log_info "Waiting for container health check to report 'healthy'..."
RECOVERY_TIMEOUT=45
ELAPSED=0
HEALTH_STATE=""

while [ $ELAPSED -lt $RECOVERY_TIMEOUT ]; do
    HEALTH_STATE=$(docker inspect --format='{{json .State.Health.Status}}' "$APP_CONTAINER" 2>/dev/null || echo "\"unknown\"")
    HEALTH_STATE=$(echo "$HEALTH_STATE" | tr -d '"')

    if [ "$HEALTH_STATE" == "healthy" ]; then
        log_pass "Container reported healthy state after ${ELAPSED}s"
        break
    fi

    sleep 2
    ELAPSED=$((ELAPSED + 2))
    echo -n "."
done
echo ""

if [ "$HEALTH_STATE" != "healthy" ]; then
    log_warn "Container reached state '$HEALTH_STATE' within timeout, probing HTTP endpoint directly..."
fi

# -----------------------------------------------------------------------------
# PHASE 5: Post-Recovery Health & Readiness Verification
# -----------------------------------------------------------------------------
log_step "PHASE 5: Validating Full System Recovery"

sleep 2
POST_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET_HOST/health" || echo "000")
if [ "$POST_HEALTH" -eq 200 ]; then
    log_pass "Recovered Liveness Check (/health): HTTP 200 OK"
else
    log_fail "Recovered liveness check failed with HTTP $POST_HEALTH"
    exit 1
fi

POST_READY=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET_HOST/ready" || echo "000")
if [ "$POST_READY" -eq 200 ]; then
    log_pass "Recovered Readiness Check (/ready): HTTP 200 OK (PostgreSQL Connection Restored)"
else
    log_fail "Recovered readiness check failed with HTTP $POST_READY"
    exit 1
fi

POST_METRICS=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET_HOST/metrics" || echo "000")
if [ "$POST_METRICS" -eq 200 ]; then
    log_pass "Recovered Prometheus Metrics Check (/metrics): HTTP 200 OK"
else
    log_warn "Metrics check returned HTTP $POST_METRICS"
fi

echo "============================================================================="
echo -e "${GREEN}   SUCCESS: Controlled Failure & Automated Recovery Test PASSED!   ${NC}"
echo "============================================================================="
