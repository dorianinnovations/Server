import express from "express";
import { protect } from "../middleware/auth.js";
import logger from "../utils/logger.js";
import { createLLMService } from "../services/llmService.js";

const router = express.Router();
const llmService = createLLMService();

// POST /analytics/llm - Handle LLM analytics requests
router.post("/llm", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { prompt, messages, options = {} } = req.body;

    // Validate request body
    if (!prompt && (!messages || !Array.isArray(messages) || messages.length === 0)) {
      return res.status(400).json({
        message: "Either 'prompt' or 'messages' array is required"
      });
    }

    // Log the request for analytics
    logger.info("LLM analytics request received", {
      userId,
      hasPrompt: !!prompt,
      hasMessages: !!messages,
      messageCount: messages?.length || 0,
      options: Object.keys(options)
    });

    // Make LLM request
    const llmResponse = await llmService.makeLLMRequest(
      prompt || messages,
      options
    );

    // Log successful response
    logger.info("LLM analytics request completed", {
      userId,
      responseLength: llmResponse.content?.length || 0,
      usage: llmResponse.usage,
      stopReason: llmResponse.stop_reason
    });

    // Return the response
    res.json({
      success: true,
      content: llmResponse.content,
      usage: llmResponse.usage,
      stop_reason: llmResponse.stop_reason,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error("LLM analytics request failed", {
      error: error.message,
      userId: req.user.id,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to process LLM request",
      error: error.message
    });
  }
});

// GET /analytics/llm/health - Check LLM service health
router.get("/llm/health", protect, async (req, res) => {
  try {
    const healthStatus = await llmService.healthCheck();
    
    res.json({
      success: true,
      health: healthStatus,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error("LLM health check failed", {
      error: error.message,
      userId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: "Failed to check LLM service health",
      error: error.message
    });
  }
});

export default router; 