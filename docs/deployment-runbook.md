# AWS EC2 Deployment & Operations Runbook

**Company:** ALGIONS AI LABS PRIVATE LIMITED  
**Project:** Cloud Deployment & CI/CD – E-Commerce Platform  
**Target Environment:** AWS EC2 Production (`Ubuntu 24.04 LTS`, `ap-southeast-2`)  
**Public Host IP:** `54.252.184.109`  
**Internal Host IP:** `172.31.33.72`

---

## 1. Production Architecture & Pre-requisites

The production infrastructure runs on a single AWS EC2 virtual machine hosting four core Docker containers and an automated synchronization helper:

```
[ Internet Traffic ]
        │
        ▼ (Port 80 / 443)
┌────────────────────────────────────────────────────────┐
│  AWS EC2 Host (Ubuntu 24.04 LTS)                       │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ ecommerce-nginx-prod (nginx:1.25-alpine)         │  │
│  │ • Serves React SPA from volume 'frontend-assets' │  │
│  │ • Reverse proxies API requests to port 3000      │  │
│  └───────────────────────┬──────────────────────────┘  │
│                          │                             │
│       ┌──────────────────┴──────────────────┐          │
│       │ ecommerce-backend-net (Bridge)      │          │
│       ▼                                     ▼          │
│  ┌────────────────────────┐    ┌────────────────────┐  │
│  │ ecommerce-api-prod     │    │ ecommerce-postgres │  │
│  │ Node.js 20 Express     │◄──►│ PostgreSQL 16      │  │
│  │ Internal Port 3000     │    │ Internal Port 5432 │  │
│  └────────────────────────┘    └────────────────────┘  │
│               │ (Scrapes :3000/metrics)                │
│               ▼                                        │
│  ┌────────────────────────┐    ┌────────────────────┐  │
│  │ ecommerce-prometheus   │    │ frontend-sync      │  │
│  │ Prometheus 2.51 (:9090)│    │ (One-shot init)    │  │
│  └────────────────────────┘    └────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### Pre-requisites on EC2 Host:
- **Operating System:** Ubuntu 24.04 LTS (x86_64)
- **Container Runtime:** Docker Engine >= 24.0.0
- **Compose Tool:** Docker Compose v2 (`docker compose version` >= 2.20)
- **Git:** Git >= 2.34
- **AWS Security Group Inbound Rules:**
  - `Port 22 (TCP)`: SSH Administrative Access
  - `Port 80 (TCP)`: HTTP Public Web Traffic
  - `Port 443 (TCP)`: HTTPS Secure Web Traffic
  - `Port 5432 & 3000`: **BLOCKED** from public ingress

---

## 2. First-Time Server Provisioning (One-Time Setup)

> [!NOTE]
> This section is strictly for provisioning a fresh EC2 instance from scratch. Normal updates do **not** require these steps and are handled automatically by GitHub Actions.

### Step 1: Connect to Instance
```bash
ssh -i /path/to/ecommerce-key.pem ubuntu@54.252.184.109
```

### Step 2: Install Docker Engine & Docker Compose
```bash
# Update package repositories
sudo apt-get update && sudo apt-get install -y ca-certificates curl gnupg

# Add Docker official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository to Apt sources
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker packages
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable and start Docker service
sudo systemctl enable docker
sudo systemctl start docker

# Allow unprivileged user to execute Docker
sudo usermod -aG docker ubuntu
```

### Step 3: Clone Repository
```bash
cd ~
git clone https://github.com/AbhishekDixitt18/E-Commerce_Platform.git
cd E-Commerce_Platform
```

### Step 4: Configure Production Environment Variables
Create `/home/ubuntu/E-Commerce_Platform/.env`:
```bash
cat << 'EOF' > .env
NODE_ENV=production
PORT=3000
API_PREFIX=/api/v1
LOG_LEVEL=info
CORS_ORIGIN=*

# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_NAME=ecommerce_prod
DB_USER=postgres
DB_PASSWORD=<SECURE_DATABASE_PASSWORD>
DB_SSL=false

# Administrative Key for Protected Endpoints
ADMIN_API_KEY=<SECURE_ADMIN_API_KEY>

# Docker Hub Image Pointer
APP_IMAGE=abhishekdixitt18/ecommerce-cloud-devops:latest
EOF

chmod 600 .env
```

### Step 5: Initial Stack Launch
```bash
# Start PostgreSQL database and initialize schema
docker compose -f docker-compose.prod.yml up -d postgres

# Wait for PostgreSQL healthcheck to become healthy
docker compose -f docker-compose.prod.yml ps

# Extract frontend assets to named volume and start application stack
docker compose -f docker-compose.prod.yml run --rm frontend-sync
docker compose -f docker-compose.prod.yml up -d app nginx prometheus
```

---

## 3. Routine Operations: Automated Continuous Deployment

All day-to-day code updates (frontend styling, React components, backend APIs, schema additions) are **100% automated**:

1. Developer commits and pushes changes to the `main` branch:
   ```bash
   git add .
   git commit -m "feat: new feature description"
   git push origin main
   ```
2. The **GitHub Actions CI/CD Pipeline** executes automatically.
3. The pipeline builds, tests, scans, tags, and pushes the new container image to Docker Hub.
4. The pipeline establishes an SSH session with EC2, pulls the exact image (`sha-<commit_sha>`), synchronizes the `frontend-assets` named volume via `frontend-sync`, recreates `app` and `nginx`, and validates health.
5. **No manual server intervention is required.**

---

## 4. Operational Health & Verification Commands

To inspect the production environment at any time:

### Check Container Status
```bash
docker compose -f docker-compose.prod.yml ps
```
**Expected Output:**
```
NAME                        IMAGE                                            STATUS
ecommerce-api-prod          abhishekdixitt18/ecommerce-cloud-devops:latest   Up (healthy)
ecommerce-nginx-prod        nginx:1.25-alpine                                Up (healthy)
ecommerce-postgres-prod     postgres:16-alpine                               Up (healthy)
ecommerce-prometheus-prod   prom/prometheus:v2.51.0                          Up
```

### Check HTTP Endpoints via cURL
```bash
# 1. Verify React Frontend Root (Must return HTTP 200 and <div id="root">)
curl -i http://54.252.184.109/

# 2. Verify Backend Liveness Probe (Must return HTTP 200 "UP")
curl -i http://54.252.184.109/health

# 3. Verify Database Readiness Probe (Must return HTTP 200 with latency < 50ms)
curl -i http://54.252.184.109/health/ready

# 4. Verify Products API through Nginx Proxy
curl -s http://54.252.184.109/api/v1/products | head -n 25

# 5. Verify Prometheus Metrics Export
curl -i http://54.252.184.109/metrics
```

---

## 5. Log Aggregation & Troubleshooting

### View Application Logs
```bash
# Follow live application access & error logs
docker logs -f --tail 100 ecommerce-api-prod

# Filter for errors only
docker logs ecommerce-api-prod 2>&1 | grep '"level":"ERROR"'
```

### View Nginx Logs
```bash
# Follow live Nginx access and error logs
docker logs -f --tail 100 ecommerce-nginx-prod

# Inspect Nginx error log file inside container
docker exec ecommerce-nginx-prod tail -n 50 /var/log/nginx/error.log
```

### View Database Logs
```bash
# Inspect PostgreSQL startup and query error logs
docker logs --tail 100 ecommerce-postgres-prod
```

---

## 6. Emergency Recovery & Manual Rollback

If a bad release passes CI or an unexpected production issue arises:

### Automated Rollback (In-Pipeline)
The GitHub Actions workflow includes automated rollback guardrails in Stage 9. If `/health`, `/health/ready`, or root frontend check fails within 60 seconds, the pipeline automatically re-tags `PREV_IMAGE` as `rollback-active`, redeploys the previous container, and exits with failure.

### Manual One-Command Rollback via Script
If manual intervention is needed, execute the production rollback script on the EC2 host:
```bash
cd ~/E-Commerce_Platform
./scripts/rollback.sh
```
The script performs:
1. Identification of the previous stable Docker image tag.
2. Graceful recreation of `ecommerce-api-prod`.
3. Validation of the `/health` and `/health/ready` endpoints.
4. Immediate failure alerting if the previous image cannot be restored.

### Manual Container Restart
```bash
# Safely restart the web stack without stopping the database
docker compose -f docker-compose.prod.yml restart app nginx

# Full stack restart (preserves database volume)
docker compose -f docker-compose.prod.yml down --remove-orphans
docker compose -f docker-compose.prod.yml up -d
```

> [!CAUTION]
> **Never** execute `docker compose down -v` on production. The `-v` flag deletes the persistent `postgres-prod-data` volume containing real customer orders and inventory data!

---

## 7. Common Troubleshooting Scenarios

| Issue / Symptom | Probable Cause | Diagnostic Command | Remediation Action |
| :--- | :--- | :--- | :--- |
| **HTTP 502 Bad Gateway** | Node.js Express backend is stopped or unhealthy | `docker ps -a` and `docker logs ecommerce-api-prod` | Restart app container: `docker compose -f docker-compose.prod.yml up -d --force-recreate app` |
| **HTTP 403 Forbidden on Root (/)** | Nginx mount point missing `index.html` | `docker exec ecommerce-nginx-prod ls -la /var/www/html` | Run frontend sync: `docker compose -f docker-compose.prod.yml run --rm frontend-sync` and restart Nginx |
| **Old Frontend Assets Displayed** | Browser cache or named volume holding previous build | Check asset hash: `curl -s http://127.0.0.1/ \| grep assets` | Force refresh in browser (`Ctrl+F5`) and verify named volume synchronization |
| **Database Connection Refused** | PostgreSQL container stopped or initializing | `docker logs ecommerce-postgres-prod` | Verify volume health and restart: `docker compose -f docker-compose.prod.yml up -d postgres` |
| **SSH Connection Timed Out** | Security group rule changed or public IP modified | Check AWS EC2 Console Security Group inbound rules | Ensure Port 22 is open to your current administrative IP address |
