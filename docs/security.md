# Security Architecture, Controls & Hardening Specifications

**Company:** ALGIONS AI LABS PRIVATE LIMITED  
**Project:** Cloud Deployment & CI/CD – E-Commerce Platform  
**Target Environment:** AWS EC2 Production (`54.252.184.109`)  
**Security Principles:** Defense in Depth, Principle of Least Privilege, Zero Trust Network Segmentation, Immutable Audit Trails

---

## 1. Security Architecture & Threat Boundary

```
[ External Untrusted Network (Public Internet) ]
                     │
                     ▼ (Port 80 / 443 Only)
┌─────────────────────────────────────────────────────────────┐
│ 1. AWS Security Group Boundary (sg-0e054f773dad87b79)       │
│    • Inbound allowed: Port 80 (HTTP), 443 (HTTPS), 22 (SSH) │
│    • Inbound BLOCKED: Port 5432 (PostgreSQL), 3000 (Node API│
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Edge Reverse Proxy Hardening (ecommerce-nginx-prod)      │
│    • Rate Limiting: 10 req/sec, burst 20 (limit_req_zone)   │
│    • Server Signature Masking: server_tokens off            │
│    • Client Request Limits: client_max_body_size 10M        │
│    • Strict-Transport-Security & Content-Security-Policy    │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼ (Internal Docker Bridge Net Only)
┌─────────────────────────────────────────────────────────────┐
│ 3. Application Runtime Security (ecommerce-api-prod)        │
│    • Non-Root Container: USER node (UID 1000)               │
│    • Process Isolation: dumb-init (PID 1 zombie reaping)    │
│    • Joi Strict Schema Validation on all inputs             │
│    • Helmet HTTP Security Headers                           │
│    • Administrative Key Protection (x-admin-api-key)        │
│    • Structured Access Log Sanitization (Scrubbed Auth)     │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼ (Internal Docker Bridge Net Only)
┌─────────────────────────────────────────────────────────────┐
│ 4. Data Layer Security (ecommerce-postgres-prod)            │
│    • Zero Host Port Exposure (Internal port 5432)           │
│    • Parameterized SQL Queries (Zero SQL Injection)         │
│    • Pessimistic Row-Level Locks on Stock Transactions      │
│    • Encrypted Backups (chmod 0600, SHA256 Verified)        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Principle of Least Privilege in Container Runtime

### 2.1 Unprivileged Non-Root User Execution (`USER node`)
Running containers as the Linux `root` user presents a severe privilege escalation vulnerability. The production [Dockerfile](../Dockerfile) strictly enforces unprivileged execution:
```dockerfile
# Stage 3: Production Runtime
FROM node:20-alpine AS runtime

# Ensure application files are owned by the unprivileged 'node' user
RUN chown -R node:node /usr/src/app

# Enforce least privilege: run container as non-root user
USER node

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "src/server.js"]
```

### 2.2 Process Supervision with `dumb-init`
Node.js was not designed to act as init process PID 1. Without a proper init wrapper, signals like `SIGTERM` and `SIGINT` from Docker are ignored by default, resulting in ungraceful container kills and zombie process accumulation. We integrate `dumb-init` as PID 1 to guarantee clean signal propagation and orderly database pool disconnection during redeployments.

---

## 3. Network Segmentation & Port Exposure Policy

The AWS Security Group (`sg-0e054f773dad87b79`) and Docker Compose configurations strictly partition network access:

| Service | Container Port | Host Port | Network Scope | Security Boundary Justification |
| :--- | :---: | :---: | :--- | :--- |
| **Nginx** | `80`, `443` | `80`, `443` | **Public (Internet)** | Legitimate edge ingress for React SPA assets and reverse-proxied API requests. |
| **Express API** | `3000` | **None** | **Internal Bridge Only** | Node.js container is not exposed to the public internet; accessible exclusively via Nginx upstream routing. |
| **PostgreSQL** | `5432` | **None** | **Internal Bridge Only** | Database port is not exposed on host interfaces; accessible exclusively by the backend container over `ecommerce-backend-net`. |
| **Prometheus** | `9090` | `9090` | **Restricted** | Time-series scraper and query dashboard. |
| **SSH** | `22` | `22` | **Admin Only** | Encrypted administrative access and GitHub Actions automated deployment. |

---

## 4. Input Validation & Injection Defense

### 4.1 Strict Joi Request Validation
All endpoints enforce rigid schema validation via `middleware/validate.js` before reaching business logic:
- **UUID Validation:** Product and order identifiers must conform to strict UUID v4 standards (`Joi.string().uuid().required()`), preventing path traversal and malformed SQL execution.
- **Payload Boundaries:** Customer names, emails, addresses, and SKUs are validated for length, trim, character format, and casing.
- **Numerical Protection:** Quantities must be positive integers (`Joi.number().integer().min(1)`), strictly preventing negative-quantity balance attacks.

### 4.2 Parameterized SQL Execution
Direct string concatenation in SQL queries is categorically banned. All database queries throughout `src/services/` utilize PostgreSQL parameterized queries ($1, $2, etc.):
```javascript
// Parameterized query prevents SQL Injection attacks
const result = await pool.query(
  'SELECT id, name, price, inventory_count FROM products WHERE id = $1 AND status = $2',
  [productId, 'ACTIVE']
);
```

---

## 5. Administrative Authentication & Sensitive Header Redaction

### 5.1 Administrative API Key Gate
Administrative operations (`POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/:id/stock`) are protected by `middleware/adminAuth.js`. Incoming requests must provide the valid secret key via the `x-admin-api-key` header. Requests with missing or mismatched keys are rejected with HTTP 401 Unauthorized before any service execution occurs.

### 5.2 Automated Log Sanitization
To prevent credential leakage in log aggregation pipelines, `middleware/requestLogger.js` automatically sanitizes incoming headers before logging:
- `authorization` -> `[REDACTED]`
- `x-admin-api-key` -> `[REDACTED]`
- `cookie` -> `[REDACTED]`

---

## 6. Secret Management & GitHub Actions Security

1. **Zero Secret Check-In:** No passwords, private keys, database credentials, or administrative tokens are checked into version control. The repository maintains a sanitized [`.env.example`](../.env.example) file for reference.
2. **Production `.env` Protection:** On the EC2 host, `.env` file permissions are restricted to `chmod 600` (readable only by the `ubuntu` owner).
3. **CI/CD Deployment Secrets:** Continuous deployment credentials are stored exclusively in GitHub Actions Encrypted Secrets:
   - `EC2_HOST`: IP address of production server.
   - `EC2_USER`: SSH service account (`ubuntu`).
   - `EC2_SSH_PRIVATE_KEY`: Cryptographic SSH private key (`.pem`).
   - `DOCKERHUB_USERNAME` & `DOCKERHUB_TOKEN`: Docker Hub deployment token.

---

## 7. Container Vulnerability Scanning (Trivy)

During Stage 6 of the CI/CD pipeline, Aqua Security's **Trivy Scanner** analyzes the freshly built Docker image for:
1. Known Common Vulnerabilities and Exposures (CVEs) in Alpine OS base packages.
2. High and critical security vulnerabilities across all production npm packages.
3. Outdated or insecure dependencies before pushing images to Docker Hub.

---

## 8. SSL / TLS Status & Production Security Hardening

- **Nginx TLS Configuration:** Nginx is pre-configured with TLS 1.2 and TLS 1.3 protocol support, strong modern ciphers (`ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:...`), and automated webroot ACME challenge location blocks for Let's Encrypt renewal (`/.well-known/acme-challenge/`).
- **HTTP Security Headers:**
  - `X-Frame-Options: DENY` (Mitigates clickjacking)
  - `X-Content-Type-Options: nosniff` (Mitigates MIME-sniffing)
  - `X-XSS-Protection: 1; mode=block` (Mitigates reflective XSS)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Content-Security-Policy: default-src 'self' ...`

---

## 9. Security Limitations & Future Roadmap

1. **Self-Signed / HTTP Edge:** Currently, the live server is accessed via public IPv4 (`http://54.252.184.109/`). While Nginx has TLS configuration in place, standard commercial SSL certificates require an associated Fully Qualified Domain Name (FQDN) rather than a raw IP address. Connecting a domain name and attaching AWS ACM or Let's Encrypt Certbot will enable trusted green-padlock HTTPS.
2. **AWS Secrets Manager Integration:** Production database passwords and admin keys currently reside in the encrypted EC2 `.env` file. A future enterprise enhancement will inject secrets directly from AWS Secrets Manager or HashiCorp Vault.
