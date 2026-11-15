const request = require('supertest');
const app = require('../../src/app');
const { sanitize, getNormalizedRoute } = require('../../src/middleware/requestLogger');

describe('Prometheus Metrics & Structured Logging', () => {
  it('GET /metrics should return 200 and Prometheus formatted metrics', async () => {
    // Generate a sample request first so metrics are populated
    await request(app).get('/health').expect(200);

    const response = await request(app)
      .get('/metrics')
      .expect(200);

    expect(response.headers['content-type']).toMatch(/text\/plain/);
    expect(response.text).toContain('http_requests_total');
    expect(response.text).toContain('http_request_duration_seconds');
    expect(response.text).toContain('app_uptime_seconds');
  });

  describe('Sanitizer Utility', () => {
    it('should redact sensitive keys from objects', () => {
      const input = {
        username: 'john_doe',
        password: 'SuperSecretPassword123!',
        apiKey: 'algions-key-xyz',
        customer: {
          email: 'john@example.com',
          token: 'jwt.token.val',
          creditCard: '4111-2222-3333-4444',
        },
      };

      const result = sanitize(input);

      expect(result.username).toBe('john_doe');
      expect(result.password).toBe('[REDACTED]');
      expect(result.apiKey).toBe('[REDACTED]');
      expect(result.customer.email).toBe('john@example.com');
      expect(result.customer.token).toBe('[REDACTED]');
      expect(result.customer.creditCard).toBe('[REDACTED]');
    });
  });

  describe('Route Normalization', () => {
    it('should normalize UUIDs in paths to prevent high cardinality', () => {
      const fakeReq = {
        baseUrl: '',
        path: '/api/v1/products/112eba3c-b26a-4b95-a249-14a938c4ef4e',
      };
      const normalized = getNormalizedRoute(fakeReq);
      expect(normalized).toBe('/api/v1/products/:id');
    });
  });
});
