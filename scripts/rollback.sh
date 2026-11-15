#!/usr/bin/env bash
# =============================================================================
# E-Commerce Platform Application Image Rollback Utility
# Rolls back the API container to a previous stable Docker image tag,
# restarts the service, and verifies container health and readiness.
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

TARGET_TAG="${1:-}"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.prod.yml"

echo "============================================================================="
echo "   Application Container Rollback Utility"
echo "   Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "============================================================================="

# -----------------------------------------------------------------------------
# 1. Identify Available Images
# -----------------------------------------------------------------------------
if [ -z "$TARGET_TAG" ]; then
    echo ""
    log_info "No image tag specified. Scanning local Docker images for available rollback targets:"
    echo "-----------------------------------------------------------------------------"
    docker images --filter "reference=abhishekdixitt18/ecommerce-cloud-devops" \
        --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.CreatedSince}}"
    echo "-----------------------------------------------------------------------------"
    echo ""
    echo "Usage: $0 <target_image_tag_or_sha>"
    echo "Example:"
    echo "  $0 b275b7e"
    echo "  $0 latest"
    exit 1
fi

ROLLBACK_IMAGE="abhishekdixitt18/ecommerce-cloud-devops:$TARGET_TAG"

# Detect current running image
CURRENT_IMAGE=$(docker inspect --format='{{.Config.Image}}' ecommerce-api-prod 2>/dev/null || echo "unknown")

log_info "Current Running Image:  $CURRENT_IMAGE"
log_info "Target Rollback Image:   $ROLLBACK_IMAGE"

if [ "$CURRENT_IMAGE" == "$ROLLBACK_IMAGE" ]; then
    log_warn "Target image is identical to currently running image ($CURRENT_IMAGE)."
fi

# -----------------------------------------------------------------------------
# 2. Pull / Validate Target Image
# -----------------------------------------------------------------------------
log_info "Verifying target image availability..."
if ! docker image inspect "$ROLLBACK_IMAGE" &>/dev/null; then
    log_info "Image '$ROLLBACK_IMAGE' not found locally. Pulling from Docker Hub..."
    if ! docker pull "$ROLLBACK_IMAGE"; then
        log_fail "Failed to pull '$ROLLBACK_IMAGE' from Docker Hub. Verify tag exists."
        exit 1
    fi
fi

# -----------------------------------------------------------------------------
# 3. Update Image & Recreate Container
# -----------------------------------------------------------------------------
log_info "Updating container deployment with rollback image..."

# Update APP_IMAGE in .env or pass as environment variable to compose
if [ -f "$PROJECT_ROOT/.env" ]; then
    if grep -q "^APP_IMAGE=" "$PROJECT_ROOT/.env"; then
        sed -i.bak "s|^APP_IMAGE=.*|APP_IMAGE=$ROLLBACK_IMAGE|" "$PROJECT_ROOT/.env"
    else
        echo "APP_IMAGE=$ROLLBACK_IMAGE" >> "$PROJECT_ROOT/.env"
    fi
fi

log_info "Recreating application container 'ecommerce-api-prod'..."
APP_IMAGE="$ROLLBACK_IMAGE" docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate app

# -----------------------------------------------------------------------------
# 4. Monitor Health Status
# -----------------------------------------------------------------------------
log_info "Waiting for application to reach healthy state..."
TIMEOUT=45
ELAPSED=0
HEALTH_STATE=""

while [ $ELAPSED -lt $TIMEOUT ]; do
    HEALTH_STATE=$(docker inspect --format='{{json .State.Health.Status}}' ecommerce-api-prod 2>/dev/null || echo "\"unknown\"")
    HEALTH_STATE=$(echo "$HEALTH_STATE" | tr -d '"')

    if [ "$HEALTH_STATE" == "healthy" ]; then
        log_pass "Application container reported 'healthy' state after ${ELAPSED}s"
        break
    fi

    sleep 2
    ELAPSED=$((ELAPSED + 2))
    echo -n "."
done
echo ""

if [ "$HEALTH_STATE" != "healthy" ]; then
    log_fail "Application container did not become healthy within ${TIMEOUT}s (State: $HEALTH_STATE)."
    echo "Recent container logs:"
    docker compose -f "$COMPOSE_FILE" logs --tail=20 app
    exit 1
fi

# -----------------------------------------------------------------------------
# 5. Verify Rollback Endpoints
# -----------------------------------------------------------------------------
log_info "Validating endpoint responses after rollback..."

HTTP_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/health || echo "000")
if [ "$HTTP_HEALTH" -eq 200 ]; then
    log_pass "Liveness Probe (/health): HTTP 200 OK"
else
    log_fail "Liveness probe failed with HTTP $HTTP_HEALTH"
    exit 1
fi

HTTP_READY=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/ready || echo "000")
if [ "$HTTP_READY" -eq 200 ]; then
    log_pass "Readiness Probe (/ready): HTTP 200 OK"
else
    log_fail "Readiness probe failed with HTTP $HTTP_READY"
    exit 1
fi

ACTIVE_IMAGE=$(docker inspect --format='{{.Config.Image}}' ecommerce-api-prod)

echo "-----------------------------------------------------------------------------"
log_pass "Rollback verified successfully!"
echo "  Active Running Image: $ACTIVE_IMAGE"
echo "  Container Status:     Healthy"
echo "  API Endpoints:        Operational"
echo "============================================================================="

exit 0
