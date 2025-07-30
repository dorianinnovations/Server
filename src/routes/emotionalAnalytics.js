import express from 'express';
import { protect } from '../middleware/auth.js';
import { HTTP_STATUS } from '../config/constants.js';

const router = express.Router();

/**
 * @route POST /emotions
 * @desc Submit emotional data for tracking
 * @access Private
 */
router.post('/submit', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { emotion, intensity, context, timestamp } = req.body;

    if (!emotion || intensity === undefined) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Emotion and intensity are required'
      });
    }

    // For now, store basic emotion data (in production this would use a proper emotions model)
    const emotionData = {
      userId,
      emotion,
      intensity: Math.max(1, Math.min(10, intensity)), // Clamp between 1-10
      context: context || '',
      timestamp: timestamp || new Date().toISOString(),
      submittedAt: new Date().toISOString()
    };

    // Save to user's emotional log for UBPM analysis
    const User = (await import('../models/User.js')).default;
    await User.findByIdAndUpdate(userId, {
      $push: {
        emotionalLog: emotionData
      }
    });

    res.json({
      success: true,
      data: emotionData,
      message: 'Emotion data submitted successfully'
    });

  } catch (error) {
    console.error('Error submitting emotion data:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to submit emotion data'
    });
  }
});

/**
 * Get current emotional session data
 */
router.get('/current-session', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's emotional data from database
    const User = (await import('../models/User.js')).default;
    const user = await User.findById(userId).select('emotionalLog');
    
    if (!user || !user.emotionalLog || user.emotionalLog.length === 0) {
      return res.json({
        success: true,
        data: {
          userId,
          sessionId: `session_${Date.now()}`,
          dominantEmotion: 'neutral',
          averageIntensity: 5.0,
          emotionDistribution: { positive: 0.33, neutral: 0.34, negative: 0.33 },
          sessionDuration: 0,
          lastActivity: new Date().toISOString(),
          insights: ['Start chatting to build your emotional profile']
        }
      });
    }

    // Analyze recent emotions (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentEmotions = user.emotionalLog.filter(e => 
      new Date(e.timestamp) > oneDayAgo
    );

    if (recentEmotions.length === 0) {
      return res.json({
        success: true,
        data: {
          userId,
          sessionId: `session_${Date.now()}`,
          dominantEmotion: 'neutral',
          averageIntensity: 5.0,
          emotionDistribution: { positive: 0.33, neutral: 0.34, negative: 0.33 },
          sessionDuration: 0,
          lastActivity: user.emotionalLog[user.emotionalLog.length - 1]?.timestamp || new Date().toISOString(),
          insights: ['No recent emotional data - chat more for analysis']
        }
      });
    }

    // Calculate real metrics
    const intensities = recentEmotions.map(e => e.intensity || 5);
    const averageIntensity = intensities.reduce((sum, i) => sum + i, 0) / intensities.length;
    
    // Categorize emotions
    const positiveEmotions = ['excited', 'satisfied', 'happy', 'love', 'fantastic', 'amazing', 'wonderful'];
    const negativeEmotions = ['frustrated', 'confused', 'sad', 'angry', 'worried', 'stressed'];
    
    let positive = 0, negative = 0, neutral = 0;
    recentEmotions.forEach(e => {
      if (positiveEmotions.some(pe => e.emotion.toLowerCase().includes(pe))) {
        positive++;
      } else if (negativeEmotions.some(ne => e.emotion.toLowerCase().includes(ne))) {
        negative++;
      } else {
        neutral++;
      }
    });

    const total = positive + negative + neutral;
    const emotionDistribution = {
      positive: total > 0 ? positive / total : 0.33,
      neutral: total > 0 ? neutral / total : 0.34,
      negative: total > 0 ? negative / total : 0.33
    };

    // Find dominant emotion
    const emotionCounts = {};
    recentEmotions.forEach(e => {
      emotionCounts[e.emotion] = (emotionCounts[e.emotion] || 0) + 1;
    });
    const dominantEmotion = Object.entries(emotionCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'balanced';

    const currentSession = {
      userId,
      sessionId: `session_${Date.now()}`,
      dominantEmotion,
      averageIntensity: Math.round(averageIntensity * 10) / 10,
      emotionDistribution,
      sessionDuration: recentEmotions.length * 2, // Rough estimate in minutes
      lastActivity: recentEmotions[recentEmotions.length - 1]?.timestamp || new Date().toISOString(),
      insights: [
        `Analyzed ${recentEmotions.length} emotional data points from the last 24 hours`,
        `Your dominant emotion today has been: ${dominantEmotion}`,
        `Average emotional intensity: ${Math.round(averageIntensity * 10) / 10}/10`
      ]
    };

    res.json({
      success: true,
      data: currentSession
    });

  } catch (error) {
    console.error('Error fetching current emotional session:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to fetch current emotional session'
    });
  }
});

/**
 * Get weekly emotional analytics report
 */
router.get('/weekly-report', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's emotional data from database
    const User = (await import('../models/User.js')).default;
    const user = await User.findById(userId).select('emotionalLog');
    
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date();
    
    if (!user || !user.emotionalLog || user.emotionalLog.length === 0) {
      return res.json({
        success: true,
        data: {
          userId,
          reportPeriod: { start: weekStart.toISOString(), end: weekEnd.toISOString() },
          emotionalTrends: { overall: 'insufficient_data', positivity: 50, intensity: 5.0, variability: 'unknown' },
          dailyBreakdown: [],
          insights: ['No emotional data available yet', 'Start chatting to build your emotional profile'],
          recommendations: ['Chat with Numina to begin tracking your emotional patterns']
        }
      });
    }

    // Filter emotions from the last week
    const weeklyEmotions = user.emotionalLog.filter(e => {
      const emotionDate = new Date(e.timestamp);
      return emotionDate >= weekStart && emotionDate <= weekEnd;
    });

    if (weeklyEmotions.length === 0) {
      return res.json({
        success: true,
        data: {
          userId,
          reportPeriod: { start: weekStart.toISOString(), end: weekEnd.toISOString() },
          emotionalTrends: { overall: 'no_recent_data', positivity: 50, intensity: 5.0, variability: 'unknown' },
          dailyBreakdown: [],
          insights: ['No emotional data from this week', 'Chat more regularly for weekly insights'],
          recommendations: ['Increase interaction frequency for better emotional tracking']
        }
      });
    }

    // Calculate weekly metrics
    const intensities = weeklyEmotions.map(e => e.intensity || 5);
    const avgIntensity = intensities.reduce((sum, i) => sum + i, 0) / intensities.length;
    const intensityVariance = intensities.reduce((sum, i) => sum + Math.pow(i - avgIntensity, 2), 0) / intensities.length;
    const variability = intensityVariance < 1 ? 'low' : intensityVariance < 4 ? 'medium' : 'high';

    // Categorize emotions for positivity score
    const positiveEmotions = ['excited', 'satisfied', 'happy', 'love', 'fantastic', 'amazing', 'wonderful', 'curious', 'focused'];
    const negativeEmotions = ['frustrated', 'confused', 'sad', 'angry', 'worried', 'stressed'];
    
    let positiveCount = 0;
    weeklyEmotions.forEach(e => {
      if (positiveEmotions.some(pe => e.emotion.toLowerCase().includes(pe))) {
        positiveCount++;
      }
    });
    const positivity = Math.round((positiveCount / weeklyEmotions.length) * 100);

    // Create daily breakdown
    const dailyBreakdown = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const dayEmotions = weeklyEmotions.filter(e => {
        const emotionDate = new Date(e.timestamp);
        return emotionDate >= dayStart && emotionDate < dayEnd;
      });

      const dayIntensity = dayEmotions.length > 0 
        ? dayEmotions.reduce((sum, e) => sum + (e.intensity || 5), 0) / dayEmotions.length 
        : 0;

      const dominantEmotion = dayEmotions.length > 0 
        ? dayEmotions.reduce((counts, e) => {
            counts[e.emotion] = (counts[e.emotion] || 0) + 1;
            return counts;
          }, {})
        : {};

      const topEmotion = Object.entries(dominantEmotion)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none';

      dailyBreakdown.push({
        date: dayStart.toISOString().split('T')[0],
        emotionCount: dayEmotions.length,
        averageIntensity: Math.round(dayIntensity * 10) / 10,
        dominantEmotion: topEmotion
      });
    }

    // Generate insights
    const insights = [];
    if (weeklyEmotions.length < 5) {
      insights.push('Limited emotional data this week - consider more frequent interactions');
    } else {
      insights.push(`Analyzed ${weeklyEmotions.length} emotional data points this week`);
    }

    if (positivity > 70) {
      insights.push('You showed predominantly positive emotions this week');
    } else if (positivity < 40) {
      insights.push('This week showed more challenging emotional states');
    } else {
      insights.push('Your emotional state has been balanced this week');
    }

    if (variability === 'low') {
      insights.push('Your emotional intensity remained quite stable');
    } else if (variability === 'high') {
      insights.push('You experienced significant emotional intensity variations');
    }

    // Generate recommendations
    const recommendations = [];
    if (weeklyEmotions.length < 10) {
      recommendations.push('Chat more regularly to improve emotional tracking accuracy');
    }
    if (positivity < 50) {
      recommendations.push('Consider activities that typically boost your mood');
    }
    if (variability === 'high') {
      recommendations.push('Try mindfulness practices to help stabilize emotional responses');
    } else {
      recommendations.push('Your emotional regulation appears healthy - keep it up!');
    }

    const weeklyReport = {
      userId,
      reportPeriod: {
        start: weekStart.toISOString(),
        end: weekEnd.toISOString()
      },
      emotionalTrends: {
        overall: weeklyEmotions.length > 5 ? 'analyzed' : 'building_data',
        positivity,
        intensity: Math.round(avgIntensity * 10) / 10,
        variability
      },
      dailyBreakdown,
      insights,
      recommendations
    };

    res.json({
      success: true,
      data: weeklyReport
    });

  } catch (error) {
    console.error('Error fetching weekly emotional report:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to fetch weekly emotional report'
    });
  }
});

export default router;