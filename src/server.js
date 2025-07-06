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

// Import middleware
import { corsMiddleware, securityMiddleware, optimizedCompression } from "./middleware/security.js";
import { requestLogger, errorLogger } from "./utils/logger.js";
import { globalErrorHandler } from "./utils/errorHandler.js";
import { performanceMiddleware as enhancedPerformanceMiddleware, completionPerformanceMiddleware } from "./middleware/performanceMiddleware.js";

// Import utilities
import { createCache, setupMemoryMonitoring } from "./utils/cache.js";

// Import services
import taskScheduler from "./services/taskScheduler.js";

// Import models (to ensure they're loaded)
import "./models/User.js";
import "./models/ShortTermMemory.js";
import "./models/Task.js";

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
app.use(corsMiddleware);
app.use(express.json({ limit: "1mb" }));
app.use(securityMiddleware);
app.use(optimizedCompression);
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

// --- Start Task Scheduler ---
if (process.env.NODE_ENV !== 'test') {
  taskScheduler.start();
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