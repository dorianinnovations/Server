# Numina Server Tests

This directory contains comprehensive test suites for the Numina AI server backend.

## Test Structure

### `/integration/`
End-to-end integration tests that verify complete API workflows:
- `test_endpoints.js` - Core API endpoint functionality
- `test_tools.js` - AI tool system integration
- `test_stripe_wallet.js` - Payment and wallet system tests
- `test_credit_setup.js` - Credit management system tests

### `/unit/`
Unit tests for individual components and functions.

### `/e2e/`
End-to-end tests for complete user workflows.

### `/middleware/`
Tests for Express middleware components:
- `security.test.js` - Security middleware validation

### `/routes/`
Route-specific test suites:
- `auth.test.js` - Authentication routes
- `user.test.js` - User management routes
- `health.test.js` - Health check endpoints
- `collectiveData.test.js` - Collective intelligence features
- `collectiveSnapshots.test.js` - Data snapshot functionality

### `/utils/`
Utility function tests:
- `cache.test.js` - Caching system tests
- `sanitize.test.js` - Input sanitization tests
- `testSetup.js` - Test configuration utilities

### `/scripts/`
Test utilities and setup scripts:
- `testAPI.js` - API testing utilities
- `testWebSocket.js` - WebSocket connection tests
- `performance-test.js` - Performance benchmarking
- `seedTestData.js` - Test data generation
- `createTestUsers.js` - User creation utilities
- `clearCache.js` - Cache management utilities
- `checkSnapshots.js` - Data snapshot verification
- `cleanupAndRegenerate.js` - Test environment cleanup

## Test Data Files

- `accuracy-test.json` - AI accuracy test data
- `historical-test.json` - Historical data test sets
- `test-payload.json` - Standard test payloads
- `signup-payload.json` - User registration test data

## Running Tests

```bash
# Run all tests
npm test

# Run specific test categories
npm test -- --testPathPattern=integration
npm test -- --testPathPattern=middleware
npm test -- --testPathPattern=routes

# Run with coverage
npm test -- --coverage
```

## Test Environment

Tests use a separate test database and environment configuration. The test environment is automatically configured via `setup.js` and `testSetup.js`.

## Contributing

When adding new features, please include corresponding tests in the appropriate directory structure. 