import express from "express";
import mongoose from "mongoose";
import { checkDBHealth } from "../config/database.js";
import { createLLMService } from "../services/llmService.js";
import { HTTP_STATUS, MESSAGES } from "../config/constants.js";

const router = express.Router();

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
    });
  }
});

export default router; 