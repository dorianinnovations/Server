import express from "express";
import { protect } from "../middleware/auth.js";
// import { AnalyticsService } from "../../archive/unused-services/analytics.js"; // Disabled archived service

const router = express.Router();

// API Documentation
router.get("/docs", (req, res) => {
  const apiDocs = {
    title: "Numina API Documentation",
    version: "2.0.0",
    description: "AI-powered emotional intelligence and task management API",
    baseUrl: `${req.protocol}://${req.get("host")}`,
    endpoints: {
      authentication: {
        "POST /signup": {
          description: "Register a new user",
          body: {
            email: "string (required)",
            password: "string (min 8 chars, required)",
          },
          response: {
            status: "success",
            token: "JWT token",
            data: { user: { id: "string", email: "string" } },
          },
        },
        "POST /login": {
          description: "Authenticate user",
          body: {
            email: "string (required)",
            password: "string (required)",
          },
          response: {
            status: "success",
            token: "JWT token",
            data: { user: { id: "string", email: "string" } },
          },
        },
      },
      user: {
        "GET /profile": {
          description: "Get user profile (protected)",
          headers: { Authorization: "Bearer <token>" },
          response: {
            status: "success",
            data: { user: "User object" },
          },
        },
        "PUT /profile": {
          description: "Update user profile (protected)",
          headers: { Authorization: "Bearer <token>" },
          body: {
            profile: "object (optional)",
          },
          response: {
            status: "success",
            data: { user: "Updated user object" },
          },
        },
      },
      ai: {
        "POST /completion": {
          description: "Get AI completion (protected)",
          headers: { Authorization: "Bearer <token>" },
          body: {
            prompt: "string (required)",
            temperature: "number (optional, default: 0.7)",
            n_predict: "number (optional, default: 1024)",
          },
          response: {
            content: "AI generated response",
          },
        },
      },
      tasks: {
        "GET /run-tasks": {
          description: "Process background tasks (protected)",
          headers: { Authorization: "Bearer <token>" },
          response: {
            status: "success",
            message: "string",
            results: "array of task results",
          },
        },
        "POST /tasks": {
          description: "Schedule a new task (protected)",
          headers: { Authorization: "Bearer <token>" },
          body: {
            taskType: "string (required)",
            parameters: "object (optional)",
            runAt: "date (optional)",
            priority: "number (optional)",
          },
          response: {
            status: "success",
            data: { task: "Task object" },
          },
        },
      },
      system: {
        "GET /health": {
          description: "System health check",
          response: {
            status: "success/degraded",
            health: {
              server: "healthy",
              database: "connected/disconnected",
              llm_api: "accessible/unreachable",
            },
          },
        },
        "GET /metrics": {
          description: "System metrics (protected)",
          headers: { Authorization: "Bearer <token>" },
          response: {
            status: "success",
            data: { metrics: "array of metrics" },
          },
        },
      },
    },
    authentication: {
      type: "Bearer Token",
      description: "Include Authorization header with Bearer token",
      example: "Authorization: Bearer <your-jwt-token>",
    },
    errorResponses: {
      400: "Bad Request - Invalid input data",
      401: "Unauthorized - Invalid or missing token",
      403: "Forbidden - Insufficient permissions",
      404: "Not Found - Resource not found",
      429: "Too Many Requests - Rate limit exceeded",
      500: "Internal Server Error - Server error",
    },
  };

  res.json(apiDocs);
});

// Interactive API Testing
router.get("/test", (req, res) => {
  const testInterface = {
    title: "API Testing Interface",
    description: "Test API endpoints interactively",
    endpoints: [
      {
        name: "Health Check",
        method: "GET",
        url: "/health",
        description: "Test system health",
      },
      {
        name: "User Registration",
        method: "POST",
        url: "/signup",
        description: "Create a new user account",
        body: {
          email: "test@example.com",
          password: "password123",
        },
      },
      {
        name: "User Login",
        method: "POST",
        url: "/login",
        description: "Authenticate user",
        body: {
          email: "test@example.com",
          password: "password123",
        },
      },
      {
        name: "Get Profile",
        method: "GET",
        url: "/profile",
        description: "Get user profile (requires auth)",
        headers: {
          Authorization: "Bearer <your-token>",
        },
      },
      {
        name: "AI Completion",
        method: "POST",
        url: "/completion",
        description: "Get AI response (requires auth)",
        headers: {
          Authorization: "Bearer <your-token>",
        },
        body: {
          prompt: "Hello, how are you today?",
        },
      },
    ],
  };

  res.json(testInterface);
});

// System Metrics (Protected)
router.get("/metrics", protect, async (req, res) => {
  try {
    const timeRange = req.query.range || "24h";
    const metrics = await AnalyticsService.getMetrics(timeRange);
    
    res.json({
      status: "success",
      data: {
        metrics,
        timeRange,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve metrics",
    });
  }
});

// API Status
router.get("/status", (req, res) => {
  const status = {
    status: "operational",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
    environment: process.env.NODE_ENV || "development",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    features: {
      authentication: "enabled",
      analytics: "enabled",
      taskScheduler: "enabled",
      logging: "enabled",
      rateLimiting: "enabled",
    },
  };

  res.json(status);
});

export default router; 