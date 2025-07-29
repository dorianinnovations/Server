import express from 'express';
import { protect } from '../middleware/auth.js';
import deletionQueueService from '../services/deletionQueueService.js';
import { HTTP_STATUS } from '../config/constants.js';
import { log } from '../utils/logger.js';

const router = express.Router();

/**
 * @route POST /deletion-queue/conversations/:id
 * @desc Queue single conversation for deletion
 * @access Private
 */
router.post('/conversations/:id', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    
    const task = await deletionQueueService.queueDeletion(
      userId,
      'delete_single_conversation',
      { conversationId },
      { priority: 1 }
    );
    
    res.json({
      success: true,
      message: 'Conversation queued for deletion',
      task: {
        id: task.taskId,
        status: task.status,
        message: task.message,
        estimatedDuration: task.estimatedDuration,
        queuePosition: task.queuePosition
      }
    });
    
  } catch (error) {
    log.error('Error queueing single conversation deletion:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to queue conversation for deletion'
    });
  }
});

/**
 * @route POST /deletion-queue/conversations/all
 * @desc Queue all conversations for deletion
 * @access Private
 */
router.post('/conversations/all', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const task = await deletionQueueService.queueDeletion(
      userId,
      'delete_all_conversations',
      { userId },
      { priority: 2 } // Higher priority for bulk operations
    );
    
    res.json({
      success: true,
      message: 'All conversations queued for deletion',
      task: {
        id: task.taskId,
        status: task.status,
        message: task.message,
        estimatedDuration: task.estimatedDuration,
        queuePosition: task.queuePosition
      }
    });
    
  } catch (error) {
    log.error('Error queueing all conversations deletion:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to queue conversations for deletion'
    });
  }
});

/**
 * @route POST /deletion-queue/user-data
 * @desc Queue complete user data clearance
 * @access Private
 */
router.post('/user-data', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { includeSettings = true } = req.body;
    
    const task = await deletionQueueService.queueDeletion(
      userId,
      'clear_user_data',
      { userId, includeSettings },
      { priority: 2 }
    );
    
    res.json({
      success: true,
      message: 'User data clearance queued',
      task: {
        id: task.taskId,
        status: task.status,
        message: task.message,
        estimatedDuration: task.estimatedDuration,
        queuePosition: task.queuePosition
      }
    });
    
  } catch (error) {
    log.error('Error queueing user data clearance:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to queue user data for clearance'
    });
  }
});

/**
 * @route GET /deletion-queue/status/:taskId
 * @desc Get status of a deletion task
 * @access Private
 */
router.get('/status/:taskId', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const taskId = req.params.taskId;
    
    const status = await deletionQueueService.getTaskStatus(taskId, userId);
    
    if (!status.found) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Task not found'
      });
    }
    
    res.json({
      success: true,
      task: status
    });
    
  } catch (error) {
    log.error('Error getting task status:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to get task status'
    });
  }
});

/**
 * @route GET /deletion-queue/tasks
 * @desc Get user's deletion tasks
 * @access Private
 */
router.get('/tasks', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    
    const tasks = await deletionQueueService.getUserTasks(userId, limit);
    
    res.json({
      success: true,
      tasks
    });
    
  } catch (error) {
    log.error('Error getting user tasks:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to get user tasks'
    });
  }
});

/**
 * @route GET /deletion-queue/stats
 * @desc Get queue statistics (admin only or for monitoring)
 * @access Private
 */
router.get('/stats', protect, async (req, res) => {
  try {
    const stats = await deletionQueueService.getQueueStats();
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    log.error('Error getting queue stats:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to get queue statistics'
    });
  }
});

export default router;