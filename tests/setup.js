import dotenv from 'dotenv';
import { clearDatabase } from './utils/globalTestSetup.js';

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
  error: () => {}
};

// Use the Jest global if available, otherwise fallback
if (typeof jest !== 'undefined') {
  jest.setTimeout(30000);
}

// Clear database between tests
beforeEach(async () => {
  await clearDatabase();
});
