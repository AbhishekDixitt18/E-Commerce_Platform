/**
 * Request Validation Middleware using Joi
 * Validates req.body, req.query, or req.params against a Joi schema.
 */

const ApiError = require('../utils/apiError');

/**
 * Higher-order middleware function to validate incoming request data.
 * @param {import('joi').ObjectSchema | { body?: import('joi').ObjectSchema, query?: import('joi').ObjectSchema, params?: import('joi').ObjectSchema }} schema
 */
function validate(schema) {
  return (req, res, next) => {
    const validSchema = schema;
    const targets = ['params', 'query', 'body'];

    const validationErrors = [];

    for (const target of targets) {
      if (validSchema[target]) {
        const { error, value } = validSchema[target].validate(req[target], {
          abortEarly: false,
          stripUnknown: true,
        });

        if (error) {
          error.details.forEach((detail) => {
            validationErrors.push({
              field: `${target}.${detail.path.join('.')}`,
              message: detail.message.replace(/['"]/g, ''),
            });
          });
        } else {
          req[target] = value;
        }
      }
    }

    if (validationErrors.length > 0) {
      return next(ApiError.badRequest('Validation failed', validationErrors));
    }

    return next();
  };
}

module.exports = validate;
