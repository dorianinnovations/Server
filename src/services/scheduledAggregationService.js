import snapshotAnalysisService from "./snapshotAnalysisService.js";
import collectiveDataService from "./collectiveDataService.js";
import logger from "../utils/logger.js";
import { createCache } from "../utils/cache.js";

console.log("⏰ Initializing scheduled aggregation service...");

class ScheduledAggregationService {
  constructor() {
    console.log("✓Creating scheduled aggregation service instance");
    this.cache = createCache();
    this.isRunning = false;
    this.lastRun = null;
    this.runCount = 0;
    this.errorCount = 0;
    this.interval = null;
    this.intervalMs = 10 * 60 * 1000; // 10 minutes
    console.log("✓Scheduled aggregation service instance created");
  }

  /**
   * Start the scheduled aggregation service
   */
  start() {
    if (this.isRunning) {
      logger.warn("Scheduled aggregation service is already running");
      return;
    }

    console.log("🚀 Starting scheduled aggregation service...");
    console.log(`⏱️ Setting interval to ${this.intervalMs / 1000 / 60} minutes`);

    logger.info("Starting scheduled aggregation service", {
      interval: "10 minutes",
      nextRun: new Date(Date.now() + this.intervalMs)
    });

    this.isRunning = true;
    
    console.log("✓Scheduled aggregation service started");
    console.log("🔄 Running initial aggregation cycle...");
    
    // Run immediately on start
    this.runAggregation();
    
    // Schedule recurring runs
    this.interval = setInterval(() => {
      console.log("⏰ Scheduled aggregation cycle triggered");
      this.runAggregation();
    }, this.intervalMs);
    
    console.log("✓Recurring aggregation schedule configured");
  }

  /**
   * Stop the scheduled aggregation service
   */
  stop() {
    if (!this.isRunning) {
      logger.warn("Scheduled aggregation service is not running");
      return;
    }

    console.log("🛑 Stopping scheduled aggregation service...");

    logger.info("Stopping scheduled aggregation service", {
      totalRuns: this.runCount,
      errorCount: this.errorCount,
      lastRun: this.lastRun
    });

    this.isRunning = false;
    
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log("✓Scheduled aggregation interval cleared");
    }
    
    console.log("✓Scheduled aggregation service stopped");
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      runCount: this.runCount,
      errorCount: this.errorCount,
      nextRun: this.isRunning ? new Date(Date.now() + this.intervalMs) : null,
      uptime: this.lastRun ? Date.now() - this.lastRun.getTime() : 0
    };
  }

  /**
   * Run a single aggregation cycle
   */
  async runAggregation() {
    const startTime = Date.now();
    
    try {
      console.log("🔍 Checking database connection...");
      // Check database connection
      const mongoose = await import("mongoose");
      if (!mongoose.default.connection || mongoose.default.connection.readyState !== 1) {
        logger.warn("Database not connected, skipping scheduled aggregation");
        console.log("⚠️ Database not connected, skipping aggregation");
        return;
      }
      console.log("✓Database connection verified");

      logger.info("Starting scheduled aggregation cycle", {
        cycle: this.runCount + 1,
        timestamp: new Date().toISOString()
      });

      console.log("📊 Checking data availability...");
      // Check if we have sufficient data
      const insights = await collectiveDataService.getRealTimeInsights();
      
      if (!insights.success) {
        logger.warn("Insufficient data for aggregation", {
          message: insights.message
        });
        console.log("⚠️ Insufficient data for aggregation");
        return;
      }

      // Check minimum requirements
      if (insights.metadata.totalUsers < 5) {
        logger.info("Insufficient users for aggregation", {
          totalUsers: insights.metadata.totalUsers,
          minimum: 5
        });
        console.log(`⚠️ Insufficient users (${insights.metadata.totalUsers}/5 minimum)`);
        return;
      }

      // Check if we have recent activity
      if (insights.insights.totalRecentEntries < 10) {
        logger.info("Insufficient recent activity for aggregation", {
          recentEntries: insights.insights.totalRecentEntries,
          minimum: 10
        });
        console.log(`⚠️ Insufficient recent activity (${insights.insights.totalRecentEntries}/10 minimum)`);
        return;
      }

      console.log("✅ Data requirements met, generating snapshot...");
      // Generate snapshot for 10-minute window
      const result = await snapshotAnalysisService.generateSnapshot("10m", {
        forceGeneration: true,
        skipCache: true
      });

      if (!result.success) {
        throw new Error(`Snapshot generation failed: ${result.error}`);
      }

      this.runCount++;
      this.lastRun = new Date();
      
      const processingTime = Date.now() - startTime;

      logger.info("Scheduled aggregation completed successfully", {
        snapshotId: result.snapshot.id,
        sampleSize: result.snapshot.sampleSize,
        dominantEmotion: result.snapshot.dominantEmotion,
        archetype: result.snapshot.archetype,
        processingTime,
        totalRuns: this.runCount
      });

      console.log(`✅ Aggregation completed successfully (${processingTime}ms)`);
      console.log(`📊 Snapshot: ${result.snapshot.archetype} - ${result.snapshot.dominantEmotion}`);

      // Cache the latest snapshot for quick access
      this.cache.set("latest_scheduled_snapshot", result.snapshot, 300000); // 5 minutes

    } catch (error) {
      this.errorCount++;
      
      logger.error("Scheduled aggregation failed", {
        error: error.message,
        stack: error.stack,
        cycle: this.runCount + 1,
        errorCount: this.errorCount
      });

      console.error(`❌ Aggregation failed: ${error.message}`);

      // Don't update lastRun on error to maintain accurate timing
    }
  }

  /**
   * Manually trigger an aggregation cycle
   */
  async triggerAggregation() {
    if (!this.isRunning) {
      throw new Error("Scheduled aggregation service is not running");
    }

    logger.info("Manually triggering aggregation cycle");
    console.log("🔧 Manually triggering aggregation cycle...");
    await this.runAggregation();
  }

  /**
   * Get the latest scheduled snapshot
   */
  getLatestScheduledSnapshot() {
    return this.cache.get("latest_scheduled_snapshot");
  }

  /**
   * Get aggregation statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      runCount: this.runCount,
      errorCount: this.errorCount,
      successRate: this.runCount > 0 ? ((this.runCount - this.errorCount) / this.runCount * 100).toFixed(2) : 0,
      averageInterval: this.runCount > 0 ? this.intervalMs / 1000 : 0,
      uptime: this.lastRun ? Date.now() - this.lastRun.getTime() : 0
    };
  }

  /**
   * Reset service statistics
   */
  resetStats() {
    this.runCount = 0;
    this.errorCount = 0;
    this.lastRun = null;
    
    logger.info("Scheduled aggregation statistics reset");
    console.log("🔄 Aggregation statistics reset");
  }

  /**
   * Update the aggregation interval
   */
  updateInterval(minutes) {
    const newIntervalMs = minutes * 60 * 1000;
    
    if (newIntervalMs < 60000) { // Minimum 1 minute
      throw new Error("Interval must be at least 1 minute");
    }

    logger.info("Updating scheduled aggregation interval", {
      oldInterval: this.intervalMs / 1000 / 60,
      newInterval: minutes
    });

    console.log(`⏰ Updating aggregation interval to ${minutes} minutes`);

    this.intervalMs = newIntervalMs;

    // Restart the service with new interval
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }
}

console.log("✓Scheduled aggregation service class defined");

// Create singleton instance
const scheduledAggregationService = new ScheduledAggregationService();

console.log("✓Scheduled aggregation service singleton created");

export default scheduledAggregationService; 