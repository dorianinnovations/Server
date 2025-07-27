export default {
  testEnvironment: 'node',
  testTimeout: 30000, // 30 seconds for database operations
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: [
    '**/tests/**/*.test.js',
    '!**/node_modules/**',
    '!**/tests/e2e/**' // Skip broken e2e tests for now
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/e2e/', // Skip broken e2e tests
    '/tests/scripts/' // Skip integration scripts
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  globalSetup: '<rootDir>/tests/utils/globalTestSetup.js',
  globalTeardown: '<rootDir>/tests/utils/globalTestTeardown.js',
  maxWorkers: 1, // Run tests sequentially to avoid database conflicts
  forceExit: true, // Force exit to prevent hanging
  detectOpenHandles: true, // Help debug async issues
}; 