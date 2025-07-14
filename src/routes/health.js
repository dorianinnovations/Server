import express from "express";
import mongoose from "mongoose";
import { createLLMService } from "../services/llmService.js";

const router = express.Router();

// Health check for the LLM service
router.get("/llm", async (req, res) => {
  try {
    const llmService = createLLMService();
    const result = await llmService.healthCheck();
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

router.get("/health", async (req, res) => {
  try {
    // Check database health
    const dbHealth = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    
    // Check OpenRouter API health
    let llmHealth;
    try {
      const llmService = createLLMService(); // Re-create llmService for health check
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
        service: "OpenRouter (GPT-4o)",
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
    });
  }
});

export default router; 