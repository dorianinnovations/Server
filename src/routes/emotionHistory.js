import express from "express";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";
import logger from "../utils/logger.js";

const router = express.Router();

// Get user's emotion history with simple filtering and pagination
router.get("/", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    
    // Optional date filtering
    const { startDate, endDate } = req.query;
    
    const user = await User.findById(userId).select('emotionalLog');
    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    let emotions = user.emotionalLog || [];

    // Apply date filtering if provided
    if (startDate || endDate) {
      emotions = emotions.filter(emotion => {
        const emotionDate = new Date(emotion.timestamp);
        if (startDate && emotionDate < new Date(startDate)) return false;
        if (endDate && emotionDate > new Date(endDate)) return false;
        return true;
      });
    }

    // Sort by most recent first
    emotions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply pagination
    const total = emotions.length;
    const paginatedEmotions = emotions.slice(skip, skip + limit);

    // Format emotions for frontend
    const formattedEmotions = paginatedEmotions.map(emotion => ({
      id: emotion._id,
      emotion: emotion.emotion,
      intensity: emotion.intensity,
      context: emotion.context,
      timestamp: emotion.timestamp,
      date: emotion.timestamp.toISOString().split('T')[0], // YYYY-MM-DD format
      time: emotion.timestamp.toISOString().split('T')[1].substring(0, 5) // HH:MM format
    }));

    res.json({
      emotions: formattedEmotions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalEmotions: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
        limit
      }
    });

  } catch (error) {
    logger.error("Error fetching emotion history", { 
      error: error.message, 
      userId: req.user.id 
    });
    res.status(500).json({
      message: "Failed to fetch emotion history",
      error: error.message
    });
  }
});

// Get simple emotion statistics
router.get("/stats", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 30 } = req.query; // Default to last 30 days
    
    const user = await User.findById(userId).select('emotionalLog');
    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const emotions = user.emotionalLog || [];
    
    // Filter by date range
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    
    const recentEmotions = emotions.filter(emotion => 
      new Date(emotion.timestamp) >= cutoffDate
    );

    if (recentEmotions.length === 0) {
      return res.json({
        period: `${days} days`,
        totalEmotions: 0,
        averageIntensity: 0,
        emotionCounts: {},
        topEmotions: [],
        intensityDistribution: {}
      });
    }

    // Calculate statistics
    const emotionCounts = {};
    const intensitySum = recentEmotions.reduce((sum, emotion) => {
      // Count emotions
      emotionCounts[emotion.emotion] = (emotionCounts[emotion.emotion] || 0) + 1;
      // Sum intensities
      return sum + (emotion.intensity || 5);
    }, 0);

    const averageIntensity = intensitySum / recentEmotions.length;

    // Get top emotions (sorted by frequency)
    const topEmotions = Object.entries(emotionCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([emotion, count]) => ({ emotion, count }));

    // Intensity distribution
    const intensityDistribution = {};
    recentEmotions.forEach(emotion => {
      const intensity = emotion.intensity || 5;
      const range = `${Math.floor(intensity/2)*2}-${Math.floor(intensity/2)*2+1}`;
      intensityDistribution[range] = (intensityDistribution[range] || 0) + 1;
    });

    res.json({
      period: `${days} days`,
      totalEmotions: recentEmotions.length,
      averageIntensity: Math.round(averageIntensity * 10) / 10,
      emotionCounts,
      topEmotions,
      intensityDistribution
    });

  } catch (error) {
    logger.error("Error fetching emotion statistics", { 
      error: error.message, 
      userId: req.user.id 
    });
    res.status(500).json({
      message: "Failed to fetch emotion statistics",
      error: error.message
    });
  }
});

export default router;