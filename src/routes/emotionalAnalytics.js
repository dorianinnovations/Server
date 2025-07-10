import express from "express";
import { protect } from "../middleware/auth.js";
import EmotionalAnalyticsSession from "../models/EmotionalAnalyticsSession.js";
import logger from "../utils/logger.js";
import { updateAnalyticsForUser } from "../utils/analyticsHelper.js";

const router = express.Router();

// Get current analytics session status and progress
router.get("/current-session", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const forceRefresh = req.query.refresh === 'true';
    
    // Get or create current session
    const session = await EmotionalAnalyticsSession.getCurrentSession(userId);
    
    if (!session) {
      return res.status(404).json({
        message: "No analytics session found"
      });
    }

    // Force refresh analytics if requested
    if (forceRefresh) {
      try {
        await updateAnalyticsForUser(userId);
        logger.info("Forced analytics refresh for current-session request", { userId });
      } catch (refreshError) {
        logger.warn("Failed to force refresh analytics", { 
          userId, 
          error: refreshError.message 
        });
        // Continue with existing data if refresh fails
      }
    }

    // Build response with session details
    const response = {
      id: session._id,
      status: session.status,
      weekStartDate: session.weekStartDate,
      weekEndDate: session.weekEndDate,
      weekNumber: session.weekNumber,
      year: session.year,
      progress: {
        percentage: session.getProgressPercentage(),
        daysProcessed: session.reportProgress.filter(p => p.status === "processed").length,
        totalDays: 7,
        nextDayToProcess: session.getNextDayToProcess()
      },
      reportProgress: session.reportProgress.map(progress => ({
        day: progress.day,
        date: progress.date,
        status: progress.status,
        emotionCount: progress.emotionCount,
        processedAt: progress.processedAt,
        hasInsights: !!(progress.insights && progress.insights.moodPatterns)
      })),
      hasFinalReport: !!(session.finalReport && session.finalReport.summary),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    };

    res.json(response);

  } catch (error) {
    logger.error("Error fetching current analytics session", { 
      error: error.message, 
      userId: req.user.id 
    });
    res.status(500).json({
      message: "Failed to fetch analytics session",
      error: error.message
    });
  }
});

// Get detailed insights for a specific day
router.get("/day-insights/:day", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const day = parseInt(req.params.day);
    
    if (day < 1 || day > 7) {
      return res.status(400).json({
        message: "Day must be between 1 and 7"
      });
    }

    // Get current session
    const session = await EmotionalAnalyticsSession.getCurrentSession(userId);
    
    if (!session) {
      return res.status(404).json({
        message: "No analytics session found"
      });
    }

    // Find the specific day's progress
    const dayProgress = session.reportProgress.find(p => p.day === day);
    
    if (!dayProgress) {
      return res.status(404).json({
        message: `No insights found for day ${day}`
      });
    }

    res.json({
      day: dayProgress.day,
      date: dayProgress.date,
      status: dayProgress.status,
      emotionCount: dayProgress.emotionCount,
      insights: dayProgress.insights,
      processedAt: dayProgress.processedAt
    });

  } catch (error) {
    logger.error("Error fetching day insights", { 
      error: error.message, 
      userId: req.user.id,
      day: req.params.day 
    });
    res.status(500).json({
      message: "Failed to fetch day insights",
      error: error.message
    });
  }
});

// Get weekly report
router.get("/weekly-report", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get current session
    const session = await EmotionalAnalyticsSession.getCurrentSession(userId);
    
    if (!session) {
      return res.status(404).json({
        message: "No analytics session found"
      });
    }

    if (!session.finalReport || !session.finalReport.summary) {
      return res.status(404).json({
        message: "Weekly report not yet generated",
        status: session.status,
        progress: session.getProgressPercentage()
      });
    }

    res.json({
      sessionId: session._id,
      weekStartDate: session.weekStartDate,
      weekEndDate: session.weekEndDate,
      status: session.status,
      report: session.finalReport,
      generatedAt: session.finalReport.generatedAt
    });

  } catch (error) {
    logger.error("Error fetching weekly report", { 
      error: error.message, 
      userId: req.user.id 
    });
    res.status(500).json({
      message: "Failed to fetch weekly report",
      error: error.message
    });
  }
});

// Get analytics sessions history
router.get("/history", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    
    const sessions = await EmotionalAnalyticsSession.find({ userId })
      .sort({ weekStartDate: -1 })
      .skip(skip)
      .limit(limit)
      .select('weekStartDate weekEndDate weekNumber year status reportProgress finalReport createdAt updatedAt');

    const total = await EmotionalAnalyticsSession.countDocuments({ userId });

    const formattedSessions = sessions.map(session => ({
      id: session._id,
      weekStartDate: session.weekStartDate,
      weekEndDate: session.weekEndDate,
      weekNumber: session.weekNumber,
      year: session.year,
      status: session.status,
      progress: session.getProgressPercentage(),
      daysProcessed: session.reportProgress.filter(p => p.status === "processed").length,
      hasFinalReport: !!(session.finalReport && session.finalReport.summary),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    }));

    res.json({
      sessions: formattedSessions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalSessions: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });

  } catch (error) {
    logger.error("Error fetching analytics history", { 
      error: error.message, 
      userId: req.user.id 
    });
    res.status(500).json({
      message: "Failed to fetch analytics history",
      error: error.message
    });
  }
});

// Get specific session by ID
router.get("/session/:sessionId", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = req.params.sessionId;
    
    const session = await EmotionalAnalyticsSession.findOne({ 
      _id: sessionId, 
      userId 
    });
    
    if (!session) {
      return res.status(404).json({
        message: "Analytics session not found"
      });
    }

    res.json({
      id: session._id,
      status: session.status,
      weekStartDate: session.weekStartDate,
      weekEndDate: session.weekEndDate,
      weekNumber: session.weekNumber,
      year: session.year,
      progress: {
        percentage: session.getProgressPercentage(),
        daysProcessed: session.reportProgress.filter(p => p.status === "processed").length,
        totalDays: 7
      },
      reportProgress: session.reportProgress,
      finalReport: session.finalReport,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    });

  } catch (error) {
    logger.error("Error fetching analytics session", { 
      error: error.message, 
      userId: req.user.id,
      sessionId: req.params.sessionId 
    });
    res.status(500).json({
      message: "Failed to fetch analytics session",
      error: error.message
    });
  }
});


export default router; 