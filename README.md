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
