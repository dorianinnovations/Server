import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../src/server.js';
import User from '../../src/models/User.js';
import jwt from 'jsonwebtoken';

let mongoServer;
let authToken;
let testUser;

beforeAll(async () => {
  
  
  
});

afterAll(async () => {
  
  
});

beforeEach(async () => {
  await User.deleteMany({});

  // Create a test user
  const userData = {
    email: 'test@example.com',
    password: 'password123'
  };

  const signupResponse = await request(app).post('/signup').send(userData);

  authToken = signupResponse.body.token;
  testUser = signupResponse.body.data.user;
});

describe('User Profile Routes', () => {
  describe('GET /profile', () => {
    it('should return user profile with valid token', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get('/profile').expect(401);

      expect(response.body.message).toBe('You are not logged in! Please log in to get access.');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.message).toBe('Invalid or expired token.');
    });

    it('should return 404 for non-existent user', async () => {
      // Create a token for a non-existent user
      const fakeToken = jwt.sign(
        { id: new mongoose.Types.ObjectId() },
        process.env.JWT_SECRET || 'test-secret'
      );

      const response = await request(app)
        .get('/profile')
        .set('Authorization', `Bearer ${fakeToken}`)
        .expect(404);

      expect(response.body.message).toBe('User not found.');
    });
  });
});
