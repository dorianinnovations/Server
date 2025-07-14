import express from "express";
import { protect } from "../middleware/auth.js";
import { rateLimiters } from "../middleware/rateLimiter.js";
import { createLLMService } from "../services/llmService.js";
import { createUserCache } from "../utils/cache.js";
import { getRecentMemory } from "../utils/memory.js";
import User from "../models/User.js";
import logger from "../utils/logger.js";

const router = express.Router();

/**
 * GET /personal-insights/growth-summary
 * Generate personalized growth insights based on user's emotional journey
 */
router.get("/growth-summary", protect, rateLimiters.general, async (req, res) => {
  try {
    const userId = req.user.id;
    const timeframe = req.query.timeframe || 'week'; // week, month, quarter
    const userCache = createUserCache(userId);
    
    console.log(`📊 Generating ${timeframe} growth summary for user ${userId}`);
    
    // Get user's recent emotional data
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    // Calculate timeframe boundaries
    const now = new Date();
    const timeframeDays = {
      'week': 7,
      'month': 30,
      'quarter': 90
    }[timeframe] || 7;
    
    const startDate = new Date(now.getTime() - (timeframeDays * 24 * 60 * 60 * 1000));
    
    // Get emotional logs within timeframe
    const emotionalLogs = user.emotionalLog.filter(log => 
      new Date(log.timestamp) >= startDate
    );
    
    // Get conversation history
    const recentMemory = await getRecentMemory(userId, userCache, timeframeDays * 24 * 60);
    const conversationCount = recentMemory.length;
    
    // Calculate growth metrics
    const emotionFrequency = {};
    let totalIntensity = 0;
    let positiveCount = 0;
    
    emotionalLogs.forEach(log => {
      const emotion = log.emotion || 'neutral';
      emotionFrequency[emotion] = (emotionFrequency[emotion] || 0) + 1;
      
      if (log.intensity) {
        totalIntensity += log.intensity;
      }
      
      if (['happy', 'excited', 'grateful', 'content', 'optimistic'].includes(emotion.toLowerCase())) {
        positiveCount++;
      }
    });
    
    const avgIntensity = emotionalLogs.length > 0 ? totalIntensity / emotionalLogs.length : 0;
    const positivityRatio = emotionalLogs.length > 0 ? positiveCount / emotionalLogs.length : 0;
    const engagementScore = Math.min(100, (conversationCount / timeframeDays) * 25);
    
    // Generate AI insights
    const llmService = createLLMService();
    const insightsPrompt = `Analyze this user's ${timeframe} emotional and engagement data to provide personalized growth insights:

EMOTIONAL PATTERNS:
- Total emotional logs: ${emotionalLogs.length}
- Most frequent emotions: ${Object.entries(emotionFrequency).sort(([,a], [,b]) => b - a).slice(0, 3).map(([emotion, count]) => `${emotion} (${count}x)`).join(', ')}
- Average emotional intensity: ${avgIntensity.toFixed(1)}/10
- Positivity ratio: ${(positivityRatio * 100).toFixed(1)}%

ENGAGEMENT METRICS:
- Conversation sessions: ${conversationCount}
- Daily engagement: ${(conversationCount / timeframeDays).toFixed(1)} sessions/day
- Engagement score: ${engagementScore.toFixed(1)}/100

TASK: Create a warm, encouraging personal growth summary that:
1. Celebrates specific improvements and patterns you notice
2. Identifies 2-3 key growth areas with actionable suggestions
3. Sets realistic goals for the next ${timeframe}
4. Maintains an optimistic, supportive tone

Keep it personal, specific, and under 300 words. Focus on progress, not deficits.`;

    const messages = [
      { role: 'system', content: 'You are a growth-focused wellness coach providing personalized insights. Be encouraging, specific, and actionable.' },
      { role: 'user', content: insightsPrompt }
    ];

    const response = await llmService.makeLLMRequest(messages, {
      temperature: 0.7,
      n_predict: 350
    });

    const insights = {
      timeframe,
      period: `${startDate.toLocaleDateString()} - ${now.toLocaleDateString()}`,
      metrics: {
        emotionalLogs: emotionalLogs.length,
        avgIntensity: Math.round(avgIntensity * 10) / 10,
        positivityRatio: Math.round(positivityRatio * 100),
        engagementScore: Math.round(engagementScore),
        conversationCount,
        topEmotions: Object.entries(emotionFrequency)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([emotion, count]) => ({ emotion, count }))
      },
      aiInsights: response.content,
      generatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: insights
    });

    logger.info(`Personal growth insights generated`, {
      userId,
      timeframe,
      emotionalLogs: emotionalLogs.length,
      engagementScore: Math.round(engagementScore)
    });

  } catch (error) {
    console.error("Error generating growth summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate growth insights",
      error: error.message
    });
  }
});

/**
 * GET /personal-insights/milestones
 * Track and celebrate user achievement milestones
 */
router.get("/milestones", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Calculate milestone achievements
    const totalEmotionalLogs = user.emotionalLog.length;
    const userCreated = new Date(user.createdAt);
    const daysSinceJoined = Math.floor((Date.now() - userCreated.getTime()) / (1000 * 60 * 60 * 24));
    
    // Recent consistency (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentLogs = user.emotionalLog.filter(log => new Date(log.timestamp) >= weekAgo);
    const consistencyScore = recentLogs.length;

    const milestones = [
      {
        id: 'first_checkin',
        title: 'First Check-in',
        description: 'Completed your first emotional check-in',
        achieved: totalEmotionalLogs >= 1,
        progress: Math.min(100, totalEmotionalLogs * 100),
        category: 'getting_started'
      },
      {
        id: 'week_warrior',
        title: 'Week Warrior',
        description: 'Maintained daily check-ins for 7 days',
        achieved: consistencyScore >= 7,
        progress: Math.min(100, (consistencyScore / 7) * 100),
        category: 'consistency'
      },
      {
        id: 'emotional_explorer',
        title: 'Emotional Explorer',
        description: 'Logged 50 different emotional experiences',
        achieved: totalEmotionalLogs >= 50,
        progress: Math.min(100, (totalEmotionalLogs / 50) * 100),
        category: 'exploration'
      },
      {
        id: 'growth_seeker',
        title: 'Growth Seeker',
        description: 'Active for 30 days on your wellness journey',
        achieved: daysSinceJoined >= 30,
        progress: Math.min(100, (daysSinceJoined / 30) * 100),
        category: 'commitment'
      },
      {
        id: 'insight_master',
        title: 'Insight Master',
        description: 'Completed 100 emotional check-ins',
        achieved: totalEmotionalLogs >= 100,
        progress: Math.min(100, (totalEmotionalLogs / 100) * 100),
        category: 'mastery'
      }
    ];

    res.json({
      success: true,
      data: {
        milestones,
        stats: {
          totalEmotionalLogs,
          daysSinceJoined,
          recentConsistency: consistencyScore
        }
      }
    });

  } catch (error) {
    console.error("Error fetching milestones:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch milestones",
      error: error.message
    });
  }
});

export default router;