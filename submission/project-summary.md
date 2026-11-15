# Executive Project Summary

**Company:** ALGIONS AI LABS PRIVATE LIMITED  
**Assessment Track:** Cloud Deployment & CI/CD Technical Assessment  
**Candidate / Author:** Abhishek Dixit  
**Project:** Cloud Deployment & CI/CD – E-Commerce Platform  
**Target Environment:** AWS EC2 Production (`Ubuntu 24.04 LTS`, `54.252.184.109`)  
**Repository:** [https://github.com/AbhishekDixitt18/E-Commerce_Platform.git](https://github.com/AbhishekDixitt18/E-Commerce_Platform.git)

---

## 1. Executive Summary

This project delivers a production-grade, enterprise-ready E-Commerce Product and Order Management Platform designed and engineered to demonstrate modern cloud engineering, containerization, site reliability engineering (SRE), and hands-free Continuous Integration and Continuous Deployment (CI/CD) automation.

The solution encompasses:
1. **Interactive SaaS Frontend:** A responsive React 18 Single Page Application (SPA) built with Vite, styled with an enterprise deep navy design system, and featuring end-to-end Indian Rupee (`₹` INR) currency localization.
2. **Reliable REST API Backend:** A high-throughput Node.js 20 & Express service implementing Joi validation, structured logging, Prometheus telemetry, and unprivileged non-root container execution.
3. **Transactional Database Engine:** PostgreSQL 16 persisting state in Docker named volumes, supporting pessimistic row-level locking (`SELECT ... FOR UPDATE`) to prevent overselling or race conditions during checkout, and maintaining an immutable audit log.
4. **Hardened Edge Perimeter:** An Nginx 1.25 reverse proxy serving React static assets with immutable 1-year caching, reverse-proxying API traffic, and enforcing rate limiting and security headers.
5. **Zero-Manual-Touch CI/CD Automation:** A 10-stage GitHub Actions pipeline that triggers upon pushes to `main`, tests the application against a live PostgreSQL container (30 tests, 100% pass rate, >82% coverage), scans for vulnerabilities with Trivy, pushes immutable version-tagged images to Docker Hub, and automatically updates the live AWS EC2 instance without requiring manual SSH logins, manual `git pull`, or container restarts.

---

## 2. Core Project Objectives & Verification Status

| Objective | Specification | Implementation & Verification | Status |
| :--- | :--- | :--- | :---: |
| **Containerization** | Multi-stage Docker packaging with least privilege | 3-stage Dockerfile (Vite builder, dependencies, runtime), dumb-init PID 1 supervisor, `USER node` non-root user. | **PASS** |
| **Edge Ingress** | Nginx reverse proxy & static asset delivery | Nginx 1.25 Alpine, Port 80 & 443, rate limiting, gzip, React Router SPA fallback (`try_files`), API reverse proxy. | **PASS** |
| **Database Persistence** | Relational integrity with volume survival | PostgreSQL 16 Alpine, Docker named volume `postgres-prod-data`, schema DDL, seed data, row locking. | **PASS** |
| **Automated CI/CD** | 10-Stage hands-free pipeline with rollback guard | GitHub Actions `.github/workflows/ci-cd.yml`, Trivy security scan, Docker Hub registry push, automated SSH deploy, rollback guard. | **PASS** |
| **Cloud Deployment** | Live deployment on public AWS EC2 | Deployed on `54.252.184.109` (Ubuntu 24.04 LTS, `ap-southeast-2`), answering HTTP 200 on `/`, `/health`, `/health/ready`, `/api/v1/products`. | **PASS** |
| **Currency Localization** | Indian Rupees (`₹` INR) across all views | Formatted via `Intl.NumberFormat('en-IN')` across product prices, order subtotals, and executive KPIs. | **PASS** |
| **Observability** | Telemetry, structured logs, and metrics | Prometheus 2.51 scraper container, `/metrics` endpoint via `prom-client`, structured JSON logging with auth scrubbing. | **PASS** |
| **Disaster Recovery** | Backup, restore, and failure testing | Shell automation scripts (`backup.sh`, `restore.sh`, `verify-backup-restore.sh`, `rollback.sh`), SHA256 verification. | **PASS** |

---

## 3. High-Level Architecture Topology

```
[ Developer ] ───> [ GitHub: main ] ───> [ GitHub Actions: 10 Stages ]
                                                    │
                                                    ▼
                                         [ Docker Hub Registry ]
                                                    │
                                                    ▼ (SSH Automated Deploy)
                                         [ AWS EC2: 54.252.184.109 ]
                                         ├── Nginx (Port 80/443)
                                         ├── Express API (Port 3000 internal)
                                         ├── PostgreSQL (Port 5432 internal)
                                         └── Prometheus (Port 9090)
```

---

## 4. Submission Artifacts Index

All requested documentation, runbooks, specifications, and evidence packages have been completed and validated against the live repository:

1. **Root Documentation:** [`README.md`](../README.md) (Complete 32-section guide with exact commands and port architecture)
2. **System Architecture:** [`docs/architecture.md`](../docs/architecture.md) & [`docs/architecture.png`](../docs/architecture.png)
3. **CI/CD Automation:** [`docs/ci-cd-pipeline.md`](../docs/ci-cd-pipeline.md)
4. **Operations Runbook:** [`docs/deployment-runbook.md`](../docs/deployment-runbook.md)
5. **Disaster Recovery:** [`docs/backup-restore.md`](../docs/backup-restore.md)
6. **Observability:** [`docs/monitoring.md`](../docs/monitoring.md)
7. **API Specifications:** [`docs/api-documentation.md`](../docs/api-documentation.md)
8. **Testing Report:** [`docs/testing-report.md`](../docs/testing-report.md)
9. **Security Hardening:** [`docs/security.md`](../docs/security.md)
10. **Submission Package:** [`submission/`](../submission/)
11. **Final Audit:** [`FINAL_SUBMISSION_AUDIT.md`](../FINAL_SUBMISSION_AUDIT.md)
