import request from 'supertest';
import express from 'express';
import User from '../../src/models/User.js';
import authRoutes from '../../src/routes/auth.js';
import {
  setupTestDatabase,
  createTestUser,
  expectValidUser,
  expectValidResponse
} from '../utils/testSetup.js';

// Create test app
const app = express();
app.use(express.json());
app.use(authRoutes);

describe('Auth Routes', () => {
  let testDb;

  beforeEach(async () => {
    testDb = await setupTestDatabase();
  });

  afterEach(async () => {
    await testDb.cleanup();
  });

  describe('POST /signup', () => {
    it('should create a new user with valid data', async () => {
      const userData = createTestUser();
      const response = await request(app).post('/signup').send(userData);

      expectValidResponse(response, 201);
      expect(response.body.status).toBe('success');
      expect(response.body.token).toBeDefined();
      expectValidUser(response.body.data.user);
    });

    it('should return 400 for invalid email', async () => {
      const userData = createTestUser({ email: 'invalid-email' });
      const response = await request(app).post('/signup').send(userData);

      expectValidResponse(response, 400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Validation failed');
    });

    it('should return 409 for existing email', async () => {
      const userData = createTestUser();
      await User.create(userData);

      const response = await request(app).post('/signup').send(userData);

      expectValidResponse(response, 409);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Email already in use.');
    });
  });

  describe('POST /login', () => {
    beforeEach(async () => {
      const userData = createTestUser();
      await User.create(userData);
    });

    it('should login with valid credentials', async () => {
      const userData = createTestUser();
      const response = await request(app).post('/login').send(userData);

      expectValidResponse(response, 200);
      expect(response.body.status).toBe('success');
      expect(response.body.token).toBeDefined();
      expectValidUser(response.body.data.user);
    });

    it('should return 401 for invalid credentials', async () => {
      const userData = createTestUser({ password: 'wrongpassword' });
      const response = await request(app).post('/login').send(userData);

      expectValidResponse(response, 401);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Incorrect email or password.');
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app).post('/login').send({ password: 'testpassword123' });

      expectValidResponse(response, 400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Validation failed');
    });
  });
});
