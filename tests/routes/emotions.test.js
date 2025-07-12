import request from 'supertest';
import app from '../../src/server.js';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../../src/models/User.js';

let mongoServer;
let authToken;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({ binary: { version: '7.0.3' } });
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  const signup = await request(app)
    .post('/signup')
    .send({ email: 'emo@test.com', password: 'password123' });
  authToken = signup.body.token;
});

describe('Emotion Routes', () => {
  test('POST /emotions stores emotion entry', async () => {
    const payload = {
      mood: 'happy',
      intensity: 8,
      notes: 'feeling great',
      timestamp: new Date().toISOString(),
      timeZone: 'UTC',
      deviceInfo: 'jest'
    };

    const res = await request(app)
      .post('/emotions')
      .set('Authorization', `Bearer ${authToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.entry.mood).toBe('happy');
    expect(res.body.entry.timeZone).toBe('UTC');
  });

  test('GET /emotion-history returns logged emotion', async () => {
    await request(app)
      .post('/emotions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        mood: 'sad',
        intensity: 5,
        notes: 'test',
        timestamp: new Date().toISOString(),
        timeZone: 'UTC',
        deviceInfo: 'jest'
      });

    const res = await request(app)
      .get('/emotion-history?limit=10&page=1')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.emotions.length).toBeGreaterThan(0);
    const entry = res.body.emotions[0];
    expect(entry.mood).toBeDefined();
    expect(entry.timeZone).toBe('UTC');
  });
});
