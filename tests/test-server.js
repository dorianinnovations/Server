/**
 * Test Server Setup
 * Creates a properly configured Express app for testing
 */

import express from 'express';
import mongoose from 'mongoose';

// Import routes (avoid problematic AI routes that trigger background services)
import authRoutes from '../src/routes/auth.js';
import healthRoutes from '../src/routes/health.js';
import emotionalAnalyticsRoutes from '../src/routes/emotionalAnalytics.js';
import mobileRoutes from '../src/routes/mobile.js';
import cloudRoutes from '../src/routes/cloud.js';
import analyticsRoutes from '../src/routes/analytics.js';
import personalInsightsRoutes from '../src/routes/personalInsights.js';
import completionRoutes from '../src/routes/completion.js';
import userRoutes from '../src/routes/user.js';

/**
 * Create a test Express app with essential middleware and routes
 */
export const createTestApp = async () => {
  const app = express();

  // Basic middleware
  app.use(express.json({ limit: '1mb' }));

  // Mock locals that some routes might expect
  app.locals.cache = {
    get: () => null,
    set: () => {},
    del: () => {},
    clear: () => {}
  };

  // Mock tool executor for testing
  app.locals.toolExecutor = {
    executeToolCall: async (toolCall, userContext) => {
      const toolName = toolCall.function.name;
      const args = toolCall.function.arguments;

      // Mock tool responses for testing
      if (toolName === 'weather_check') {
        return {
          success: true,
          data: {
            location: { name: args.location },
            current: { temperature: 22, condition: 'sunny' }
          }
        };
      }
      if (toolName === 'web_search') {
        return {
          success: true,
          data: {
            results: [{ title: 'Test Result', url: 'https://example.com' }]
          }
        };
      }
      return { success: false, error: 'Tool not found' };
    }
  };

  // Register routes (matching the main server, but avoid problematic ones)
  app.use('/', authRoutes);
  app.use('/', userRoutes);
  app.use('/', healthRoutes);
  app.use('/', completionRoutes);
  app.use('/emotional-analytics', emotionalAnalyticsRoutes);
  app.use('/analytics', analyticsRoutes);
  app.use('/cloud', cloudRoutes);
  app.use('/personal-insights', personalInsightsRoutes);
  app.use('/', mobileRoutes);

  // Mock tools route to avoid dependency issues
  app.use('/tools', async (req, res, next) => {
    if (req.path === '/execute' && req.method === 'POST') {
      const { toolName, arguments: args } = req.body;
      const mockResult = await app.locals.toolExecutor.executeToolCall(
        {
          function: { name: toolName, arguments: args }
        },
        { userId: req.user?.id }
      );
      return res.json({ success: true, result: mockResult });
    }
    next();
  });

  // Mock AI routes to avoid dependency issues
  app.use('/ai', (req, res, next) => {
    if (req.path === '/adaptive-chat' && req.method === 'POST') {
      return res.json({
        success: true,
        data: {
          response: 'This is a mock adaptive response for testing.',
          emotionalContext: req.body.emotionalContext,
          adaptedToMood: true
        }
      });
    }
    if (req.path === '/emotional-state' && req.method === 'POST') {
      return res.json({
        success: true,
        data: {
          currentState: 'positive',
          analysis: 'Mock emotional state analysis',
          recommendations: ['Continue positive engagement']
        }
      });
    }
    next();
  });

  // Test endpoint
  app.get('/test', (req, res) => {
    res.json({
      success: true,
      message: 'Test server is working',
      timestamp: new Date().toISOString()
    });
  });

  return app;
};

/**
 * Setup test database connection
 */
export const setupTestDatabase = async () => {
  if (mongoose.connection.readyState === 0) {
    // Connect to test database
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/numina-test';
    await mongoose.connect(mongoUri);
  }
};

/**
 * Cleanup test database
 */
export const cleanupTestDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
};
