/**
 * Order Request Validation Schemas
 */

const Joi = require('joi');

const createOrder = {
  body: Joi.object({
    customer_name: Joi.string().trim().min(2).max(100).required(),
    customer_email: Joi.string().trim().email().max(255).required(),
    shipping_address: Joi.string().trim().min(5).max(500).required(),
    items: Joi.array()
      .items(
        Joi.object({
          productId: Joi.string().uuid().required(),
          quantity: Joi.number().integer().min(1).required(),
        })
      )
      .min(1)
      .required(),
  }),
};

const getOrderById = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
};

module.exports = {
  createOrder,
  getOrderById,
};
