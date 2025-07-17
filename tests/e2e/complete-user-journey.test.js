/**
 * Complete End-to-End User Journey Test Suite
 * Tests the full user lifecycle with success rate monitoring
 */

import request from 'supertest';
import User from '../../src/models/User.js';
import { setupTestEnvironment, cleanupTestEnvironment } from '../utils/testSetup.js';
import { createTestApp } from '../test-server.js';

describe('Complete User Journey E2E Tests', () => {
  let app;
  let testUserEmail;
  let authToken;
  let userId;

  // Test metrics for success rate monitoring
  const testMetrics = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    testResults: [],
    startTime: null,
    endTime: null
  };

  beforeAll(async () => {
    testMetrics.startTime = Date.now();
    await setupTestEnvironment();
    app = await createTestApp(); // Use our working test server
    testUserEmail = `test-journey-${Date.now()}@numina.app`;
  });

  afterAll(async () => {
    testMetrics.endTime = Date.now();
    await cleanupTestEnvironment();

    // Calculate and log success rates
    const successRate = (testMetrics.passedTests / testMetrics.totalTests) * 100;
    const duration = testMetrics.endTime - testMetrics.startTime;

    console.log('\n🎯 END-TO-END TEST METRICS:');
    console.log(`📊 Success Rate: ${successRate.toFixed(2)}%`);
    console.log(`✅ Passed: ${testMetrics.passedTests}/${testMetrics.totalTests}`);
    console.log(`❌ Failed: ${testMetrics.failedTests}`);
    console.log(`⏱️ Duration: ${duration}ms`);
    console.log('📋 Test Results:', testMetrics.testResults);
  });

  // Helper function to track test results
  const trackTest = (testName, success, duration, error = null) => {
    testMetrics.totalTests++;
    if (success) {
      testMetrics.passedTests++;
    } else {
      testMetrics.failedTests++;
    }

    testMetrics.testResults.push({
      name: testName,
      success,
      duration,
      error: error ? error.message : null,
      timestamp: Date.now()
    });
  };

  describe('1. User Registration Flow', () => {
    test('should successfully register a new user', async () => {
      const startTime = Date.now();
      let success = false;
      let error = null;

      try {
        const response = await request(app).post('/signup').send({
          email: testUserEmail,
          password: 'TestPassword123!'
        });

        expect(response.status).toBe(201);
        expect(response.body.status).toBe('success');
        expect(response.body.token).toBeDefined();
        expect(response.body.data.user.email).toBe(testUserEmail);

        authToken = response.body.token;
        userId = response.body.data.user.id;
        success = true;
      } catch (e) {
        error = e;
        throw e;
      } finally {
        trackTest('User Registration', success, Date.now() - startTime, error);
      }
    });

    test('should reject duplicate email registration', async () => {
      const startTime = Date.now();
      let success = false;
      let error = null;

      try {
        const response = await request(app).post('/signup').send({
          email: testUserEmail,
          password: 'AnotherPassword123!'
        });

        expect(response.status).toBe(409);
        expect(response.body.status).toBe('error');
        success = true;
      } catch (e) {
        error = e;
        throw e;
      } finally {
        trackTest('Duplicate Email Rejection', success, Date.now() - startTime, error);
      }
    });
  });

  describe('2. Authentication Flow', () => {
    test('should successfully login with valid credentials', async () => {
      const startTime = Date.now();
      let success = false;
      let error = null;

      try {
        const response = await request(app).post('/login').send({
          email: testUserEmail,
          password: 'TestPassword123!'
        });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.token).toBeDefined();

        authToken = response.body.token; // Update token
        success = true;
      } catch (e) {
        error = e;
        throw e;
      } finally {
        trackTest('User Login', success, Date.now() - startTime, error);
      }
    });

    test('should reject invalid credentials', async () => {
      const startTime = Date.now();
      let success = false;
      let error = null;

      try {
        const response = await request(app).post('/login').send({
          email: testUserEmail,
          password: 'WrongPassword123!'
        });

        expect(response.status).toBe(401);
        expect(response.body.status).toBe('error');
        success = true;
      } catch (e) {
        error = e;
        throw e;
      } finally {
        trackTest('Invalid Login Rejection', success, Date.now() - startTime, error);
      }
    });
  });

  describe('3. Core Chat Functionality', () => {
    test('should successfully process chat completion', async () => {
      const startTime = Date.now();
      let success = false;
      let error = null;

      try {
        const response = await request(app)
          .post('/completion')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            prompt: 'Hello, how are you today?',
            stream: false,
            temperature: 0.7,
            n_predict: 100
          });

        expect(response.status).toBe(200);
        // Response should contain AI-generated content
        expect(response.text).toBeDefined();
        expect(response.text.length).toBeGreaterThan(0);
        success = true;
      } catch (e) {
        error = e;
        throw e;
      } finally {
        trackTest('Chat Completion', success, Date.now() - startTime, error);
      }
    });

    test('should handle adaptive chat with emotional context', async () => {
      const startTime = Date.now();
      let success = false;
      let error = null;

      try {
        const response = await request(app)
          .post('/ai/adaptive-chat')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'I feel stressed about work today',
            emotionalContext: {
              mood: 'stressed',
              intensity: 7,
              timeOfDay: 'afternoon',
              recentInteractions: ['work meeting', 'deadline pressure'],
              patterns: ['work-related stress']
            },
            personalityStyle: 'supportive',
            stream: false
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.response).toBeDefined();
        success = true;
      } catch (e) {
        error = e;
        throw e;
      } finally {
        trackTest('Adaptive Chat', success, Date.now() - startTime, error);
      }
    });
  });

  describe('4. Emotional Analytics Flow', () => {
    test('should successfully save emotional data', async () => {
      const startTime = Date.now();
      let success = false;
      let error = null;

      try {
        const response = await request(app)
          .post('/emotions')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            mood: 'happy',
            intensity: 8,
            notes: 'Feeling great after successful test',
            date: new Date().toISOString()
          });

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('Emotional entry submitted successfully');
        success = true;
      } catch (e) {
        error = e;
        throw e;
      } finally {
        trackTest('Emotion Data Save', success, Date.now() - startTime, error);
      }
    });

    test('should analyze emotional state', async () => {
      const startTime = Date.now();
      let success = false;
      let error = null;

      try {
        const response = await request(app)
          .post('/ai/emotional-state')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            recentEmotions: [
              { type: 'happy', intensity: 8, timestamp: new Date() },
              { type: 'calm', intensity: 6, timestamp: new Date() }
            ],
            conversationHistory: [
              { role: 'user', content: 'I feel great today!' },
              { role: 'assistant', content: "That's wonderful to hear!" }
            ],
            timeContext: new Date().toISOString()
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        success = true;
      } catch (e) {
        error = e;
        throw e;
      } finally {
        trackTest('Emotional State Analysis', success, Date.now() - startTime, error);
      }
    });
  });

  describe('5. AI Tool Execution', () => {
    test('should execute weather check tool', async () => {
      const startTime = Date.now();
      let success = false;
      let error = null;

      try {
        const response = await request(app)
          .post('/tools/execute')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            toolName: 'weather_check',
            arguments: {
              location: 'San Francisco, CA'
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.result).toBeDefined();
        success = true;
      } catch (e) {
        error = e;
        throw e;
      } finally {
        trackTest('Weather Tool Execution', success, Date.now() - startTime, error);
      }
    });

    test('should execute web search tool', async () => {
      const startTime = Date.now();
      let success = false;
      let error = null;

      try {
        const response = await request(app)
          .post('/tools/execute')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            toolName: 'web_search',
            arguments: {
              query: 'latest AI news 2024'
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.result.data.results).toBeDefined();
        success = true;
      } catch (e) {
        error = e;
        throw e;
      } finally {
        trackTest('Web Search Tool Execution', success, Date.now() - startTime, error);
      }
    });
  });

  describe('6. Cloud Events & Social Features', () => {
    test('should retrieve cloud events', async () => {
      const startTime = Date.now();
      let success = false;
      let error = null;

      try {
        const response = await request(app)
          .get('/cloud/events?limit=5')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data.events)).toBe(true);
        success = true;
      } catch (e) {
        error = e;
        throw e;
      } finally {
        trackTest('Cloud Events Retrieval', success, Date.now() - startTime, error);
      }
    });

    test('should find compatible users', async () => {
      const startTime = Date.now();
      let success = false;
      let error = null;

      try {
        const response = await request(app)
          .post('/cloud/compatibility/users')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            emotionalState: {
              mood: 'happy',
              intensity: 8,
              timeOfDay: 'afternoon',
              recentInteractions: ['successful test'],
              patterns: ['positive']
            },
            interests: ['technology', 'AI', 'wellness'],
            maxResults: 5
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        success = true;
      } catch (e) {
        error = e;
        throw e;
      } finally {
        trackTest('Compatible Users Search', success, Date.now() - startTime, error);
      }
    });
  });

  describe('7. Analytics & Insights', () => {
    test('should generate LLM analytics insights', async () => {
      const startTime = Date.now();
      let success = false;
      let error = null;

      try {
        const response = await request(app)
          .post('/analytics/llm/insights')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            timeRange: '7d',
            focus: 'emotional_patterns',
            model: 'openai/gpt-4o-mini',
            maxTokens: 1000,
            temperature: 0.7
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.insights).toBeDefined();
        success = true;
      } catch (e) {
        error = e;
        throw e;
      } finally {
        trackTest('LLM Analytics Insights', success, Date.now() - startTime, error);
      }
    });

    test('should get personal growth summary', async () => {
      const startTime = Date.now();
      let success = false;
      let error = null;

      try {
        const response = await request(app)
          .get('/personal-insights/growth-summary?timeframe=week')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.metrics).toBeDefined();
        success = true;
      } catch (e) {
        error = e;
        throw e;
      } finally {
        trackTest('Personal Growth Summary', success, Date.now() - startTime, error);
      }
    });
  });

  describe('8. Mobile Sync & Offline Features', () => {
    test('should handle mobile data sync', async () => {
      const startTime = Date.now();
      let success = false;
      let error = null;

      try {
        const response = await request(app)
          .get(
            '/mobile/sync?lastSync=2024-01-01T00:00:00.000Z&dataTypes=profile,emotions,conversations'
          )
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        success = true;
      } catch (e) {
        error = e;
        throw e;
      } finally {
        trackTest('Mobile Data Sync', success, Date.now() - startTime, error);
      }
    });

    test('should get mobile app configuration', async () => {
      const startTime = Date.now();
      let success = false;
      let error = null;

      try {
        const response = await request(app)
          .get('/mobile/app-config')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.features).toBeDefined();
        success = true;
      } catch (e) {
        error = e;
        throw e;
      } finally {
        trackTest('Mobile App Config', success, Date.now() - startTime, error);
      }
    });
  });

  describe('9. Error Handling & Edge Cases', () => {
    test('should handle unauthorized requests', async () => {
      const startTime = Date.now();
      let success = false;
      let error = null;

      try {
        const response = await request(app)
          .get('/profile')
          .set('Authorization', 'Bearer invalid-token');

        expect(response.status).toBe(401);
        expect(response.body.status).toBe('error');
        success = true;
      } catch (e) {
        error = e;
        throw e;
      } finally {
        trackTest('Unauthorized Request Handling', success, Date.now() - startTime, error);
      }
    });

    test('should handle malformed requests', async () => {
      const startTime = Date.now();
      let success = false;
      let error = null;

      try {
        const response = await request(app)
          .post('/emotions')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            // Missing required fields
            intensity: 'invalid'
          });

        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
        success = true;
      } catch (e) {
        error = e;
        throw e;
      } finally {
        trackTest('Malformed Request Handling', success, Date.now() - startTime, error);
      }
    });
  });

  describe('10. Performance & Load Testing', () => {
    test('should handle concurrent chat requests', async () => {
      const startTime = Date.now();
      let success = false;
      let error = null;

      try {
        const concurrentRequests = Array.from({ length: 5 }, (_, i) =>
          request(app)
            .post('/completion')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              prompt: `Test message ${i + 1}`,
              stream: false,
              temperature: 0.7,
              n_predict: 50
            })
        );

        const responses = await Promise.all(concurrentRequests);

        responses.forEach(response => {
          expect(response.status).toBe(200);
          expect(response.text).toBeDefined();
        });

        success = true;
      } catch (e) {
        error = e;
        throw e;
      } finally {
        trackTest('Concurrent Chat Requests', success, Date.now() - startTime, error);
      }
    });

    test('should handle large emotion data batch', async () => {
      const startTime = Date.now();
      let success = false;
      let error = null;

      try {
        const batchRequests = Array.from({ length: 10 }, (_, i) =>
          request(app)
            .post('/emotions')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              mood: 'neutral',
              intensity: Math.floor(Math.random() * 10) + 1,
              notes: `Batch emotion ${i + 1}`,
              date: new Date().toISOString()
            })
        );

        const responses = await Promise.all(batchRequests);

        responses.forEach(response => {
          expect(response.status).toBe(201);
          expect(response.body.message).toBe('Emotional entry submitted successfully');
        });

        success = true;
      } catch (e) {
        error = e;
        throw e;
      } finally {
        trackTest('Large Emotion Data Batch', success, Date.now() - startTime, error);
      }
    });
  });
});
