import mongoose from "mongoose";
import logger from "../utils/logger.js";

// Analytics Schema
const analyticsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false, // Allow anonymous tracking
  },
  event: {
    type: String,
    required: true,
    enum: [
      "user_signup",
      "user_login",
      "completion_request",
      "emotion_logged",
      "task_created",
      "task_completed",
      "error_occurred",
      "api_call",
      "performance_metric"
    ],
  },
  category: {
    type: String,
    required: true,
    enum: ["user", "system", "performance", "error"],
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  sessionId: String,
  userAgent: String,
  ipAddress: String,
  responseTime: Number,
  statusCode: Number,
});

const Analytics = mongoose.model("Analytics", analyticsSchema);

// Batch processing for analytics
class AnalyticsBatcher {
  constructor() {
    this.batch = [];
    this.batchSize = 10; // Process 10 events at once
    this.flushInterval = 5000; // Flush every 5 seconds
    this.lastFlush = Date.now();
    
    // Start auto-flush timer
    this.startAutoFlush();
  }

  add(analyticsData) {
    this.batch.push(analyticsData);
    
    // Flush if batch is full
    if (this.batch.length >= this.batchSize) {
      this.flush();
    }
  }

  async flush() {
    if (this.batch.length === 0) return;
    
    const currentBatch = this.batch.splice(0, this.batch.length);
    
    try {
      await Analytics.insertMany(currentBatch);
      logger.info(`Flushed ${currentBatch.length} analytics events`);
    } catch (error) {
      logger.error("Failed to flush analytics batch", {
        error: error.message,
        batchSize: currentBatch.length,
      });
    }
    
    this.lastFlush = Date.now();
  }

  startAutoFlush() {
    setInterval(() => {
      if (this.batch.length > 0 && Date.now() - this.lastFlush > this.flushInterval) {
        this.flush();
      }
    }, this.flushInterval);
  }
}

// Create singleton batcher
const analyticsBatcher = new AnalyticsBatcher();

// Analytics service
export class AnalyticsService {
  static async trackEvent(event, category, metadata = {}, req = null) {
    try {
      const analyticsData = {
        userId: req?.user?.id || null,
        event,
        category,
        metadata,
        sessionId: req?.session?.id || null,
        userAgent: req?.get("User-Agent") || null,
        ipAddress: req?.ip || null,
        responseTime: req?.responseTime || null,
        statusCode: req?.statusCode || null,
        timestamp: new Date(),
      };

      // Add to batch instead of immediate database write
      analyticsBatcher.add(analyticsData);
      
      // Only log for critical events to reduce noise
      if (category === "error" || event === "task_completed") {
        logger.info("Analytics event queued for batch processing", {
          event,
          category,
          userId: analyticsData.userId,
        });
      }
    } catch (error) {
      logger.error("Failed to queue analytics event", {
        error: error.message,
        event,
        category,
      });
    }
  }

  static async getMetrics(timeRange = "24h") {
    try {
      const now = new Date();
      let startDate;

      switch (timeRange) {
        case "1h":
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case "24h":
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const metrics = await Analytics.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              event: "$event",
              category: "$category",
            },
            count: { $sum: 1 },
            avgResponseTime: { $avg: "$responseTime" },
          },
        },
        {
          $group: {
            _id: "$_id.category",
            events: {
              $push: {
                event: "$_id.event",
                count: "$count",
                avgResponseTime: "$avgResponseTime",
              },
            },
            totalEvents: { $sum: "$count" },
          },
        },
      ]);

      return metrics;
    } catch (error) {
      logger.error("Failed to get analytics metrics", {
        error: error.message,
        timeRange,
      });
      return [];
    }
  }

  static async getUserInsights(userId, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const insights = await Analytics.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            timestamp: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              event: "$event",
              date: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$timestamp",
                },
              },
            },
            count: { $sum: 1 },
            avgResponseTime: { $avg: "$responseTime" },
          },
        },
        {
          $sort: { "_id.date": 1 },
        },
      ]);

      return insights;
    } catch (error) {
      logger.error("Failed to get user insights", {
        error: error.message,
        userId,
      });
      return [];
    }
  }

  static async trackPerformance(operation, duration, metadata = {}) {
    await this.trackEvent(
      "performance_metric",
      "performance",
      {
        operation,
        duration,
        ...metadata,
      }
    );
  }

  static async trackError(error, req = null) {
    await this.trackEvent(
      "error_occurred",
      "error",
      {
        error: error.message,
        stack: error.stack,
        statusCode: error.statusCode || 500,
      },
      req
    );
  }

  // Force flush for critical events
  static async forceFlush() {
    await analyticsBatcher.flush();
  }
}

export default Analytics; 