import express from "express";
import { protect } from "../middleware/auth.js";
import { rateLimiters } from "../middleware/rateLimiter.js";
import { requireAdmin } from "../middleware/security.js";
import scheduledAggregationService from "../services/scheduledAggregationService.js";
import logger from "../utils/logger.js";

const router = express.Router();

// POST /scheduled-aggregation/start - Start the scheduled aggregation service
router.post("/start", protect, requireAdmin, rateLimiters.admin, async (req, res) => {
  try {
    scheduledAggregationService.start();

    logger.info("Scheduled aggregation service started", {
      userId: req.user.id
    });

    res.json({
      success: true,
      message: "Scheduled aggregation service started successfully",
      status: scheduledAggregationService.getStatus()
    });

  } catch (error) {
    logger.error("Error starting scheduled aggregation service", {
      error: error.message,
      userId: req.user?.id,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to start scheduled aggregation service",
      error: error.message
    });
  }
});

// POST /scheduled-aggregation/stop - Stop the scheduled aggregation service
router.post("/stop", protect, requireAdmin, rateLimiters.admin, async (req, res) => {
  try {
    scheduledAggregationService.stop();

    logger.info("Scheduled aggregation service stopped", {
      userId: req.user.id
    });

    res.json({
      success: true,
      message: "Scheduled aggregation service stopped successfully",
      status: scheduledAggregationService.getStatus()
    });

  } catch (error) {
    logger.error("Error stopping scheduled aggregation service", {
      error: error.message,
      userId: req.user?.id,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to stop scheduled aggregation service",
      error: error.message
    });
  }
});

// GET /scheduled-aggregation/status - Get service status
router.get("/status", rateLimiters.aggregation, async (req, res) => {
  try {
    const status = scheduledAggregationService.getStatus();

    res.json({
      success: true,
      status,
      metadata: {
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error("Error fetching scheduled aggregation status", {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch service status",
      error: error.message
    });
  }
});

// POST /scheduled-aggregation/trigger - Manually trigger an aggregation cycle
router.post("/trigger", protect, rateLimiters.aggregation, async (req, res) => {
  try {
    await scheduledAggregationService.triggerAggregation();

    logger.info("Manual aggregation cycle triggered", {
      userId: req.user.id
    });

    res.json({
      success: true,
      message: "Aggregation cycle triggered successfully",
      status: scheduledAggregationService.getStatus()
    });

  } catch (error) {
    logger.error("Error triggering aggregation cycle", {
      error: error.message,
      userId: req.user?.id,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to trigger aggregation cycle",
      error: error.message
    });
  }
});

// GET /scheduled-aggregation/latest - Get the latest scheduled snapshot
router.get("/latest", rateLimiters.aggregation, async (req, res) => {
  try {
    const snapshot = scheduledAggregationService.getLatestScheduledSnapshot();

    if (!snapshot) {
      return res.status(404).json({
        success: false,
        message: "No scheduled snapshots available"
      });
    }

    res.json({
      success: true,
      snapshot,
      metadata: {
        generatedAt: new Date().toISOString(),
        source: "scheduled_aggregation"
      }
    });

  } catch (error) {
    logger.error("Error fetching latest scheduled snapshot", {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch latest scheduled snapshot",
      error: error.message
    });
  }
});

// GET /scheduled-aggregation/stats - Get service statistics
router.get("/stats", rateLimiters.aggregation, async (req, res) => {
  try {
    const stats = scheduledAggregationService.getStats();

    res.json({
      success: true,
      stats,
      metadata: {
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error("Error fetching scheduled aggregation stats", {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch service statistics",
      error: error.message
    });
  }
});

// POST /scheduled-aggregation/reset - Reset service statistics
router.post("/reset", protect, requireAdmin, rateLimiters.admin, async (req, res) => {
  try {
    scheduledAggregationService.resetStats();

    logger.info("Scheduled aggregation statistics reset", {
      userId: req.user.id
    });

    res.json({
      success: true,
      message: "Service statistics reset successfully",
      stats: scheduledAggregationService.getStats()
    });

  } catch (error) {
    logger.error("Error resetting scheduled aggregation stats", {
      error: error.message,
      userId: req.user?.id,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to reset service statistics",
      error: error.message
    });
  }
});

// PUT /scheduled-aggregation/interval - Update aggregation interval
router.put("/interval", protect, requireAdmin, rateLimiters.admin, async (req, res) => {
  try {
    const { minutes } = req.body;

    if (!minutes || typeof minutes !== 'number' || minutes < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid interval. Must be a number greater than 0"
      });
    }

    scheduledAggregationService.updateInterval(minutes);

    logger.info("Scheduled aggregation interval updated", {
      userId: req.user.id,
      newInterval: minutes
    });

    res.json({
      success: true,
      message: `Aggregation interval updated to ${minutes} minutes`,
      status: scheduledAggregationService.getStatus()
    });

  } catch (error) {
    logger.error("Error updating scheduled aggregation interval", {
      error: error.message,
      userId: req.user?.id,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to update aggregation interval",
      error: error.message
    });
  }
});

// GET /scheduled-aggregation/health - Health check endpoint
router.get("/health", rateLimiters.aggregation, async (req, res) => {
  try {
    const status = scheduledAggregationService.getStatus();
    const stats = scheduledAggregationService.getStats();

    const health = {
      service: "scheduled_aggregation",
      status: status.isRunning ? "healthy" : "stopped",
      uptime: status.uptime,
      lastRun: status.lastRun,
      runCount: stats.runCount,
      errorCount: stats.errorCount,
      successRate: stats.successRate,
      nextRun: status.nextRun
    };

    res.json({
      success: true,
      health,
      metadata: {
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error("Error in scheduled aggregation health check", {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      health: {
        service: "scheduled_aggregation",
        status: "unhealthy",
        error: error.message
      }
    });
  }
});

export default router; 