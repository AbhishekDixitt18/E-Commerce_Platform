const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../src/config/database');

describe('Health Check & System API Endpoints', () => {
  afterAll(async () => {
    // Close pool after all tests run to avoid open handles
    await pool.end();
  });

  describe('GET /health (Liveness Probe)', () => {
    it('should return 200 OK with UP status', async () => {
      const res = await request(app)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('status', 'UP');
      expect(res.body.data).toHaveProperty('uptimeSeconds');
      expect(res.body.data).toHaveProperty('version');
      expect(res.body.data).toHaveProperty('environment');
    });
  });

  describe('GET /health/ready (Readiness Probe)', () => {
    it('should return health status envelope', async () => {
      const res = await request(app)
        .get('/health/ready')
        .expect('Content-Type', /json/);

      // Status could be 200 (if DB connected) or 503 (if DB offline in test environment)
      expect([200, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('dependencies');
      expect(res.body.data.dependencies).toHaveProperty('database');
      expect(res.body.data.dependencies.database).toHaveProperty('type', 'PostgreSQL');
    });
  });

  describe('GET / (Root Service Info)', () => {
    it('should return 200 with service metadata', async () => {
      const res = await request(app)
        .get('/')
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('service', 'ecommerce-cloud-devops-api');
      expect(res.body.endpoints).toHaveProperty('health', '/health');
      expect(res.body.endpoints).toHaveProperty('ready', '/health/ready');
    });
  });

  describe('404 Route Not Found Handling', () => {
    it('should return 404 for undefined routes in standard error format', async () => {
      const res = await request(app)
        .get('/api/v1/non-existent-route')
        .expect(404);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toMatch(/Route not found/);
    });
  });
});
