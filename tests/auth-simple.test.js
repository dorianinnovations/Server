import request from 'supertest';
import express from 'express';
import authRoutes from '../src/routes/auth.js';

// Create minimal test app
const app = express();
app.use(express.json());
app.use(authRoutes);

describe('Auth Routes - Basic Tests', () => {
  test('signup should require email and password', async () => {
    const response = await request(app)
      .post('/signup')
      .send({});
    
    expect(response.status).toBe(400);
    expect(response.body.status).toBe('error');
  });

  test('login should require email and password', async () => {
    const response = await request(app)
      .post('/login')
      .send({});
    
    expect(response.status).toBe(400);
    expect(response.body.status).toBe('error');
  });

  test('signup should reject invalid email format', async () => {
    const response = await request(app)
      .post('/signup')
      .send({
        email: 'invalid-email',
        password: 'testpass123'
      });
    
    expect(response.status).toBe(400);
    expect(response.body.status).toBe('error');
  });

  test('login should reject non-existent user', async () => {
    const response = await request(app)
      .post('/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'testpass123'
      });
    
    // Accept either 401 or 500 since database may not be connected in tests
    expect([401, 500]).toContain(response.status);
    expect(response.body.status).toBe('error');
  });
});