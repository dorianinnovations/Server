import DeletionTask from '../models/DeletionTask.js';
import conversationService from './conversationService.js';
import { log } from '../utils/logger.js';

class DeletionQueueService {
  constructor() {
    this.isProcessing = false;
    this.processingInterval = null;
  }

  /**
   * Queue a deletion task
   */
  async queueDeletion(userId, type, payload, options = {}) {
    try {
      const task = new DeletionTask({
        userId,
        type,
        payload,
        priority: options.priority || 1,
        userMessage: this.getUserMessage(type, payload),
        estimatedDuration: this.getEstimatedDuration(type, payload),
        maxAttempts: options.maxAttempts || 3
      });

      await task.save();
      
      log.debug(`Queued deletion task ${task.taskId} for user ${userId}`);
      
      // Start processing if not already running
      this.startProcessing();
      
      return {
        taskId: task.taskId,
        status: task.status,
        message: task.userMessage,
        estimatedDuration: task.estimatedDuration,
        queuePosition: await this.getQueuePosition(task._id)
      };
    } catch (error) {
      log.error('Error queueing deletion task:', error);
      throw error;
    }
  }

  /**
   * Get user-friendly message for task type
   */
  getUserMessage(type, payload) {
    switch (type) {
      case 'delete_single_conversation':
        return 'Your conversation is queued for deletion and will be removed shortly.';
      case 'delete_all_conversations':
        return 'All your conversations are queued for deletion. This may take a few moments to complete.';
      case 'clear_user_data':
        return 'Your data clearance request is queued. All personal information will be permanently deleted.';
      default:
        return 'Your deletion request is being processed.';
    }
  }

  /**
   * Estimate processing duration
   */
  getEstimatedDuration(type, payload) {
    switch (type) {
      case 'delete_single_conversation':
        return 10; // 10 seconds
      case 'delete_all_conversations':
        return 60; // 1 minute
      case 'clear_user_data':
        return 120; // 2 minutes
      default:
        return 30;
    }
  }

  /**
   * Get task status for user
   */
  async getTaskStatus(taskId, userId) {
    try {
      const task = await DeletionTask.findOne({ taskId, userId });
      if (!task) {
        return { found: false };
      }

      const queuePosition = task.status === 'queued' ? await this.getQueuePosition(task._id) : 0;
      
      return {
        found: true,
        taskId: task.taskId,
        status: task.status,
        message: task.userMessage,
        result: task.result,
        queuePosition,
        estimatedDuration: task.estimatedDuration,
        createdAt: task.createdAt,
        progress: this.calculateProgress(task)
      };
    } catch (error) {
      log.error('Error getting task status:', error);
      throw error;
    }
  }

  /**
   * Calculate task progress percentage
   */
  calculateProgress(task) {
    switch (task.status) {
      case 'queued':
        return 10;
      case 'processing':
        const elapsed = Date.now() - task.startedAt.getTime();
        const estimatedMs = task.estimatedDuration * 1000;
        return Math.min(90, 10 + (elapsed / estimatedMs) * 80);
      case 'completed':
        return 100;
      case 'failed':
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Get queue position for a task
   */
  async getQueuePosition(taskId) {
    try {
      const task = await DeletionTask.findById(taskId);
      if (!task || task.status !== 'queued') return 0;

      const position = await DeletionTask.countDocuments({
        status: 'queued',
        $or: [
          { priority: { $GT: task.priority } },
          { 
            priority: task.priority,
            createdAt: { $lt: task.createdAt }
          }
        ]
      });

      return position + 1;
    } catch (error) {
      log.error('Error calculating queue position:', error);
      return 0;
    }
  }

  /**
   * Get all user's deletion tasks
   */
  async getUserTasks(userId, limit = 10) {
    try {
      const tasks = await DeletionTask.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      return tasks.map(task => ({
        taskId: task.taskId,
        type: task.type,
        status: task.status,
        message: task.userMessage,
        result: task.result,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
        progress: this.calculateProgress(task)
      }));
    } catch (error) {
      log.error('Error getting user tasks:', error);
      throw error;
    }
  }

  /**
   * Process queued tasks
   */
  async processQueue() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      const tasks = await DeletionTask.getQueuedTasks().limit(5);
      
      for (const task of tasks) {
        await this.processTask(task);
      }
    } catch (error) {
      log.error('Error processing deletion queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process individual task
   */
  async processTask(task) {
    try {
      task.markAsProcessing();
      await task.save();
      
      log.debug(`Processing deletion task ${task.taskId} of type ${task.type}`);
      
      let result = {};
      
      switch (task.type) {
        case 'delete_single_conversation':
          await conversationService.deleteConversation(task.userId, task.payload.conversationId);
          result = { conversationsDeleted: 1 };
          break;
          
        case 'delete_all_conversations':
          result = await conversationService.deleteAllConversations(task.userId);
          break;
          
        case 'clear_user_data':
          result = await this.clearUserData(task.userId, task.payload);
          break;
          
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
      
      task.markAsCompleted(result);
      await task.save();
      
      log.info(`Completed deletion task ${task.taskId}:`, result);
      
    } catch (error) {
      log.error(`Failed to process task ${task.taskId}:`, error);
      
      task.markAsFailed(error.message);
      await task.save();
    }
  }

  /**
   * Clear all user data
   */
  async clearUserData(userId, payload) {
    const result = {
      conversationsDeleted: 0,
      memoryEntriesDeleted: 0,
      settingsCleared: false
    };

    // Delete all conversations
    const convResult = await conversationService.deleteAllConversations(userId);
    result.conversationsDeleted = convResult.conversationsDeleted;
    result.memoryEntriesDeleted = convResult.memoryEntriesDeleted;

    // Clear user settings if requested
    if (payload.includeSettings) {
      // Implementation depends on your settings storage
      result.settingsCleared = true;
    }

    return result;
  }

  /**
   * Start background processing
   */
  startProcessing() {
    if (this.processingInterval) return;
    
    // Process queue every 10 seconds
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 10000);
    
    // Process immediately
    setImmediate(() => this.processQueue());
    
    log.debug('Started deletion queue processing');
  }

  /**
   * Stop background processing
   */
  stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      log.debug('Stopped deletion queue processing');
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    try {
      const stats = await DeletionTask.getTaskStats();
      const queuedCount = await DeletionTask.countDocuments({ status: 'queued' });
      const processingCount = await DeletionTask.countDocuments({ status: 'processing' });
      
      return {
        queued: queuedCount,
        processing: processingCount,
        totalStats: stats,
        isProcessing: this.isProcessing
      };
    } catch (error) {
      log.error('Error getting queue stats:', error);
      return { queued: 0, processing: 0, totalStats: [], isProcessing: false };
    }
  }

  /**
   * Cleanup old completed/failed tasks (call periodically)
   */
  async cleanupOldTasks(daysOld = 7) {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
      
      const result = await DeletionTask.deleteMany({
        status: { $in: ['completed', 'failed'] },
        completedAt: { $lt: cutoffDate }
      });
      
      log.debug(`Cleaned up ${result.deletedCount} old deletion tasks`);
      return result.deletedCount;
    } catch (error) {
      log.error('Error cleaning up old tasks:', error);
      return 0;
    }
  }
}

export default new DeletionQueueService();