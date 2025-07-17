import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import https from "https";
import http from "http";

/**
 * Numina AI Server - Main Application Entry Point
 * 
 * This server provides the backend infrastructure for the Numina AI mobile application,
 * featuring personalized AI, emotional analytics, collective intelligence, and
 * comprehensive tool integration capabilities.
 */

console.log("Initializing Numina AI Server...");

// Core configuration imports
import "./config/environment.js";
import connectDB from "./config/database.js";

// API route imports
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import healthRoutes from "./routes/health.js";
import completionRoutes from "./routes/completion.js";
import analyticsRoutes from "./routes/analytics.js";
import taskRoutes from "./routes/tasks.js";
import docsRoutes from "./routes/docs.js";
import emotionsRoutes from "./routes/emotions.js";
import emotionHistoryRoutes from "./routes/emotionHistory.js";
import emotionMetricsRoutes from "./routes/emotionMetrics.js";
import aiRoutes from "./routes/ai.js";
import cloudRoutes from "./routes/cloud.js";
import mobileRoutes from "./routes/mobile.js";
import personalInsightsRoutes from "./routes/personalInsights.js";
import cascadingRecommendationsRoutes from "./routes/cascadingRecommendations.js";
import syncRoutes from "./routes/sync.js";
import apiDocsRoutes from "./routes/apiDocs.js";
import personalizedAIRoutes from "./routes/personalizedAI.js";
import testPersonalizationRoutes from "./routes/testPersonalization.js";
import testGPT4oRoutes from "./routes/testGPT4o.js";
import numinaPersonalityRoutes from "./routes/numinaPersonality.js";
import toolsRoutes from "./routes/tools.js";
import walletRoutes from "./routes/wallet.js";
import subscriptionRoutes from "./routes/subscription.js";
import debugRoutes from "./routes/debug.js";
import testUBPMRoutes from "./routes/testUBPM.js";
import dataCleanupRoutes from "./routes/dataCleanup.js";

console.log("Route modules imported successfully");

// Import tool system
import toolRegistry from "./services/toolRegistry.js";
import triggerSystem from "./services/triggerSystem.js";

// Import middleware
import { corsSecurity, securityHeaders, validateContent, sanitizeRequest } from "./middleware/security.js";
import { requestLogger, errorLogger } from "./utils/logger.js";
import { globalErrorHandler } from "./utils/errorHandler.js";
import { performanceMiddleware as enhancedPerformanceMiddleware, completionPerformanceMiddleware } from "./middleware/performanceMiddleware.js";
import cacheMiddleware from "./middleware/cacheMiddleware.js";

console.log("Middleware modules imported successfully");

// Utility imports
import { createCache, setupMemoryMonitoring } from "./utils/cache.js";

console.log("Utility modules imported successfully");

import taskScheduler from "./services/taskScheduler.js";

import websocketService from "./services/websocketService.js";
import redisService from "./services/redisService.js";
import pushNotificationService from "./services/pushNotificationService.js";
import offlineSyncService from "./services/offlineSyncService.js";
import dataProcessingPipeline from "./services/dataProcessingPipeline.js";

console.log("Service modules imported successfully");

// Database model imports (ensures models are loaded)
import "./models/User.js";
import "./models/ShortTermMemory.js";
import "./models/Task.js";
import "./models/EmotionalAnalyticsSession.js";
import "./models/CollectiveDataConsent.js";
import "./models/CollectiveSnapshot.js";
import "./models/Event.js";
import "./models/UserBehaviorProfile.js";

console.log("Database models loaded successfully");

const app = express();

console.log("Express application created");

/**
 * Server initialization function
 * Sets up all middleware, services, and routes
 */
const initializeServer = async () => {
  console.log("Beginning server initialization...");
  
  // Memory cleanup middleware for performance optimization
  const memoryCleanupMiddleware = (req, res, next) => {
    res.on('finish', () => {
      // Clean up request-specific data to prevent memory leaks
      if (req.user) delete req.user;
      if (req.body) delete req.body;
      
      // Trigger garbage collection for large responses
      if (res.get('content-length') > 100000) {
        setImmediate(() => {
          if (global.gc) global.gc();
        });
      }
    });
    next();
  };

  console.log("Memory cleanup middleware configured");

  // Initialize core services
  console.log("Initializing Redis service...");
  await redisService.initialize();
  
  console.log("Initializing push notification service...");
  await pushNotificationService.initialize();

  // Configure security and middleware stack
  app.use(enhancedPerformanceMiddleware);
  app.use(corsSecurity);
  app.use(express.json({ limit: "10mb" }));
  app.use(validateContent);
  app.use(sanitizeRequest);
  app.use(securityHeaders);
  app.use(compression());
  app.use(memoryCleanupMiddleware);
  app.use(requestLogger);

  // Configure caching for mobile-optimized routes
  app.use('/api', cacheMiddleware.mobileOptimizedCache());
  app.use('/mobile', cacheMiddleware.mobileOptimizedCache({ mobileTtl: 900 }));

  console.log("Security and middleware configured");

  // Establish database connection
  console.log("Connecting to MongoDB...");
  await connectDB();

  // Initialize AI tool system
  console.log("Initializing tool system...");
  await toolRegistry.initialize();
  console.log("Tool system initialized");

  // Configure HTTPS agent for external API calls
  const globalHttpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 50,
    rejectUnauthorized: false,
    timeout: 60000,
  });

  app.locals.httpsAgent = globalHttpsAgent;
  console.log("HTTPS agent configured for external API calls");

  // Initialize cache and memory monitoring
  console.log("Initializing cache and memory monitoring...");
  app.locals.cache = createCache();
  setupMemoryMonitoring();
  console.log("Cache and memory monitoring initialized");

  // Register API routes
  console.log("Registering API routes...");
  app.use("/", authRoutes);
  app.use("/", userRoutes);
  app.use("/", healthRoutes);
  app.use("/", completionPerformanceMiddleware, completionRoutes);
  app.use("/", analyticsRoutes);
  app.use("/", taskRoutes);
  app.use("/", docsRoutes);
  app.use("/emotions", emotionsRoutes);
  app.use("/emotion-history", emotionHistoryRoutes);
  app.use("/emotion-metrics", emotionMetricsRoutes);
  app.use("/analytics", analyticsRoutes);
  app.use("/ai", aiRoutes);
  app.use("/personalized-ai", personalizedAIRoutes);
  app.use("/test-personalization", testPersonalizationRoutes);
  app.use("/test-gpt4o", testGPT4oRoutes);
  app.use("/numina-personality", numinaPersonalityRoutes);
  app.use("/tools", toolsRoutes);
  app.use("/wallet", walletRoutes);
  app.use("/subscription", subscriptionRoutes);
  app.use("/", debugRoutes);
  app.use("/test-ubpm", testUBPMRoutes);
  app.use("/data-cleanup", dataCleanupRoutes);
  app.use("/cloud", cloudRoutes);
  app.use("/personal-insights", personalInsightsRoutes);
  app.use("/cascading-recommendations", cascadingRecommendationsRoutes);
  
  // Register mobile-optimized routes
  app.use("/", mobileRoutes);
  app.use("/", syncRoutes);
  app.use("/", apiDocsRoutes);

  console.log("API routes registered successfully");

  // Health check endpoint for monitoring
  app.get("/test", (req, res) => {
    res.json({
      success: true,
      message: "Numina AI Server is operational",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      features: [
        "Personalized AI",
        "Emotional Analytics", 
        "Collective Intelligence",
        "Tool Integration"
      ]
    });
  });

  console.log("Health check endpoint configured");

  // Validate required environment variables
  console.log("Validating environment variables...");
  const requiredEnvVars = ['OPENROUTER_API_KEY', 'MONGO_URI'];
  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingEnvVars.length > 0) {
    console.warn('Warning: Missing required environment variables:', missingEnvVars.join(', '));
    console.warn('Some features may not work properly without these variables');
  } else {
    console.log("All required environment variables are present");
  }

  // Initialize scheduled services (production only)
  if (process.env.NODE_ENV !== 'test') {
    console.log("Initializing scheduled services...");
    // Scheduled aggregation service temporarily disabled for optimization
    // scheduledAggregationService.start();
    console.log("Collective data services disabled - focusing on core features");
  }

  // Configure error handling
  console.log("Configuring error handling middleware...");
  app.use(errorLogger);
  app.use(globalErrorHandler);
  console.log("Error handling middleware configured");

  // Start HTTP server (production only)
  if (process.env.NODE_ENV !== 'test') {
    console.log("Starting HTTP server...");
    const PORT = process.env.PORT || 5000;
    
    // Create HTTP server for WebSocket integration
    const server = http.createServer(app);
    
    // Initialize WebSocket service for real-time features
    console.log("Initializing WebSocket service...");
    websocketService.initialize(server);
    
    server.listen(PORT, () => {
      console.log(`Numina AI Server running on port ${PORT}`);
      console.log(`WebSocket service active on ws://localhost:${PORT}`);
      console.log(`Performance optimizations: Enabled`);
      console.log(`Memory usage: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
      console.log(`Redis service: ${redisService.isRedisConnected() ? 'Connected' : 'Fallback mode'}`);
      console.log(`Push notifications: ${pushNotificationService.isInitialized ? 'Enabled' : 'Disabled'}`);
      console.log("Server initialization completed successfully");
    });
  }
};

// Initialize server for both production and testing
if (process.env.NODE_ENV !== 'test') {
  // Full initialization for production
  console.log("Launching Numina AI Server...");
  initializeServer().catch(err => {
    console.error('Failed to initialize server:', err);
    process.exit(1);
  });
} else {
  // Minimal initialization for tests
  console.log("Initializing server for testing...");
  
  // Initialize basic middleware and routes for testing
  const initializeForTests = async () => {
    try {
      // Basic middleware setup
      app.use(express.json({ limit: "10mb" }));
      
      // Connect to database if not already connected
      if (process.env.MONGO_URI && !mongoose.connection.readyState) {
        await connectDB();
      }
      
      // Register routes for testing
      app.use("/", authRoutes);
      app.use("/", userRoutes);
      app.use("/", healthRoutes);
      app.use("/", completionRoutes);
      app.use("/", taskRoutes);
      app.use("/", docsRoutes);
      app.use("/emotions", emotionsRoutes);
      app.use("/emotion-history", emotionHistoryRoutes);
      app.use("/emotion-metrics", emotionMetricsRoutes);
      app.use("/analytics", analyticsRoutes);
      app.use("/ai", aiRoutes);
      app.use("/personalized-ai", personalizedAIRoutes);
      app.use("/test-personalization", testPersonalizationRoutes);
      app.use("/test-gpt4o", testGPT4oRoutes);
      app.use("/numina-personality", numinaPersonalityRoutes);
      app.use("/tools", toolsRoutes);
      app.use("/wallet", walletRoutes);
      app.use("/subscription", subscriptionRoutes);
      app.use("/", debugRoutes);
      app.use("/test-ubpm", testUBPMRoutes);
      app.use("/cloud", cloudRoutes);
      app.use("/personal-insights", personalInsightsRoutes);
      app.use("/cascading-recommendations", cascadingRecommendationsRoutes);
      app.use("/", mobileRoutes);
      app.use("/", syncRoutes);
      app.use("/", apiDocsRoutes);
      
      // Test endpoint
      app.get("/test", (req, res) => {
        res.json({
          success: true,
          message: "Numina AI Server Test Mode",
          timestamp: new Date().toISOString(),
          version: "1.0.0-test"
        });
      });
      
      console.log("Test server initialization completed");
    } catch (error) {
      console.error('Test server initialization error:', error);
    }
  };
  
  // Initialize immediately for tests (but don't await - let it run in background)
  initializeForTests().catch(error => {
    console.error('Test initialization failed:', error);
  });
}

export default app;