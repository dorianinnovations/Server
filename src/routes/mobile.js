import express from 'express';
import { body, validationResult } from 'express-validator';
import { protect as authenticateToken } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import redisService from '../services/redisService.js';
import websocketService from '../services/websocketService.js';
import User from '../models/User.js';
import EmotionalAnalyticsSession from '../models/EmotionalAnalyticsSession.js';

const router = express.Router();

/**
 * Mobile-Optimized API Routes
 * Designed for mobile app performance with batching, caching, and real-time features
 */

/**
 * @route POST /mobile/batch
 * @desc Execute multiple API requests in a single batch
 * @access Private
 */
router.post('/mobile/batch', 
  authenticateToken,
  body('requests').isArray().withMessage('Requests must be an array'),
  body('requests.*.endpoint').notEmpty().withMessage('Each request must have an endpoint'),
  body('requests.*.method').isIn(['GET', 'POST', 'PUT', 'DELETE']).withMessage('Invalid HTTP method'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { requests } = req.body;
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const results = [];

      // Process up to 10 requests per batch
      const limitedRequests = requests.slice(0, 10);

      for (const request of limitedRequests) {
        try {
          const { endpoint, method, data, headers } = request;
          let result;

          // Route to appropriate handler based on endpoint
          switch (endpoint) {
            case '/profile':
              result = await handleProfileRequest(req.user.userId, method, data);
              break;
            case '/emotions':
              result = await handleEmotionsRequest(req.user.userId, method, data);
              break;
            case '/analytics/insights':
              result = await handleAnalyticsRequest(req.user.userId, method, data);
              break;
            case '/chat/history':
              result = await handleChatHistoryRequest(req.user.userId, method, data);
              break;
            case '/cloud/events':
              result = await handleCloudEventsRequest(req.user.userId, method, data);
              break;
            default:
              result = {
                success: false,
                error: `Endpoint ${endpoint} not supported in batch mode`
              };
          }

          results.push({
            endpoint,
            method,
            success: result.success,
            data: result.data,
            error: result.error,
            timestamp: new Date()
          });

        } catch (error) {
          results.push({
            endpoint: request.endpoint,
            method: request.method,
            success: false,
            error: error.message,
            timestamp: new Date()
          });
        }
      }

      // Cache batch results for 5 minutes
      await redisService.set(`batch:${batchId}`, results, 300);

      res.json({
        success: true,
        batchId,
        results,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Batch API error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

/**
 * @route GET /mobile/sync
 * @desc Get incremental sync data for mobile app
 * @access Private
 */
router.get('/mobile/sync', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { lastSync, dataTypes } = req.query;
    const syncKey = `sync:${userId}`;

    // Parse last sync timestamp
    const lastSyncDate = lastSync ? new Date(lastSync) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Get cached sync data
    const cachedSync = await redisService.get(syncKey);
    
    const syncData = {
      timestamp: new Date(),
      lastSync: lastSyncDate,
      data: {}
    };

    // Define what data types to sync
    const requestedTypes = dataTypes ? dataTypes.split(',') : ['profile', 'emotions', 'conversations', 'analytics'];

    // Sync user profile if requested
    if (requestedTypes.includes('profile')) {
      const user = await User.findById(userId).select('-password');
      syncData.data.profile = {
        updated: user.updatedAt > lastSyncDate,
        data: user.updatedAt > lastSyncDate ? user : null
      };
    }

    // Sync emotions if requested
    if (requestedTypes.includes('emotions')) {
      const recentEmotions = await EmotionalAnalyticsSession.find({
        userId,
        createdAt: { $gte: lastSyncDate }
      }).sort({ createdAt: -1 }).limit(100);

      syncData.data.emotions = {
        updated: recentEmotions.length > 0,
        data: recentEmotions,
        count: recentEmotions.length
      };
    }

    // Sync conversations if requested
    if (requestedTypes.includes('conversations')) {
      // This would integrate with conversation storage
      syncData.data.conversations = {
        updated: false,
        data: [],
        message: 'Conversation sync will be implemented with conversation storage'
      };
    }

    // Sync analytics if requested
    if (requestedTypes.includes('analytics')) {
      const analyticsKey = `analytics:${userId}`;
      const cachedAnalytics = await redisService.get(analyticsKey);
      
      syncData.data.analytics = {
        updated: !cachedAnalytics,
        data: cachedAnalytics || null,
        cached: !!cachedAnalytics
      };
    }

    // Cache sync response for 2 minutes
    await redisService.set(syncKey, syncData, 120);

    res.json({
      success: true,
      ...syncData
    });

  } catch (error) {
    logger.error('Mobile sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Sync failed'
    });
  }
});

/**
 * @route POST /mobile/offline-queue
 * @desc Process offline queue items
 * @access Private
 */
router.post('/mobile/offline-queue',
  authenticateToken,
  body('items').isArray().withMessage('Items must be an array'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { items } = req.body;
      const userId = req.user.id;
      const processed = [];
      const failed = [];

      for (const item of items) {
        try {
          const { id, endpoint, method, data, timestamp, priority } = item;
          
          // Check if item is too old (7 days)
          const itemDate = new Date(timestamp);
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          
          if (itemDate < sevenDaysAgo) {
            failed.push({
              id,
              error: 'Item too old',
              timestamp: new Date()
            });
            continue;
          }

          // Process based on endpoint
          let result;
          switch (endpoint) {
            case '/emotions':
              result = await handleEmotionsRequest(userId, method, data);
              break;
            case '/analytics/session':
              result = await handleAnalyticsRequest(userId, method, data);
              break;
            case '/cloud/events':
              result = await handleCloudEventsRequest(userId, method, data);
              break;
            default:
              result = {
                success: false,
                error: `Endpoint ${endpoint} not supported in offline queue`
              };
          }

          if (result.success) {
            processed.push({
              id,
              endpoint,
              timestamp: new Date()
            });
          } else {
            failed.push({
              id,
              endpoint,
              error: result.error,
              timestamp: new Date()
            });
          }

        } catch (error) {
          failed.push({
            id: item.id,
            endpoint: item.endpoint,
            error: error.message,
            timestamp: new Date()
          });
        }
      }

      res.json({
        success: true,
        processed: processed.length,
        failed: failed.length,
        results: {
          processed,
          failed
        }
      });

    } catch (error) {
      logger.error('Offline queue processing error:', error);
      res.status(500).json({
        success: false,
        error: 'Queue processing failed'
      });
    }
  }
);

/**
 * @route GET /mobile/realtime-status
 * @desc Get real-time connection status and user presence
 * @access Private
 */
router.get('/mobile/realtime-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const isOnline = websocketService.isUserOnline(userId);
    const connectionInfo = websocketService.getUserConnection(userId);
    const serverStats = websocketService.getServerStats();

    res.json({
      success: true,
      user: {
        id: userId,
        isOnline,
        connectionInfo: connectionInfo ? {
          connectedAt: connectionInfo.connectedAt,
          lastActivity: connectionInfo.lastActivity,
          status: connectionInfo.status || 'online'
        } : null
      },
      server: {
        connectedUsers: serverStats.connectedUsers,
        uptime: serverStats.serverUptime
      },
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Real-time status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get real-time status'
    });
  }
});

/**
 * @route POST /mobile/push-token
 * @desc Register push notification token
 * @access Private
 */
router.post('/mobile/push-token',
  authenticateToken,
  body('token').notEmpty().withMessage('Push token is required'),
  body('platform').isIn(['ios', 'android']).withMessage('Platform must be ios or android'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { token, platform } = req.body;
      const userId = req.user.id;

      // Update user with push token
      await User.findByIdAndUpdate(userId, {
        $set: {
          pushToken: token,
          platform,
          pushTokenUpdatedAt: new Date()
        }
      });

      // Store in Redis for quick access
      await redisService.set(`push:${userId}`, { token, platform }, 86400 * 30); // 30 days

      res.json({
        success: true,
        message: 'Push token registered successfully'
      });

    } catch (error) {
      logger.error('Push token registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to register push token'
      });
    }
  }
);

/**
 * @route GET /mobile/app-config
 * @desc Get mobile app configuration
 * @access Private
 */
router.get('/mobile/app-config', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const configKey = `config:mobile:${userId}`;
    
    // Check cache first
    const cachedConfig = await redisService.get(configKey);
    if (cachedConfig) {
      return res.json({
        success: true,
        ...cachedConfig,
        cached: true
      });
    }

    // Get user preferences
    const user = await User.findById(userId).select('preferences settings');
    
    const config = {
      features: {
        realTimeChat: true,
        offlineMode: true,
        pushNotifications: true,
        analyticsLLM: true,
        cloudEvents: true,
        emotionalTracking: true,
        adaptivePersonality: true
      },
      limits: {
        batchRequestLimit: 10,
        offlineQueueLimit: 100,
        messageLengthLimit: 2000,
        fileUploadLimit: 5242880 // 5MB
      },
      endpoints: {
        websocket: process.env.WEBSOCKET_URL || 'ws://localhost:5000',
        api: process.env.API_URL || 'http://localhost:5000',
        cdn: process.env.CDN_URL || null
      },
      user: {
        preferences: user?.preferences || {},
        settings: user?.settings || {}
      },
      version: '1.0.0',
      timestamp: new Date()
    };

    // Cache for 1 hour
    await redisService.set(configKey, config, 3600);

    res.json({
      success: true,
      ...config
    });

  } catch (error) {
    logger.error('App config error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get app config'
    });
  }
});

// Helper functions for batch processing
async function handleProfileRequest(userId, method, data) {
  try {
    if (method === 'GET') {
      const user = await User.findById(userId).select('-password');
      return { success: true, data: user };
    }
    
    if (method === 'PUT') {
      const updatedUser = await User.findByIdAndUpdate(userId, data, { new: true }).select('-password');
      return { success: true, data: updatedUser };
    }
    
    return { success: false, error: 'Method not supported' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleEmotionsRequest(userId, method, data) {
  try {
    if (method === 'POST') {
      const emotionData = {
        userId,
        ...data,
        timestamp: new Date()
      };
      
      const session = new EmotionalAnalyticsSession(emotionData);
      await session.save();
      
      // Notify via WebSocket
      websocketService.sendToUser(userId, 'emotion_saved', emotionData);
      
      return { success: true, data: session };
    }
    
    if (method === 'GET') {
      const emotions = await EmotionalAnalyticsSession.find({ userId })
        .sort({ createdAt: -1 })
        .limit(50);
      return { success: true, data: emotions };
    }
    
    return { success: false, error: 'Method not supported' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleAnalyticsRequest(userId, method, data) {
  try {
    if (method === 'POST') {
      const cacheKey = `analytics:${userId}`;
      const cachedData = await redisService.get(cacheKey);
      
      if (cachedData) {
        return { success: true, data: cachedData };
      }
      
      // Generate analytics using LLM
      const analyticsData = {
        userId,
        insights: 'Analytics will be generated using LLM service',
        timestamp: new Date()
      };
      
      await redisService.set(cacheKey, analyticsData, 3600);
      return { success: true, data: analyticsData };
    }
    
    return { success: false, error: 'Method not supported' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleChatHistoryRequest(userId, method, data) {
  try {
    const cacheKey = `chat:${userId}`;
    const cachedHistory = await redisService.get(cacheKey);
    
    if (cachedHistory) {
      return { success: true, data: cachedHistory };
    }
    
    // This would integrate with conversation storage
    const chatHistory = {
      userId,
      conversations: [],
      message: 'Chat history will be implemented with conversation storage'
    };
    
    return { success: true, data: chatHistory };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleCloudEventsRequest(userId, method, data) {
  try {
    if (method === 'GET') {
      const events = []; // This would fetch from cloud events storage
      return { success: true, data: events };
    }
    
    if (method === 'POST') {
      // This would create a new cloud event
      const event = {
        id: `event_${Date.now()}`,
        ...data,
        createdBy: userId,
        createdAt: new Date()
      };
      
      return { success: true, data: event };
    }
    
    return { success: false, error: 'Method not supported' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export default router;