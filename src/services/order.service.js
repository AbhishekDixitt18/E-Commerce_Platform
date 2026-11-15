/**
 * Order Service
 * Implements strict transaction isolation, row-level locking, inventory deduction,
 * price snapshotting, idempotency deduplication, and audit logging.
 */

const crypto = require('crypto');
const { getClient, query } = require('../config/database');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

class OrderService {
  /**
   * Create customer order with transactional inventory safety and idempotency
   */
  async createOrder({
    customer_name,
    customer_email,
    shipping_address,
    items,
    idempotencyKey = null,
    clientIp = null,
    userAgent = null,
  }) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw ApiError.badRequest('Order must contain at least one item');
    }

    const client = await getClient();

    try {
      await client.query('BEGIN');

      // 1. Idempotency Check: Return existing order if key was already processed
      if (idempotencyKey) {
        const existingOrderResult = await client.query(
          'SELECT * FROM orders WHERE idempotency_key = $1',
          [idempotencyKey]
        );

        if (existingOrderResult.rowCount > 0) {
          const existingOrder = existingOrderResult.rows[0];
          const itemsResult = await client.query(
            `SELECT oi.*, p.name AS product_name, p.sku AS product_sku
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = $1`,
            [existingOrder.id]
          );

          await client.query('COMMIT');
          logger.info('Idempotency key hit: returning cached order', {
            idempotencyKey,
            orderId: existingOrder.id,
          });

          return {
            order: existingOrder,
            items: itemsResult.rows,
            isIdempotentReplay: true,
          };
        }
      }

      // 2. Aggregate quantities by productId to prevent duplicate line issues
      const aggregatedItems = new Map();
      for (const item of items) {
        const qty = parseInt(item.quantity, 10);
        if (isNaN(qty) || qty <= 0) {
          throw ApiError.badRequest(`Invalid quantity for product ${item.productId}: must be a positive integer`);
        }
        aggregatedItems.set(item.productId, (aggregatedItems.get(item.productId) || 0) + qty);
      }

      // 3. Deterministic locking order: sort product IDs alphabetically to eliminate deadlocks
      const uniqueProductIds = Array.from(aggregatedItems.keys()).sort();

      // 4. Lock products with SELECT ... FOR UPDATE
      const productsQuery = `
        SELECT id, sku, name, price, currency, inventory_count, status
        FROM products
        WHERE id = ANY($1::uuid[])
        ORDER BY id ASC
        FOR UPDATE
      `;
      const productsResult = await client.query(productsQuery, [uniqueProductIds]);

      // Verify all products exist
      if (productsResult.rowCount !== uniqueProductIds.length) {
        const foundIds = new Set(productsResult.rows.map((p) => p.id));
        const missingIds = uniqueProductIds.filter((id) => !foundIds.has(id));
        throw ApiError.notFound(`One or more products not found: ${missingIds.join(', ')}`);
      }

      const productsMap = new Map();
      for (const p of productsResult.rows) {
        productsMap.set(p.id, p);
      }

      // 5. Verify status and inventory availability for every product
      for (const [productId, requiredQty] of aggregatedItems.entries()) {
        const product = productsMap.get(productId);

        if (product.status !== 'ACTIVE') {
          throw ApiError.badRequest(`Product '${product.name}' is currently ${product.status.toLowerCase()} and cannot be purchased`);
        }

        const currentStock = parseInt(product.inventory_count, 10);
        if (currentStock < requiredQty) {
          throw ApiError.badRequest(
            `Insufficient inventory for product '${product.name}'. Requested: ${requiredQty}, Available: ${currentStock}`
          );
        }
      }

      // 6. Calculate total amount & prepare price snapshot
      let calculatedTotal = 0;
      const orderItemsToInsert = [];

      for (const item of items) {
        const product = productsMap.get(item.productId);
        const unitPrice = parseFloat(product.price);
        const qty = parseInt(item.quantity, 10);
        const subtotal = Math.round(unitPrice * qty * 100) / 100;

        calculatedTotal += subtotal;

        orderItemsToInsert.push({
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          quantity: qty,
          unitPrice, // Price snapshot at time of checkout
          subtotal,
        });
      }

      calculatedTotal = Math.round(calculatedTotal * 100) / 100;

      // 7. Atomic inventory deduction
      for (const [productId, requiredQty] of aggregatedItems.entries()) {
        await client.query(
          `UPDATE products
           SET inventory_count = inventory_count - $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [requiredQty, productId]
        );
      }

      // 8. Generate unique order number and insert Order
      const orderNumber = `ORD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const insertOrderSql = `
        INSERT INTO orders (order_number, customer_name, customer_email, total_amount, currency, status, shipping_address, idempotency_key)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      const orderResult = await client.query(insertOrderSql, [
        orderNumber,
        customer_name,
        customer_email,
        calculatedTotal,
        'INR',
        'PENDING',
        shipping_address,
        idempotencyKey,
      ]);

      const createdOrder = orderResult.rows[0];

      // 9. Insert Order Items (with historical unit price snapshot)
      const insertedItems = [];
      for (const lineItem of orderItemsToInsert) {
        const insertItemSql = `
          INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `;
        const itemResult = await client.query(insertItemSql, [
          createdOrder.id,
          lineItem.productId,
          lineItem.quantity,
          lineItem.unitPrice,
          lineItem.subtotal,
        ]);

        insertedItems.push({
          ...itemResult.rows[0],
          product_name: lineItem.productName,
          product_sku: lineItem.productSku,
        });
      }

      // 10. Record Order Placement in Audit Log
      const auditSql = `
        INSERT INTO audit_logs (entity_type, entity_id, action, actor, payload, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      await client.query(auditSql, [
        'ORDER',
        createdOrder.id,
        'ORDER_CREATED',
        customer_email,
        JSON.stringify({
          order_number: createdOrder.order_number,
          total_amount: createdOrder.total_amount,
          items_count: insertedItems.length,
          idempotency_key: idempotencyKey,
        }),
        clientIp,
        userAgent,
      ]);

      await client.query('COMMIT');
      logger.info('Order successfully created', {
        orderId: createdOrder.id,
        orderNumber: createdOrder.order_number,
        total: createdOrder.total_amount,
      });

      return {
        order: createdOrder,
        items: insertedItems,
        isIdempotentReplay: false,
      };
    } catch (error) {
      await client.query('ROLLBACK');

      // Concurrent race condition handling for duplicate idempotency key
      if (error.code === '23505' && error.detail && error.detail.includes('idempotency_key')) {
        logger.info('Concurrent duplicate idempotency key caught by unique constraint; fetching original order');
        const existingOrder = await query('SELECT * FROM orders WHERE idempotency_key = $1', [idempotencyKey]);
        if (existingOrder.rowCount > 0) {
          const itemsResult = await query(
            `SELECT oi.*, p.name AS product_name, p.sku AS product_sku
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = $1`,
            [existingOrder.rows[0].id]
          );
          return {
            order: existingOrder.rows[0],
            items: itemsResult.rows,
            isIdempotentReplay: true,
          };
        }
      }

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Retrieve order details and associated line items by order UUID
   */
  async getOrderById(id) {
    const orderSql = 'SELECT * FROM orders WHERE id = $1';
    const orderResult = await query(orderSql, [id]);

    if (orderResult.rowCount === 0) {
      throw ApiError.notFound(`Order not found with ID: ${id}`);
    }

    const order = orderResult.rows[0];

    const itemsSql = `
      SELECT oi.*, p.name AS product_name, p.sku AS product_sku
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
      ORDER BY oi.created_at ASC
    `;
    const itemsResult = await query(itemsSql, [id]);

    return {
      order,
      items: itemsResult.rows,
    };
  }
}

module.exports = new OrderService();
