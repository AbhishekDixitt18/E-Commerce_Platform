/**
 * Product Controller
 * Handles catalog and product queries from the database.
 */

const { query } = require('../config/database');
const { successResponse } = require('../utils/response');

class ProductController {
  /**
   * List all products in the catalog
   */
  async getProducts(req, res, next) {
    try {
      const result = await query(
        'SELECT id, sku, name, description, price, currency, inventory_count, category, status, created_at, updated_at FROM products ORDER BY created_at ASC'
      );

      return successResponse(res, {
        statusCode: 200,
        message: 'Products retrieved successfully',
        data: result.rows,
        meta: {
          count: result.rowCount,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new ProductController();
