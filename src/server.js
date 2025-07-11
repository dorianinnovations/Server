import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import https from "https";

// Centralized configuration
import "./config/environment.js";
import connectDB from "./config/database.js";

// Import routes
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import healthRoutes from "./routes/health.js";
import completionRoutes from "./routes/completion.js";
import taskRoutes from "./routes/tasks.js";
import docsRoutes from "./routes/docs.js";
import emotionsRoutes from "./routes/emotions.js";
import emotionHistoryRoutes from "./routes/emotionHistory.js";
import emotionMetricsRoutes from "./routes/emotionMetrics.js";
import analyticsRoutes from "./routes/analytics.js";
import collectiveDataRoutes from "./routes/collectiveData.js";
import collectiveSnapshotsRoutes from "./routes/collectiveSnapshots.js";
import scheduledAggregationRoutes from "./routes/scheduledAggregation.js";

// Import middleware
import { corsSecurity, securityHeaders, validateContent, sanitizeRequest } from "./middleware/security.js";
import { requestLogger, errorLogger } from "./utils/logger.js";
import { globalErrorHandler } from "./utils/errorHandler.js";
import { performanceMiddleware as enhancedPerformanceMiddleware, completionPerformanceMiddleware } from "./middleware/performanceMiddleware.js";

// Import utilities
import { createCache, setupMemoryMonitoring } from "./utils/cache.js";

// Import services
import taskScheduler from "./services/taskScheduler.js";
import scheduledAggregationService from "./services/scheduledAggregationService.js";

// Import models (to ensure they're loaded)
import "./models/User.js";
import "./models/ShortTermMemory.js";
import "./models/Task.js";
import "./models/EmotionalAnalyticsSession.js";
import "./models/CollectiveDataConsent.js";
import "./models/CollectiveSnapshot.js";

const app = express();

// --- Memory Cleanup Middleware ---
const memoryCleanupMiddleware = (req, res, next) => {
  res.on('finish', () => {
    // Clean up request-specific data
    if (req.user) delete req.user;
    if (req.body) delete req.body;
    
    // Suggest GC on large responses
    if (res.get('content-length') > 100000) {
      setImmediate(() => {
        if (global.gc) global.gc();
      });
    }
  });
  next();
};

// --- Security and Middleware Configuration ---
app.use(enhancedPerformanceMiddleware);
app.use(corsSecurity);
app.use(express.json({ limit: "1mb" }));
app.use(validateContent);
app.use(sanitizeRequest);
app.use(securityHeaders);
app.use(compression());
app.use(memoryCleanupMiddleware);
app.use(requestLogger);

// --- Database Connection ---
connectDB();

// --- Global HTTPS Agent for Performance ---
const globalHttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  rejectUnauthorized: false,
  timeout: 60000,
});

app.locals.httpsAgent = globalHttpsAgent;

// --- Cache and Memory Management ---
app.locals.cache = createCache();
setupMemoryMonitoring();

// --- Route Registration ---
app.use("/", authRoutes);
app.use("/", userRoutes);
app.use("/", healthRoutes);
app.use("/", completionPerformanceMiddleware, completionRoutes);
app.use("/", taskRoutes);
app.use("/", docsRoutes);
app.use("/emotions", emotionsRoutes);
app.use("/emotion-history", emotionHistoryRoutes);
app.use("/emotion-metrics", emotionMetricsRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/collective-data", collectiveDataRoutes);
app.use("/collective-snapshots", collectiveSnapshotsRoutes);
app.use("/scheduled-aggregation", scheduledAggregationRoutes);

// --- Environment Variable Validation ---
const requiredEnvVars = ['OPENROUTER_API_KEY', 'MONGODB_URI'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.warn('⚠️ Missing required environment variables:', missingEnvVars.join(', '));
  console.warn('⚠️ Some features may not work properly without these variables');
}

// --- Task Scheduler Disabled ---
// Complex analytics removed - using simple emotion history tracking instead
// if (process.env.NODE_ENV !== 'test') {
//   taskScheduler.start();
// }

// --- Scheduled Aggregation Service ---
if (process.env.NODE_ENV !== 'test') {
  // Start scheduled aggregation service
  scheduledAggregationService.start();
  console.log("✓Scheduled aggregation service started (10-minute intervals)");
}

// --- Error Handling ---
app.use(errorLogger);
app.use(globalErrorHandler);

// --- Server Start ---
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`✓API running → http://localhost:${PORT}`);
    console.log(`✓Performance optimizations enabled`);
    console.log(`✓Memory optimization enabled, initial RSS: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
  });
}

export default app;