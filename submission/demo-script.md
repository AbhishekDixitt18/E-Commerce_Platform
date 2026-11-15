# Internship Assessment Video Demonstration Script (3–5 Minutes)

**Company:** ALGIONS AI LABS PRIVATE LIMITED  
**Project:** Cloud Deployment & CI/CD – E-Commerce Platform  
**Candidate / Presenter:** Abhishek Dixit  
**Estimated Run Time:** 4 Minutes 30 Seconds  
**Format:** Screen Recording with Voiceover

---

## Preparation Before Recording

1. **Browser Tabs to Open:**
   - Tab 1: `http://54.252.184.109/` (Live React Admin Dashboard)
   - Tab 2: `http://54.252.184.109/health/ready` (Live Database Readiness Probe)
   - Tab 3: `http://54.252.184.109:9090` (Prometheus Metrics Dashboard)
   - Tab 4: `https://github.com/AbhishekDixitt18/E-Commerce_Platform` (GitHub Repository)
   - Tab 5: `https://github.com/AbhishekDixitt18/E-Commerce_Platform/actions` (GitHub Actions CI/CD)
   - Tab 6: `https://hub.docker.com/r/abhishekdixitt18/ecommerce-cloud-devops/tags` (Docker Hub)
2. **Terminal Windows to Open:**
   - Terminal 1 (Local): Project root on your workstation (`E_Commerce Platform`).
   - Terminal 2 (SSH to EC2): Active SSH session into `ubuntu@54.252.184.109`.

---

## Minute-by-Minute Presentation Script

### Minute 0:00 – 0:30 | Introduction & Problem Statement
- **What to Show on Screen:**
  - Display the project [README.md](../README.md) or architecture diagram on GitHub.
- **What to Say:**
  > "Hello everyone. My name is Abhishek Dixit, and this is my final project demonstration for the Cloud Deployment and CI/CD technical assessment at Algions AI Labs Private Limited.
  > 
  > The objective of this project was to take a full-stack e-commerce platform and build a production-grade, highly available, secure, and observable infrastructure deployed on AWS EC2. A key requirement was establishing a fully automated continuous deployment pipeline with zero manual intervention on the server, paired with robust data persistence, concurrency protection, and instant rollback safety."

---

### Minute 0:30 – 1:15 | Architecture & Infrastructure Overview
- **What to Show on Screen:**
  - Switch to [`docs/architecture.png`](../docs/architecture.png) or Mermaid diagram.
- **What to Say:**
  > "Our architecture is built on a containerized multi-tier model running inside an isolated Docker bridge network on AWS EC2.
  > 
  > At the edge, an Nginx reverse proxy listens on ports 80 and 443, handling SSL termination, rate limiting, and static React asset delivery. The Express backend runs in a hardened Alpine container as an unprivileged non-root user supervised by dumb-init. PostgreSQL 16 stores catalog and order transactions with Docker volume persistence, and Prometheus continuously scrapes system and pool metrics. Notice that database port 5432 and backend port 3000 have zero public exposure—only Nginx is reachable publicly."

---

### Minute 1:15 – 2:00 | Live React Admin Dashboard & INR Localization
- **What to Show on Screen:**
  - Switch to browser Tab 1: `http://54.252.184.109/`.
  - Click through **Dashboard**, **Products**, **Orders**, and **Create Order**.
- **What to Say:**
  > "Here is our live production frontend running at public IP 54.252.184.109. The application is a React 18 Single Page Application compiled with Vite.
  > 
  > Notice that all financial metrics and pricing across the entire platform are strictly localized in Indian Rupees using the Indian numbering system. We have executive KPI cards showing total revenue, active orders, and low-stock alerts.
  > 
  > In the Product Management tab, we can search, filter by category, and view real-time stock levels. In the Orders section, we can place orders with live inventory validation and full idempotency protection to prevent duplicate orders during network retries."

---

### Minute 2:00 – 2:45 | Docker Containerization & Local Dev Port Partitioning
- **What to Show on Screen:**
  - Switch to Terminal 2 (SSH on EC2): Run `docker compose -f docker-compose.prod.yml ps`.
- **What to Say:**
  > "Looking at our production server via terminal, running `docker compose ps` shows our 4 active services: `ecommerce-nginx-prod`, `ecommerce-api-prod`, `ecommerce-postgres-prod`, and `ecommerce-prometheus-prod`. All containers have active automated healthchecks.
  > 
  > In our local development setup, we carefully preserved host port 3000 for developer Grafana dashboards by mapping the local Express API to host port 3001, allowing seamless local testing without port conflicts."

---

### Minute 2:45 – 3:30 | Automated CI/CD Pipeline & Zero-Manual-Touch Deployment
- **What to Show on Screen:**
  - Switch to Tab 5 (GitHub Actions) showing the 10 green stages.
  - Switch to Tab 6 (Docker Hub) showing the commit SHA tag.
- **What to Say:**
  > "Our CI/CD workflow in GitHub Actions implements 10 automated stages. When a commit is pushed to the main branch, it runs dependency installation, ESLint linting, Vite bundle verification, and executes our automated test suite of 30 tests with over 82% code coverage against a live PostgreSQL service container.
  > 
  > Following automated Trivy security scanning, the container image is tagged with the exact Git commit SHA and pushed to Docker Hub.
  > 
  > Stage 9 automatically connects to our AWS EC2 instance over SSH, pulls the exact image, uses our `frontend-sync` helper to update the Docker named volume, restarts the containers, and verifies application health. If any health probe fails, it automatically rolls back to the previous working release. As a developer, I never need to SSH in, run `git pull`, or restart containers manually."

---

### Minute 3:30 – 4:00 | Health Probes, Telemetry & Logging
- **What to Show on Screen:**
  - Switch to Tab 2: `http://54.252.184.109/health/ready`.
  - Switch to Tab 3: `http://54.252.184.109:9090`.
- **What to Say:**
  > "For observability, our `/health/ready` probe performs an active SQL ping to PostgreSQL, reporting exact latency in milliseconds and connection pool status.
  > 
  > Our Prometheus dashboard on port 9090 scrapes telemetry every 5 seconds, capturing request duration histograms, status code counts, and database pool utilization.
  > 
  > In the terminal, our structured JSON logs automatically sanitize sensitive authentication tokens before writing to standard out."

---

### Minute 4:00 – 4:30 | Disaster Recovery, Backup Verification & Conclusion
- **What to Show on Screen:**
  - In Terminal 2 (EC2): Run `./scripts/verify-backup-restore.sh`.
- **What to Say:**
  > "Finally, reliability and disaster recovery are guaranteed through our automated backup and restore toolset. Running `verify-backup-restore.sh` inserts a canary record into the active database, generates a timestamped gzip backup with a SHA256 checksum, restores it to an isolated test database, and validates data integrity.
  > 
  > In conclusion, this project provides a complete, resilient, containerized e-commerce infrastructure with fully automated CI/CD and production verification on AWS EC2. Thank you for your time and evaluation."
