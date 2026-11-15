#!/usr/bin/env bash
# =============================================================================
# Cloud Deployment & CI/CD – E-Commerce Platform
# Production Deployment Verification & Evidence Suite
# =============================================================================

set -eo pipefail

TARGET_HOST="${1:-http://127.0.0.1}"
# Strip trailing slash if present
TARGET_HOST="${TARGET_HOST%/}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED_COUNT=0
FAILED_COUNT=0

record_result() {
    local test_name="$1"
    local expected="$2"
    local actual="$3"
    local status="$4"
    
    if [ "$status" == "PASS" ]; then
        echo -e "${GREEN}[PASS]${NC} $test_name | Expected: $expected | Actual: $actual"
        PASSED_COUNT=$((PASSED_COUNT + 1))
    else
        echo -e "${RED}[FAIL]${NC} $test_name | Expected: $expected | Actual: $actual"
        FAILED_COUNT=$((FAILED_COUNT + 1))
    fi
}

echo "============================================================================="
echo "   Running E-Commerce Deployment Verification Suite"
echo "   Target Host: $TARGET_HOST"
echo "   Timestamp:   $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "============================================================================="
echo ""

# -----------------------------------------------------------------------------
# 1. Check Running Docker Containers
# -----------------------------------------------------------------------------
echo "--- Section 1: Docker Containers & Infrastructure ---"
DOCKER_CMD="docker"
if ! docker ps &> /dev/null; then
    DOCKER_CMD="sudo docker"
fi

if command -v docker &> /dev/null; then
    CONTAINERS=$($DOCKER_CMD ps --format "{{.Names}} ({{.Status}})" 2>/dev/null || echo "")
    echo "Running Containers:"
    echo "$CONTAINERS"
    
    if echo "$CONTAINERS" | grep -q "ecommerce-api" && echo "$CONTAINERS" | grep -q "ecommerce-postgres"; then
        record_result "Docker Container Orchestration" "api & postgres running" "Containers active" "PASS"
    else
        record_result "Docker Container Orchestration" "api & postgres running" "Missing container(s)" "FAIL"
    fi
else
    echo "Docker binary not accessible from current shell (skipping container inspection)."
fi
echo ""

# -----------------------------------------------------------------------------
# 2. Health & Readiness Verification
# -----------------------------------------------------------------------------
echo "--- Section 2: Health & Readiness Probes ---"

# Test 1: GET /health
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$TARGET_HOST/health" || echo "000")
HEALTH_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HEALTH_CODE" == "200" ]; then
    record_result "Liveness Probe (GET /health)" "HTTP 200" "HTTP $HEALTH_CODE" "PASS"
else
    record_result "Liveness Probe (GET /health)" "HTTP 200" "HTTP $HEALTH_CODE ($HEALTH_BODY)" "FAIL"
fi

# Test 2: GET /ready
READY_RESPONSE=$(curl -s -w "\n%{http_code}" "$TARGET_HOST/ready" || echo "000")
READY_CODE=$(echo "$READY_RESPONSE" | tail -n1)
READY_BODY=$(echo "$READY_RESPONSE" | head -n-1)

if [ "$READY_CODE" == "200" ]; then
    record_result "Readiness Probe (GET /ready)" "HTTP 200 (DB connected)" "HTTP $READY_CODE" "PASS"
else
    record_result "Readiness Probe (GET /ready)" "HTTP 200 (DB connected)" "HTTP $READY_CODE ($READY_BODY)" "FAIL"
fi
echo ""

# -----------------------------------------------------------------------------
# 3. Product Catalog APIs
# -----------------------------------------------------------------------------
echo "--- Section 3: Product APIs ---"

# Test 3: GET /api/v1/products
PRODUCTS_RESPONSE=$(curl -s -w "\n%{http_code}" "$TARGET_HOST/api/v1/products" || echo "000")
PRODUCTS_CODE=$(echo "$PRODUCTS_RESPONSE" | tail -n1)
PRODUCTS_BODY=$(echo "$PRODUCTS_RESPONSE" | head -n-1)

FIRST_PRODUCT_ID=""
if [ "$PRODUCTS_CODE" == "200" ]; then
    record_result "Product Catalog (GET /api/v1/products)" "HTTP 200" "HTTP $PRODUCTS_CODE" "PASS"
    # Extract first product ID using grep/sed/node
    FIRST_PRODUCT_ID=$(echo "$PRODUCTS_BODY" | grep -o '"id":"[^"]*' | head -n1 | cut -d'"' -f4 || echo "")
else
    record_result "Product Catalog (GET /api/v1/products)" "HTTP 200" "HTTP $PRODUCTS_CODE ($PRODUCTS_BODY)" "FAIL"
fi

# Test 4: GET /api/v1/products/:id
if [ -n "$FIRST_PRODUCT_ID" ]; then
    PROD_ITEM_RESPONSE=$(curl -s -w "\n%{http_code}" "$TARGET_HOST/api/v1/products/$FIRST_PRODUCT_ID" || echo "000")
    PROD_ITEM_CODE=$(echo "$PROD_ITEM_RESPONSE" | tail -n1)
    
    if [ "$PROD_ITEM_CODE" == "200" ]; then
        record_result "Product Detail (GET /api/v1/products/:id)" "HTTP 200" "HTTP $PROD_ITEM_CODE (ID: $FIRST_PRODUCT_ID)" "PASS"
    else
        record_result "Product Detail (GET /api/v1/products/:id)" "HTTP 200" "HTTP $PROD_ITEM_CODE" "FAIL"
    fi
else
    record_result "Product Detail (GET /api/v1/products/:id)" "HTTP 200" "No product ID available to test" "FAIL"
fi
echo ""

# -----------------------------------------------------------------------------
# 4. Order Creation & Idempotency
# -----------------------------------------------------------------------------
echo "--- Section 4: Order Processing & Idempotency ---"

ORDER_IDEMPOTENCY_KEY="deploy-verify-$(date +%s%N | cut -b1-13)"
ORDER_PAYLOAD=$(cat <<EOF
{
  "customer_name": "AWS Deployment Verifier",
  "customer_email": "devops-verifier@algions.com",
  "shipping_address": "AWS EC2 Ubuntu 24.04 Production Server",
  "items": [
    {
      "productId": "${FIRST_PRODUCT_ID}",
      "quantity": 1
    }
  ]
}
EOF
)

# Test 5: POST /api/v1/orders
ORDER_RES=$(curl -s -w "\n%{http_code}" \
  -X POST "$TARGET_HOST/api/v1/orders" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: ${ORDER_IDEMPOTENCY_KEY}" \
  -d "$ORDER_PAYLOAD" || echo "000")

ORDER_CODE=$(echo "$ORDER_RES" | tail -n1)
ORDER_BODY=$(echo "$ORDER_RES" | head -n-1)

CREATED_ORDER_ID=""
if [ "$ORDER_CODE" == "201" ]; then
    CREATED_ORDER_ID=$(echo "$ORDER_BODY" | grep -o '"id":"[^"]*' | head -n1 | cut -d'"' -f4 || echo "")
    record_result "Create Order (POST /api/v1/orders)" "HTTP 201" "HTTP $ORDER_CODE (Order ID: $CREATED_ORDER_ID)" "PASS"
else
    record_result "Create Order (POST /api/v1/orders)" "HTTP 201" "HTTP $ORDER_CODE ($ORDER_BODY)" "FAIL"
fi

# Test 6: Replay same order request with identical Idempotency-Key
if [ -n "$CREATED_ORDER_ID" ]; then
    IDEMP_RES=$(curl -s -w "\n%{http_code}" \
      -X POST "$TARGET_HOST/api/v1/orders" \
      -H "Content-Type: application/json" \
      -H "Idempotency-Key: ${ORDER_IDEMPOTENCY_KEY}" \
      -d "$ORDER_PAYLOAD" || echo "000")
    
    IDEMP_CODE=$(echo "$IDEMP_RES" | tail -n1)
    IDEMP_BODY=$(echo "$IDEMP_RES" | head -n-1)
    
    # Should return HTTP 200 with the cached original order
    if [ "$IDEMP_CODE" == "200" ] && echo "$IDEMP_BODY" | grep -q "$CREATED_ORDER_ID"; then
        record_result "Order Idempotency Guard" "HTTP 200 (Existing Order Returned)" "HTTP $IDEMP_CODE (Match verified)" "PASS"
    else
        record_result "Order Idempotency Guard" "HTTP 200 (Existing Order Returned)" "HTTP $IDEMP_CODE ($IDEMP_BODY)" "FAIL"
    fi
fi

# Test 7: GET /api/v1/orders/:id
if [ -n "$CREATED_ORDER_ID" ]; then
    FETCH_ORDER_RES=$(curl -s -w "\n%{http_code}" "$TARGET_HOST/api/v1/orders/$CREATED_ORDER_ID" || echo "000")
    FETCH_ORDER_CODE=$(echo "$FETCH_ORDER_RES" | tail -n1)
    
    if [ "$FETCH_ORDER_CODE" == "200" ]; then
        record_result "Fetch Order (GET /api/v1/orders/:id)" "HTTP 200" "HTTP $FETCH_ORDER_CODE" "PASS"
    else
        record_result "Fetch Order (GET /api/v1/orders/:id)" "HTTP 200" "HTTP $FETCH_ORDER_CODE" "FAIL"
    fi
fi
echo ""

# -----------------------------------------------------------------------------
# 5. Administrative Authentication & Audit Logging
# -----------------------------------------------------------------------------
echo "--- Section 5: Admin RBAC & Audit Log Security ---"

# Test 8: Unauthorized attempt without admin key
UNAUTH_RES=$(curl -s -w "\n%{http_code}" \
  -X POST "$TARGET_HOST/api/v1/admin/products" \
  -H "Content-Type: application/json" \
  -d '{"title":"Unauthorized Item","price":10,"sku":"UNAUTH-01","inventory":5}' || echo "000")
UNAUTH_CODE=$(echo "$UNAUTH_RES" | tail -n1)

if [ "$UNAUTH_CODE" == "401" ]; then
    record_result "Admin Route Protection (No Key)" "HTTP 401 Unauthorized" "HTTP $UNAUTH_CODE" "PASS"
else
    record_result "Admin Route Protection (No Key)" "HTTP 401 Unauthorized" "HTTP $UNAUTH_CODE" "FAIL"
fi

# Test 9: Authorized product addition with admin key
ADMIN_KEY="${ADMIN_API_KEY:-algions-devops-admin-key-2026}"
if [ -f .env ]; then
    ENV_KEY=$(grep '^ADMIN_API_KEY=' .env | cut -d '=' -f2- | tr -d '\r' || true)
    if [ -n "$ENV_KEY" ]; then
        ADMIN_KEY="$ENV_KEY"
    fi
fi

NEW_SKU="PROD-EC2-$(date +%s | tail -c 6)"
AUTH_RES=$(curl -s -w "\n%{http_code}" \
  -X POST "$TARGET_HOST/api/v1/admin/products" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ADMIN_KEY" \
  -d "{\"title\":\"EC2 Cloud Verified Item\",\"sku\":\"$NEW_SKU\",\"price\":49.99,\"currency\":\"USD\",\"inventory\":50,\"category\":\"Cloud Engineering\",\"description\":\"Verified in production\"}" || echo "000")
AUTH_CODE=$(echo "$AUTH_RES" | tail -n1)

if [ "$AUTH_CODE" == "201" ]; then
    record_result "Admin Product Creation & Audit (With Key)" "HTTP 201 Created" "HTTP $AUTH_CODE (SKU: $NEW_SKU)" "PASS"
else
    record_result "Admin Product Creation & Audit (With Key)" "HTTP 201 Created" "HTTP $AUTH_CODE" "FAIL"
fi

echo ""
echo "============================================================================="
echo "   Verification Summary: $PASSED_COUNT Passed, $FAILED_COUNT Failed"
echo "============================================================================="

if [ $FAILED_COUNT -eq 0 ]; then
    echo -e "${GREEN}All production deployment verification tests PASSED successfully!${NC}"
    exit 0
else
    echo -e "${RED}Deployment verification completed with failures.${NC}"
    exit 1
fi
