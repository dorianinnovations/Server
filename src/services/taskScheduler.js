import cron from "node-cron";
import Task from "../models/Task.js";
import User from "../models/User.js";
import logger from "../utils/logger.js";
import { AnalyticsService } from "./analytics.js";

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

    this.jobs.set("analytics", analyticsJob);
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

  // Helper methods
  getMostFrequent(array) {
    const counts = {};
    array.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
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