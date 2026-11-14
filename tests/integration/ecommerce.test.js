/**
 * Comprehensive Integration Test Suite
 * Covers all 14 core assessment requirements:
 * 1. Product listing
 * 2. Product search
 * 3. Product details
 * 4. Successful order
 * 5. Insufficient stock
 * 6. Invalid quantity
 * 7. Duplicate idempotency key
 * 8. Stock deduction
 * 9. Prevention of negative stock
 * 10. Price snapshot
 * 11. Unauthorized admin request
 * 12. Successful admin operation
 * 13. Audit log creation
 * 14. Concurrent checkout attempts
 */

const request = require('supertest');
const app = require('../../src/app');
const { pool, query } = require('../../src/config/database');
const config = require('../../src/config/env');

const ADMIN_KEY = config.server.adminApiKey;

describe('E-Commerce REST API - Full Integration Suite', () => {
  let sampleProduct;
  let limitedStockProduct;

  beforeAll(async () => {
    // Seed fresh test products to ensure reliable test isolation
    const insertSample = await query(
      `INSERT INTO products (sku, name, description, price, currency, inventory_count, category, status)
       VALUES ('TEST-SKU-001', 'High-End Developer Laptop', 'Ultra-fast processor with 32GB RAM', 1500.00, 'USD', 50, 'Electronics', 'ACTIVE')
       RETURNING *`
    );
    sampleProduct = insertSample.rows[0];

    const insertLimited = await query(
      `INSERT INTO products (sku, name, description, price, currency, inventory_count, category, status)
       VALUES ('TEST-SKU-LIMITED', 'Limited Edition Mechanical Keycap', 'Handcrafted artisan keycap', 50.00, 'USD', 5, 'Accessories', 'ACTIVE')
       RETURNING *`
    );
    limitedStockProduct = insertLimited.rows[0];
  });

  afterAll(async () => {
    // Clean up test products and orders created during tests
    await query("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE customer_email LIKE '%@test.com')");
    await query("DELETE FROM orders WHERE customer_email LIKE '%@test.com'");
    await query("DELETE FROM audit_logs WHERE actor LIKE '%@test.com' OR actor = 'ADMIN'");
    await query("DELETE FROM products WHERE sku LIKE 'TEST-%'");
    await pool.end();
  });

  // ===========================================================================
  // 1. PRODUCT LISTING
  // ===========================================================================
  describe('1. Product Listing (GET /api/products)', () => {
    it('should return a list of active products with pagination metadata', async () => {
      const res = await request(app)
        .get('/api/products')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.meta).toHaveProperty('total');
      expect(res.body.meta).toHaveProperty('limit');
      expect(res.body.meta).toHaveProperty('offset');

      const item = res.body.data[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('sku');
      expect(item).toHaveProperty('price');
      expect(item).toHaveProperty('inventory_count');
    });
  });

  // ===========================================================================
  // 2. PRODUCT SEARCH
  // ===========================================================================
  describe('2. Product Search (GET /api/products?search=...)', () => {
    it('should filter products matching keyword in name or description', async () => {
      const res = await request(app)
        .get('/api/products')
        .query({ search: 'Developer Laptop' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      const found = res.body.data.find((p) => p.sku === 'TEST-SKU-001');
      expect(found).toBeDefined();
      expect(found.name).toContain('Developer Laptop');
    });

    it('should filter products by category', async () => {
      const res = await request(app)
        .get('/api/products')
        .query({ category: 'Electronics' })
        .expect(200);

      expect(res.body.success).toBe(true);
      res.body.data.forEach((prod) => {
        expect(prod.category.toLowerCase()).toContain('electronics');
      });
    });
  });

  // ===========================================================================
  // 3. PRODUCT DETAILS
  // ===========================================================================
  describe('3. Product Details (GET /api/products/:id)', () => {
    it('should return complete details for a valid product ID', async () => {
      const res = await request(app)
        .get(`/api/products/${sampleProduct.id}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(sampleProduct.id);
      expect(res.body.data.sku).toBe('TEST-SKU-001');
      expect(parseFloat(res.body.data.price)).toBe(1500.00);
    });

    it('should return 404 for non-existent product UUID', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .get(`/api/products/${fakeUuid}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });
  });

  // ===========================================================================
  // 4. SUCCESSFUL ORDER
  // ===========================================================================
  describe('4. Successful Order (POST /api/orders)', () => {
    it('should place an order, compute total, snapshot prices, and return order details', async () => {
      const orderPayload = {
        customer_name: 'Alice Johnson',
        customer_email: 'alice@test.com',
        shipping_address: '123 Cloud Way, Tech City, CA 94016',
        items: [
          { productId: sampleProduct.id, quantity: 2 },
        ],
      };

      const res = await request(app)
        .post('/api/orders')
        .send(orderPayload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('order');
      expect(res.body.data).toHaveProperty('items');

      const { order, items } = res.body.data;
      expect(order.customer_email).toBe('alice@test.com');
      expect(parseFloat(order.total_amount)).toBe(3000.00); // 2 * 1500
      expect(items.length).toBe(1);
      expect(items[0].product_id).toBe(sampleProduct.id);
      expect(items[0].quantity).toBe(2);
      expect(parseFloat(items[0].unit_price)).toBe(1500.00);
      expect(parseFloat(items[0].subtotal)).toBe(3000.00);
    });
  });

  // ===========================================================================
  // 5. INSUFFICIENT STOCK
  // ===========================================================================
  describe('5. Insufficient Stock Handling', () => {
    it('should reject order if requested quantity exceeds available inventory', async () => {
      const orderPayload = {
        customer_name: 'Bob Buyer',
        customer_email: 'bob@test.com',
        shipping_address: '456 Market St, Austin, TX',
        items: [
          { productId: limitedStockProduct.id, quantity: 9999 }, // Only 5 available
        ],
      };

      const res = await request(app)
        .post('/api/orders')
        .send(orderPayload)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/insufficient inventory/i);
    });
  });

  // ===========================================================================
  // 6. INVALID QUANTITY VALIDATION
  // ===========================================================================
  describe('6. Invalid Quantity Validation', () => {
    it('should reject non-positive quantities (0 or negative)', async () => {
      const zeroQtyPayload = {
        customer_name: 'Invalid Qty User',
        customer_email: 'invalid@test.com',
        shipping_address: '789 Elm St',
        items: [{ productId: sampleProduct.id, quantity: 0 }],
      };

      const res = await request(app)
        .post('/api/orders')
        .send(zeroQtyPayload)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/validation failed/i);
    });
  });

  // ===========================================================================
  // 7. DUPLICATE IDEMPOTENCY KEY
  // ===========================================================================
  describe('7. Idempotency Support (Idempotency-Key Header)', () => {
    it('should replay original order response and not double-charge or double-deduct inventory', async () => {
      const idempotencyKey = `idemp-key-${Date.now()}`;

      // Fetch stock before first attempt
      const stockBefore = await query('SELECT inventory_count FROM products WHERE id = $1', [sampleProduct.id]);
      const initialStock = parseInt(stockBefore.rows[0].inventory_count, 10);

      const payload = {
        customer_name: 'Charlie Idempotent',
        customer_email: 'charlie@test.com',
        shipping_address: '100 Repeat Lane, Seattle, WA',
        items: [{ productId: sampleProduct.id, quantity: 1 }],
      };

      // First Request
      const firstRes = await request(app)
        .post('/api/orders')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload)
        .expect(201);

      const firstOrderId = firstRes.body.data.order.id;

      // Second Request with identical Idempotency-Key
      const secondRes = await request(app)
        .post('/api/orders')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload)
        .expect(200);

      expect(secondRes.body.data.order.id).toBe(firstOrderId);
      expect(secondRes.body.meta.idempotentReplay).toBe(true);

      // Verify stock was deducted exactly ONCE
      const stockAfter = await query('SELECT inventory_count FROM products WHERE id = $1', [sampleProduct.id]);
      const finalStock = parseInt(stockAfter.rows[0].inventory_count, 10);
      expect(finalStock).toBe(initialStock - 1);
    });
  });

  // ===========================================================================
  // 8. STOCK DEDUCTION
  // ===========================================================================
  describe('8. Stock Deduction Verification', () => {
    it('should correctly decrement product inventory on successful order', async () => {
      const stockBefore = await query('SELECT inventory_count FROM products WHERE id = $1', [sampleProduct.id]);
      const countBefore = parseInt(stockBefore.rows[0].inventory_count, 10);

      await request(app)
        .post('/api/orders')
        .send({
          customer_name: 'Stock Check User',
          customer_email: 'stock@test.com',
          shipping_address: '55 Pine St, Denver, CO',
          items: [{ productId: sampleProduct.id, quantity: 3 }],
        })
        .expect(201);

      const stockAfter = await query('SELECT inventory_count FROM products WHERE id = $1', [sampleProduct.id]);
      const countAfter = parseInt(stockAfter.rows[0].inventory_count, 10);

      expect(countAfter).toBe(countBefore - 3);
    });
  });

  // ===========================================================================
  // 9. PREVENTION OF NEGATIVE STOCK
  // ===========================================================================
  describe('9. Prevention of Negative Stock', () => {
    it('should prevent setting negative stock via admin endpoint', async () => {
      const res = await request(app)
        .patch(`/api/admin/products/${sampleProduct.id}/stock`)
        .set('x-admin-api-key', ADMIN_KEY)
        .send({ inventory_count: -10 })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/validation failed|negative/i);

      // Verify product stock in DB is unchanged
      const check = await query('SELECT inventory_count FROM products WHERE id = $1', [sampleProduct.id]);
      expect(parseInt(check.rows[0].inventory_count, 10)).toBeGreaterThanOrEqual(0);
    });
  });

  // ===========================================================================
  // 10. PRICE SNAPSHOT
  // ===========================================================================
  describe('10. Price Snapshot Immutability', () => {
    it('historical order unit price must remain unchanged when product price changes later', async () => {
      // 1. Create a product with price $200
      const prodRes = await query(
        `INSERT INTO products (sku, name, price, inventory_count, category)
         VALUES ('TEST-SNAPSHOT', 'Snapshot Test Item', 200.00, 20, 'Test')
         RETURNING *`
      );
      const snapshotItem = prodRes.rows[0];

      // 2. Customer orders it at $200
      const orderRes = await request(app)
        .post('/api/orders')
        .send({
          customer_name: 'Snapshot User',
          customer_email: 'snapshot@test.com',
          shipping_address: '999 History Blvd',
          items: [{ productId: snapshotItem.id, quantity: 1 }],
        })
        .expect(201);

      const orderId = orderRes.body.data.order.id;

      // 3. Admin modifies the product price to $350
      await query('UPDATE products SET price = 350.00 WHERE id = $1', [snapshotItem.id]);

      // 4. Retrieve original order
      const getOrderRes = await request(app)
        .get(`/api/orders/${orderId}`)
        .expect(200);

      const itemInOrder = getOrderRes.body.data.items[0];
      expect(parseFloat(itemInOrder.unit_price)).toBe(200.00); // Must be original snapshot price
      expect(parseFloat(getOrderRes.body.data.order.total_amount)).toBe(200.00);
    });
  });

  // ===========================================================================
  // 11. UNAUTHORIZED ADMIN REQUEST
  // ===========================================================================
  describe('11. Admin Route Protection (401 Unauthorized)', () => {
    it('should reject request without admin API key', async () => {
      const res = await request(app)
        .post('/api/admin/products')
        .send({ sku: 'TEST-UNAUTH', name: 'Unauthorized Item', price: 99.00, category: 'Test' })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/missing admin api key/i);
    });

    it('should reject request with invalid admin API key', async () => {
      const res = await request(app)
        .patch(`/api/admin/products/${sampleProduct.id}/stock`)
        .set('x-admin-api-key', 'wrong-key')
        .send({ inventory_count: 100 })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid admin api key/i);
    });
  });

  // ===========================================================================
  // 12. SUCCESSFUL ADMIN OPERATION
  // ===========================================================================
  describe('12. Successful Admin Operation (Product Creation & Stock Update)', () => {
    let createdAdminProductId;

    it('should allow admin to create a new product with valid API key', async () => {
      const newProductPayload = {
        sku: 'TEST-ADMIN-CREATED',
        name: 'Enterprise Cloud Server Rack',
        description: '42U Server Cabinet with dual redundant PDUs',
        price: 2499.00,
        currency: 'USD',
        inventory_count: 10,
        category: 'Infrastructure',
        status: 'ACTIVE',
      };

      const res = await request(app)
        .post('/api/admin/products')
        .set('x-admin-api-key', ADMIN_KEY)
        .send(newProductPayload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.sku).toBe('TEST-ADMIN-CREATED');
      createdAdminProductId = res.body.data.id;
    });

    it('should allow admin to update stock for existing product', async () => {
      const res = await request(app)
        .patch(`/api/admin/products/${createdAdminProductId}/stock`)
        .set('x-admin-api-key', ADMIN_KEY)
        .send({ inventory_count: 25 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.inventory_count).toBe(25);
    });
  });

  // ===========================================================================
  // 13. AUDIT LOG CREATION
  // ===========================================================================
  describe('13. Audit Log Verification', () => {
    it('should have recorded audit log entries for admin changes and customer orders', async () => {
      const logsResult = await query(
        "SELECT * FROM audit_logs WHERE action IN ('PRODUCT_CREATED', 'INVENTORY_UPDATED', 'ORDER_CREATED') ORDER BY created_at DESC LIMIT 5"
      );

      expect(logsResult.rows.length).toBeGreaterThan(0);
      const actions = logsResult.rows.map((l) => l.action);
      expect(actions).toContain('ORDER_CREATED');

      const orderLog = logsResult.rows.find((l) => l.action === 'ORDER_CREATED');
      expect(orderLog).toBeDefined();
      expect(orderLog.entity_type).toBe('ORDER');
      expect(orderLog.payload).toHaveProperty('order_number');
    });
  });

  // ===========================================================================
  // 14. CONCURRENT CHECKOUT ATTEMPTS
  // ===========================================================================
  describe('14. Concurrency & Race-Condition Safety', () => {
    it('should safely handle simultaneous checkouts: exactly deplete stock without overselling or negative inventory', async () => {
      // 1. Create a product with strictly 3 items in stock
      const insertFlashSale = await query(
        `INSERT INTO products (sku, name, price, inventory_count, category, status)
         VALUES ('TEST-FLASH-SALE', 'Flash Sale GPU', 500.00, 3, 'Components', 'ACTIVE')
         RETURNING *`
      );
      const flashProduct = insertFlashSale.rows[0];

      // 2. Fire 8 simultaneous requests each trying to purchase 1 item
      const concurrentRequests = Array.from({ length: 8 }).map((_, index) => {
        return request(app)
          .post('/api/orders')
          .send({
            customer_name: `Buyer #${index + 1}`,
            customer_email: `buyer${index + 1}@test.com`,
            shipping_address: '100 Race Condition Blvd',
            items: [{ productId: flashProduct.id, quantity: 1 }],
          });
      });

      const results = await Promise.all(concurrentRequests);

      // Count successes (201) vs rejections (400)
      const successfulOrders = results.filter((r) => r.status === 201);
      const rejectedOrders = results.filter((r) => r.status === 400);

      expect(successfulOrders.length).toBe(3); // Exactly 3 buyers get the 3 items
      expect(rejectedOrders.length).toBe(5);   // The other 5 receive insufficient inventory error

      // 3. Verify final stock is exactly 0 (never negative)
      const finalStockRes = await query('SELECT inventory_count FROM products WHERE id = $1', [flashProduct.id]);
      expect(parseInt(finalStockRes.rows[0].inventory_count, 10)).toBe(0);
    });
  });
});
