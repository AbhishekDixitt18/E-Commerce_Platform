#!/usr/bin/env bash
# =============================================================================
# Cloud Deployment & CI/CD – E-Commerce Platform
# Automated AWS EC2 Server Setup & Deployment Script
# Target OS: Ubuntu 22.04 LTS / 24.04 LTS
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "============================================================================="
echo "   E-Commerce Platform - Automated AWS EC2 Deployment Script"
echo "============================================================================="

# -----------------------------------------------------------------------------
# 1. System Requirements & Architecture Check
# -----------------------------------------------------------------------------
log_info "Validating host environment and operating system..."

if [ -f /etc/os-release ]; then
    . /etc/os-release
    if [ "$ID" != "ubuntu" ]; then
        log_warn "This script is optimized for Ubuntu. Detected: $NAME"
    else
        log_success "Operating System: $PRETTY_NAME"
    fi
else
    log_warn "Could not verify /etc/os-release. Proceeding with standard Debian/Ubuntu commands..."
fi

# -----------------------------------------------------------------------------
# 2. Install Docker & Docker Compose Plugin (Official Docker Repository)
# -----------------------------------------------------------------------------
if ! command -v docker &> /dev/null; then
    log_info "Docker is not installed. Installing official Docker Engine..."
    
    sudo apt-get update -y
    sudo apt-get install -y ca-certificates curl gnupg lsb-release
    
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    sudo systemctl enable docker
    sudo systemctl start docker
    
    # Add current user to docker group
    if [ "$USER" != "root" ]; then
        sudo usermod -aG docker "$USER"
        log_info "Added $USER to docker group. (Note: group membership activates on next login)"
    fi
    log_success "Docker Engine and Docker Compose plugin installed successfully."
else
    log_success "Docker is already installed: $(docker --version)"
fi

# Verify Docker Compose V2
if docker compose version &> /dev/null; then
    log_success "Docker Compose plugin verified: $(docker compose version)"
else
    log_error "Docker compose plugin not found. Installing docker-compose-plugin..."
    sudo apt-get update -y && sudo apt-get install -y docker-compose-plugin
fi

# -----------------------------------------------------------------------------
# 3. Deployment Directory Setup
# -----------------------------------------------------------------------------
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
log_info "Working directory: $REPO_DIR"
cd "$REPO_DIR"

# -----------------------------------------------------------------------------
# 4. Production Environment Configuration (.env)
# -----------------------------------------------------------------------------
if [ ! -f .env ]; then
    log_info "No .env file found. Generating secure production .env configuration..."
    
    RANDOM_DB_PASSWORD=$(openssl rand -hex 16 2>/dev/null || date +%s | sha256sum | base64 | head -c 24)
    RANDOM_ADMIN_KEY="algions-prod-$(openssl rand -hex 12 2>/dev/null || date +%s | sha256sum | base64 | head -c 16)"
    
    cat > .env <<EOF
# Production Environment Variables - Generated $(date -u +"%Y-%m-%dT%H:%M:%SZ")
NODE_ENV=production
PORT=3000
API_PREFIX=/api/v1
LOG_LEVEL=info
CORS_ORIGIN=*

# PostgreSQL Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_NAME=ecommerce_prod
DB_USER=postgres
DB_PASSWORD=${RANDOM_DB_PASSWORD}
DB_SSL=false

# Administrative Access Key
ADMIN_API_KEY=${RANDOM_ADMIN_KEY}

# Published Docker Image Reference
APP_IMAGE=abhishekdixitt18/ecommerce-cloud-devops:latest
EOF
    chmod 600 .env
    log_success "Created production .env with secure random credentials (permissions: 0600)."
else
    log_info "Existing .env file detected. Preserving existing configuration."
fi

# -----------------------------------------------------------------------------
# 5. SSL/TLS Certificate Provisioning
# -----------------------------------------------------------------------------
if [ ! -f nginx/ssl/server.crt ] || [ ! -f nginx/ssl/server.key ]; then
    log_info "No TLS certificates detected in nginx/ssl/. Generating local self-signed certificate..."
    chmod +x scripts/generate-self-signed-ssl.sh
    ./scripts/generate-self-signed-ssl.sh "127.0.0.1"
else
    log_info "TLS certificates verified in nginx/ssl/."
fi

# -----------------------------------------------------------------------------
# 6. Build & Launch Containers via Docker Compose
# -----------------------------------------------------------------------------
log_info "Deploying production stack via docker-compose.prod.yml..."

# Use sudo if user cannot access docker daemon directly yet
DOCKER_CMD="docker"
if ! docker info &> /dev/null; then
    DOCKER_CMD="sudo docker"
fi

$DOCKER_CMD compose -f docker-compose.prod.yml down --remove-orphans || true
$DOCKER_CMD compose -f docker-compose.prod.yml up -d --build

# -----------------------------------------------------------------------------
# 7. Wait for Health Checks to Pass
# -----------------------------------------------------------------------------
log_info "Waiting for containers to report healthy state..."

MAX_RETRIES=15
COUNTER=0
ALL_HEALTHY=false

while [ $COUNTER -lt $MAX_RETRIES ]; do
    APP_STATUS=$($DOCKER_CMD inspect --format='{{json .State.Health.Status}}' ecommerce-api-prod 2>/dev/null || echo '"starting"')
    PG_STATUS=$($DOCKER_CMD inspect --format='{{json .State.Health.Status}}' ecommerce-postgres-prod 2>/dev/null || echo '"starting"')
    
    echo "Check $((COUNTER + 1))/$MAX_RETRIES -> app: $APP_STATUS, postgres: $PG_STATUS"
    
    if [ "$APP_STATUS" == '"healthy"' ] && [ "$PG_STATUS" == '"healthy"' ]; then
        ALL_HEALTHY=true
        break
    fi
    
    COUNTER=$((COUNTER + 1))
    sleep 4
done

if [ "$ALL_HEALTHY" = true ]; then
    log_success "All production containers are healthy and operational!"
else
    log_warn "Health checks still pending. Proceeding to verification probe..."
fi

# -----------------------------------------------------------------------------
# 8. Run Deployment Verification
# -----------------------------------------------------------------------------
if [ -f scripts/verify-deployment.sh ]; then
    chmod +x scripts/verify-deployment.sh
    log_info "Running automated post-deployment verification suite..."
    sudo bash scripts/verify-deployment.sh "http://127.0.0.1"
fi

PUBLIC_IP=$(curl -s -m 3 https://checkip.amazonaws.com || curl -s -m 3 https://ifconfig.me || echo "YOUR_EC2_PUBLIC_IP")

echo ""
echo "============================================================================="
log_success "E-Commerce Platform successfully deployed on AWS EC2 with TLS/HTTPS!"
echo "HTTP Endpoint:   http://${PUBLIC_IP}/ (Redirects to HTTPS)"
echo "HTTPS Endpoint:  https://${PUBLIC_IP}/"
echo "Health Probe:    https://${PUBLIC_IP}/health"
echo "Readiness Probe: https://${PUBLIC_IP}/ready"
echo "Products API:    https://${PUBLIC_IP}/api/v1/products"
echo "Orders API:      https://${PUBLIC_IP}/api/v1/orders"
echo "============================================================================="
