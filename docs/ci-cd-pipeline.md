# CI/CD Pipeline & Automated Continuous Deployment

**Company:** ALGIONS AI LABS PRIVATE LIMITED  
**Project:** Cloud Deployment & CI/CD – E-Commerce Platform  
**Workflow File:** [`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml)  
**Status:** Operational, Verified & Automated

---

## 1. Overview & Objectives

The Continuous Integration and Continuous Deployment (CI/CD) engine is built on **GitHub Actions**. It enforces strict quality gates, automated security scans, and completely hands-free continuous delivery to AWS EC2 (`54.252.184.109`).

### Core Deployment Guarantee: Zero Manual Touch
Whenever changes are pushed to the `main` branch:
1. The pipeline automatically executes all dependency installation, static analysis, unit/integration testing, and security scanning stages.
2. The pipeline builds a production Docker image encapsulating both the React 18 production bundle and the Node.js Express backend.
3. The pipeline pushes the immutable version-tagged image to Docker Hub.
4. The pipeline establishes an automated SSH session to the live AWS EC2 server, synchronizes the runtime container, triggers the `frontend-sync` named volume population, restarts the application and Nginx reverse proxy, and verifies health.
5. **No manual SSH login, no manual `git pull`, no container restarts, and no manual file copying are ever required on the EC2 server.**

---

## 2. Pipeline Trigger & Concurrency Configuration

```yaml
name: CI/CD Pipeline - E-Commerce Platform

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### Trigger Matrix:
- **Pull Requests to `main`:** Runs Stages 1 through 6 (Validation, Testing, Security Scanning, and Dry-run Packaging). Deployment to production is skipped.
- **Direct Push / Merge to `main`:** Runs all 10 Stages end-to-end, concluding with automated EC2 deployment and production verification.
- **Concurrency Control:** Ensures that overlapping commits cancel superseded CI runs, while the production deployment job (`stage-9-ec2-deployment`) uses a dedicated serialization lock (`concurrency: group: ec2-production-deployment, cancel-in-progress: false`) to avoid concurrent server collisions.

---

## 3. Detailed Stage-by-Stage Breakdown

```mermaid
flowchart TD
    subgraph CI_Quality_Gates ["Continuous Integration (CI) Quality Gates"]
        S1["Stage 1: Checkout<br>actions/checkout@v4"]
        S2["Stage 2: Dependencies<br>Node 20 | npm ci (Backend & Frontend)"]
        S3["Stage 3: Code Quality<br>ESLint Static Checks & Vite Build Verification"]
        S4["Stage 4: Automated Testing<br>PostgreSQL Service Container | Jest (30 Tests)"]
        S5["Stage 5: Docker Build<br>Multi-Stage Dockerfile (Alpine)"]
        S6["Stage 6: Security Scanning<br>Aqua Security Trivy Scanner"]
    end

    subgraph CD_Packaging ["Continuous Delivery (CD) Packaging"]
        S7["Stage 7: Image Tagging<br>Tag: sha-${GITHUB_SHA} & latest"]
        S8["Stage 8: Registry Push<br>Docker Hub: abhishekdixitt18/ecommerce-cloud-devops"]
    end

    subgraph CD_Deployment ["Production EC2 Automated Deployment"]
        S9["Stage 9: Automated EC2 Deploy & Rollback Guard<br>SSH Execution | frontend-sync | Health Check Loop"]
        S10["Stage 10: Production Verification<br>External Public Probes (/, /health, /health/ready, /api/v1/products)"]
    end

    S1 --> S2
    S2 --> S3
    S3 --> S4
    S4 --> S5
    S5 --> S6
    S6 --> S7
    S7 --> S8
    S8 --> S9
    S9 --> S10
```

### Stage 1: Checkout
- **Action:** `actions/checkout@v4`
- **Purpose:** Checks out the exact Git commit SHA triggering the build, outputs commit metadata, and ensures clean workspace state.

### Stage 2: Dependencies Installation
- **Action:** `actions/setup-node@v4` (Node.js 20 LTS, npm caching enabled)
- **Execution:**
  ```bash
  npm ci                   # Backend dependencies from package-lock.json
  cd frontend && npm ci    # Frontend dependencies from frontend/package-lock.json
  ```
- **Integrity Check:** Runs `npm ls --depth=0` to ensure strict dependency tree integrity.

### Stage 3: Code Quality & Frontend Build Verification
- **Execution:**
  1. **ESLint Static Analysis:** `npm run lint` inspects backend controllers, middleware, and services.
  2. **Vite Production Compilation:** `cd frontend && npm run build` compiles React JSX, CSS modules, and assets into `frontend/dist/`.
  3. **Artifact Verification:**
     ```bash
     if [ ! -f "frontend/dist/index.html" ]; then
       echo "ERROR: frontend/dist/index.html was not generated!"
       exit 1
     fi
     ```

### Stage 4: Automated Testing with Isolated PostgreSQL
- **Database Service Container:** Spawns an isolated `postgres:16-alpine` service container on port 5432 with health check probe `pg_isready`.
- **Database Migration:** Executes `npm run db:init` and `npm run db:seed`.
- **Test Suite:** Executes `npm run test:coverage` (Jest & Supertest).
- **Quality Gate:** Requires 100% test pass rate across all 30 tests and enforces code coverage thresholds (>82% statement coverage achieved).

### Stage 5: Multi-Stage Docker Image Build
- **Builder:** `docker/setup-buildx-action@v3` and `docker/build-push-action@v5`
- **Context:** Root repository directory using the multi-stage [Dockerfile](../Dockerfile).
- **Artifact:** Compiles the runtime container and exports it as an archive artifact (`/tmp/docker-build/ecommerce-api.tar`) to be passed to subsequent pipeline stages without rebuilding.

### Stage 6: Security Scanning (Trivy Vulnerability Scanner)
- **Scanner:** `aquasecurity/trivy-action@v0.36.0`
- **Target:** Loaded local image `ecommerce-api:${{ github.sha }}`
- **Severity Filter:** `CRITICAL,HIGH`
- **Vulnerability Types:** OS packages (`alpine`) and application library dependencies (`npm`).
- **Reporting:** Tabular report generated directly in the GitHub Actions runner log.

### Stage 7: Image Version Tagging
- **Action:** `docker/metadata-action@v5`
- **Naming Pattern:**
  - `sha-${GITHUB_SHA}` (short immutable Git SHA tag, e.g., `sha-4ea3b64`)
  - `latest` (active production release pointer on `main`)
- **Output:** Saves generated tags to artifact archive for the push stage.

### Stage 8: Container Registry Push
- **Registry:** Docker Hub (`https://hub.docker.com/r/abhishekdixitt18/ecommerce-cloud-devops`)
- **Authentication:** Authenticates securely via `secrets.DOCKERHUB_USERNAME` and `secrets.DOCKERHUB_TOKEN`.
- **Execution:** Tags and pushes both the commit SHA tag and `latest` tag to Docker Hub.

### Stage 9: Automated AWS EC2 Deployment & Rollback Guard
- **Action:** `appleboy/ssh-action@v1.0.3`
- **Authentication:** Connects over SSH Port 22 using `secrets.EC2_HOST`, `secrets.EC2_USER`, and `secrets.EC2_SSH_PRIVATE_KEY` (or `secrets.EC2_SSH_KEY`).
- **Automated Host Execution Sequence:**
  ```bash
  set -e
  cd ~/E-Commerce_Platform

  # 1. Capture running container image for rollback safety
  PREV_IMAGE=$(sudo docker inspect --format='{{.Image}}' ecommerce-api-prod 2>/dev/null || echo "")

  # 2. Synchronize repository state
  git fetch origin main && git reset --hard origin/main

  # 3. Pull or build verified application container
  TARGET_IMAGE="abhishekdixitt18/ecommerce-cloud-devops:sha-${{ github.sha }}"
  if sudo docker pull "$TARGET_IMAGE"; then
    export APP_IMAGE="$TARGET_IMAGE"
  else
    sudo docker compose -f docker-compose.prod.yml build app
    export APP_IMAGE="abhishekdixitt18/ecommerce-cloud-devops:latest"
  fi

  # 4. Synchronize React frontend assets to Docker named volume
  sudo docker compose -f docker-compose.prod.yml run --rm frontend-sync || true
  sudo docker create --name temp-sync-assets "$APP_IMAGE" 2>/dev/null || true
  sudo docker cp temp-sync-assets:/usr/src/app/frontend/dist/. ./frontend/dist/ 2>/dev/null || true
  sudo docker rm -f temp-sync-assets 2>/dev/null || true

  # 5. Recreate app & Nginx containers (preserves postgres-prod-data volume)
  sudo docker compose -f docker-compose.prod.yml up -d --remove-orphans app nginx

  # 6. Local Health Verification Loop (12 attempts, 60 seconds)
  HEALTH_PASSED=false
  for i in {1..12}; do
    if curl -sf http://127.0.0.1/health > /dev/null && \
       curl -sf http://127.0.0.1/health/ready > /dev/null && \
       curl -s http://127.0.0.1/ | grep -q '<div id="root">'; then
      HEALTH_PASSED=true
      break
    fi
    sleep 5
  done

  # 7. Automated Rollback on Verification Failure
  if [ "$HEALTH_PASSED" != "true" ]; then
    echo "::error ::Health verification failed! Triggering automatic rollback..."
    if [ -n "$PREV_IMAGE" ]; then
      sudo docker tag "$PREV_IMAGE" "abhishekdixitt18/ecommerce-cloud-devops:rollback-active"
      export APP_IMAGE="abhishekdixitt18/ecommerce-cloud-devops:rollback-active"
      sudo docker compose -f docker-compose.prod.yml up -d app
      sudo docker compose -f docker-compose.prod.yml restart nginx
    fi
    exit 1
  fi
  ```

### Stage 10: Production Verification
- **Runner:** GitHub Actions Ubuntu runner connects externally to `http://${EC2_HOST}/` (Public IP `54.252.184.109`).
- **Verifications:**
  1. `http://54.252.184.109/health` returns HTTP 200 `UP`.
  2. `http://54.252.184.109/health/ready` returns HTTP 200 with database connectivity confirmation.
  3. `http://54.252.184.109/` returns HTTP 200 and serves HTML containing `<div id="root">`.
  4. `http://54.252.184.109/api/v1/products` returns HTTP 200 and valid JSON data.
- **Failure Handling:** If any check fails, the pipeline exits with status 1, marking the deployment failed and alerting the engineering team.

---

## 4. How Frontend-Only and Backend-Only Changes Are Deployed

Because the application uses a **unified multi-stage Docker build**:
1. **Frontend-Only Changes** (e.g., modifying CSS, React components, or INR formatting):
   - Trigger the pipeline on `main`.
   - Stage 3 compiles the Vite bundle.
   - Stage 5 packages the compiled `dist/` into the Docker image at `/usr/src/app/frontend/dist`.
   - Stage 9 pulls the new image and `frontend-sync` extracts the latest assets directly into the `frontend-assets` named volume. Nginx immediately begins serving the new React components without touching the database or disrupting the backend.
2. **Backend-Only Changes** (e.g., adding an API route or query optimization):
   - Trigger the pipeline on `main`.
   - Stage 4 verifies all 30 tests against the PostgreSQL test container.
   - Stage 5 packages the updated `src/` files into the Docker image.
   - Stage 9 pulls the new image and recreates the `app` container. Nginx maintains continuous reverse proxying without dropping connections.

---

## 5. Required GitHub Secrets Configuration

To enable the automated pipeline, the following secrets must be configured in the GitHub repository under **Settings → Secrets and variables → Actions**:

| Secret Key | Description | Example / Format |
| :--- | :--- | :--- |
| `EC2_HOST` | Public IP or DNS of the production AWS EC2 instance | `54.252.184.109` |
| `EC2_USER` | SSH remote username on Ubuntu AMI | `ubuntu` |
| `EC2_SSH_PRIVATE_KEY` | Private SSH key for EC2 authentication | `-----BEGIN RSA PRIVATE KEY-----...` |
| `DOCKERHUB_USERNAME` | Docker Hub registry account username | `abhishekdixitt18` |
| `DOCKERHUB_TOKEN` | Docker Hub Personal Access Token (Read & Write permissions) | `dckr_pat_...` |
