/**
 * Product Controller
 * HTTP handlers for catalog listing, search, single product details, creation, and stock updates.
 */

const productService = require('../services/product.service');
const { successResponse } = require('../utils/response');

class ProductController {
  /**
   * List all products with search, filtering, and pagination
   */
  async getProducts(req, res, next) {
    try {
      const result = await productService.getProducts(req.query);

      return successResponse(res, {
        statusCode: 200,
        message: 'Products retrieved successfully',
        data: result.products,
        meta: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Retrieve product details by ID
   */
  async getProductById(req, res, next) {
    try {
      const product = await productService.getProductById(req.params.id);

      return successResponse(res, {
        statusCode: 200,
        message: 'Product retrieved successfully',
        data: product,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Create a new product (Admin)
   */
  async createProduct(req, res, next) {
    try {
      const product = await productService.createProduct(
        req.body,
        req.ip,
        req.headers['user-agent']
      );

      return successResponse(res, {
        statusCode: 201,
        message: 'Product created successfully',
        data: product,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update product inventory stock (Admin)
   */
  async updateStock(req, res, next) {
    try {
      const updatedProduct = await productService.updateStock(
        req.params.id,
        req.body,
        req.ip,
        req.headers['user-agent']
      );

      return successResponse(res, {
        statusCode: 200,
        message: 'Product stock updated successfully',
        data: updatedProduct,
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new ProductController();
