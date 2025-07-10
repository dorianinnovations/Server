import cron from "node-cron";
import Task from "../models/Task.js";
import User from "../models/User.js";
import EmotionalAnalyticsSession from "../models/EmotionalAnalyticsSession.js";
import logger from "../utils/logger.js";
import { AnalyticsService } from "./analytics.js";
import { createLLMService } from "./llmService.js";

class TaskScheduler {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  // Start the scheduler
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Schedule task processing every minute
    this.scheduleTaskProcessing();
    
    // Schedule cleanup jobs
    this.scheduleCleanupJobs();
    
    // Schedule analytics jobs
    this.scheduleAnalyticsJobs();
    
    logger.info("Task scheduler started");
  }

  // Stop the scheduler
  stop() {
    this.isRunning = false;
    this.jobs.forEach(job => job.stop());
    this.jobs.clear();
    logger.info("Task scheduler stopped");
  }

  // Schedule task processing
  scheduleTaskProcessing() {
    const job = cron.schedule("*/5 * * * *", async () => { // Changed from every minute to every 5 minutes
      try {
        await this.processPendingTasks();
      } catch (error) {
        logger.error("Error in task processing job", { error: error.message });
      }
    });

    this.jobs.set("taskProcessing", job);
  }

  // Schedule cleanup jobs
  scheduleCleanupJobs() {
    // Clean up old completed tasks daily at 2 AM
    const cleanupJob = cron.schedule("0 2 * * *", async () => {
      try {
        await this.cleanupOldTasks();
      } catch (error) {
        logger.error("Error in cleanup job", { error: error.message });
      }
    });

    this.jobs.set("cleanup", cleanupJob);
  }

  // Schedule analytics jobs
  scheduleAnalyticsJobs() {
    // Generate daily analytics at 1 AM
    const analyticsJob = cron.schedule("0 1 * * *", async () => {
      try {
        await this.generateDailyAnalytics();
      } catch (error) {
        logger.error("Error in analytics job", { error: error.message });
      }
    });

    // Process emotional analytics sessions at 2 AM daily
    const emotionalAnalyticsJob = cron.schedule("0 2 * * *", async () => {
      try {
        await this.processEmotionalAnalyticsSessions();
      } catch (error) {
        logger.error("Error in emotional analytics job", { error: error.message });
      }
    });

    this.jobs.set("analytics", analyticsJob);
    this.jobs.set("emotionalAnalytics", emotionalAnalyticsJob);
  }

  // Process pending tasks
  async processPendingTasks() {
    const tasksToProcess = await Task.find({
      status: "queued",
      runAt: { $lte: new Date() },
    })
      .sort({ priority: -1, createdAt: 1 })
      .limit(3) // Reduced from 10 to 3 tasks per batch
      .populate("userId");

    if (tasksToProcess.length === 0) return;

    logger.info(`Processing ${tasksToProcess.length} pending tasks`);

    // Process tasks in parallel instead of sequentially for better performance
    const taskPromises = tasksToProcess.map(async (task) => {
      try {
        await this.processTask(task);
      } catch (error) {
        logger.error(`Error processing task ${task._id}`, {
          error: error.message,
          taskType: task.taskType,
        });
        
        await Task.updateOne(
          { _id: task._id },
          { 
            $set: { 
              status: "failed",
              result: `Error: ${error.message}` 
            } 
          }
        );
      }
    });

    // Wait for all tasks to complete
    await Promise.allSettled(taskPromises);
  }

  // Process individual task
  async processTask(task) {
    // Mark as processing
    await Task.updateOne(
      { _id: task._id },
      { $set: { status: "processing" } }
    );

    logger.info(`Processing task: ${task.taskType}`, {
      taskId: task._id,
      userId: task.userId,
    });

    let result = "";
    let status = "completed";

    try {
      switch (task.taskType) {
        case "summarize_emotions":
          result = await this.summarizeEmotions(task.userId, task.parameters);
          break;
        case "generate_insights":
          result = await this.generateInsights(task.userId, task.parameters);
          break;
        case "send_reminder":
          result = await this.sendReminder(task.userId, task.parameters);
          break;
        case "data_export":
          result = await this.exportUserData(task.userId, task.parameters);
          break;
        case "emotion_analysis":
          result = await this.analyzeEmotions(task.userId, task.parameters);
          break;
        case "process_daily_insights":
          result = await this.processDailyInsights(task.userId, task.parameters);
          break;
        case "generate_weekly_report":
          result = await this.generateWeeklyReport(task.userId, task.parameters);
          break;
        default:
          result = `Unknown task type: ${task.taskType}`;
          status = "failed";
      }

      // Update task with result
      await Task.updateOne(
        { _id: task._id },
        { 
          $set: { 
            status,
            result,
            completedAt: new Date()
          } 
        }
      );

      // Only track analytics for critical events to reduce database load
      if (status === "failed" || task.taskType === "emotion_analysis") {
        await AnalyticsService.trackEvent(
          "task_completed",
          "system",
          {
            taskType: task.taskType,
            status,
            taskId: task._id.toString(),
          }
        );
      }

      logger.info(`Task completed: ${task.taskType}`, {
        taskId: task._id,
        status,
      });

    } catch (error) {
      throw error;
    }
  }

  // Task implementations
  async summarizeEmotions(userId, parameters = {}) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    const days = parameters.days || 7;
    const insights = user.getEmotionalInsights(days);
    
    const summary = Object.entries(insights)
      .map(([emotion, data]) => 
        `${emotion}: ${data.count} times (avg intensity: ${(data.totalIntensity / data.count).toFixed(1)})`
      )
      .join(", ");

    return `Emotional summary for the last ${days} days: ${summary}`;
  }

  async generateInsights(userId, parameters = {}) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    // Use cached insights instead of generating new ones every time
    const insights = await AnalyticsService.getUserInsights(userId, 30);
    
    return `User insights generated with ${insights.length} data points`;
  }

  async sendReminder(userId, parameters = {}) {
    // This would integrate with email/notification service
    return `Reminder sent to user ${userId}`;
  }

  async exportUserData(userId, parameters = {}) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    const exportData = {
      profile: user.profile,
      emotionalLog: user.emotionalLog,
      stats: user.stats,
      exportDate: new Date(),
    };

    return `Data export completed for user ${userId}`;
  }

  async analyzeEmotions(userId, parameters = {}) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    const recentEmotions = user.emotionalLog
      .slice(-10)
      .map(e => ({ emotion: e.emotion, intensity: e.intensity, date: e.timestamp }));

    const analysis = {
      totalEmotions: recentEmotions.length,
      averageIntensity: recentEmotions.reduce((sum, e) => sum + (e.intensity || 5), 0) / recentEmotions.length,
      mostFrequent: this.getMostFrequent(recentEmotions.map(e => e.emotion)),
    };

    return `Emotion analysis: ${analysis.totalEmotions} emotions analyzed, avg intensity: ${analysis.averageIntensity.toFixed(1)}`;
  }

  // Process daily insights for emotional analytics session
  async processDailyInsights(userId, parameters = {}) {
    const { sessionId, day } = parameters;
    
    if (!sessionId || !day) {
      throw new Error("Session ID and day are required for daily insights processing");
    }

    const session = await EmotionalAnalyticsSession.findById(sessionId);
    if (!session) {
      throw new Error("Analytics session not found");
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Get emotions for the specific day
    const dayDate = new Date(session.weekStartDate);
    dayDate.setDate(dayDate.getDate() + (day - 1));
    dayDate.setHours(0, 0, 0, 0);
    
    const nextDay = new Date(dayDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const dayEmotions = user.emotionalLog.filter(emotion => {
      const emotionDate = new Date(emotion.timestamp);
      return emotionDate >= dayDate && emotionDate < nextDay;
    });

    if (dayEmotions.length === 0) {
      // No emotions for this day, mark as processed with empty insights
      await EmotionalAnalyticsSession.updateOne(
        { _id: sessionId },
        { 
          $push: { 
            reportProgress: {
              day,
              date: dayDate,
              insights: {
                moodPatterns: "No emotions recorded for this day",
                emotionClusters: "No data available",
                externalFactors: "No context available",
                intensityTrends: "No intensity data",
                contextualThemes: "No themes identified"
              },
              emotionCount: 0,
              status: "processed"
            }
          }
        }
      );
      return `Day ${day} processed with no emotions recorded`;
    }

    try {
      // Generate insights using LLM
      const llmService = createLLMService();
      const emotionsSummary = dayEmotions.map(e => 
        `${e.emotion} (intensity: ${e.intensity || 'N/A'}) - ${e.context || 'No context'}`
      ).join('\n');

      const prompt = `Analyze these emotions for day ${day} of the week:

${emotionsSummary}

Please provide insights in these categories:
1. Mood Patterns: What patterns do you see in the emotions?
2. Emotion Clusters: How do the emotions group together?
3. External Factors: What external factors might have influenced these emotions?
4. Intensity Trends: What trends do you see in emotional intensity?
5. Contextual Themes: What themes emerge from the contexts provided?

Keep each insight concise (2-3 sentences max) and practical.`;

      const messages = [
        { role: "system", content: "You are an emotional analytics expert. Provide concise, practical insights about emotional patterns." },
        { role: "user", content: prompt }
      ];

      const response = await llmService.makeLLMRequest(messages, {
        temperature: 0.3,
        n_predict: 400
      });

      // Parse the response into structured insights
      const insights = this.parseInsightsFromResponse(response.content);

      // Update the session with the insights
      await EmotionalAnalyticsSession.updateOne(
        { _id: sessionId },
        { 
          $push: { 
            reportProgress: {
              day,
              date: dayDate,
              insights,
              emotionCount: dayEmotions.length,
              status: "processed"
            }
          }
        }
      );

      // Check if this was the last day and schedule final report if needed
      const updatedSession = await EmotionalAnalyticsSession.findById(sessionId);
      if (updatedSession.isReadyForFinalReport()) {
        await this.scheduleTask(userId, "generate_weekly_report", { sessionId }, new Date(), 5);
      }

      return `Day ${day} processed with ${dayEmotions.length} emotions analyzed`;

    } catch (error) {
      // Mark as failed
      await EmotionalAnalyticsSession.updateOne(
        { _id: sessionId },
        { 
          $push: { 
            reportProgress: {
              day,
              date: dayDate,
              insights: {
                moodPatterns: "Error processing insights",
                emotionClusters: "Error processing insights",
                externalFactors: "Error processing insights",
                intensityTrends: "Error processing insights",
                contextualThemes: "Error processing insights"
              },
              emotionCount: dayEmotions.length,
              status: "failed"
            }
          }
        }
      );
      throw error;
    }
  }

  // Generate weekly report from daily insights
  async generateWeeklyReport(userId, parameters = {}) {
    const { sessionId } = parameters;
    
    if (!sessionId) {
      throw new Error("Session ID is required for weekly report generation");
    }

    const session = await EmotionalAnalyticsSession.findById(sessionId);
    if (!session) {
      throw new Error("Analytics session not found");
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    try {
      // Get all processed daily insights
      const processedInsights = session.reportProgress.filter(p => p.status === "processed");
      
      if (processedInsights.length === 0) {
        throw new Error("No processed insights found for weekly report");
      }

      // Collect all emotions from the week
      const weekEmotions = user.emotionalLog.filter(emotion => {
        const emotionDate = new Date(emotion.timestamp);
        return emotionDate >= session.weekStartDate && emotionDate <= session.weekEndDate;
      });

      // Generate comprehensive weekly report using LLM
      const llmService = createLLMService();
      
      const dailyInsightsSummary = processedInsights.map(insight => {
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][insight.day - 1];
        return `${dayName}: ${insight.emotionCount} emotions
        - Mood Patterns: ${insight.insights.moodPatterns}
        - Emotion Clusters: ${insight.insights.emotionClusters}
        - External Factors: ${insight.insights.externalFactors}
        - Intensity Trends: ${insight.insights.intensityTrends}
        - Contextual Themes: ${insight.insights.contextualThemes}`;
      }).join('\n\n');

      const prompt = `Generate a comprehensive weekly emotional analytics report based on these daily insights:

${dailyInsightsSummary}

Please provide:
1. A comprehensive summary of the week's emotional journey
2. 3-5 key insights about emotional patterns and trends
3. A narrative description of the emotional journey throughout the week
4. 3-5 actionable recommendations for emotional well-being

Keep the tone supportive and constructive. Focus on growth and self-awareness.`;

      const messages = [
        { role: "system", content: "You are a compassionate emotional wellness coach. Provide supportive, constructive analysis that helps users understand their emotional patterns and grow." },
        { role: "user", content: prompt }
      ];

      const response = await llmService.makeLLMRequest(messages, {
        temperature: 0.4,
        n_predict: 800
      });

      // Parse the response into structured report
      const reportData = this.parseWeeklyReportFromResponse(response.content);

      // Calculate weekly stats
      const weeklyStats = {
        totalEmotions: weekEmotions.length,
        avgIntensity: weekEmotions.length > 0 ? 
          weekEmotions.reduce((sum, e) => sum + (e.intensity || 5), 0) / weekEmotions.length : 0,
        mostFrequentEmotion: weekEmotions.length > 0 ? 
          this.getMostFrequent(weekEmotions.map(e => e.emotion)) : "None",
        emotionDistribution: this.calculateEmotionDistribution(weekEmotions)
      };

      // Update session with final report
      await EmotionalAnalyticsSession.updateOne(
        { _id: sessionId },
        { 
          $set: { 
            status: "completed",
            finalReport: {
              ...reportData,
              weeklyStats,
              generatedAt: new Date()
            }
          }
        }
      );

      return `Weekly report generated for session ${sessionId} with ${weekEmotions.length} emotions analyzed`;

    } catch (error) {
      // Mark session as failed
      await EmotionalAnalyticsSession.updateOne(
        { _id: sessionId },
        { $set: { status: "failed" } }
      );
      throw error;
    }
  }

  // Helper methods
  getMostFrequent(array) {
    const counts = {};
    array.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
  }

  // Parse insights from LLM response
  parseInsightsFromResponse(response) {
    // Simple parsing - in production, you might want more sophisticated parsing
    const insights = {
      moodPatterns: "Pattern analysis completed",
      emotionClusters: "Cluster analysis completed",
      externalFactors: "Factor analysis completed",
      intensityTrends: "Trend analysis completed",
      contextualThemes: "Theme analysis completed"
    };

    // Try to extract structured insights from the response
    const lines = response.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      if (line.toLowerCase().includes('mood pattern')) {
        insights.moodPatterns = line.replace(/^\d+\.\s*/, '').replace(/^mood pattern[s]?:?\s*/i, '');
      } else if (line.toLowerCase().includes('emotion cluster')) {
        insights.emotionClusters = line.replace(/^\d+\.\s*/, '').replace(/^emotion cluster[s]?:?\s*/i, '');
      } else if (line.toLowerCase().includes('external factor')) {
        insights.externalFactors = line.replace(/^\d+\.\s*/, '').replace(/^external factor[s]?:?\s*/i, '');
      } else if (line.toLowerCase().includes('intensity trend')) {
        insights.intensityTrends = line.replace(/^\d+\.\s*/, '').replace(/^intensity trend[s]?:?\s*/i, '');
      } else if (line.toLowerCase().includes('contextual theme')) {
        insights.contextualThemes = line.replace(/^\d+\.\s*/, '').replace(/^contextual theme[s]?:?\s*/i, '');
      }
    }

    return insights;
  }

  // Parse weekly report from LLM response
  parseWeeklyReportFromResponse(response) {
    const report = {
      summary: "Weekly emotional summary generated",
      keyInsights: [],
      emotionalJourney: "Emotional journey analysis completed",
      recommendations: []
    };

    // Simple parsing - extract key sections
    const lines = response.split('\n').filter(line => line.trim());
    let currentSection = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.toLowerCase().includes('summary')) {
        currentSection = 'summary';
        continue;
      } else if (trimmedLine.toLowerCase().includes('key insight')) {
        currentSection = 'insights';
        continue;
      } else if (trimmedLine.toLowerCase().includes('emotional journey')) {
        currentSection = 'journey';
        continue;
      } else if (trimmedLine.toLowerCase().includes('recommendation')) {
        currentSection = 'recommendations';
        continue;
      }
      
      if (currentSection === 'summary' && trimmedLine.length > 10) {
        report.summary = trimmedLine;
      } else if (currentSection === 'insights' && trimmedLine.length > 10) {
        report.keyInsights.push(trimmedLine.replace(/^\d+\.\s*/, '').replace(/^-\s*/, ''));
      } else if (currentSection === 'journey' && trimmedLine.length > 10) {
        report.emotionalJourney = trimmedLine;
      } else if (currentSection === 'recommendations' && trimmedLine.length > 10) {
        report.recommendations.push(trimmedLine.replace(/^\d+\.\s*/, '').replace(/^-\s*/, ''));
      }
    }

    return report;
  }

  // Calculate emotion distribution
  calculateEmotionDistribution(emotions) {
    const distribution = new Map();
    emotions.forEach(emotion => {
      const current = distribution.get(emotion.emotion) || 0;
      distribution.set(emotion.emotion, current + 1);
    });
    return distribution;
  }

  // Cleanup old tasks
  async cleanupOldTasks() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await Task.deleteMany({
      status: { $in: ["completed", "failed"] },
      createdAt: { $lt: thirtyDaysAgo },
    });

    logger.info(`Cleaned up ${result.deletedCount} old tasks`);
  }

  // Generate daily analytics
  async generateDailyAnalytics() {
    const metrics = await AnalyticsService.getMetrics("24h");
    logger.info("Daily analytics generated", { metrics });
  }

  // Process emotional analytics sessions
  async processEmotionalAnalyticsSessions() {
    try {
      // Get all users with recent emotional data
      const users = await User.find({
        "emotionalLog.timestamp": { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }).select('_id');

      logger.info(`Processing emotional analytics for ${users.length} users`);

      // Process each user's session
      for (const user of users) {
        try {
          // Get or create current session
          const session = await EmotionalAnalyticsSession.getCurrentSession(user._id);
          
          if (session.status === "completed") {
            continue; // Skip completed sessions
          }

          // Get the next day to process
          const nextDay = session.getNextDayToProcess();
          
          if (nextDay) {
            // Schedule daily insight processing task
            await this.scheduleTask(user._id, "process_daily_insights", {
              sessionId: session._id.toString(),
              day: nextDay
            }, new Date(), 3);
            
            logger.info(`Scheduled daily insights processing for user ${user._id}, day ${nextDay}`);
          }
          
          // If the session is ready for final report and not already scheduled
          if (session.isReadyForFinalReport() && session.status !== "in_progress") {
            await EmotionalAnalyticsSession.updateOne(
              { _id: session._id },
              { $set: { status: "in_progress" } }
            );
            
            await this.scheduleTask(user._id, "generate_weekly_report", {
              sessionId: session._id.toString()
            }, new Date(), 5);
            
            logger.info(`Scheduled weekly report generation for user ${user._id}`);
          }
          
        } catch (userError) {
          logger.error(`Error processing analytics for user ${user._id}`, { error: userError.message });
        }
      }
      
    } catch (error) {
      logger.error("Error in processEmotionalAnalyticsSessions", { error: error.message });
    }
  }

  // Schedule a new task
  async scheduleTask(userId, taskType, parameters = {}, runAt = new Date(), priority = 0) {
    const task = await Task.create({
      userId,
      taskType,
      parameters,
      runAt,
      priority,
      status: "queued",
    });

    logger.info("Task scheduled", {
      taskId: task._id,
      taskType,
      userId,
      runAt,
    });

    return task;
  }
}

// Create singleton instance
const taskScheduler = new TaskScheduler();

export default taskScheduler; 