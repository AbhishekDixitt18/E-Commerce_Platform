const ApiError = require('../../src/utils/apiError');

describe('ApiError Utility', () => {
  it('should instantiate an ApiError with status and code', () => {
    const error = new ApiError(400, 'Invalid parameters', [{ field: 'email', message: 'is required' }]);
    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(400);
    expect(error.status).toBe('fail');
    expect(error.isOperational).toBe(true);
    expect(error.errors).toHaveLength(1);
  });

  it('should create 404 notFound error through static factory', () => {
    const error = ApiError.notFound('Product not found');
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('Product not found');
  });

  it('should create 500 internal server error with isOperational false', () => {
    const error = ApiError.internal('Database crash');
    expect(error.statusCode).toBe(500);
    expect(error.isOperational).toBe(false);
  });
});
