# Database Backup, Restoration & Disaster Recovery

**Company:** ALGIONS AI LABS PRIVATE LIMITED  
**Project:** Cloud Deployment & CI/CD – E-Commerce Platform  
**Target Database:** PostgreSQL 16 Alpine (`ecommerce-postgres-prod`)  
**Persistent Storage:** Docker Named Volume `postgres-prod-data`  
**Utilities:** [`scripts/backup.sh`](../scripts/backup.sh), [`scripts/restore.sh`](../scripts/restore.sh), [`scripts/verify-backup-restore.sh`](../scripts/verify-backup-restore.sh)

---

## 1. Overview & Strategy

The database architecture is designed with **dual-layer protection**:
1. **Primary Persistence:** PostgreSQL data files reside inside the dedicated Docker named volume `postgres-prod-data:/var/lib/postgresql/data`. This volume is completely decoupled from container lifecycles; running `docker compose down`, rebuilding images, or restarting the host retains all data intact.
2. **Point-In-Time Logical Backups:** Backups are generated via `pg_dump`, compressed with `gzip`, tagged with ISO timestamps, verified via SHA256 checksums, and stored with restricted permissions (`0600`).
3. **Safety Protection:** Production restorations require explicit confirmation flags (`--confirm-production`) and automatically generate a pre-restoration safety snapshot before modifying production tables.

---

## 2. Backup Strategy & Execution

### 2.1 Backup Script Features (`scripts/backup.sh`)
- **Execution Vector:** Runs `pg_dump` directly inside the running `ecommerce-postgres-prod` container.
- **Compression:** Streams directly through `gzip -9` to generate `.sql.gz` archives.
- **Integrity Validation:** Generates a companion `.sha256` checksum file immediately following creation.
- **Security:** Restricts file permissions to `chmod 0600` so only the owner can read backup archives.
- **Retention & Rotation:** Automatically rotates and prunes backups older than 7 days (`find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete`).

### 2.2 Manual Backup Command
To trigger an immediate backup on the AWS EC2 instance:
```bash
cd ~/E-Commerce_Platform
./scripts/backup.sh
```

**Sample Output:**
```
=============================================================================
   PostgreSQL Automated Database Backup Utility
   Target Database:  ecommerce_prod
   Timestamp:        20261115_222530
   Destination:      /home/ubuntu/E-Commerce_Platform/backups
=============================================================================
[INFO] Locating PostgreSQL container...
[SUCCESS] Detected active container: ecommerce-postgres-prod
[INFO] Executing pg_dump streaming through gzip compression...
[SUCCESS] Backup created successfully:
         File: /home/ubuntu/E-Commerce_Platform/backups/ecommerce_prod_backup_20261115_222530.sql.gz
         Size: 14.8 KB
[INFO] Calculating SHA-256 checksum...
[SUCCESS] SHA-256: 7f8a9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a
[INFO] Applying secure permissions (0600)...
[INFO] Checking for backups older than 7 days...
[SUCCESS] Backup operation completed successfully!
```

### 2.3 Automated Periodic Backups (Cron Configuration)
To schedule automated daily backups at 02:00 UTC on the EC2 host:
```bash
# Add cron job to ubuntu user crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /home/ubuntu/E-Commerce_Platform/scripts/backup.sh >> /home/ubuntu/E-Commerce_Platform/backups/backup.log 2>&1") | crontab -
```

---

## 3. Database Restoration & Recovery Runbook

Restoring a database must adhere to strict safety guardrails to prevent accidental loss of active customer orders or inventory states.

### 3.1 Scenario A: Isolated Sandbox Verification (Recommended)
Before applying a backup to production, test it in an isolated sandbox database (`ecommerce_restore_test`):
```bash
cd ~/E-Commerce_Platform
./scripts/restore.sh backups/ecommerce_prod_backup_20261115_222530.sql.gz ecommerce_restore_test
```
This procedure:
1. Validates the archive integrity using `gunzip -t`.
2. Creates an empty database `ecommerce_restore_test`.
3. Streams the SQL dump into the sandbox.
4. Verifies table creation and record counts without touching production data.

### 3.2 Scenario B: Full Production Restoration
If recovering from catastrophic data corruption:
```bash
cd ~/E-Commerce_Platform
./scripts/restore.sh backups/ecommerce_prod_backup_20261115_222530.sql.gz ecommerce_prod --confirm-production
```
**Safety Safeguards Enforced by `restore.sh`:**
1. **Safety Gate:** Rejects execution if `--confirm-production` is omitted when targeting `ecommerce_prod`.
2. **Pre-Restore Snapshot:** Automatically dumps the current active database to `pre_restore_safety_snapshot_<timestamp>.sql.gz` before applying changes.
3. **Connection Termination:** Terminates active client connection pools (`pg_terminate_backend(pid)`) to prevent deadlock or dirty writes during restoration.
4. **Transaction Integrity:** Restores schema and rows inside an active transaction.
5. **Post-Restoration Audit:** Verifies row counts in `products`, `orders`, and `audit_logs`.

---

## 4. End-to-End Backup & Restore Automated Verification

The repository includes an automated testing harness: [`scripts/verify-backup-restore.sh`](../scripts/verify-backup-restore.sh).

### What the Verification Suite Tests:
1. **Canary Insertion:** Inserts a uniquely stamped UUID canary product into the active database.
2. **Backup Generation:** Executes `backup.sh` to generate a compressed backup file.
3. **Sandbox Restoration:** Restores the backup into an ephemeral test database.
4. **Canary Validation:** Queries the restored database to confirm that the canary UUID and all associated attributes survived intact.
5. **Cleanup:** Drops the ephemeral test database and removes the canary record from production.

### Execution Command:
```bash
cd ~/E-Commerce_Platform
./scripts/verify-backup-restore.sh
```

---

## 5. Container & Volume Failure Recovery Matrix

| Incident Type | Impact | Recovery Procedure | Recovery Time Objective (RTO) | Recovery Point Objective (RPO) |
| :--- | :--- | :--- | :--- | :--- |
| **App Container Crash** | API temporarily unreachable | Docker daemon automatically restarts container (`restart: always`). If needed, run `docker compose up -d app`. | < 10 seconds | 0 (No data loss) |
| **PostgreSQL Container Crash** | Database queries fail with 502/500 | Docker restarts container. PostgreSQL recovers WAL logs from `postgres-prod-data`. | < 30 seconds | 0 (ACID crash recovery) |
| **EC2 VM Host Reboot** | All containers stopped | Docker daemon starts all containers automatically via `restart: always`. | < 90 seconds | 0 (Volume persisted on gp3 SSD) |
| **Accidental Table Deletion** | Specific table or rows dropped | Run `scripts/restore.sh` pointing to the latest daily backup archive. | < 5 minutes | <= 24 hours (or time since last backup) |
| **Corrupted Host Volume** | SSD storage corruption | Provision new volume, run `npm run db:init`, and execute `restore.sh` from offsite backup. | < 15 minutes | Time since last backup |

> [!CAUTION]
> **Data Persistence Warning:** Never run `docker compose down -v`. Docker named volumes (`postgres-prod-data`, `frontend-assets`, `prometheus-prod-data`) are explicitly isolated from container lifecycles. Removing `-v` guarantees zero data loss during deployments or service restarts.
