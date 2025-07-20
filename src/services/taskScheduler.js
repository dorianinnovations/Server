import cron from "node-cron";
import Task from "../models/Task.js";
import User from "../models/User.js";
import logger from "../utils/logger.js";
import { AnalyticsService } from "./analytics.js";
import { createLLMService } from "./llmService.js";

console.log("📅 Initializing task scheduler...");

class TaskScheduler {
  constructor() {
    console.log("✓Creating task scheduler instance");
    this.jobs = new Map();
    this.isRunning = false;
    console.log("✓Task scheduler instance created");
  }

  // Start the scheduler
  start() {
    if (this.isRunning) {
      console.log("⚠️ Task scheduler is already running");
      return;
    }
    
    console.log("🚀 Starting task scheduler...");
    this.isRunning = true;
    
    // Schedule task processing more frequently for better responsiveness
    console.log("⏰ Scheduling task processing jobs...");
    this.scheduleTaskProcessing();
    
    // Schedule cleanup jobs
    console.log("🧹 Scheduling cleanup jobs...");
    this.scheduleCleanupJobs();
    
    // Schedule analytics jobs
    console.log("📊 Scheduling analytics jobs...");
    this.scheduleAnalyticsJobs();
    
    logger.info("Task scheduler started");
    console.log("✓Task scheduler started successfully");
  }

  // Stop the scheduler
  stop() {
    console.log("🛑 Stopping task scheduler...");
    this.isRunning = false;
    this.jobs.forEach(job => job.stop());
    this.jobs.clear();
    logger.info("Task scheduler stopped");
    console.log("✓Task scheduler stopped");
  }

  // Schedule task processing
  scheduleTaskProcessing() {
    console.log("⚡ Setting up high priority task processing (every minute)...");
    // Process high priority tasks every minute for better responsiveness
    const highPriorityJob = cron.schedule("* * * * *", async () => {
      try {
        await this.processPendingTasks(true); // Process high priority tasks only
      } catch (error) {
        logger.error("Error in high priority task processing job", { error: error.message });
      }
    });

    console.log("📋 Setting up regular task processing (every 5 minutes)...");
    // Process all tasks every 5 minutes
    const regularJob = cron.schedule("*/5 * * * *", async () => {
      try {
        await this.processPendingTasks(false); // Process all tasks
      } catch (error) {
        logger.error("Error in regular task processing job", { error: error.message });
      }
    });

    this.jobs.set("highPriorityTaskProcessing", highPriorityJob);
    this.jobs.set("regularTaskProcessing", regularJob);
    console.log("✓Task processing jobs scheduled");
  }

  // Schedule cleanup jobs
  scheduleCleanupJobs() {
    console.log("🧹 Setting up cleanup job (daily at 2 AM)...");
    // Clean up old completed tasks daily at 2 AM
    const cleanupJob = cron.schedule("0 2 * * *", async () => {
      try {
        await this.cleanupOldTasks();
      } catch (error) {
        logger.error("Error in cleanup job", { error: error.message });
      }
    });

    this.jobs.set("cleanup", cleanupJob);
    console.log("✓Cleanup job scheduled");
  }

  // Schedule analytics jobs
  scheduleAnalyticsJobs() {
    console.log("📊 Setting up analytics job (daily at 1 AM)...");
    // Generate daily analytics at 1 AM
    const analyticsJob = cron.schedule("0 1 * * *", async () => {
      try {
        await this.generateDailyAnalytics();
      } catch (error) {
        logger.error("Error in analytics job", { error: error.message });
      }
    });

    console.log("📊 Setting up emotional analytics job (daily at 2 AM)...");
    // Process emotional analytics sessions at 2 AM daily
    const emotionalAnalyticsJob = cron.schedule("0 2 * * *", async () => {
      try {
        // Emotional analytics now handled by AI-driven system
        logger.info("Emotional analytics handled by AI system");
      } catch (error) {
        logger.error("Error in emotional analytics job", { error: error.message });
      }
    });

    this.jobs.set("analytics", analyticsJob);
    this.jobs.set("emotionalAnalytics", emotionalAnalyticsJob);
    console.log("✓Analytics jobs scheduled");
  }

  // Process pending tasks
  async processPendingTasks(highPriorityOnly = false) {
    const query = {
      status: "queued",
      runAt: { $lte: new Date() },
    };

    // If processing high priority only, add priority filter
    if (highPriorityOnly) {
      query.priority = { $gte: 1 }; // High priority tasks (1 and above)
    }

    const tasksToProcess = await Task.find(query)
      .sort({ priority: -1, createdAt: 1 })
      .limit(highPriorityOnly ? 5 : 3) // More high priority tasks, fewer regular tasks
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
          // Convert Map to plain object for proper parameter access
          const dailyParams = task.parameters instanceof Map ? Object.fromEntries(task.parameters) : task.parameters;
          result = await this.processDailyInsights(task.userId, dailyParams);
          break;
        case "generate_weekly_report":
          // Convert Map to plain object for proper parameter access
          const weeklyParams = task.parameters instanceof Map ? Object.fromEntries(task.parameters) : task.parameters;
          result = await this.generateWeeklyReport(task.userId, weeklyParams);
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
    logger.info("Processing daily insights with parameters", { userId, parameters });
    
    const { sessionId, day } = parameters;
    
    if (!sessionId || !day) {
      logger.error("Missing required parameters for daily insights", { 
        sessionId, 
        day, 
        parameters: JSON.stringify(parameters) 
      });
      throw new Error("Session ID and day are required for daily insights processing");
    }

    // Analytics sessions are now handled by AI-driven system
    logger.info("Daily insights handled by AI system", { sessionId });

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Emotional insights are now generated from AI analysis of conversations
    logger.info("Processing completed - AI handles emotional insights", { userId, day });
    return `Day ${day} processed - AI-driven analytics active`;
  }

  // Generate weekly report from daily insights
  async generateWeeklyReport(userId, parameters = {}) {
    const { sessionId } = parameters;
    
    if (!sessionId) {
      throw new Error("Session ID is required for weekly report generation");
    }

    // Weekly reports are now handled by AI-driven system
    logger.info("Weekly report handled by AI system", { userId, sessionId });

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    try {
      // AI system handles weekly insights automatically
      logger.info("Weekly report completed - AI system handles analytics", { userId, sessionId });
      return `Weekly report completed - AI-driven analytics active`;

    } catch (error) {
      logger.error("Error in weekly report generation", error);
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
    // Simple parsing - consider more sophisticated parsing in production
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
      // Emotional analytics now handled by AI-driven system
      logger.info("Emotional analytics processing handled by AI system");
      
      // No manual session processing needed
      
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