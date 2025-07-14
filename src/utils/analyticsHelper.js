import EmotionalAnalyticsSession from "../models/EmotionalAnalyticsSession.js";
import logger from "./logger.js";

console.log("📊 Initializing analytics helper utilities...");

// Shared helper function to update analytics for a user
export async function updateAnalyticsForUser(userId) {
  try {
    // Get or create current analytics session
    const session = await EmotionalAnalyticsSession.getCurrentSession(userId);
    
    if (!session) {
      logger.warn("No analytics session found for user", { userId });
      return;
    }

    // Get the next day to process
    const nextDay = session.getNextDayToProcess();
    
    if (nextDay) {
      // Import task scheduler to process daily insights
      const { default: taskScheduler } = await import("../services/taskScheduler.js");
      
      // Schedule immediate processing of daily insights
      await taskScheduler.scheduleTask(userId, "process_daily_insights", {
        sessionId: session._id.toString(),
        day: nextDay
      }, new Date(), 1); // High priority, immediate execution
      
      logger.info("Scheduled immediate analytics processing", { 
        userId, 
        sessionId: session._id.toString(),
        day: nextDay 
      });
    }
    
    // Check if session is ready for final report
    if (session.isReadyForFinalReport() && session.status !== "in_progress") {
      const { default: taskScheduler } = await import("../services/taskScheduler.js");
      
      await EmotionalAnalyticsSession.updateOne(
        { _id: session._id },
        { $set: { status: "in_progress" } }
      );
      
      await taskScheduler.scheduleTask(userId, "generate_weekly_report", {
        sessionId: session._id.toString()
      }, new Date(), 2);
      
      logger.info("Scheduled weekly report generation", { 
        userId, 
        sessionId: session._id.toString() 
      });
    }
    
  } catch (error) {
    logger.error("Error updating analytics for user", { 
      userId, 
      error: error.message 
    });
    throw error;
  }
}

console.log("✓Analytics helper function configured");
console.log("✓Analytics helper utilities initialization completed"); 