const Joi = require('joi');
const validate = require('../../src/middleware/validate');

describe('Validate Middleware', () => {
  it('should pass validation when body conforms to schema', () => {
    const schema = {
      body: Joi.object({
        name: Joi.string().required(),
        price: Joi.number().positive().required(),
      }),
    };

    const req = {
      body: { name: 'Wireless Mouse', price: 29.99 },
    };
    const res = {};
    const next = jest.fn();

    const middleware = validate(schema);
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should call next with ApiError when validation fails', () => {
    const schema = {
      body: Joi.object({
        name: Joi.string().required(),
        price: Joi.number().positive().required(),
      }),
    };

    const req = {
      body: { price: -10 },
    };
    const res = {};
    const next = jest.fn();

    const middleware = validate(schema);
    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
    expect(err.errors.length).toBeGreaterThanOrEqual(1);
  });
});
