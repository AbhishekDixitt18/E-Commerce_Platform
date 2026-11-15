# Implementation Overview & Engineering Decisions

**Company:** ALGIONS AI LABS PRIVATE LIMITED  
**Project:** Cloud Deployment & CI/CD – E-Commerce Platform  
**Candidate / Author:** Abhishek Dixit  
**Domain:** DevOps & Cloud Engineering

---

## 1. Architectural Philosophy & Design Principles

The technical implementation of this platform was guided by four fundamental engineering pillars:
1. **Decoupling & Modularity:** Clean separation between the React SPA presentation layer, the Express.js business logic, and PostgreSQL data persistence.
2. **Infrastructure as Code & Immutability:** Docker containers encapsulate all runtime dependencies; container images built by the CI pipeline are tagged with immutable Git commit SHAs.
3. **Defense in Depth & Least Privilege:** Containers execute as non-root users; internal database and API ports are strictly hidden from public routing.
4. **Resilience & Zero-Manual-Intervention:** Deployments, rollbacks, and volume synchronization occur automatically via pipeline automation without requiring manual SSH logins or host-level build commands.

---

## 2. Key Engineering Decisions & Technical Trade-offs

### 2.1 Multi-Stage Dockerfile Packaging
- **Decision:** Implemented a 3-stage multi-stage [Dockerfile](../Dockerfile):
  - Stage 1: `frontend-builder` (compiles Vite React SPA to `dist/`).
  - Stage 2: `dependencies` (installs production Node.js dependencies using `npm ci --omit=dev`).
  - Stage 3: `runtime` (copies compiled frontend and node_modules into a minimal `node:20-alpine` image).
- **Trade-off Analysis:** While multi-stage builds require more build memory in CI, they yield a single, unified, immutable artifact. The runtime image size is reduced to a minimal footprint, completely eliminating developer dependencies (`vite`, `esbuild`, `eslint`, `jest`) from the production attack surface.

### 2.2 Decoupled Frontend Distribution via Docker Named Volume (`frontend-sync`)
- **Challenge:** In production, Nginx serves static assets at `/var/www/html`. Mounting a host directory (`./frontend/dist`) required running `git pull` and `npm run build` on the EC2 host. Because Node.js and npm are not installed on the production EC2 host, updates to frontend files caused stale assets or HTTP 403 errors.
- **Decision:** Introduced a dedicated one-shot synchronization helper (`frontend-sync`) in [docker-compose.prod.yml](../docker-compose.prod.yml). Upon deployment, `frontend-sync` extracts the compiled `/usr/src/app/frontend/dist` directly from the newly pulled application container image into the Docker named volume `frontend-assets`.
- **Engineering Advantage:** Nginx mounts `frontend-assets:/var/www/html:ro`. This eliminates all host-level build dependencies. The EC2 host remains a pristine, lightweight Docker host requiring zero build tools.

### 2.3 Concurrency Control & Row-Level Locking in Checkout
- **Challenge:** High-volume concurrent checkouts competing for limited stock can lead to race conditions, overselling, and negative inventory balances.
- **Decision:** Implemented explicit ACID transactions with pessimistic row-level locking (`SELECT ... FOR UPDATE`) in `src/services/order.service.js`.
- **Engineering Advantage:** PostgreSQL locks the specific product row during stock verification and deduction. Competing transactions queue safely until the active transaction commits. If stock drops below requested quantity, the transaction rolls back cleanly and returns HTTP 409 Conflict without altering inventory.

### 2.4 Idempotent Order Creation via Unique Request Keys
- **Challenge:** Flaky mobile networks or aggressive client retries can cause duplicate orders and double stock deductions.
- **Decision:** Supported the `Idempotency-Key` request header. The database enforces a `UNIQUE` constraint on `orders.idempotency_key`.
- **Engineering Advantage:** If a retry request arrives with an existing key, the service immediately queries and returns the original order envelope without modifying inventory or generating duplicate billing.

### 2.5 Local Development Port Partitioning (Grafana Port 3000 Protection)
- **Challenge:** Developer workstations frequently run local monitoring stacks (Grafana) on port 3000.
- **Decision:** In [docker-compose.yml](../docker-compose.yml), the local Express API is mapped to host port `3001` (`3001:3000`), preserving host port `3000` for local Grafana dashboards. The Vite dev server proxies `/api` requests to `localhost:3001`, ensuring seamless developer workflow without port contention.

---

## 3. Technology Stack Justification

| Layer | Chosen Technology | Alternatives Evaluated | Justification |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | **React 18.3 (Vite)** | Next.js, CRA | Vite provides instantaneous HMR in development and generates lean, optimized ES module chunks for Nginx static serving without requiring a dedicated Node SSR server. |
| **Backend Runtime** | **Node.js 20 LTS (Express)** | Fastify, NestJS | High ecosystem maturity, native async/await for non-blocking I/O, lightweight memory footprint (59MB RSS), seamless Prometheus exporter integration. |
| **Database** | **PostgreSQL 16 Alpine** | MySQL, MongoDB | Strict relational integrity, native UUID v4 support, robust pessimistic row locks (`SELECT FOR UPDATE`), JSONB column support for audit logs. |
| **Edge Proxy** | **Nginx 1.25 Alpine** | Traefik, Caddy | Industry-standard edge proxy with high connection concurrency (epoll), low memory footprint (< 15MB), hardened rate limiting, and proven static file serving. |
| **CI/CD** | **GitHub Actions** | Jenkins, GitLab CI | Deep native integration with GitHub repository, managed ephemeral runners, secure secret injection, multi-job dependency chaining with rollback hooks. |
| **Observability** | **Prometheus 2.51** | Datadog, New Relic | Open-source, vendor-neutral time-series metrics collection via standard `/metrics` endpoint; zero external software licenses required. |
