# Deployment & Demonstration Evidence Checklist

**Company:** ALGIONS AI LABS PRIVATE LIMITED  
**Project:** Cloud Deployment & CI/CD – E-Commerce Platform  
**Candidate / Author:** Abhishek Dixit  
**Public Host IP:** `54.252.184.109`  
**Repository:** [https://github.com/AbhishekDixitt18/E-Commerce_Platform.git](https://github.com/AbhishekDixitt18/E-Commerce_Platform.git)

---

## Instructions for Submission Reviewer & Candidate

This checklist outlines the **exact artifacts, commands, pages, and terminal outputs** required to verify all technical assessment deliverables. Capture screenshots or terminal text corresponding to each item below.

---

## 1. Evidence Matrix

### 1.1 Source Code, Git Repository & Version Control
- **Item to Capture:** GitHub Repository Overview & Latest Commit on `main`.
- **Target Page / URL:** `https://github.com/AbhishekDixitt18/E-Commerce_Platform`
- **Verification Command:**
  ```bash
  git log -1 --format="Commit: %H%nAuthor: %an%nDate: %ad%nMessage: %s"
  ```
- **Expected Proof:** Latest commit hash on `main` branch reflecting verified production code.

### 1.2 GitHub Actions CI/CD Pipeline Execution
- **Item to Capture:** Successful 10-Stage Pipeline Run in GitHub Actions tab.
- **Target Page / URL:** `https://github.com/AbhishekDixitt18/E-Commerce_Platform/actions`
- **Expected Proof:** All stages green:
  1. `Stage 1: Checkout`
  2. `Stage 2: Dependencies`
  3. `Stage 3: Code Quality & Frontend Build`
  4. `Stage 4: Automated Testing`
  5. `Stage 5: Docker Build`
  6. `Stage 6: Security Scanning`
  7. `Stage 7: Image Tagging`
  8. `Stage 8: Image Push`
  9. `Stage 9: EC2 Deployment & Rollback Safety`
  10. `Stage 10: Production Verification`

### 1.3 Automated Test Suite Execution & Coverage Report
- **Item to Capture:** Jest test output and coverage summary table.
- **Verification Command:**
  ```bash
  npm run test:coverage
  ```
- **Expected Output:**
  ```
  Test Suites: 5 passed, 5 total
  Tests:       30 passed, 30 total
  Statements:  82.12%
  ```

### 1.4 Docker Hub Image Registry & Version Tags
- **Item to Capture:** Docker Hub Repository showing immutable commit SHA tag and `latest`.
- **Target Page / URL:** `https://hub.docker.com/r/abhishekdixitt18/ecommerce-cloud-devops/tags`
- **Expected Proof:** Tags `sha-<commit_sha>` and `latest` pushed within minutes of the CI/CD pipeline run.

### 1.5 Live AWS EC2 Container Status
- **Item to Capture:** Terminal output showing all four operational production containers.
- **Verification Command (on EC2):**
  ```bash
  ssh -i ecommerce-key.pem ubuntu@54.252.184.109 "docker compose -f /home/ubuntu/E-Commerce_Platform/docker-compose.prod.yml ps"
  ```
- **Expected Output:**
  - `ecommerce-nginx-prod`: Up (healthy) on ports `0.0.0.0:80->80/tcp`, `0.0.0.0:443->443/tcp`
  - `ecommerce-api-prod`: Up (healthy) on port `3000/tcp` (internal)
  - `ecommerce-postgres-prod`: Up (healthy) on port `5432/tcp` (internal)
  - `ecommerce-prometheus-prod`: Up on port `0.0.0.0:9090->9090/tcp`

### 1.6 Live Frontend React SPA (Browser Screenshot)
- **Item to Capture:** Full browser window open to `http://54.252.184.109/`.
- **Target Page / URL:** `http://54.252.184.109/`
- **Key Visual Elements to Show:**
  - Sidebar with 6 sections (Dashboard, Products, Orders, Create Order, Inventory, System Health).
  - Executive KPI cards with amounts formatted in Indian Rupees (e.g. `₹1,26,450.00`).
  - Active products and recent orders table.
  - Zero console errors in Chrome DevTools.

### 1.7 Liveness & Readiness Probes
- **Item to Capture:** HTTP headers and JSON bodies from `/health` and `/health/ready`.
- **Verification Commands:**
  ```bash
  curl -i http://54.252.184.109/health
  curl -i http://54.252.184.109/health/ready
  ```
- **Expected Output:**
  - Both return `HTTP/1.1 200 OK`.
  - `/health/ready` reports database status `CONNECTED` with latency in milliseconds.

### 1.8 Nginx Reverse Proxy & API Routing
- **Item to Capture:** Product catalog JSON response proxied through Nginx.
- **Verification Command:**
  ```bash
  curl -i http://54.252.184.109/api/v1/products
  ```
- **Expected Output:**
  - `Server: nginx` header.
  - HTTP 200 OK with `data` array containing catalog products.

### 1.9 Database Volume Persistence
- **Item to Capture:** Container restart without data loss.
- **Verification Command (on EC2):**
  ```bash
  ssh -i ecommerce-key.pem ubuntu@54.252.184.109 "docker compose -f /home/ubuntu/E-Commerce_Platform/docker-compose.prod.yml restart postgres && sleep 5 && curl -s http://127.0.0.1/api/v1/products | grep -o '\"total\":[0-9]*'"
  ```
- **Expected Output:** Total count returns original record count (`"total":10`) confirming persistence.

### 1.10 Prometheus Telemetry & Metrics Scraper
- **Item to Capture:** Prometheus browser UI or terminal curl showing collected metrics.
- **Target Page / URL:** `http://54.252.184.109:9090/targets` or `http://54.252.184.109/metrics`
- **Verification Command:**
  ```bash
  curl -s http://54.252.184.109/metrics | grep http_requests_total | head -n 10
  ```
- **Expected Output:** Active Prometheus counters for GET/POST methods and status codes.

### 1.11 Database Backup & Restoration Execution
- **Item to Capture:** Output from the automated backup verification script.
- **Verification Command (on EC2):**
  ```bash
  ssh -i ecommerce-key.pem ubuntu@54.252.184.109 "cd /home/ubuntu/E-Commerce_Platform && ./scripts/verify-backup-restore.sh"
  ```
- **Expected Output:** Canary insertion, backup generation, test restore, and validation all return `[SUCCESS]`.

### 1.12 Rollback Guard Execution
- **Item to Capture:** Terminal demonstration or script test of `scripts/rollback.sh`.
- **Verification Command (on EC2):**
  ```bash
  ssh -i ecommerce-key.pem ubuntu@54.252.184.109 "cd /home/ubuntu/E-Commerce_Platform && ./scripts/rollback.sh --help"
  ```
- **Expected Output:** Displays rollback execution options and safe revert workflow.
