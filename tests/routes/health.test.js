import request from 'supertest';
import { createTestApp } from '../test-server.js';

let app;

beforeAll(async () => {
  // Create test app with global database setup
  app = await createTestApp();
});

describe('Health Check Routes', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      // Accept 200 (healthy), 503 (degraded), or 500 (unhealthy)
      expect([200, 500, 503]).toContain(response.status);
      expect(response.body.status).toBeDefined();
      expect(response.body.health).toBeDefined();
      expect(response.body.health.server).toBeDefined();
      expect(response.body.health.database).toBeDefined();
      expect(response.body.health.llm_api).toBeDefined();
    });

    it('should include all required health fields', async () => {
      const response = await request(app).get('/health');

      // Accept 200, 503, or 500 status
      expect([200, 500, 503]).toContain(response.status);

      const health = response.body.health;
      expect(health).toHaveProperty('server');
      expect(health).toHaveProperty('database');
      expect(health).toHaveProperty('llm_api');
      expect(health).toHaveProperty('llm_service');
    });

    it('should handle LLM API errors gracefully', async () => {
      // Mock the OpenRouter service to return an error
      const originalEnv = process.env.OPENROUTER_API_KEY;
      process.env.OPENROUTER_API_KEY = 'invalid-key-that-will-fail';

      const response = await request(app).get('/health');

      // Accept 500 or 503 when LLM API fails
      expect([500, 503]).toContain(response.status);
      
      if (response.status === 503) {
        expect(response.body.status).toBe('degraded');
        expect(response.body.health.llm_api).toBe('unreachable');
      } else if (response.status === 500) {
        expect(response.body.health.llm_api).toBeDefined();
      }

      // Restore original environment
      process.env.OPENROUTER_API_KEY = originalEnv;
    });
  });
});
