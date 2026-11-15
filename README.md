# Cloud Deployment & CI/CD – E-Commerce Platform

A production-grade, modular Node.js/Express and PostgreSQL REST API built as part of the backend engineering & DevOps assessment for **ALGIONS AI LABS PRIVATE LIMITED**.

---

## 📌 Project Overview

This repository provides the core backend API, database schema, containerization, and automation infrastructure for an E-Commerce Product and Order platform. The primary focus of this project is on production-grade engineering principles: modularity, resilient database pooling, request validation, structured error handling, containerization, observability, and automated CI/CD workflows.

---

## 🛠 Technology Stack

- **Runtime & Framework:** Node.js (v18+) & Express.js
- **Database:** PostgreSQL (v14+) with Connection Pooling (`pg`)
- **Validation:** Joi schema validation
- **Security:** Helmet, CORS, parameterized queries
- **Testing:** Jest & Supertest
- **Containerization:** Docker & Docker Compose (Multi-stage build)
- **CI/CD:** GitHub Actions

---

## 📂 Project Structure

```
ecommerce-cloud-devops/
├── .github/
│   └── workflows/
│       └── ci.yml                 # Automated CI workflow (Lint, Test, Docker Build)
├── database/
│   ├── schema.sql                 # DDL: products, orders, order_items, audit_logs
│   └── seed.sql                   # Sample product catalog & audit seed records
├── nginx/
│   └── nginx.conf                 # Production reverse proxy & rate limiting config
├── scripts/
│   ├── init-db.js                 # Schema migration runner
│   └── seed-db.js                 # Seed data population script
├── src/
│   ├── config/
│   │   ├── env.js                 # Centralized environment validator
│   │   └── database.js            # PostgreSQL connection pool & health probe
│   ├── controllers/
│   │   └── health.controller.js   # Liveness & readiness probe handlers
│   ├── middleware/
│   │   ├── errorHandler.js        # Centralized operational error handler
│   │   ├── notFoundHandler.js     # 404 handler for unmapped routes
│   │   └── validate.js            # Joi request validation middleware
│   ├── routes/
│   │   ├── health.routes.js       # Health endpoint definitions
│   │   └── index.js               # Master API router (/api/v1)
│   ├── services/
│   │   └── health.service.js      # System & database readiness service
│   ├── utils/
│   │   ├── apiError.js            # Custom operational ApiError class
│   │   ├── logger.js              # Structured logger
│   │   └── response.js            # Standardized API response formatters
│   ├── app.js                     # Express app setup (decoupled for testing)
│   └── server.js                  # Entrypoint with graceful shutdown & signal handlers
├── tests/
│   ├── integration/
│   │   └── health.test.js         # Integration tests for health probes & 404
│   └── unit/
│       ├── apiError.test.js       # Unit tests for ApiError
│       └── validate.test.js       # Unit tests for validation middleware
├── .dockerignore                  # Docker build exclusions
├── .env.example                   # Environment configuration template
├── .gitignore                     # Git exclusions (credentials, secrets, node_modules)
├── Dockerfile                     # Multi-stage production container definition
├── docker-compose.yml             # Orchestration for App and PostgreSQL
├── package.json                   # Project metadata and dependencies
└── README.md                      # Documentation
```

---

## 🗄 Database Design

The schema enforces strict relational integrity, check constraints, indexes, and automated timestamp triggers:

1. **`products`**: UUID primary key, SKU (unique index), title, description, price (CHECK `>= 0`), currency, inventory count (CHECK `>= 0`), category, status (`ACTIVE`, `INACTIVE`, `ARCHIVED`), and `updated_at` trigger.
2. **`orders`**: UUID primary key, unique human-readable order number, customer name and email, total amount, order lifecycle status (`PENDING`, `PAID`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`, `REFUNDED`), and shipping address.
3. **`order_items`**: Line items linked via foreign keys to `orders` (CASCADE) and `products` (RESTRICT), preserving historical unit price and quantity.
4. **`audit_logs`**: Immutable audit log capturing entity type, action, actor, IP address, and JSONB event payload for compliance and observability.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (>= 18.0.0)
- [Docker & Docker Compose](https://www.docker.com/)
- [PostgreSQL](https://www.postgresql.org/) (optional if running via Docker)

### 1. Environment Setup

Copy `.env.example` to create `.env`:

```bash
cp .env.example .env
```

Adjust variables if running against a custom PostgreSQL instance:
```env
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ecommerce_dev
DB_USER=postgres
DB_PASSWORD=postgres
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start PostgreSQL and Initialize Database

#### Option A: Using Docker Compose (Recommended)
Spins up PostgreSQL container and automatically maps port `5432`:
```bash
docker compose up -d postgres
```

#### Option B: Run Migration & Seed Scripts
Run the database creation and seeding scripts against the running database:
```bash
npm run db:init
npm run db:seed
```

### 4. Start the Application

#### Development Mode (with hot-reload):
```bash
npm run dev
```

#### Production Mode:
```bash
npm start
```

#### Full Stack via Docker Compose:
Spins up both the PostgreSQL database and Express API container:
```bash
docker compose up --build
```

---

## 🔍 Health & Verification Endpoints

| Method | Endpoint | Description | Expected Status |
|---|---|---|---|
| `GET` | `/` | Root API service information & endpoints index | `200 OK` |
| `GET` | `/health` | Basic liveness probe (uptime, node version, environment) | `200 OK` |
| `GET` | `/health/ready` | Deep readiness probe (checks PostgreSQL connectivity & latency) | `200 OK` / `503 Degraded` |
| `GET` | `/api/v1/health` | Versioned API health route | `200 OK` |

### Sample Readiness Response (`GET /health/ready`):
```json
{
  "success": true,
  "message": "All dependencies are healthy",
  "data": {
    "status": "UP",
    "uptimeSeconds": 14,
    "timestamp": "2026-11-14T08:47:29.786Z",
    "environment": "development",
    "version": "1.0.0",
    "system": {
      "nodeVersion": "v22.14.0",
      "platform": "win32",
      "arch": "x64",
      "memoryUsageMB": { "rss": 42, "heapUsed": 18, "heapTotal": 24 }
    },
    "dependencies": {
      "database": {
        "type": "PostgreSQL",
        "status": "CONNECTED",
        "latencyMs": 8,
        "pool": {
          "totalCount": 1,
          "idleCount": 1,
          "waitingCount": 0
        }
      }
    }
  },
  "timestamp": "2026-11-14T08:47:29.786Z"
}
```

---

## 🧪 Running Automated Tests

Run the test suite powered by Jest and Supertest:

```bash
# Run all unit and integration tests
npm test

# Run tests with coverage report
npm run test:coverage
```

---

## 🔒 Security & Git Policies

- `.env`, `.pem`, `.key`, and credential files are strictly excluded via `.gitignore`.
- HTTP Security headers configured via `helmet`.
- SQL injection prevention via PostgreSQL parameterized queries (`$1, $2, ...`).
- Input validation enforced at the middleware layer via Joi.
- Non-root user execution inside Docker container (`USER node`).


---

## ☁️ AWS EC2 Production Deployment Guide

This guide details the step-by-step procedure for deploying the E-Commerce Platform on an Ubuntu-based AWS EC2 instance following production-grade security, isolation, and observability standards.

### 1. EC2 Instance & Architecture Specifications

| Parameter | Recommended Production Value | Justification |
| :--- | :--- | :--- |
| **Instance Type** | `t2.micro` (or `t3.micro` where available) | **AWS Free Tier eligible** (1 vCPU, 1 GB RAM, sufficient for Node.js Alpine + PostgreSQL) |
| **Operating System** | **Ubuntu 24.04 LTS** (Noble Numbat) or **22.04 LTS** | Long Term Support, stable kernel, verified Docker Engine support |
| **Storage (EBS)** | 30 GB gp3 / gp2 root volume | Free-tier eligible (up to 30 GB EBS), ample space for Docker images and DB volume |
| **Network & VPC** | Default VPC or Custom Public Subnet | Auto-assign public IPv4 enabled |

### 2. Security Group Configuration (Least Privilege)

Create a dedicated Security Group (e.g., `ecommerce-api-sg`) with minimal required inbound rules:

| Type | Protocol | Port Range | Source | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **SSH** | TCP | `22` | `YOUR_PUBLIC_IP/32` | **Restricted SSH access** (Admins only, never 0.0.0.0/0) |
| **HTTP** | TCP | `80` | `0.0.0.0/0` | Public API & Nginx Reverse Proxy traffic |
| **HTTPS** | TCP | `443` | `0.0.0.0/0` | Secure SSL/TLS web traffic |

> [!CAUTION]
> **PostgreSQL (Port 5432)** and internal **Node.js (Port 3000)** must **NEVER** be open in the AWS Security Group. They communicate strictly over the internal isolated Docker bridge network (`ecommerce-backend-net`).

### 3. Step-by-Step Server Setup & Deployment

#### Step 1: Connect to the EC2 Instance via SSH
```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IPV4_ADDRESS>
```

#### Step 2: Clone the Project Repository
```bash
# Clone the repository
git clone https://github.com/AbhishekDixitt18/E-Commerce_Platform.git
cd E-Commerce_Platform
```

#### Step 3: Run the Automated Deployment Script
```bash
# Grant execution permissions
chmod +x scripts/deploy-ec2.sh scripts/verify-deployment.sh

# Run automated deployment
./scripts/deploy-ec2.sh
```
The automated script will:
1. Install Docker Engine and the Docker Compose plugin from official Docker APT repositories.
2. Add the `ubuntu` user to the `docker` group.
3. Generate a secure, production `.env` file with cryptographically random database passwords and admin API keys.
4. Launch the multi-container stack (`nginx`, `app`, `postgres`) via `docker-compose.prod.yml`.
5. Wait for container health checks to pass.
6. Automatically run the verification suite.

#### Manual Alternative (Step-by-Step):
```bash
# 1. Update and install Docker
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER

# 2. Configure Environment Variables
cp .env.example .env
nano .env  # Populate DB_PASSWORD and ADMIN_API_KEY with strong secrets

# 3. Deploy via Docker Compose
docker compose -f docker-compose.prod.yml up -d --build

# 4. Inspect container health
docker compose -f docker-compose.prod.yml ps
```

### 4. Post-Deployment Verification & Evidence

Run the automated verification script to validate all endpoints, transactions, and security barriers:

```bash
./scripts/verify-deployment.sh "http://<EC2_PUBLIC_IP>"
```

Expected verification output:
- `[PASS] Docker Container Orchestration | Expected: api & postgres running | Actual: Containers active`
- `[PASS] Liveness Probe (GET /health) | Expected: HTTP 200 | Actual: HTTP 200`
- `[PASS] Readiness Probe (GET /ready) | Expected: HTTP 200 (DB connected) | Actual: HTTP 200`
- `[PASS] Product Catalog (GET /api/v1/products) | Expected: HTTP 200 | Actual: HTTP 200`
- `[PASS] Product Detail (GET /api/v1/products/:id) | Expected: HTTP 200 | Actual: HTTP 200`
- `[PASS] Create Order (POST /api/v1/orders) | Expected: HTTP 201 | Actual: HTTP 201`
- `[PASS] Order Idempotency Guard | Expected: HTTP 200 (Existing Order) | Actual: HTTP 200`
- `[PASS] Admin Route Protection (No Key) | Expected: HTTP 401 Unauthorized | Actual: HTTP 401`
- `[PASS] Admin Product Creation & Audit (With Key) | Expected: HTTP 201 Created | Actual: HTTP 201`
