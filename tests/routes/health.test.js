import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createTestApp } from '../test-server.js';

let mongoServer;
let app;

beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.OPENROUTER_API_KEY = 'test-key';
  
  mongoServer = await MongoMemoryServer.create({ binary: { version: '7.0.3' } });
  const mongoUri = mongoServer.getUri();
  process.env.MONGO_URI = mongoUri;
  
  await mongoose.connect(mongoUri);
  
  // Create test app
  app = await createTestApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

describe('Health Check Routes', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health');

      // Accept either 200 (all healthy) or 503 (degraded but functional)
      expect([200, 503]).toContain(response.status);
      expect(response.body.status).toBeDefined();
      expect(response.body.health).toBeDefined();
      expect(response.body.health.server).toBe('healthy');
      expect(response.body.health.database).toBeDefined();
      expect(response.body.health.llm_api).toBeDefined();
    });

    it('should include all required health fields', async () => {
      const response = await request(app)
        .get('/health');

      // Accept either 200 or 503 status
      expect([200, 503]).toContain(response.status);

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

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body.status).toBe('degraded');
      expect(response.body.health.server).toBe('healthy');
      expect(response.body.health.llm_api).toBe('unreachable');

      // Restore original environment
      process.env.OPENROUTER_API_KEY = originalEnv;
    });
  });
}); 