#!/usr/bin/env node

// Debug script to check what routes are available
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/test';
process.env.OPENROUTER_API_KEY = 'test-key';

console.log('NODE_ENV:', process.env.NODE_ENV);

import { default as app } from './src/server.js';

console.log('App type:', typeof app);
console.log('App properties:', Object.getOwnPropertyNames(app));

// Check if app has routes
if (app._router) {
  console.log('App has router');
  console.log('Router stack:', app._router.stack.length, 'layers');
  
  app._router.stack.forEach((layer, index) => {
    if (layer.route) {
      console.log(`Route ${index}:`, layer.route.path, Object.keys(layer.route.methods));
    } else {
      console.log(`Middleware ${index}:`, layer.regexp, layer.name);
    }
  });
} else {
  console.log('App has no router');
}

// Test a simple request
import request from 'supertest';

console.log('\nTesting /health endpoint...');
const response = await request(app)
  .get('/health')
  .catch(err => console.log('Health test error:', err.message));

if (response) {
  console.log('Health response status:', response.status);
  console.log('Health response body:', response.body);
} else {
  console.log('No response received');
}

console.log('\nTesting /test endpoint...');
const testResponse = await request(app)
  .get('/test')
  .catch(err => console.log('Test endpoint error:', err.message));

if (testResponse) {
  console.log('Test response status:', testResponse.status);
  console.log('Test response body:', testResponse.body);
} else {
  console.log('No test response received');
}

process.exit(0);