import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import https from "https";
import http from "http";
import mongoose from "mongoose";
import path from "path";

/**
 * Numina AI Server - Main Application Entry Point
 * 
 * This server provides the backend infrastructure for the Numina AI mobile application,
 * featuring personalized AI, emotional analytics, collective intelligence, and
 * comprehensive tool integration capabilities.
 */

// Import logger first for clean startup
import { log } from "./utils/logger.js";

// Initializing Numina AI Server

// Core configuration imports
import "./config/environment.js";
import connectDB from "./config/database.js";

// API route imports
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import healthRoutes from "./routes/health.js";
import { protect } from "./middleware/auth.js";
import completionRoutes from "./routes/completion.js";
import analyticsRoutes from "./routes/analytics.js";
import taskRoutes from "./routes/tasks.js";
import docsRoutes from "./routes/docs.js";
import aiRoutes from "./routes/ai.js";
import cloudRoutes from "./routes/cloud.js";
import mobileRoutes from "./routes/mobile.js";
import personalInsightsRoutes from "./routes/personalInsights.js";
import syncRoutes from "./routes/sync.js";
import conversationSyncRoutes from "./routes/conversationSync.js";
import conversationsRoutes from "./routes/conversations.js";
import emotionalAnalyticsRoutes from "./routes/emotionalAnalytics.js";
import ubpmRoutes from "./routes/ubpm.js";
import apiDocsRoutes from "./routes/apiDocs.js";
import personalizedAIRoutes from "./routes/personalizedAI.js";
import toolsRoutes from "./routes/tools.js";
import walletRoutes from "./routes/wallet.js";
import subscriptionRoutes from "./routes/subscription.js";
import dataCleanupRoutes from "./routes/dataCleanup.js";
import collectiveDataRoutes from "./routes/collectiveData.js";
import collectiveSnapshotsRoutes from "./routes/collectiveSnapshots.js";
import scheduledAggregationRoutes from "./routes/scheduledAggregation.js";
import secureCloudRoutes from "./routes/secureCloud.js";
import analyticsLLMRoutes from "./routes/analyticsLLM.js";
import analyticsRateStatusRoutes from "./routes/analyticsRateStatus.js";
import intelligenceDebugRoutes from "./routes/intelligenceDebug.js";
import compressionDashboardRoutes from "./routes/compressionDashboard.js";
import tierTestRoutes from "./routes/tierTest.js";
import sandboxRoutes from "./routes/sandbox.js";
import analyticsEcosystemRoutes from "./routes/analyticsEcosystem.js";
import authTestRoutes from "./routes/authTest.js";
import emailRoutes from "./routes/email.js";
import visualizationsRoutes from "./routes/visualizations.js";
import behaviorMetricsRoutes from "./routes/behaviorMetrics.js";

log.debug("Route modules imported");

// Import tool system
import toolRegistry from "./services/toolRegistry.js";
import triggerSystem from "./services/triggerSystem.js";

// Import middleware
import { corsSecurity, securityHeaders, validateContent, sanitizeRequest } from "./middleware/security.js";
import { requestLogger, errorLogger } from "./utils/logger.js";
import { globalErrorHandler } from "./utils/errorHandler.js";
import { performanceMiddleware as enhancedPerformanceMiddleware, completionPerformanceMiddleware } from "./middleware/performanceMiddleware.js";
import cacheMiddleware from "./middleware/cacheMiddleware.js";

log.debug("Middleware modules imported");

// Utility imports
import { createCache, setupMemoryMonitoring } from "./utils/cache.js";

log.debug("Utility modules imported");

// import taskScheduler from "./services/taskScheduler.js"; // REMOVED - phased out

import websocketService from "./services/websocketService.js";
import redisService from "./services/redisService.js";
import pushNotificationService from "./services/pushNotificationService.js";
import offlineSyncService from "./services/offlineSyncService.js";
import dataProcessingPipeline from "./services/dataProcessingPipeline.js";

log.debug("Service modules imported");

// Database model imports (ensures models are loaded)
import "./models/User.js";
import "./models/ShortTermMemory.js";
import "./models/Task.js";
import "./models/CollectiveDataConsent.js";
import "./models/CollectiveSnapshot.js";
import "./models/Event.js";
import "./models/UserBehaviorProfile.js";
import "./models/AnalyticsInsight.js";
import "./models/InsightCooldown.js";
import "./models/SandboxSession.js";
import "./models/LockedNode.js";

log.debug("Database models loaded");

const app = express();

log.debug("Express application created");

/**
 * Server initialization function
 * Sets up all middleware, services, and routes
 */
const initializeServer = async () => {
  // Beginning server initialization
  
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

  log.debug("Memory cleanup middleware configured");

  // Initialize core services
  // Initializing Redis service
  await redisService.initialize();
  
  // Initializing push notification service
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

  // Configure caching for mobile-optimized routes BEFORE static files
  app.use('/api', cacheMiddleware.mobileOptimizedCache());
  app.use('/mobile', cacheMiddleware.mobileOptimizedCache({ mobileTtl: 900 }));

  // Serve static files from public directory (AFTER API routes to prevent conflicts)
  app.use('/static', express.static('public'));
  app.use('/assets', express.static('public'));

  // Security and middleware configured

  // Establish database connection
  // Connecting to MongoDB
  await connectDB();

  // Initialize AI tool system
  // Initializing tool system
  await toolRegistry.initialize();
  // Tool system initialized

  // Configure HTTPS agent for external API calls
  const globalHttpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 50,
    rejectUnauthorized: true,
    timeout: 60000,
  });

  app.locals.httpsAgent = globalHttpsAgent;
  log.debug("HTTPS agent configured for external API calls");

  // Initialize cache and memory monitoring
  // Initializing cache and memory monitoring
  app.locals.cache = createCache();
  setupMemoryMonitoring();
  // Cache and memory monitoring initialized

  // Root health endpoint for monitoring
  app.get("/", (req, res) => {
    res.json({ 
      status: "success", 
      message: "Numina AI Server is running", 
      timestamp: new Date().toISOString(),
      version: "1.0.0"
    });
  });

  // Register API routes first to take precedence over static routes
  log.debug("Registering API routes");
  app.use("/", authRoutes);
  app.use("/", userRoutes);
  app.use("/", healthRoutes);
  app.use("/", completionPerformanceMiddleware, completionRoutes);
  app.use("/", analyticsRoutes);
  app.use("/", taskRoutes);
  app.use("/", docsRoutes);
  app.use("/analytics", analyticsRoutes);
  app.use("/analytics", analyticsEcosystemRoutes);
  app.use("/analytics/llm", analyticsLLMRoutes);
  app.use("/analytics-rate-status", analyticsRateStatusRoutes);
  app.use("/intelligence-debug", intelligenceDebugRoutes);
  app.use("/compression-dashboard", compressionDashboardRoutes);
  app.use("/tier-test", tierTestRoutes);
  app.use("/sandbox", sandboxRoutes);
  app.use("/", authTestRoutes);
  app.use("/email", emailRoutes);
  app.use("/visualizations", visualizationsRoutes);
  app.use("/behavior-metrics", behaviorMetricsRoutes);
  app.use("/ai", aiRoutes);
  app.use("/personalized-ai", personalizedAIRoutes);
  app.use("/tools", toolsRoutes);
  app.use("/wallet", walletRoutes);
  app.use("/subscription", subscriptionRoutes);
  app.use("/data-cleanup", dataCleanupRoutes);
  app.use("/cloud", cloudRoutes);
  app.use("/personal-insights", personalInsightsRoutes);
  app.use("/collective-data", collectiveDataRoutes);
  app.use("/collective-snapshots", collectiveSnapshotsRoutes);
  app.use("/scheduled-aggregation", scheduledAggregationRoutes);
  app.use("/api/cloud", secureCloudRoutes);
  
  // Register mobile-optimized routes
  app.use("/", mobileRoutes);
  app.use("/", syncRoutes);
  app.use("/conversation", conversationSyncRoutes);
  app.use("/conversations", conversationsRoutes); // New persistent conversation routes
  app.use("/emotional-analytics", emotionalAnalyticsRoutes);
  
  // Direct emotions endpoint for mobile app compatibility
  app.post("/emotions", protect, async (req, res) => {
    try {
      const userId = req.user.id;
      const { emotion, intensity, context, timestamp } = req.body;

      if (!emotion || intensity === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Emotion and intensity are required'
        });
      }

      const emotionData = {
        userId,
        emotion,
        intensity: Math.max(1, Math.min(10, intensity)),
        context: context || '',
        timestamp: timestamp || new Date().toISOString(),
        submittedAt: new Date().toISOString()
      };

      res.json({
        success: true,
        data: emotionData,
        message: 'Emotion data submitted successfully'
      });

    } catch (error) {
      console.error('Error submitting emotion data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit emotion data'
      });
    }
  });
  
  app.use("/test-ubpm", ubpmRoutes);
  app.use("/", apiDocsRoutes);

  // API routes registered

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

  log.debug("Health check endpoint configured");

  // Static HTML routes (after API routes to prevent conflicts)
  app.get("/profile-page", (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'profile.html'));
  });

  app.get("/login-page", (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'login.html'));
  });

  // Validate required environment variables
  // Validating environment variables
  const requiredEnvVars = ['OPENROUTER_API_KEY', 'MONGO_URI'];
  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingEnvVars.length > 0) {
    log.warn('Missing required environment variables', { missing: missingEnvVars });
    log.warn('Some features may not work properly without these variables');
  } else {
    // All required environment variables are present
  }

  // Initialize scheduled services (production only)
  if (process.env.NODE_ENV !== 'test') {
    // Initializing scheduled services
    // Scheduled aggregation service temporarily disabled for optimization
    // scheduledAggregationService.start();
    log.debug("Collective data services disabled - focusing on core features");
  }

  // Configure error handling
  log.debug("Configuring error handling middleware");
  app.use(errorLogger);
  app.use(globalErrorHandler);
  // Error handling middleware configured

  // Start HTTP server (production only)
  if (process.env.NODE_ENV !== 'test') {
    // Starting HTTP server
    const PORT = process.env.PORT || 5000;
    
    // Create HTTP server for WebSocket integration
    const server = http.createServer(app);
    
    // Initialize WebSocket service for real-time features
    // Initializing WebSocket service
    websocketService.initialize(server);
    
    server.listen(PORT, () => {
      log.success(`Numina AI Server running on port ${PORT}`);
      // WebSocket service active
      // Performance optimizations enabled
      // Memory usage logged
      // Redis service status checked
      // Push notifications status checked
      // Server initialization completed
    });
  }
};

// Initialize server for both production and testing
if (process.env.NODE_ENV !== 'test') {
  // Full initialization for production
  log.system("Launching Numina AI Server");
  initializeServer().catch(err => {
    log.error('Failed to initialize server', err);
    process.exit(1);
  });
} else {
  // Minimal initialization for tests
  log.system("Initializing server for testing");
  
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
      app.use("/analytics", analyticsRoutes);
      app.use("/analytics", analyticsEcosystemRoutes);
      app.use("/analytics/llm", analyticsLLMRoutes);
      app.use("/intelligence-debug", intelligenceDebugRoutes);
      app.use("/compression-dashboard", compressionDashboardRoutes);
      app.use("/tier-test", tierTestRoutes);
      app.use("/sandbox", sandboxRoutes);
      app.use("/", authTestRoutes);
      app.use("/ai", aiRoutes);
      app.use("/personalized-ai", personalizedAIRoutes);
          app.use("/tools", toolsRoutes);
      app.use("/wallet", walletRoutes);
      app.use("/subscription", subscriptionRoutes);
      app.use("/cloud", cloudRoutes);
      app.use("/personal-insights", personalInsightsRoutes);
      app.use("/collective-data", collectiveDataRoutes);
      app.use("/collective-snapshots", collectiveSnapshotsRoutes);
      app.use("/scheduled-aggregation", scheduledAggregationRoutes);
      app.use("/api/cloud", secureCloudRoutes);
      app.use("/", mobileRoutes);
      app.use("/", syncRoutes);
      app.use("/conversation", conversationSyncRoutes);
      // Note: /conversations is handled by conversationsRoutes - don't override it
      app.use("/emotional-analytics", emotionalAnalyticsRoutes);
      app.use("/test-ubpm", ubpmRoutes);
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
      
      log.success("Test server initialization completed");
    } catch (error) {
      log.error('Test server initialization error', error);
    }
  };
  
  // Initialize immediately for tests (but don't await - let it run in background)
  initializeForTests().catch(error => {
    log.error('Test initialization failed', error);
  });
}

export default app;