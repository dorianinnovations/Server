import express from "express";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";
import Task from "../models/Task.js";

const router = express.Router();

// Optimized task processing with batch operations and better queries
router.get("/run-tasks", protect, async (req, res) => {
  const userId = req.user.id;
  try {
    // Optimized query using the compound index
    const tasksToProcess = await Task.find({
      userId,
      status: "queued",
      runAt: { $lte: new Date() },
    })
      .sort({ priority: -1, runAt: 1 }) // Use compound index efficiently
      .limit(5)
      .lean(); // Use lean() for better performance

    if (tasksToProcess.length === 0) {
      return res.status(200).json({ 
        status: "success", 
        message: "No tasks to process.",
        processed: 0
      });
    }

    console.log(`Processing ${tasksToProcess.length} tasks for user ${userId}`);
    
    // Batch update tasks to processing status to prevent race conditions
    const taskIds = tasksToProcess.map(task => task._id);
    const updateResult = await Task.updateMany(
      { 
        _id: { $in: taskIds }, 
        status: "queued" 
      },
      { 
        $set: { status: "processing" } 
      }
    );

    console.log(`Updated ${updateResult.modifiedCount} tasks to processing status`);

    // Process tasks efficiently
    const results = await Promise.allSettled(
      tasksToProcess.map(task => processTask(task, userId))
    );

    // Prepare batch update operations
    const bulkOperations = [];
    const processedResults = [];

    results.forEach((result, index) => {
      const task = tasksToProcess[index];
      let taskStatus = "failed";
      let taskResult = "Task processing failed";

      if (result.status === 'fulfilled' && result.value) {
        taskStatus = result.value.status;
        taskResult = result.value.result;
      } else if (result.status === 'rejected') {
        taskResult = `Task failed: ${result.reason}`;
      }

      // Add to bulk operations
      bulkOperations.push({
        updateOne: {
          filter: { _id: task._id },
          update: { 
            $set: { 
              status: taskStatus, 
              result: taskResult,
              completedAt: new Date()
            } 
          }
        }
      });

      processedResults.push({
        taskId: task._id,
        taskType: task.taskType,
        status: taskStatus,
        result: taskResult,
      });
    });

    // Batch update all task results
    if (bulkOperations.length > 0) {
      await Task.bulkWrite(bulkOperations);
    }

    console.log(`Completed processing ${processedResults.length} tasks`);

    res.status(200).json({ 
      status: "success", 
      message: "Tasks processed.", 
      processed: processedResults.length,
      results: processedResults 
    });

  } catch (err) {
    console.error("Error in /run-tasks endpoint:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Error running background tasks.",
      error: err.message
    });
  }
});

// Optimized task processing function
async function processTask(task, userId) {
  const startTime = Date.now();
  console.log(`Processing task: ${task.taskType} (ID: ${task._id})`);

  try {
    let taskResult = "Task completed successfully.";
    let taskStatus = "completed";

    switch (task.taskType) {
      case "summarize_expenses":
        // Simulate async work with timeout
        await new Promise((resolve) => setTimeout(resolve, 1000));
        taskResult = `Your weekly expenses summary: Groceries $150, Utilities $80, Entertainment $50.`;
        break;

      case "send_email_summary":
        // Simulate async work with timeout
        await new Promise((resolve) => setTimeout(resolve, 1500));
        taskResult = `Summary of important unread emails: Meeting reminder from John, Project update from Sarah.`;
        break;

      case "summarize_emotions":
        // Optimized emotion summary with lean query
        const userEmotions = await User.findById(userId)
          .select("emotionalLog")
          .lean();
        
        if (userEmotions?.emotionalLog?.length > 0) {
          const recentEmotions = userEmotions.emotionalLog
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 5)
            .map(e => `${e.emotion} on ${new Date(e.timestamp).toLocaleDateString()}`)
            .join(", ");
          taskResult = `Your recent emotional trends include: ${recentEmotions}.`;
        } else {
          taskResult = "No emotional history to summarize.";
        }
        break;

      case "schedule_organization":
        // New task type for schedule organization
        const parameters = task.parameters || {};
        await new Promise((resolve) => setTimeout(resolve, 800));
        taskResult = `Schedule organized for ${parameters.scope || 'general'} context: ${parameters.context || 'work'}. Suggested time blocks have been created.`;
        break;

      case "mood_analysis":
        // New task type for mood analysis
        await new Promise((resolve) => setTimeout(resolve, 1200));
        taskResult = `Mood analysis complete. Patterns identified in your emotional data suggest focusing on stress management techniques.`;
        break;

      case "process_daily_insights":
        // Process daily emotional insights using taskScheduler
        const { default: taskScheduler } = await import("../services/taskScheduler.js");
        taskResult = await taskScheduler.processDailyInsights(userId, task.parameters);
        break;

      case "generate_weekly_report":
        // Generate weekly report using taskScheduler
        const { default: taskSchedulerWeekly } = await import("../services/taskScheduler.js");
        taskResult = await taskSchedulerWeekly.generateWeeklyReport(userId, task.parameters);
        break;

      default:
        taskResult = `Unknown task type: ${task.taskType}. Please check task configuration.`;
        taskStatus = "failed";
        console.warn(`Unknown task type: ${task.taskType}`);
        break;
    }

    const duration = Date.now() - startTime;
    console.log(`Task ${task.taskType} completed in ${duration}ms`);

    return { status: taskStatus, result: taskResult };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Task ${task._id} failed after ${duration}ms:`, error);
    return { 
      status: "failed", 
      result: `Task processing error: ${error.message}` 
    };
  }
}

// New endpoint to get task status for a user
router.get("/tasks/status", protect, async (req, res) => {
  const userId = req.user.id;
  const { limit = 10, status, taskType } = req.query;

  try {
    const filter = { userId };
    if (status) filter.status = status;
    if (taskType) filter.taskType = taskType;

    const tasks = await Task.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('taskType status result createdAt runAt priority')
      .lean();

    const taskStats = await Task.aggregate([
      { $match: { userId } },
      { 
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      status: "success",
      tasks,
      stats: taskStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      total: tasks.length
    });

  } catch (error) {
    console.error("Error fetching task status:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch task status",
      error: error.message
    });
  }
});

// New endpoint to cancel/delete tasks
router.delete("/tasks/:taskId", protect, async (req, res) => {
  const userId = req.user.id;
  const { taskId } = req.params;

  try {
    const result = await Task.findOneAndDelete({ 
      _id: taskId, 
      userId, 
      status: { $in: ["queued", "failed"] } // Only allow deletion of queued or failed tasks
    });

    if (!result) {
      return res.status(404).json({
        status: "error",
        message: "Task not found or cannot be deleted (task may be processing or completed)"
      });
    }

    res.json({
      status: "success",
      message: "Task deleted successfully",
      deletedTask: {
        id: result._id,
        taskType: result.taskType,
        status: result.status
      }
    });

  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to delete task",
      error: error.message
    });
  }
});

export default router; 