import express from 'express';
import { protect } from '../middleware/auth.js';
import User from '../models/User.js';
import ShortTermMemory from '../models/ShortTermMemory.js';
import Task from '../models/Task.js';
import UserBehaviorProfile from '../models/UserBehaviorProfile.js';
import EmotionalAnalyticsSession from '../models/EmotionalAnalyticsSession.js';
import { HTTP_STATUS, MESSAGES } from '../config/constants.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * Data Cleanup Routes - Server-side data management
 * 
 * CRITICAL: These routes handle comprehensive data cleanup and auditing
 * Used for development, testing, and privacy compliance
 */

// Get data audit for current user
router.get('/audit', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all user data
    const [user, memories, tasks, behaviorProfile, emotionalSessions] = await Promise.all([
      User.findById(userId).select('-password'),
      ShortTermMemory.find({ userId }).sort({ timestamp: -1 }),
      Task.find({ userId }).sort({ createdAt: -1 }),
      UserBehaviorProfile.findOne({ userId }),
      EmotionalAnalyticsSession.find({ userId }).sort({ weekStartDate: -1 })
    ]);

    // Calculate storage usage
    const dataSize = {
      user: JSON.stringify(user).length,
      memories: memories.reduce((sum, m) => sum + JSON.stringify(m).length, 0),
      tasks: tasks.reduce((sum, t) => sum + JSON.stringify(t).length, 0),
      behaviorProfile: behaviorProfile ? JSON.stringify(behaviorProfile).length : 0,
      emotionalSessions: emotionalSessions.reduce((sum, e) => sum + JSON.stringify(e).length, 0)
    };

    const totalSize = Object.values(dataSize).reduce((sum, size) => sum + size, 0);

    res.json({
      status: MESSAGES.SUCCESS,
      data: {
        userId,
        userEmail: user?.email,
        accountCreated: user?.createdAt,
        counts: {
          memories: memories.length,
          tasks: tasks.length,
          behaviorProfile: behaviorProfile ? 1 : 0,
          emotionalSessions: emotionalSessions.length
        },
        dataSize: {
          ...dataSize,
          total: totalSize,
          totalFormatted: formatBytes(totalSize)
        },
        preview: {
          recentMemories: memories.slice(0, 5).map(m => ({
            timestamp: m.timestamp,
            role: m.role,
            contentLength: m.content?.length || 0
          })),
          recentTasks: tasks.slice(0, 5).map(t => ({
            createdAt: t.createdAt,
            taskType: t.taskType,
            status: t.status
          })),
          behaviorProfile: behaviorProfile ? {
            createdAt: behaviorProfile.createdAt,
            updatedAt: behaviorProfile.updatedAt,
            patternsCount: behaviorProfile.behaviorPatterns?.length || 0,
            traitsCount: behaviorProfile.personalityTraits?.length || 0
          } : null,
          emotionalSessions: emotionalSessions.slice(0, 3).map(e => ({
            weekStartDate: e.weekStartDate,
            primaryEmotion: e.primaryEmotion,
            totalInteractions: e.totalInteractions
          }))
        }
      }
    });

  } catch (error) {
    logger.error('Data audit error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: MESSAGES.ERROR,
      message: 'Failed to perform data audit'
    });
  }
});

// Get system-wide data statistics (admin only)
router.get('/system-audit', protect, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        status: MESSAGES.ERROR,
        message: 'Admin access required'
      });
    }

    // Get system-wide statistics
    const [
      userCount,
      memoryCount,
      taskCount,
      behaviorProfileCount,
      emotionalSessionCount
    ] = await Promise.all([
      User.countDocuments(),
      ShortTermMemory.countDocuments(),
      Task.countDocuments(),
      UserBehaviorProfile.countDocuments(),
      EmotionalAnalyticsSession.countDocuments()
    ]);

    // Get users with most data
    const usersWithMostMemories = await ShortTermMemory.aggregate([
      { $group: { _id: '$userId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get oldest and newest users
    const oldestUser = await User.findOne().sort({ createdAt: 1 }).select('email createdAt');
    const newestUser = await User.findOne().sort({ createdAt: -1 }).select('email createdAt');

    res.json({
      status: MESSAGES.SUCCESS,
      data: {
        systemStats: {
          totalUsers: userCount,
          totalMemories: memoryCount,
          totalTasks: taskCount,
          totalBehaviorProfiles: behaviorProfileCount,
          totalEmotionalSessions: emotionalSessionCount
        },
        userStats: {
          oldestUser,
          newestUser,
          usersWithMostMemories
        },
        auditTimestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('System audit error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: MESSAGES.ERROR,
      message: 'Failed to perform system audit'
    });
  }
});

// Clean up orphaned data
router.post('/cleanup-orphaned', protect, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        status: MESSAGES.ERROR,
        message: 'Admin access required'
      });
    }

    // Find all user IDs
    const userIds = await User.find().distinct('_id');
    const userIdStrings = userIds.map(id => id.toString());

    // Find orphaned data
    const orphanedMemories = await ShortTermMemory.find({
      userId: { $nin: userIdStrings }
    });

    const orphanedTasks = await Task.find({
      userId: { $nin: userIdStrings }
    });

    const orphanedBehaviorProfiles = await UserBehaviorProfile.find({
      userId: { $nin: userIdStrings }
    });

    const orphanedEmotionalSessions = await EmotionalAnalyticsSession.find({
      userId: { $nin: userIdStrings }
    });

    // Delete orphaned data
    const cleanupResults = await Promise.allSettled([
      ShortTermMemory.deleteMany({ userId: { $nin: userIdStrings } }),
      Task.deleteMany({ userId: { $nin: userIdStrings } }),
      UserBehaviorProfile.deleteMany({ userId: { $nin: userIdStrings } }),
      EmotionalAnalyticsSession.deleteMany({ userId: { $nin: userIdStrings } })
    ]);

    const deletedCounts = {
      memories: cleanupResults[0].status === 'fulfilled' ? cleanupResults[0].value.deletedCount : 0,
      tasks: cleanupResults[1].status === 'fulfilled' ? cleanupResults[1].value.deletedCount : 0,
      behaviorProfiles: cleanupResults[2].status === 'fulfilled' ? cleanupResults[2].value.deletedCount : 0,
      emotionalSessions: cleanupResults[3].status === 'fulfilled' ? cleanupResults[3].value.deletedCount : 0
    };

    logger.info('Orphaned data cleanup completed', {
      deletedCounts,
      orphanedFound: {
        memories: orphanedMemories.length,
        tasks: orphanedTasks.length,
        behaviorProfiles: orphanedBehaviorProfiles.length,
        emotionalSessions: orphanedEmotionalSessions.length
      }
    });

    res.json({
      status: MESSAGES.SUCCESS,
      message: 'Orphaned data cleanup completed',
      deletedCounts
    });

  } catch (error) {
    logger.error('Orphaned data cleanup error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: MESSAGES.ERROR,
      message: 'Failed to cleanup orphaned data'
    });
  }
});

// Clean up old data (admin only)
router.post('/cleanup-old', protect, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        status: MESSAGES.ERROR,
        message: 'Admin access required'
      });
    }

    const { daysOld = 90 } = req.body;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Delete old data
    const cleanupResults = await Promise.allSettled([
      ShortTermMemory.deleteMany({ timestamp: { $lt: cutoffDate } }),
      Task.deleteMany({ createdAt: { $lt: cutoffDate } }),
      EmotionalAnalyticsSession.deleteMany({ weekStartDate: { $lt: cutoffDate } })
    ]);

    const deletedCounts = {
      memories: cleanupResults[0].status === 'fulfilled' ? cleanupResults[0].value.deletedCount : 0,
      tasks: cleanupResults[1].status === 'fulfilled' ? cleanupResults[1].value.deletedCount : 0,
      emotionalSessions: cleanupResults[2].status === 'fulfilled' ? cleanupResults[2].value.deletedCount : 0
    };

    logger.info('Old data cleanup completed', {
      daysOld,
      cutoffDate,
      deletedCounts
    });

    res.json({
      status: MESSAGES.SUCCESS,
      message: `Old data cleanup completed (${daysOld} days+)`,
      deletedCounts
    });

  } catch (error) {
    logger.error('Old data cleanup error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: MESSAGES.ERROR,
      message: 'Failed to cleanup old data'
    });
  }
});

// Helper function to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default router;