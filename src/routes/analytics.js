import express from "express";
import { protect } from "../middleware/auth.js";
import { getUserMemoryAnalytics, getGlobalMemoryAnalytics, getOptimizationRecommendations } from "../utils/memoryAnalytics.js";
import { getIncrementalStats } from "../utils/incrementalMemory.js";

const router = express.Router();

/**
 * Get user-specific memory analytics
 */
router.get("/analytics/memory", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const analytics = getUserMemoryAnalytics(userId);
    
    res.json({
      status: "success",
      data: analytics
    });
  } catch (error) {
    console.error("Error fetching user analytics:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch analytics data"
    });
  }
});

/**
 * Get optimization recommendations for user
 */
router.get("/analytics/recommendations", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const recommendations = getOptimizationRecommendations(userId);
    
    res.json({
      status: "success",
      data: recommendations
    });
  } catch (error) {
    console.error("Error generating recommendations:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to generate recommendations"
    });
  }
});

/**
 * Get global system analytics (admin/monitoring)
 */
router.get("/analytics/system", protect, async (req, res) => {
  try {
    const globalAnalytics = getGlobalMemoryAnalytics();
    const incrementalStats = getIncrementalStats();
    
    res.json({
      status: "success",
      data: {
        memory: globalAnalytics,
        incremental: incrementalStats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("Error fetching system analytics:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch system analytics"
    });
  }
});

export default router;