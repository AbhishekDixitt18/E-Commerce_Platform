/**
 * Order Controller
 * Handles customer checkout requests, idempotency headers, and order lookups.
 */

const orderService = require('../services/order.service');
const { successResponse } = require('../utils/response');

class OrderController {
  /**
   * Create customer order
   */
  async createOrder(req, res, next) {
    try {
      const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

      const result = await orderService.createOrder({
        customer_name: req.body.customer_name,
        customer_email: req.body.customer_email,
        shipping_address: req.body.shipping_address,
        items: req.body.items,
        idempotencyKey,
        clientIp: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const statusCode = result.isIdempotentReplay ? 200 : 201;
      const message = result.isIdempotentReplay
        ? 'Order retrieved from idempotent key cache'
        : 'Order placed successfully';

      return successResponse(res, {
        statusCode,
        message,
        data: {
          order: result.order,
          items: result.items,
        },
        meta: {
          idempotentReplay: result.isIdempotentReplay,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Retrieve order details and items by order UUID
   */
  async getOrderById(req, res, next) {
    try {
      const result = await orderService.getOrderById(req.params.id);

      return successResponse(res, {
        statusCode: 200,
        message: 'Order retrieved successfully',
        data: {
          order: result.order,
          items: result.items,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new OrderController();
