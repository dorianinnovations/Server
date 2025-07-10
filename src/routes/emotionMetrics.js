import express from "express";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";
import logger from "../utils/logger.js";

const router = express.Router();

// Export comprehensive emotion metrics for LLM analysis
router.get("/export", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { format = 'json', days = 90 } = req.query;
    
    const user = await User.findById(userId).select('emotionalLog profile');
    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const emotions = user.emotionalLog || [];
    
    // Filter by date range
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    
    const filteredEmotions = emotions.filter(emotion => 
      new Date(emotion.timestamp) >= cutoffDate
    );

    // Generate comprehensive metrics for LLM consumption
    const metrics = {
      metadata: {
        userId: userId,
        exportDate: new Date().toISOString(),
        period: `${days} days`,
        totalEmotions: filteredEmotions.length
      },
      rawData: filteredEmotions.map(emotion => ({
        emotion: emotion.emotion,
        intensity: emotion.intensity || null,
        context: emotion.context || null,
        timestamp: emotion.timestamp.toISOString(),
        dayOfWeek: emotion.timestamp.getDay(), // 0-6 (Sunday-Saturday)
        hourOfDay: emotion.timestamp.getHours(),
        date: emotion.timestamp.toISOString().split('T')[0]
      })),
      patterns: generatePatterns(filteredEmotions),
      trends: generateTrends(filteredEmotions),
      correlations: generateCorrelations(filteredEmotions)
    };

    // Return different formats based on request
    if (format === 'csv') {
      const csv = convertToCSV(metrics.rawData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="emotions-${userId}-${days}days.csv"`);
      return res.send(csv);
    }

    if (format === 'text') {
      const textSummary = generateTextSummary(metrics);
      res.setHeader('Content-Type', 'text/plain');
      return res.send(textSummary);
    }

    // Default JSON response
    res.json(metrics);

  } catch (error) {
    logger.error("Error exporting emotion metrics", { 
      error: error.message, 
      userId: req.user.id 
    });
    res.status(500).json({
      message: "Failed to export emotion metrics",
      error: error.message
    });
  }
});

// Helper function to generate patterns
function generatePatterns(emotions) {
  if (emotions.length === 0) return {};

  const emotionCounts = {};
  const timePatterns = {
    byDay: {},
    byHour: {},
    byDate: {}
  };
  const intensityByEmotion = {};

  emotions.forEach(emotion => {
    // Emotion frequency
    emotionCounts[emotion.emotion] = (emotionCounts[emotion.emotion] || 0) + 1;

    // Time patterns
    const day = emotion.timestamp.getDay();
    const hour = emotion.timestamp.getHours();
    const date = emotion.timestamp.toISOString().split('T')[0];

    timePatterns.byDay[day] = (timePatterns.byDay[day] || 0) + 1;
    timePatterns.byHour[hour] = (timePatterns.byHour[hour] || 0) + 1;
    timePatterns.byDate[date] = (timePatterns.byDate[date] || 0) + 1;

    // Intensity patterns
    if (emotion.intensity) {
      if (!intensityByEmotion[emotion.emotion]) {
        intensityByEmotion[emotion.emotion] = [];
      }
      intensityByEmotion[emotion.emotion].push(emotion.intensity);
    }
  });

  // Calculate average intensities
  const avgIntensityByEmotion = {};
  Object.entries(intensityByEmotion).forEach(([emotion, intensities]) => {
    avgIntensityByEmotion[emotion] = intensities.reduce((a, b) => a + b, 0) / intensities.length;
  });

  return {
    emotionFrequency: emotionCounts,
    timePatterns,
    averageIntensityByEmotion: avgIntensityByEmotion,
    mostFrequentEmotion: Object.entries(emotionCounts).sort(([,a], [,b]) => b - a)[0]?.[0],
    totalUniqueEmotions: Object.keys(emotionCounts).length
  };
}

// Helper function to generate trends
function generateTrends(emotions) {
  if (emotions.length < 2) return {};

  // Sort by date
  const sortedEmotions = emotions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  // Group by date
  const dailyData = {};
  sortedEmotions.forEach(emotion => {
    const date = emotion.timestamp.toISOString().split('T')[0];
    if (!dailyData[date]) {
      dailyData[date] = {
        emotions: [],
        intensities: [],
        count: 0
      };
    }
    dailyData[date].emotions.push(emotion.emotion);
    if (emotion.intensity) {
      dailyData[date].intensities.push(emotion.intensity);
    }
    dailyData[date].count++;
  });

  // Calculate daily averages
  const dailyTrends = Object.entries(dailyData).map(([date, data]) => ({
    date,
    emotionCount: data.count,
    avgIntensity: data.intensities.length > 0 
      ? data.intensities.reduce((a, b) => a + b, 0) / data.intensities.length 
      : null,
    topEmotion: getMostFrequent(data.emotions)
  }));

  return {
    dailyTrends,
    overallTrend: calculateOverallTrend(dailyTrends)
  };
}

// Helper function to generate correlations
function generateCorrelations(emotions) {
  const contextToEmotions = {};
  const timeToIntensity = {};

  emotions.forEach(emotion => {
    // Context correlations
    if (emotion.context) {
      const words = emotion.context.toLowerCase().split(/\s+/).filter(word => word.length > 3);
      words.forEach(word => {
        if (!contextToEmotions[word]) {
          contextToEmotions[word] = {};
        }
        contextToEmotions[word][emotion.emotion] = (contextToEmotions[word][emotion.emotion] || 0) + 1;
      });
    }

    // Time-intensity correlations
    if (emotion.intensity) {
      const hour = emotion.timestamp.getHours();
      if (!timeToIntensity[hour]) {
        timeToIntensity[hour] = [];
      }
      timeToIntensity[hour].push(emotion.intensity);
    }
  });

  // Calculate average intensity by hour
  const avgIntensityByHour = {};
  Object.entries(timeToIntensity).forEach(([hour, intensities]) => {
    avgIntensityByHour[hour] = intensities.reduce((a, b) => a + b, 0) / intensities.length;
  });

  return {
    contextCorrelations: contextToEmotions,
    timeIntensityCorrelations: avgIntensityByHour
  };
}

// Helper functions
function getMostFrequent(array) {
  const counts = {};
  array.forEach(item => {
    counts[item] = (counts[item] || 0) + 1;
  });
  return Object.entries(counts).sort(([,a], [,b]) => b - a)[0]?.[0];
}

function calculateOverallTrend(dailyTrends) {
  if (dailyTrends.length < 3) return 'insufficient_data';
  
  const recent = dailyTrends.slice(-7);
  const previous = dailyTrends.slice(-14, -7);
  
  const recentAvg = recent.reduce((sum, day) => sum + (day.avgIntensity || 5), 0) / recent.length;
  const previousAvg = previous.length > 0 
    ? previous.reduce((sum, day) => sum + (day.avgIntensity || 5), 0) / previous.length 
    : recentAvg;
  
  const difference = recentAvg - previousAvg;
  
  if (Math.abs(difference) < 0.5) return 'stable';
  return difference > 0 ? 'improving' : 'declining';
}

function convertToCSV(data) {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];
  
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
    });
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
}

function generateTextSummary(metrics) {
  const { rawData, patterns, trends } = metrics;
  
  return `
EMOTION METRICS SUMMARY
Period: ${metrics.metadata.period}
Total Emotions: ${metrics.metadata.totalEmotions}

TOP EMOTIONS:
${Object.entries(patterns.emotionFrequency || {})
  .sort(([,a], [,b]) => b - a)
  .slice(0, 5)
  .map(([emotion, count]) => `- ${emotion}: ${count} times`)
  .join('\n')}

INTENSITY PATTERNS:
${Object.entries(patterns.averageIntensityByEmotion || {})
  .map(([emotion, avg]) => `- ${emotion}: ${avg.toFixed(1)} average intensity`)
  .join('\n')}

OVERALL TREND: ${trends.overallTrend || 'unknown'}

RAW DATA:
${rawData.map(emotion => 
  `${emotion.timestamp} | ${emotion.emotion} | ${emotion.intensity || 'N/A'} | ${emotion.context || 'No context'}`
).join('\n')}
`.trim();
}

export default router;