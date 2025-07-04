import express from "express";
import dotenv from "dotenv";

// Import configurations
import connectDB from "./config/database.js";

// Import middleware
import { corsMiddleware, rateLimiter, securityMiddleware } from "./middleware/security.js";

// Import routes
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import healthRoutes from "./routes/health.js";
import completionRoutes from "./routes/completion.js";
import taskRoutes from "./routes/tasks.js";

// Import utilities
import { createCache, setupMemoryMonitoring } from "./utils/cache.js";

// Import models (to ensure they're loaded)
import "./models/User.js";
import "./models/ShortTermMemory.js";
import "./models/Task.js";

const app = express();
dotenv.config(); // Load environment variables

// --- Security and Middleware Configuration ---
app.use(corsMiddleware);
app.use(express.json({ limit: "1mb" })); // Parse JSON request bodies with size limit
app.use(securityMiddleware);
app.use(rateLimiter);

// --- Database Connection ---
connectDB();

// --- Route Registration ---
app.use("/", authRoutes);
app.use("/", userRoutes);
app.use("/", healthRoutes);
app.use("/", completionRoutes);
app.use("/", taskRoutes);

// --- Cache and Memory Management ---
app.locals.cache = createCache();
setupMemoryMonitoring();

// --- Server Start ---
const PORT = process.env.PORT || 5000; // Use port from .env or default to 5000
app.listen(PORT, () => {
  console.log(`✓API running → http://localhost:${PORT}`);
  console.log(
    `✓Memory optimization enabled, initial RSS: ${Math.round(
      process.memoryUsage().rss / 1024 / 1024
    )}MB`
  );
}); 