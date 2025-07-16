import dotenv from 'dotenv';
import { setTimeout } from 'node:timers/promises';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

// Use the Jest global if available, otherwise fallback
if (typeof jest !== 'undefined') {
  jest.setTimeout(30000);
}

// Consolidated test database setup
export const setupTestDatabase = async () => {
  const mongoServer = await MongoMemoryServer.create({
    binary: {
      version: '7.0.3', // Use compatible MongoDB version
    }
  });
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri);
  
  return {
    mongoServer,
    mongoUri,
    cleanup: async () => {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
      await mongoServer.stop();
    }
  };
};

// Common test user factory
export const createTestUser = (overrides = {}) => ({
  email: 'test@example.com',
  password: 'testpassword123',
  ...overrides
});

// JWT token helpers
export const generateTestToken = (userId) => {
  // This would typically use JWT utility
  return `Bearer test-token-${userId}`;
};

// Common test assertions
export const expectValidUser = (user) => {
  expect(user).toHaveProperty('id'); // MongoDB returns 'id' not '_id' in JSON
  expect(user).toHaveProperty('email');
      expect(user).not.toHaveProperty('password'); // Password should not be exposed in response
};

export const expectValidResponse = (response, statusCode = 200) => {
  expect(response.status).toBe(statusCode);
  expect(response.body).toHaveProperty('status');
};