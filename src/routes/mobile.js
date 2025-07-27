import express from 'express';
import { body, validationResult } from 'express-validator';
import { protect as authenticateToken } from '../middleware/auth.js';
import { visionRateLimit, uploadRateLimit } from '../middleware/uploadRateLimit.js';
import { trackUploadMetrics, uploadMetrics } from '../middleware/uploadMetrics.js';
import logger from '../utils/logger.js';
import redisService from '../services/redisService.js';
import websocketService from '../services/websocketService.js';
import User from '../models/User.js';
import multer from 'multer';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import fs from 'fs/promises';
import path from 'path';

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
    const requestedTypes = dataTypes ? dataTypes.split(',') : ['profile', 'conversations', 'analytics'];

    // Sync user profile if requested
    if (requestedTypes.includes('profile')) {
      const user = await User.findById(userId).select('-password');
      syncData.data.profile = {
        updated: user.updatedAt > lastSyncDate,
        data: user.updatedAt > lastSyncDate ? user : null
      };
    }


    // Sync conversations if requested
    if (requestedTypes.includes('conversations')) {
      try {
        const conversationService = (await import('../services/conversationService.js')).default;
        const conversations = await conversationService.getUserConversations(userId, {
          page: 1,
          limit: 10,
          includeArchived: false
        });
        
        syncData.data.conversations = {
          updated: true,
          data: conversations.conversations,
          hasMore: conversations.pagination.pages > 1,
          totalCount: conversations.pagination.total
        };
      } catch (error) {
        syncData.data.conversations = {
          updated: false,
          data: [],
          error: 'Failed to sync conversations'
        };
      }
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

/**
 * @route GET /mobile/profile-header
 * @desc Get profile header data optimized for mobile display
 * @access Private
 */
router.get('/mobile/profile-header', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const cacheKey = `profile-header:${userId}`;
    
    // Check cache first
    const cachedData = await redisService.get(cacheKey);
    if (cachedData) {
      return res.json({
        success: true,
        ...cachedData,
        cached: true
      });
    }

    // Get user data
    const user = await User.findById(userId).select('-password -__v');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get tier information
    const { getUserTier, getTierLimits } = await import('../config/tiers.js');
    const userTier = getUserTier(user);
    const tierLimits = getTierLimits(user);

    // Prepare profile header data
    const profileHeader = {
      user: {
        id: user._id,
        email: user.email,
        username: user.profile?.get('username') || user.email.split('@')[0],
        displayName: user.profile?.get('displayName') || user.profile?.get('username') || user.email.split('@')[0]
      },
      profilePicture: {
        url: user.profile?.get('profilePicture') || null,
        updatedAt: user.profile?.get('profilePictureUpdated') || null,
        defaultAvatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&size=300&background=6366f1&color=white&rounded=true`
      },
      header: {
        style: 'rectangle',
        backgroundColor: '#f8fafc',
        gradientColors: ['#6366f1', '#8b5cf6'],
        height: 200,
        profilePosition: 'left',
        profileSize: 80,
        profileBorderColor: '#ffffff',
        profileBorderWidth: 3
      },
      tier: {
        name: tierLimits.name,
        level: userTier,
        color: userTier === 'aether' ? '#fbbf24' : userTier === 'pro' ? '#8b5cf6' : '#6b7280',
        features: tierLimits.features
      },
      stats: {
        joinedDate: user.createdAt,
        lastActive: user.updatedAt,
        sessionCount: user.profile?.get('sessionCount') || 0,
        totalInteractions: user.profile?.get('totalInteractions') || 0
      },
      canUpload: true, // All users can upload profile pictures
      uploadEndpoint: '/profile/picture',
      maxFileSize: '5MB'
    };

    // Cache for 15 minutes
    await redisService.set(cacheKey, profileHeader, 900);

    res.json({
      success: true,
      ...profileHeader
    });

  } catch (error) {
    logger.error('Profile header error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get profile header data'
    });
  }
});

/**
 * @route PUT /mobile/profile-header
 * @desc Update profile header settings
 * @access Private
 */
router.put('/mobile/profile-header', 
  authenticateToken,
  body('displayName').optional().isLength({ min: 1, max: 50 }).withMessage('Display name must be 1-50 characters'),
  body('username').optional().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const userId = req.user.userId;
      const { displayName, username } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Update profile data
      if (!user.profile) {
        user.profile = new Map();
      }

      if (displayName) {
        user.profile.set('displayName', displayName);
      }
      
      if (username) {
        // Check if username is already taken
        const existingUser = await User.findOne({
          'profile.username': username,
          _id: { $ne: userId }
        });
        
        if (existingUser) {
          return res.status(400).json({
            success: false,
            error: 'Username already taken'
          });
        }
        
        user.profile.set('username', username);
      }

      user.markModified('profile');
      await user.save();

      // Clear cache
      await redisService.delete(`profile-header:${userId}`);

      res.json({
        success: true,
        message: 'Profile header updated successfully',
        data: {
          displayName: user.profile?.get('displayName'),
          username: user.profile?.get('username')
        }
      });

    } catch (error) {
      logger.error('Profile header update error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update profile header'
      });
    }
  }
);

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


async function handleAnalyticsRequest(userId, method, _data) {
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

async function handleChatHistoryRequest(userId, _method, _data) {
  try {
    const cacheKey = `chat:${userId}`;
    const cachedHistory = await redisService.get(cacheKey);
    
    if (cachedHistory) {
      return { success: true, data: cachedHistory };
    }
    
    // Get conversation history from persistent storage
    const conversationService = (await import('../services/conversationService.js')).default;
    const conversations = await conversationService.getUserConversations(userId, {
      page: 1,
      limit: 20,
      includeArchived: false
    });
    
    const chatHistory = {
      userId,
      conversations: conversations.conversations,
      pagination: conversations.pagination,
      lastUpdated: new Date()
    };
    
    // Cache for 5 minutes
    await redisService.set(cacheKey, chatHistory, 300);
    
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

// File upload configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Only one file at a time
  },
  fileFilter: (req, file, cb) => {
    // Allow images, text files, JSON, and PDFs
    const allowedMimes = [
      'image/jpeg',
      'image/png', 
      'image/webp',
      'image/gif',
      'text/plain',
      'application/json',
      'application/pdf',
      'application/octet-stream' // For generic uploads
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`), false);
    }
  }
});

/**
 * @route POST /upload
 * @desc Upload and process file (image, text, PDF) - Supports FormData
 * @access Private
 */
router.post('/upload', 
  uploadRateLimit, // Apply rate limiting
  authenticateToken,
  trackUploadMetrics, // Track metrics
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file provided'
        });
      }

      const { buffer, mimetype, originalname, size } = req.file;
      const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Validate file type with file-type library for extra security
      const detectedType = await fileTypeFromBuffer(buffer);
      if (detectedType && !mimetype.startsWith(detectedType.mime.split('/')[0])) {
        return res.status(400).json({
          success: false,
          error: 'File type mismatch detected'
        });
      }

      let processedData = {
        fileId,
        originalName: originalname,
        mimeType: mimetype,
        size,
        url: null,
        extractedText: null
      };

      // Process based on file type
      if (mimetype.startsWith('image/')) {
        // Process image: compress and generate URL
        processedData = await processImage(buffer, processedData, req.user.userId);
      } else if (mimetype === 'text/plain') {
        // Extract text from text file
        processedData = await processTextFile(buffer, processedData, req.user.userId);
      } else if (mimetype === 'application/pdf') {
        // For now, just store PDF - could add PDF text extraction later
        processedData = await processDocument(buffer, processedData, req.user.userId);
      }

      // Log upload for analytics
      logger.info('File uploaded successfully', {
        userId: req.user.userId,
        fileId,
        originalName: originalname,
        mimeType: mimetype,
        size,
        hasText: !!processedData.extractedText
      });

      res.json({
        success: true,
        url: processedData.url,
        extractedText: processedData.extractedText,
        fileInfo: {
          id: fileId,
          name: originalname,
          type: mimetype,
          size
        }
      });

    } catch (error) {
      logger.error('File upload failed', {
        error: error.message,
        userId: req.user?.userId,
        originalName: req.file?.originalname
      });

      res.status(500).json({
        success: false,
        error: 'File upload failed: ' + error.message
      });
    }
  }
);

/**
 * @route POST /upload/vision
 * @desc Upload image for GPT-4o vision processing - Supports base64
 * @access Private
 */
router.post('/upload/vision', 
  visionRateLimit, // Apply rate limiting first
  authenticateToken,
  trackUploadMetrics, // Track metrics
  express.json({ limit: '25mb' }), // Higher limit for base64
  [
    body('imageData').notEmpty().withMessage('Image data is required'),
    body('fileName').notEmpty().withMessage('File name is required'),
    body('mimeType').isIn(['image/jpeg', 'image/png', 'image/webp']).withMessage('Invalid image type')
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Vision upload validation failed', {
          userId: req.user?.userId,
          errors: errors.array()
        });
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { imageData, fileName, mimeType } = req.body;
      
      // Enhanced logging
      logger.info('Vision upload started', {
        userId: req.user.userId,
        fileName,
        mimeType,
        dataSize: imageData?.length || 0
      });
      
      if (!imageData) {
        return res.status(400).json({
          success: false,
          error: 'No image data provided'
        });
      }

      // Handle base64 data URL format
      let base64Data = imageData;
      if (imageData.startsWith('data:')) {
        const base64Match = imageData.match(/^data:([^;]+);base64,(.+)$/);
        if (!base64Match) {
          return res.status(400).json({
            success: false,
            error: 'Invalid base64 data URL format'
          });
      }
        base64Data = base64Match[2];
      }

      // Convert base64 to buffer for processing
      const buffer = Buffer.from(base64Data, 'base64');
      const fileId = `vision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Validate image size (limit to 10MB for vision processing)
      if (buffer.length > 10 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          error: 'Image too large for vision processing (max 10MB)'
        });
      }

      // Validate file type
      const detectedType = await fileTypeFromBuffer(buffer);
      if (!detectedType || !detectedType.mime.startsWith('image/')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid image file type'
        });
      }

      let processedData = {
        fileId,
        originalName: fileName || `image_${fileId}.jpg`,
        mimeType: detectedType.mime,
        size: buffer.length,
        url: null,
        extractedText: null
      };

      // Process for vision - optimize without losing quality
      processedData = await processImageForVision(buffer, processedData, req.user.userId);

      // Log upload for analytics
      logger.info('Vision image processed successfully', {
        userId: req.user.userId,
        fileId,
        originalName: processedData.originalName,
        mimeType: detectedType.mime,
        size: buffer.length,
        processingType: 'vision'
      });

      res.json({
        success: true,
        url: processedData.url,
        extractedText: processedData.extractedText,
        fileInfo: {
          id: fileId,
          name: processedData.originalName,
          type: detectedType.mime,
          size: buffer.length
        }
      });

    } catch (error) {
      logger.error('Vision image processing failed', {
        error: error.message,
        userId: req.user?.userId,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Vision image processing failed: ' + error.message
      });
    }
  }
);

// Helper function to process images
async function processImage(buffer, fileData, _userId) {
  try {
    // Compress image using Sharp
    const compressedBuffer = await sharp(buffer)
      .resize(1024, 1024, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    // In a production environment, you would upload to cloud storage (AWS S3, etc.)
    // For now, we'll simulate a URL and store extracted text if it's a screenshot
    const simulatedUrl = `https://api.numina.app/files/${fileData.fileId}.jpg`;
    
    // For demonstration, we'll return the compressed data as base64
    // In production, you'd upload to actual cloud storage
    const base64Data = compressedBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Data}`;
    
    return {
      ...fileData,
      url: dataUrl, // In production, this would be the cloud storage URL
      extractedText: null // Could implement OCR here for text extraction from images
    };
  } catch (error) {
    throw new Error(`Image processing failed: ${error.message}`);
  }
}

// Helper function to process text files
async function processTextFile(buffer, fileData, _userId) {
  try {
    const textContent = buffer.toString('utf-8');
    
    // Validate text size (max 50KB of text)
    if (textContent.length > 50000) {
      throw new Error('Text file too large (max 50KB)');
    }

    // In production, you might want to store the file in cloud storage
    const simulatedUrl = `https://api.numina.app/files/${fileData.fileId}.txt`;
    
    return {
      ...fileData,
      url: simulatedUrl,
      extractedText: textContent
    };
  } catch (error) {
    throw new Error(`Text processing failed: ${error.message}`);
  }
}

// Helper function to process documents (PDF, etc.)
async function processDocument(buffer, fileData, _userId) {
  try {
    // For now, just store the document
    // In production, you could implement PDF text extraction using libraries like pdf-parse
    const simulatedUrl = `https://api.numina.app/files/${fileData.fileId}.pdf`;
    
    return {
      ...fileData,
      url: simulatedUrl,
      extractedText: null // Could implement PDF text extraction here
    };
  } catch (error) {
    throw new Error(`Document processing failed: ${error.message}`);
  }
}

// Helper function to process images for vision (higher quality, optimized for AI)
async function processImageForVision(buffer, fileData, userId) {
  const startTime = Date.now();
  try {
    // Get image metadata first
    const metadata = await sharp(buffer).metadata();
    logger.info('Processing image for vision', {
      userId,
      originalSize: buffer.length,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format
    });

    // Intelligent resizing based on content
    const maxDimension = Math.max(metadata.width || 0, metadata.height || 0);
    let targetSize = 2048;
    
    // Optimize target size based on original dimensions
    if (maxDimension <= 1024) {
      targetSize = Math.min(maxDimension, 1024); // Don't upscale small images
    } else if (maxDimension <= 2048) {
      targetSize = maxDimension; // Keep original size if already reasonable
    }

    // For vision processing, we want to preserve quality while optimizing size
    const compressedBuffer = await sharp(buffer)
      .resize(targetSize, targetSize, { 
        fit: 'inside',
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3 // Better quality resizing
      })
      .jpeg({ 
        quality: 95, // Higher quality for vision
        mozjpeg: true, // Better compression
        progressive: true
      })
      .toBuffer();

    // Convert to base64 data URL for vision processing
    const base64Data = compressedBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Data}`;
    
    const processingTime = Date.now() - startTime;
    const compressionRatio = ((buffer.length - compressedBuffer.length) / buffer.length * 100).toFixed(1);
    
    logger.info('Vision image processing completed', {
      userId,
      originalSize: buffer.length,
      compressedSize: compressedBuffer.length,
      compressionRatio: `${compressionRatio}%`,
      processingTime: `${processingTime}ms`,
      targetSize
    });
    
    return {
      ...fileData,
      url: dataUrl, // Vision expects base64 data URL
      extractedText: null,
      processingType: 'vision',
      metadata: {
        originalSize: buffer.length,
        compressedSize: compressedBuffer.length,
        compressionRatio: parseFloat(compressionRatio),
        processingTime
      }
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error('Vision image processing failed', {
      userId,
      error: error.message,
      processingTime: `${processingTime}ms`
    });
    throw new Error(`Vision image processing failed: ${error.message}`);
  }
}

/**
 * @route GET /upload/metrics
 * @desc Get upload metrics and performance data
 * @access Private (Admin only in production)
 */
router.get('/upload/metrics', authenticateToken, async (req, res) => {
  try {
    // In production, restrict to admin users
    // if (process.env.NODE_ENV === 'production' && req.user.role !== 'admin') {
    //   return res.status(403).json({ success: false, error: 'Admin access required' });
    // }
    
    const metrics = uploadMetrics.getMetrics();
    
    res.json({
      success: true,
      data: {
        uploadMetrics: metrics,
        timestamp: new Date().toISOString(),
        server: 'localhost:5000'
      }
    });
  } catch (error) {
    logger.error('Failed to get upload metrics', {
      error: error.message,
      userId: req.user?.userId
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics'
    });
  }
});

export default router;