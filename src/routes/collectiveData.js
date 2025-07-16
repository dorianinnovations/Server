import express from "express";
import { protect } from "../middleware/auth.js";
import { rateLimiters } from "../middleware/rateLimiter.js";
import { requireAdmin } from "../middleware/security.js";
import CollectiveDataConsent from "../models/CollectiveDataConsent.js";
import collectiveDataService from "../services/collectiveDataService.js";
import { collectiveDataFormatter } from "../utils/collectiveDataHelper.js";
import logger from "../utils/logger.js";

const router = express.Router();

// GET /collective-data/health - Simple health check
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Collective data service is running",
    timestamp: new Date().toISOString()
  });
});

// POST /collective-data/consent - Update user consent for collective data
router.post("/consent", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      consentStatus, 
      dataTypes = {},
      notes 
    } = req.body;

    // Validate consent status
    if (!consentStatus || !["granted", "denied", "pending"].includes(consentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid consent status. Must be 'granted', 'denied', or 'pending'"
      });
    }

    // Find existing consent or create new one
    let consent = await CollectiveDataConsent.findOne({ userId });
    
    if (!consent) {
      consent = new CollectiveDataConsent({
        userId,
        consentStatus,
        dataTypes,
        notes,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent")
      });
    } else {
      consent.consentStatus = consentStatus;
      consent.dataTypes = { ...consent.dataTypes, ...dataTypes };
      consent.notes = notes;
      consent.ipAddress = req.ip;
      consent.userAgent = req.get("User-Agent");
    }

    await consent.save();

    logger.info("User consent updated", {
      userId,
      consentStatus,
      dataTypes: Object.keys(dataTypes)
    });

    res.json({
      success: true,
      message: "Consent updated successfully",
      consent: consent.getConsentSummary()
    });

  } catch (error) {
    logger.error("Error updating user consent", {
      error: error.message,
      userId: req.user?.id,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to update consent",
      error: error.message
    });
  }
});

// GET /collective-data/consent - Get user's current consent status
router.get("/consent", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const consent = await CollectiveDataConsent.findOne({ userId });
    
    if (!consent) {
      return res.json({
        success: true,
        consent: {
          consentStatus: "pending",
          dataTypes: {
            emotions: false,
            intensity: false,
            context: false,
            demographics: false,
            activityPatterns: false
          },
          consentDate: null,
          lastUpdated: null
        }
      });
    }

    res.json({
      success: true,
      consent: consent.getConsentSummary()
    });

  } catch (error) {
    logger.error("Error fetching user consent", {
      error: error.message,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch consent",
      error: error.message
    });
  }
});

// GET /collective-data/emotions - Get aggregated emotional data
router.get("/emotions", rateLimiters.collectiveData, async (req, res) => {
  try {
    const {
      timeRange = "30d",
      groupBy = "day",
      includeIntensity = "true",
      includeContext = "false",
      minConsentCount = "5",
      format = "json",
      compress = "false",
      visualization = null
    } = req.query;

    const options = {
      timeRange,
      groupBy,
      includeIntensity: includeIntensity === "true",
      includeContext: includeContext === "true",
      minConsentCount: parseInt(minConsentCount)
    };

    const result = await collectiveDataService.getAggregatedEmotionalData(options);

    if (!result.success) {
      return res.status(400).json(result);
    }

    let processedData = result.data;

    // Format for specific visualization if requested
    if (visualization) {
      const formatted = collectiveDataFormatter.formatForVisualization(processedData, visualization);
      if (formatted.success) {
        processedData = formatted.data;
        result.metadata.visualizationType = visualization;
      }
    }

    // Compress data if requested
    if (compress === "true") {
      const compressed = collectiveDataFormatter.compressEmotionalData(processedData);
      if (compressed.success) {
        result.data = compressed.data;
        result.metadata.compression = {
          originalSize: compressed.originalSize,
          compressedSize: compressed.compressedSize,
          compressionRatio: ((1 - compressed.compressedSize / compressed.originalSize) * 100).toFixed(2)
        };
      }
    } else {
      result.data = processedData;
    }

    // Set appropriate content type
    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="collective_emotions_${timeRange}.csv"`);
      
      // Convert to CSV format
      const csvHeaders = "timeGroup,totalEntries,emotion,count,percentage,avgIntensity\n";
      const csvRows = result.data.flatMap(group => 
        group.emotions.map(emotion => 
          `${group.timeGroup},${group.totalEntries},${emotion.emotion},${emotion.count},${emotion.percentage},${emotion.avgIntensity || ""}`
        )
      ).join("\n");
      
      res.send(csvHeaders + csvRows);
    } else {
      res.json(result);
    }

  } catch (error) {
    logger.error("Error fetching collective emotional data", {
      error: error.message,
      query: req.query,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch collective emotional data",
      error: error.message
    });
  }
});

// GET /collective-data/demographics - Get demographic patterns
router.get("/demographics", rateLimiters.collectiveData, async (req, res) => {
  try {
    const {
      includeActivityPatterns = "true",
      includeGeographicData = "false"
    } = req.query;

    const options = {
      includeActivityPatterns: includeActivityPatterns === "true",
      includeGeographicData: includeGeographicData === "true"
    };

    const result = await collectiveDataService.getDemographicPatterns(options);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);

  } catch (error) {
    logger.error("Error fetching demographic patterns", {
      error: error.message,
      query: req.query,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch demographic patterns",
      error: error.message
    });
  }
});

// GET /collective-data/insights - Get real-time collective insights
router.get("/insights", rateLimiters.collectiveData, async (req, res) => {
  try {
    const result = await collectiveDataService.getRealTimeInsights();

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);

  } catch (error) {
    logger.error("Error fetching real-time insights", {
      error: error.message,
      stack: error.stack
    });

    // Check if it's a rate limit error
    if (error.message && error.message.includes("Too Many Requests")) {
      return res.status(429).json({
        success: false,
        message: "Rate limit exceeded. Please try again later.",
        error: "Too Many Requests"
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to fetch real-time insights",
      error: error.message
    });
  }
});

// GET /collective-data/formatted - Get formatted data with summary statistics
router.get("/formatted", rateLimiters.collectiveData, async (req, res) => {
  try {
    const {
      timeRange = "30d",
      groupBy = "day",
      includeIntensity = "true",
      includeContext = "false",
      minConsentCount = "5",
      visualization = "chart",
      includeStats = "true"
    } = req.query;

    // Log the request for debugging
    logger.info("Formatted collective data request", {
      query: req.query,
      ip: req.ip
    });

    const options = {
      timeRange,
      groupBy,
      includeIntensity: includeIntensity === "true",
      includeContext: includeContext === "true",
      minConsentCount: parseInt(minConsentCount)
    };

    logger.info("Calling collectiveDataService with options", { options });

    const result = await collectiveDataService.getAggregatedEmotionalData(options);

    if (!result.success) {
      logger.warn("collectiveDataService returned error", {
        error: result.message,
        query: req.query
      });
      return res.status(400).json(result);
    }

    // Format data for visualization
    const formatted = collectiveDataFormatter.formatForVisualization(result.data, visualization);
    
    if (!formatted.success) {
      logger.warn("formatForVisualization returned error", {
        error: formatted.error,
        visualization,
        dataLength: result.data?.length
      });
      return res.status(400).json(formatted);
    }

    const response = {
      success: true,
      metadata: {
        ...result.metadata,
        visualizationType: visualization,
        formattedAt: new Date().toISOString()
      },
      data: formatted.data,
      visualization: {
        type: formatted.type,
        metadata: formatted.metadata
      }
    };

    // Include summary statistics if requested
    if (includeStats === "true") {
      const stats = collectiveDataFormatter.generateSummaryStats(result.data);
      if (stats.success) {
        response.summary = stats.summary;
      }
    }

    logger.info("Formatted collective data response successful", {
      dataPoints: result.data?.length,
      visualizationType: visualization
    });

    res.json(response);

  } catch (error) {
    logger.error("Error fetching formatted collective data", {
      error: error.message,
      query: req.query,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch formatted collective data",
      error: error.message
    });
  }
});

// GET /collective-data/stats - Get collective data statistics
router.get("/stats", rateLimiters.collectiveData, async (req, res) => {
  try {
    const consentStats = await CollectiveDataConsent.getConsentStats();
    
    // Get additional stats
    const totalUsers = await CollectiveDataConsent.countDocuments();
    const recentConsents = await CollectiveDataConsent.countDocuments({
      consentDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    const stats = {
      success: true,
      metadata: {
        generatedAt: new Date().toISOString()
      },
      consent: consentStats,
      overview: {
        totalUsers,
        recentConsents,
        consentRate: totalUsers > 0 ? (consentStats.granted / totalUsers * 100).toFixed(2) : 0
      }
    };

    res.json(stats);

  } catch (error) {
    logger.error("Error fetching collective data stats", {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch collective data stats",
      error: error.message
    });
  }
});

// POST /collective-data/cache/clear - Clear cache (admin only)
router.post("/cache/clear", protect, requireAdmin, rateLimiters.admin, async (req, res) => {
  try {
    // Check if user is admin
    // TODO: Implement proper admin authorization in production
    
    collectiveDataService.clearCache();

    res.json({
      success: true,
      message: "Cache cleared successfully"
    });

  } catch (error) {
    logger.error("Error clearing cache", {
      error: error.message,
      userId: req.user?.id,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to clear cache",
      error: error.message
    });
  }
});

// GET /collective-data/export - Export collective data (admin only)
router.get("/export", protect, requireAdmin, rateLimiters.export, async (req, res) => {
  try {
    const { format = "json", timeRange = "30d" } = req.query;
    
    // Get all consenting users
    const consentingUsers = await CollectiveDataConsent.find({ 
      consentStatus: "granted" 
    }).populate("userId");

    if (consentingUsers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No consenting users found"
      });
    }

    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        totalUsers: consentingUsers.length,
        timeRange,
        format
      },
      users: consentingUsers.map(consent => ({
        userId: consent.userId._id,
        email: consent.userId.email,
        consentDate: consent.consentDate,
        dataTypes: consent.dataTypes,
        emotionalLogCount: consent.userId.emotionalLog?.length || 0
      }))
    };

    if (format === "csv") {
      // Convert to CSV format
      const csvHeaders = "userId,email,consentDate,emotionalLogCount,emotions,intensity,context,demographics,activityPatterns\n";
      const csvRows = exportData.users.map(user => 
        `${user.userId},${user.email},${user.consentDate},${user.emotionalLogCount},${user.dataTypes.emotions},${user.dataTypes.intensity},${user.dataTypes.context},${user.dataTypes.demographics},${user.dataTypes.activityPatterns}`
      ).join("\n");
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="collective_data_${timeRange}.csv"`);
      res.send(csvHeaders + csvRows);
    } else {
      res.json(exportData);
    }

  } catch (error) {
    logger.error("Error exporting collective data", {
      error: error.message,
      userId: req.user?.id,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to export collective data",
      error: error.message
    });
  }
});

export default router; 