import request from 'supertest';
import app from '../../src/server.js';
import mongoose from 'mongoose';
import User from '../../src/models/User.js';
import CollectiveDataConsent from '../../src/models/CollectiveDataConsent.js';

describe('Collective Data API', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Create test user
    testUser = new User({
      email: 'test@collective.com',
      password: 'testpassword123',
      emotionalLog: [
        {
          emotion: 'happy',
          intensity: 8,
          context: 'Great day at work',
          timestamp: new Date()
        },
        {
          emotion: 'sad',
          intensity: 3,
          context: 'Missed the bus',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      ]
    });
    await testUser.save();

    // Create consent for test user
    const consent = new CollectiveDataConsent({
      userId: testUser._id,
      consentStatus: 'granted',
      dataTypes: {
        emotions: true,
        intensity: true,
        context: true,
        demographics: false,
        activityPatterns: false
      }
    });
    await consent.save();

    // Login to get auth token
    const loginResponse = await request(app).post('/auth/login').send({
      email: 'test@collective.com',
      password: 'testpassword123'
    });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    // Cleanup
    await User.deleteMany({ email: 'test@collective.com' });
    await CollectiveDataConsent.deleteMany({ userId: testUser._id });
    await mongoose.connection.close();
  });

  describe('POST /collective-data/consent', () => {
    it('should update user consent', async () => {
      const response = await request(app)
        .post('/collective-data/consent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consentStatus: 'granted',
          dataTypes: {
            emotions: true,
            intensity: true,
            context: false
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.consent.consentStatus).toBe('granted');
    });

    it('should reject invalid consent status', async () => {
      const response = await request(app)
        .post('/collective-data/consent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consentStatus: 'invalid',
          dataTypes: {
            emotions: true
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /collective-data/consent', () => {
    it('should get user consent status', async () => {
      const response = await request(app)
        .get('/collective-data/consent')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.consent).toBeDefined();
    });
  });

  describe('GET /collective-data/emotions', () => {
    it('should get aggregated emotional data', async () => {
      const response = await request(app).get(
        '/collective-data/emotions?timeRange=30d&minConsentCount=1'
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.metadata).toBeDefined();
      expect(response.body.data).toBeDefined();
    });

    it('should handle insufficient consenting users', async () => {
      const response = await request(app).get('/collective-data/emotions?minConsentCount=100');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /collective-data/formatted', () => {
    it('should get formatted data for pie chart', async () => {
      const response = await request(app).get(
        '/collective-data/formatted?visualization=pie&minConsentCount=1'
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.visualization.type).toBe('pie');
      expect(response.body.data).toBeDefined();
    });

    it('should get formatted data for heatmap', async () => {
      const response = await request(app).get(
        '/collective-data/formatted?visualization=heatmap&minConsentCount=1'
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.visualization.type).toBe('heatmap');
    });
  });

  describe('GET /collective-data/demographics', () => {
    it('should get demographic patterns', async () => {
      const response = await request(app).get('/collective-data/demographics');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.demographics).toBeDefined();
      expect(response.body.activityPatterns).toBeDefined();
    });
  });

  describe('GET /collective-data/insights', () => {
    it('should get real-time insights', async () => {
      const response = await request(app).get('/collective-data/insights');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.insights).toBeDefined();
    });
  });

  describe('GET /collective-data/stats', () => {
    it('should get collective data statistics', async () => {
      const response = await request(app).get('/collective-data/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.consent).toBeDefined();
      expect(response.body.overview).toBeDefined();
    });
  });

  describe('POST /collective-data/cache/clear', () => {
    it('should clear cache with authentication', async () => {
      const response = await request(app)
        .post('/collective-data/cache/clear')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject without authentication', async () => {
      const response = await request(app).post('/collective-data/cache/clear');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /collective-data/export', () => {
    it('should export data as JSON', async () => {
      const response = await request(app)
        .get('/collective-data/export')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.users).toBeDefined();
    });

    it('should export data as CSV', async () => {
      const response = await request(app)
        .get('/collective-data/export?format=csv')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
    });
  });
});
