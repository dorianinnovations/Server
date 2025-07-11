import express from "express";
import { protect } from "../middleware/auth.js";
import { rateLimiters } from "../middleware/rateLimiter.js";
import { requireAdmin } from "../middleware/security.js";
import snapshotAnalysisService from "../services/snapshotAnalysisService.js";
import CollectiveSnapshot from "../models/CollectiveSnapshot.js";
import logger from "../utils/logger.js";

const router = express.Router();

// POST /collective-snapshots/generate - Generate a new collective snapshot
router.post("/generate", protect, rateLimiters.snapshots, async (req, res) => {
  try {
    const { timeRange = "30d" } = req.body;

    // Validate time range
    if (!["7d", "30d", "90d", "1y", "all"].includes(timeRange)) {
      return res.status(400).json({
        success: false,
        message: "Invalid time range. Must be one of: 7d, 30d, 90d, 1y, all"
      });
    }

    logger.info("Generating collective snapshot", {
      userId: req.user.id,
      timeRange
    });

    const result = await snapshotAnalysisService.generateSnapshot(timeRange);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: "Collective snapshot generated successfully",
      snapshot: result.snapshot,
      processingTime: result.processingTime
    });

  } catch (error) {
    logger.error("Error generating collective snapshot", {
      error: error.message,
      userId: req.user?.id,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to generate collective snapshot",
      error: error.message
    });
  }
});

// GET /collective-snapshots/latest - Get the latest snapshot
router.get("/latest", rateLimiters.collectiveData, async (req, res) => {
  try {
    const { timeRange = "30d" } = req.query;

    const result = await snapshotAnalysisService.getLatestSnapshot(timeRange);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json({
      success: true,
      snapshot: result.snapshot
    });

  } catch (error) {
    logger.error("Error fetching latest snapshot", {
      error: error.message,
      query: req.query,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch latest snapshot",
      error: error.message
    });
  }
});

// GET /collective-snapshots/history - Get snapshot history
router.get("/history", rateLimiters.collectiveData, async (req, res) => {
  try {
    const { 
      timeRange = "30d", 
      limit = "10" 
    } = req.query;

    const result = await snapshotAnalysisService.getSnapshotHistory(
      timeRange, 
      parseInt(limit)
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      snapshots: result.snapshots,
      count: result.count,
      metadata: {
        timeRange,
        limit: parseInt(limit),
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error("Error fetching snapshot history", {
      error: error.message,
      query: req.query,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch snapshot history",
      error: error.message
    });
  }
});

// GET /collective-snapshots/archetypes - Get archetype history
router.get("/archetypes", rateLimiters.collectiveData, async (req, res) => {
  try {
    const { 
      timeRange = "30d", 
      limit = "20" 
    } = req.query;

    const result = await snapshotAnalysisService.getArchetypeHistory(
      timeRange, 
      parseInt(limit)
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      archetypes: result.archetypes,
      metadata: {
        timeRange,
        limit: parseInt(limit),
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error("Error fetching archetype history", {
      error: error.message,
      query: req.query,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch archetype history",
      error: error.message
    });
  }
});

// GET /collective-snapshots/emotions - Get emotion trends
router.get("/emotions", rateLimiters.collectiveData, async (req, res) => {
  try {
    const { 
      timeRange = "30d", 
      limit = "20" 
    } = req.query;

    const result = await snapshotAnalysisService.getEmotionTrends(
      timeRange, 
      parseInt(limit)
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      emotions: result.emotions,
      metadata: {
        timeRange,
        limit: parseInt(limit),
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error("Error fetching emotion trends", {
      error: error.message,
      query: req.query,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch emotion trends",
      error: error.message
    });
  }
});

// GET /collective-snapshots/stats - Get snapshot statistics
router.get("/stats", rateLimiters.collectiveData, async (req, res) => {
  try {
    const result = await snapshotAnalysisService.getSnapshotStats();

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      stats: result.stats,
      metadata: {
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error("Error fetching snapshot stats", {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch snapshot stats",
      error: error.message
    });
  }
});

// GET /collective-snapshots/:id - Get detailed snapshot
router.get("/:id", rateLimiters.collectiveData, async (req, res) => {
  try {
    const { id } = req.params;

    const snapshot = await CollectiveSnapshot.findById(id);
    
    if (!snapshot) {
      return res.status(404).json({
        success: false,
        message: "Snapshot not found"
      });
    }

    res.json({
      success: true,
      snapshot: snapshot.getDetailed()
    });

  } catch (error) {
    logger.error("Error fetching snapshot details", {
      error: error.message,
      snapshotId: req.params.id,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch snapshot details",
      error: error.message
    });
  }
});

// DELETE /collective-snapshots/:id - Delete a snapshot (admin only)
router.delete("/:id", protect, requireAdmin, rateLimiters.admin, async (req, res) => {
  try {
    const { id } = req.params;

    const snapshot = await CollectiveSnapshot.findById(id);
    
    if (!snapshot) {
      return res.status(404).json({
        success: false,
        message: "Snapshot not found"
      });
    }

    await CollectiveSnapshot.findByIdAndDelete(id);

    logger.info("Snapshot deleted", {
      userId: req.user.id,
      snapshotId: id
    });

    res.json({
      success: true,
      message: "Snapshot deleted successfully"
    });

  } catch (error) {
    logger.error("Error deleting snapshot", {
      error: error.message,
      userId: req.user?.id,
      snapshotId: req.params.id,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to delete snapshot",
      error: error.message
    });
  }
});

// GET /collective-snapshots/search - Search snapshots
router.get("/search", rateLimiters.collectiveData, async (req, res) => {
  try {
    const { 
      archetype, 
      emotion, 
      timeRange = "30d",
      limit = "10",
      page = "1"
    } = req.query;

    const query = {
      status: "completed",
      "metadata.timeRange": timeRange
    };

    if (archetype) {
      query.archetype = { $regex: archetype, $options: "i" };
    }

    if (emotion) {
      query.dominantEmotion = { $regex: emotion, $options: "i" };
    }

    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);
    const skip = (pageNum - 1) * limitNum;

    const snapshots = await CollectiveSnapshot.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await CollectiveSnapshot.countDocuments(query);

    res.json({
      success: true,
      snapshots: snapshots.map(snapshot => snapshot.getSummary()),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      metadata: {
        filters: { archetype, emotion, timeRange },
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error("Error searching snapshots", {
      error: error.message,
      query: req.query,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to search snapshots",
      error: error.message
    });
  }
});

// GET /collective-snapshots/export - Export snapshots
router.get("/export", protect, requireAdmin, rateLimiters.export, async (req, res) => {
  try {
    const { 
      format = "json", 
      timeRange = "30d",
      limit = "100"
    } = req.query;

    const snapshots = await CollectiveSnapshot.find({
      status: "completed",
      "metadata.timeRange": timeRange
    })
    .sort({ timestamp: -1 })
    .limit(parseInt(limit));

    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        timeRange,
        totalSnapshots: snapshots.length,
        format
      },
      snapshots: snapshots.map(snapshot => snapshot.getDetailed())
    };

    if (format === "csv") {
      // Convert to CSV format
      const csvHeaders = "timestamp,sampleSize,dominantEmotion,avgIntensity,insight,archetype,status\n";
      const csvRows = exportData.snapshots.map(snapshot => 
        `"${snapshot.timestamp}","${snapshot.sampleSize}","${snapshot.dominantEmotion}","${snapshot.avgIntensity}","${snapshot.insight.replace(/"/g, '""')}","${snapshot.archetype}","${snapshot.status}"`
      ).join("\n");
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="collective_snapshots_${timeRange}.csv"`);
      res.send(csvHeaders + csvRows);
    } else {
      res.json(exportData);
    }

  } catch (error) {
    logger.error("Error exporting snapshots", {
      error: error.message,
      userId: req.user?.id,
      query: req.query,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to export snapshots",
      error: error.message
    });
  }
});

export default router; 