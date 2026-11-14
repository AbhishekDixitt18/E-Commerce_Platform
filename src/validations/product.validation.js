/**
 * Product Request Validation Schemas
 */

const Joi = require('joi');

const getProducts = {
  query: Joi.object({
    search: Joi.string().trim().max(100).allow(''),
    q: Joi.string().trim().max(100).allow(''),
    category: Joi.string().trim().max(100),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'ARCHIVED', 'ALL'),
    minPrice: Joi.number().min(0),
    maxPrice: Joi.number().min(0),
    limit: Joi.number().integer().min(1).max(100).default(50),
    offset: Joi.number().integer().min(0).default(0),
    page: Joi.number().integer().min(1),
    sortBy: Joi.string().valid('name', 'price', 'created_at', 'inventory_count').default('created_at'),
    sortOrder: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('ASC'),
  }),
};

const getProductById = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
};

const createProduct = {
  body: Joi.object({
    sku: Joi.string().trim().uppercase().max(50).required(),
    name: Joi.string().trim().max(255).required(),
    description: Joi.string().trim().allow('', null),
    price: Joi.number().positive().precision(2).required(),
    currency: Joi.string().length(3).uppercase().default('USD'),
    inventory_count: Joi.number().integer().min(0).default(0),
    category: Joi.string().trim().max(100).required(),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'ARCHIVED').default('ACTIVE'),
  }),
};

const updateStock = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    inventory_count: Joi.number().integer().min(0),
    quantity: Joi.number().integer(),
    adjustment: Joi.number().integer(),
  }).or('inventory_count', 'quantity', 'adjustment'),
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateStock,
};
