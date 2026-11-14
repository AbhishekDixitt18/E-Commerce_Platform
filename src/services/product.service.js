/**
 * Product Service
 * Business logic for product retrieval, search, creation, and stock updates.
 */

const { pool, query, getClient } = require('../config/database');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

class ProductService {
  /**
   * Retrieve products with filtering, search, pagination, and sorting
   */
  async getProducts(filters = {}) {
    const {
      search,
      q,
      category,
      status = 'ACTIVE',
      minPrice,
      maxPrice,
      limit = 50,
      offset = 0,
      page,
      sortBy = 'created_at',
      sortOrder = 'ASC',
    } = filters;

    const searchTerm = search || q;
    const effectiveOffset = page ? (page - 1) * limit : offset;

    const conditions = [];
    const values = [];
    let paramIndex = 1;

    // Status filter
    if (status && status !== 'ALL') {
      conditions.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    // Category filter
    if (category) {
      conditions.push(`category ILIKE $${paramIndex++}`);
      values.push(category);
    }

    // Search term (name or description)
    if (searchTerm && searchTerm.trim() !== '') {
      conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      values.push(`%${searchTerm.trim()}%`);
      paramIndex++;
    }

    // Price range filters
    if (minPrice !== undefined && minPrice !== null) {
      conditions.push(`price >= $${paramIndex++}`);
      values.push(minPrice);
    }

    if (maxPrice !== undefined && maxPrice !== null) {
      conditions.push(`price <= $${paramIndex++}`);
      values.push(maxPrice);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Sanitize sort column and direction
    const allowedSortFields = ['name', 'price', 'created_at', 'inventory_count'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // Count query
    const countSql = `SELECT COUNT(*) AS total FROM products ${whereClause}`;
    const countResult = await query(countSql, values);
    const total = parseInt(countResult.rows[0].total, 10);

    // Data query
    const dataSql = `
      SELECT id, sku, name, description, price, currency, inventory_count, category, status, created_at, updated_at
      FROM products
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const dataValues = [...values, limit, effectiveOffset];
    const dataResult = await query(dataSql, dataValues);

    return {
      products: dataResult.rows,
      total,
      limit: parseInt(limit, 10),
      offset: parseInt(effectiveOffset, 10),
    };
  }

  /**
   * Retrieve single product by UUID
   */
  async getProductById(id) {
    const sql = `
      SELECT id, sku, name, description, price, currency, inventory_count, category, status, created_at, updated_at
      FROM products
      WHERE id = $1
    `;
    const result = await query(sql, [id]);

    if (result.rowCount === 0) {
      throw ApiError.notFound(`Product not found with ID: ${id}`);
    }

    return result.rows[0];
  }

  /**
   * Create a new product (Admin) with Audit Logging
   */
  async createProduct(productData, clientIp = null, userAgent = null) {
    const {
      sku,
      name,
      description = '',
      price,
      currency = 'USD',
      inventory_count = 0,
      category,
      status = 'ACTIVE',
    } = productData;

    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Check SKU uniqueness
      const existingSku = await client.query('SELECT id FROM products WHERE sku = $1', [sku]);
      if (existingSku.rowCount > 0) {
        throw ApiError.conflict(`Product with SKU '${sku}' already exists`);
      }

      const insertSql = `
        INSERT INTO products (sku, name, description, price, currency, inventory_count, category, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      const result = await client.query(insertSql, [
        sku,
        name,
        description,
        price,
        currency,
        inventory_count,
        category,
        status,
      ]);

      const createdProduct = result.rows[0];

      // Insert audit log
      const auditSql = `
        INSERT INTO audit_logs (entity_type, entity_id, action, actor, payload, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      await client.query(auditSql, [
        'PRODUCT',
        createdProduct.id,
        'PRODUCT_CREATED',
        'ADMIN',
        JSON.stringify({
          sku: createdProduct.sku,
          name: createdProduct.name,
          price: createdProduct.price,
          inventory_count: createdProduct.inventory_count,
          category: createdProduct.category,
        }),
        clientIp,
        userAgent,
      ]);

      await client.query('COMMIT');
      logger.info('Product created successfully', { id: createdProduct.id, sku: createdProduct.sku });
      return createdProduct;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update product stock (Admin) with Row-Level Locking, Negative Prevention, and Audit Log
   */
  async updateStock(id, payload, clientIp = null, userAgent = null) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Acquire exclusive row-level lock
      const selectSql = 'SELECT * FROM products WHERE id = $1 FOR UPDATE';
      const selectResult = await client.query(selectSql, [id]);

      if (selectResult.rowCount === 0) {
        throw ApiError.notFound(`Product not found with ID: ${id}`);
      }

      const product = selectResult.rows[0];
      const previousStock = parseInt(product.inventory_count, 10);
      let newStock;

      if (payload.inventory_count !== undefined) {
        newStock = parseInt(payload.inventory_count, 10);
      } else if (payload.quantity !== undefined) {
        newStock = parseInt(payload.quantity, 10);
      } else if (payload.adjustment !== undefined) {
        newStock = previousStock + parseInt(payload.adjustment, 10);
      } else {
        throw ApiError.badRequest('Must provide inventory_count, quantity, or adjustment');
      }

      // Enforce inventory safety: never allow negative stock
      if (newStock < 0) {
        throw ApiError.badRequest(
          `Stock update failed: negative inventory not allowed. Current: ${previousStock}, Requested: ${newStock}`
        );
      }

      // Update product inventory
      const updateSql = `
        UPDATE products
        SET inventory_count = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;
      const updateResult = await client.query(updateSql, [newStock, id]);
      const updatedProduct = updateResult.rows[0];

      // Record audit log
      const auditSql = `
        INSERT INTO audit_logs (entity_type, entity_id, action, actor, payload, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      await client.query(auditSql, [
        'PRODUCT',
        id,
        'INVENTORY_UPDATED',
        'ADMIN',
        JSON.stringify({
          sku: product.sku,
          previous_stock: previousStock,
          new_stock: newStock,
          delta: newStock - previousStock,
        }),
        clientIp,
        userAgent,
      ]);

      await client.query('COMMIT');
      logger.info('Product stock updated successfully', {
        id,
        sku: product.sku,
        previousStock,
        newStock,
      });

      return updatedProduct;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new ProductService();
