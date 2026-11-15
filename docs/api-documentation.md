# E-Commerce Platform REST API Specification

**Company:** ALGIONS AI LABS PRIVATE LIMITED  
**Project:** Cloud Deployment & CI/CD – E-Commerce Platform  
**Base Production URL:** `http://54.252.184.109/api/v1`  
**Internal Port:** `3000` (Reverse-proxied via Nginx)  
**API Prefix:** `/api/v1` (with `/api/*` compatibility aliases)

---

## 1. Global Standards & Conventions

### 1.1 Content Types & Encoding
- All request payloads must be encoded as `application/json; charset=utf-8`.
- All response payloads are returned as `application/json; charset=utf-8`.

### 1.2 Authentication
- **Public Endpoints:** `/health`, `/health/ready`, `/metrics`, `GET /products`, `GET /products/:id`, `POST /orders`, `GET /orders/:id` require no authentication.
- **Administrative Endpoints:** `/admin/*` endpoints require the administrative key passed in the request header:
  ```http
  x-admin-api-key: algions-prod-fd232c70bbad9bafc772eb64
  ```
  *(Or configured via `ADMIN_API_KEY` environment variable).*

### 1.3 Standard Response Formats
#### Success Response Envelope (HTTP 200, 201)
```json
{
  "success": true,
  "message": "Human readable confirmation",
  "data": { ... },
  "timestamp": "2026-11-15T16:42:44.309Z"
}
```

#### Error Response Envelope (HTTP 400, 401, 404, 409, 500)
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Product not found with ID: 00000000-0000-0000-0000-000000000000",
    "details": []
  },
  "timestamp": "2026-11-15T16:53:30.744Z"
}
```

---

## 2. Health, Readiness & Observability Endpoints

### 2.1 Liveness Probe
```http
GET /health
GET /api/v1/health
```
- **Description:** Verifies that the API server is active and responding.
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Service is healthy",
  "data": {
    "status": "UP",
    "uptimeSeconds": 1845,
    "timestamp": "2026-11-15T16:42:42.956Z",
    "environment": "production",
    "version": "1.0.0"
  },
  "timestamp": "2026-11-15T16:42:42.956Z"
}
```

### 2.2 Readiness & Dependency Probe
```http
GET /health/ready
GET /ready
GET /api/v1/health/ready
```
- **Description:** Verifies connectivity to the PostgreSQL database, measures query latency in milliseconds, and audits connection pool metrics.
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "All dependencies are healthy",
  "data": {
    "status": "UP",
    "uptimeSeconds": 1846,
    "timestamp": "2026-11-15T16:42:43.649Z",
    "environment": "production",
    "version": "1.0.0",
    "system": {
      "nodeVersion": "v20.20.2",
      "platform": "linux",
      "arch": "x64",
      "memoryUsageMB": { "rss": 59, "heapUsed": 12, "heapTotal": 14 }
    },
    "dependencies": {
      "database": {
        "type": "PostgreSQL",
        "status": "CONNECTED",
        "latencyMs": 12,
        "serverTime": "2026-11-15T16:42:43.648Z",
        "pool": { "totalCount": 1, "idleCount": 1, "waitingCount": 0 }
      }
    }
  },
  "timestamp": "2026-11-15T16:42:43.649Z"
}
```

### 2.3 Prometheus Metrics Exporter
```http
GET /metrics
```
- **Content-Type:** `text/plain; version=0.0.4; charset=utf-8`
- **Description:** Scraped by Prometheus container to record API latency histograms, total requests by status code, process memory, and PostgreSQL connection pool counts.

---

## 3. Product Catalog Endpoints

### 3.1 List Products
```http
GET /api/v1/products
```
- **Query Parameters:**
  | Parameter | Type | Default | Description |
  | :--- | :--- | :--- | :--- |
  | `search` or `q` | String | None | Search by name, description, or SKU |
  | `category` | String | None | Filter by product category |
  | `status` | String | `ACTIVE` | Filter status (`ACTIVE`, `INACTIVE`, `ARCHIVED`, `ALL`) |
  | `minPrice` | Number | None | Filter by minimum price |
  | `maxPrice` | Number | None | Filter by maximum price |
  | `limit` | Integer | `50` | Pagination page size (max: 100) |
  | `offset` | Integer | `0` | Pagination record offset |
  | `sortBy` | String | `created_at` | Sort field (`name`, `price`, `created_at`, `inventory_count`) |
  | `sortOrder` | String | `ASC` | Sort direction (`ASC` or `DESC`) |

- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Products retrieved successfully",
  "data": [
    {
      "id": "3a5f1df7-fe03-4170-84ff-421f02b1f56f",
      "sku": "PROD-LAPTOP-001",
      "name": "Developer Pro 16-Inch Laptop",
      "description": "32GB RAM, 1TB NVMe SSD, 12-core processor with high-resolution Retina-grade display.",
      "price": "1899.99",
      "currency": "USD",
      "inventory_count": 44,
      "category": "Computers & Laptops",
      "status": "ACTIVE",
      "created_at": "2026-11-15T13:30:04.324Z",
      "updated_at": "2026-11-15T15:38:55.389Z"
    }
  ],
  "meta": {
    "total": 10,
    "limit": 50,
    "offset": 0
  },
  "timestamp": "2026-11-15T16:42:44.309Z"
}
```

### 3.2 Get Product by ID
```http
GET /api/v1/products/:id
```
- **Path Parameter:** `id` (Required UUID string)
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "3a5f1df7-fe03-4170-84ff-421f02b1f56f",
    "sku": "PROD-LAPTOP-001",
    "name": "Developer Pro 16-Inch Laptop",
    "description": "32GB RAM, 1TB NVMe SSD...",
    "price": "1899.99",
    "currency": "USD",
    "inventory_count": 44,
    "category": "Computers & Laptops",
    "status": "ACTIVE",
    "created_at": "2026-11-15T13:30:04.324Z",
    "updated_at": "2026-11-15T15:38:55.389Z"
  },
  "timestamp": "2026-11-15T16:42:44.309Z"
}
```
- **Error (404 Not Found):**
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Product not found with ID: 00000000-0000-0000-0000-000000000000"
  }
}
```

---

## 4. Order Management & Checkout Endpoints

### 4.1 Place Order (with Idempotency Protection)
```http
POST /api/v1/orders
```
- **Optional Request Header:** `Idempotency-Key: <unique-uuid-or-string>`
- **Request Body (JSON):**
```json
{
  "customer_name": "Aarav Sharma",
  "customer_email": "aarav.sharma@example.in",
  "shipping_address": "Flat 402, Cyber Heights, Hitech City, Hyderabad, 500081",
  "items": [
    {
      "productId": "3a5f1df7-fe03-4170-84ff-421f02b1f56f",
      "quantity": 1
    },
    {
      "productId": "53d1e502-6f85-4064-8ed9-210ea07c0381",
      "quantity": 2
    }
  ]
}
```

- **Business Logic Enforced:**
  1. **Transactional Integrity:** Execution runs inside an explicit database transaction (`BEGIN ... COMMIT`).
  2. **Pessimistic Row-Locking:** Executes `SELECT ... FOR UPDATE` on each requested product.
  3. **Stock Verification:** Verifies `inventory_count >= requested_quantity`. If insufficient, triggers `ROLLBACK` and returns HTTP 409 Conflict.
  4. **Atomic Deduction:** Decrements `inventory_count` atomically.
  5. **Snapshot Pricing:** Captures the current product unit price into `order_items.unit_price`.
  6. **Idempotency Check:** If an order with the same `Idempotency-Key` was previously placed, returns the cached original order immediately without re-deducting inventory or duplicating rows.

- **Response (201 Created):**
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "id": "1b7a9d43-8339-46ee-a21f-d5ec9b148d2b",
    "order_number": "ORD-1794761610813-5270D2",
    "customer_name": "Aarav Sharma",
    "customer_email": "aarav.sharma@example.in",
    "total_amount": "2458.99",
    "currency": "USD",
    "status": "PENDING",
    "shipping_address": "Flat 402, Cyber Heights, Hitech City, Hyderabad, 500081",
    "items": [
      {
        "id": "4d7c18a9-38b2-4d51-9e23-7fa09bb21980",
        "productId": "3a5f1df7-fe03-4170-84ff-421f02b1f56f",
        "productName": "Developer Pro 16-Inch Laptop",
        "quantity": 1,
        "unit_price": "1899.99",
        "subtotal": "1899.99"
      }
    ],
    "created_at": "2026-11-15T16:53:30.829Z"
  },
  "timestamp": "2026-11-15T16:53:30.831Z"
}
```

- **Insufficient Stock Error (409 Conflict):**
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Insufficient stock for product: Dual-Motor Height Adjustable Standing Desk. Requested: 100, Available: 18"
  }
}
```

### 4.2 Get Order Details by ID
```http
GET /api/v1/orders/:id
```
- **Path Parameter:** `id` (Required UUID string)
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "1b7a9d43-8339-46ee-a21f-d5ec9b148d2b",
    "order_number": "ORD-1794761610813-5270D2",
    "customer_name": "Aarav Sharma",
    "customer_email": "aarav.sharma@example.in",
    "total_amount": "2458.99",
    "currency": "USD",
    "status": "PENDING",
    "shipping_address": "Flat 402, Cyber Heights, Hitech City, Hyderabad, 500081",
    "items": [ ... ],
    "created_at": "2026-11-15T16:53:30.829Z",
    "updated_at": "2026-11-15T16:53:30.829Z"
  },
  "timestamp": "2026-11-15T16:53:31.000Z"
}
```

---

## 5. Administrative Catalog & Inventory Endpoints

> [!IMPORTANT]
> All endpoints under `/api/v1/admin/*` require the header:  
> `x-admin-api-key: <ADMIN_API_KEY>`

### 5.1 Create New Catalog Product
```http
POST /api/v1/admin/products
```
- **Headers:** `x-admin-api-key: <ADMIN_API_KEY>`
- **Request Body (JSON):**
```json
{
  "sku": "PROD-MIC-011",
  "name": "Broadcast Studio Condenser Microphone",
  "description": "Cardioid condenser microphone with XLR connectivity and shock mount.",
  "price": 149.50,
  "currency": "USD",
  "inventory_count": 50,
  "category": "Audio",
  "status": "ACTIVE"
}
```
- **Response (201 Created):** Returns the newly created product record with assigned UUID and timestamps.

### 5.2 Adjust Warehouse Inventory Stock
```http
PATCH /api/v1/admin/products/:id/stock
```
- **Headers:** `x-admin-api-key: <ADMIN_API_KEY>`
- **Path Parameter:** `id` (Product UUID)
- **Request Body Options (accepts `inventory_count`, `quantity`, or `adjustment`):**
```json
{
  "inventory_count": 75
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Product stock updated successfully",
  "data": {
    "id": "3a5f1df7-fe03-4170-84ff-421f02b1f56f",
    "sku": "PROD-LAPTOP-001",
    "previous_inventory": 44,
    "inventory_count": 75,
    "updated_at": "2026-11-15T17:00:00.000Z"
  },
  "timestamp": "2026-11-15T17:00:00.000Z"
}
```
- **Audit Log Side Effect:** Automatically records the adjustment in the PostgreSQL `audit_logs` table with previous and new stock levels.
- **Unauthorized Error (401 Unauthorized):**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing administrative API key"
  }
}
```
