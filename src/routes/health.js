import express from "express";
import mongoose from "mongoose";
import { checkDBHealth } from "../config/database.js";
import { createLLMService } from "../services/llmService.js";
import { HTTP_STATUS, MESSAGES } from "../config/constants.js";

const router = express.Router();

<<<<<<< HEAD
// Health check endpoint
router.get("/health", async (req, res) => {
  try {
    const llmService = createLLMService();
    const dbHealth = checkDBHealth();
    const llmHealth = await llmService.healthCheck();

    const healthStatus = {
      server: "healthy",
      database: dbHealth.state,
      llm_api: llmHealth.healthy ? "accessible" : "unreachable",
      llm_api_url: llmService.config.apiUrl,
      timestamp: new Date().toISOString(),
    };

    if (llmHealth.healthy && dbHealth.state === 'connected') {
      res.json({ 
        status: MESSAGES.SUCCESS, 
        health: healthStatus 
      });
    } else {
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        status: MESSAGES.DEGRADED,
        health: {
          ...healthStatus,
          llm_error: llmHealth.error || null,
        },
      });
    }
  } catch (err) {
    console.error("Health check error:", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
      status: MESSAGES.ERROR, 
      message: MESSAGES.HEALTH_CHECK_FAILED 
=======
router.get("/health", async (req, res) => {
  try {
    // Check database health
    const dbHealth = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    
    // Check OpenRouter API health
    let llmHealth;
    try {
      const llmHealthCheck = await llmService.healthCheck();
      llmHealth = {
        status: llmHealthCheck.status,
        service: llmHealthCheck.service,
        response_status: llmHealthCheck.responseStatus,
      };
    } catch (error) {
      console.error("Health check OpenRouter test failed:", error.message);
      llmHealth = {
        status: "unreachable",
        service: "OpenRouter (Claude 3 Sonnet)",
        error: error.message,
      };
    }

    const healthStatus = {
      server: "healthy",
      database: dbHealth,
      llm_api: llmHealth.status,
      llm_service: llmHealth.service,
      llm_response_status: llmHealth.response_status,
    };

    const overallStatus = (dbHealth === "connected" && llmHealth.status === "accessible") 
      ? "success" 
      : "degraded";

    const statusCode = overallStatus === "success" ? 200 : 503;

    res.status(statusCode).json({ 
      status: overallStatus, 
      health: healthStatus 
    });
  } catch (err) {
    console.error("Health check error:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Health check failed",
      error: err.message 
>>>>>>> 3f17339 (refactor: Swap configuration for claude open router setup)
    });
  }
});

export default router; 