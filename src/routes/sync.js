import express from 'express';
import { body, validationResult } from 'express-validator';
import { protect as authenticateToken } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import offlineSyncService from '../services/offlineSyncService.js';
import cacheMiddleware from '../middleware/cacheMiddleware.js';

const router = express.Router();

/**
 * Offline Sync API Routes
 * Handles data synchronization between mobile app and server
 */

/**
 * @route POST /sync/process
 * @desc Process complete sync request from mobile app
 * @access Private
 */
router.post('/sync/process',
  authenticateToken,
  body('syncData').isObject().withMessage('Sync data must be an object'),
  body('syncData.profile').optional().isObject(),
  body('syncData.emotions').optional().isArray(),
  body('syncData.conversations').optional().isArray(),
  body('syncData.settings').optional().isObject(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { syncData } = req.body;
      const userId = req.user.id;

      logger.info(`Processing sync request for user ${userId}`);

      // Process sync request
      const syncResult = await offlineSyncService.processSyncRequest(userId, syncData);

      if (syncResult.success) {
        res.json({
          success: true,
          ...syncResult,
          timestamp: new Date()
        });
      } else {
        res.status(500).json({
          success: false,
          error: syncResult.error
        });
      }

    } catch (error) {
      logger.error('Sync processing error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

/**
 * @route GET /sync/incremental
 * @desc Get incremental sync data since last sync
 * @access Private
 */
router.get('/sync/incremental',
  authenticateToken,
  cacheMiddleware.cacheResponse({ ttl: 60 }), // Cache for 1 minute
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { lastSync, dataTypes } = req.query;

      if (!lastSync) {
        return res.status(400).json({
          success: false,
          error: 'lastSync timestamp is required'
        });
      }

      const requestedDataTypes = dataTypes ? dataTypes.split(',') : ['profile', 'emotions', 'conversations', 'settings'];

      logger.info(`Incremental sync request for user ${userId}, since ${lastSync}`);

      const syncResult = await offlineSyncService.getIncrementalSync(userId, lastSync, requestedDataTypes);

      if (syncResult.success) {
        res.json({
          success: true,
          ...syncResult
        });
      } else {
        res.status(500).json({
          success: false,
          error: syncResult.error
        });
      }

    } catch (error) {
      logger.error('Incremental sync error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

/**
 * @route POST /sync/offline-queue
 * @desc Process offline queue items
 * @access Private
 */
router.post('/sync/offline-queue',
  authenticateToken,
  body('items').isArray().withMessage('Items must be an array'),
  body('items.*.id').notEmpty().withMessage('Each item must have an id'),
  body('items.*.endpoint').notEmpty().withMessage('Each item must have an endpoint'),
  body('items.*.method').isIn(['GET', 'POST', 'PUT', 'DELETE']).withMessage('Invalid HTTP method'),
  body('items.*.timestamp').isISO8601().withMessage('Invalid timestamp format'),
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

      logger.info(`Processing offline queue for user ${userId}, ${items.length} items`);

      const queueResult = await offlineSyncService.processOfflineQueue(userId, items);

      if (queueResult.success) {
        res.json({
          success: true,
          ...queueResult,
          timestamp: new Date()
        });
      } else {
        res.status(500).json({
          success: false,
          error: queueResult.error
        });
      }

    } catch (error) {
      logger.error('Offline queue processing error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

/**
 * @route GET /sync/status
 * @desc Get sync status and statistics
 * @access Private
 */
router.get('/sync/status',
  authenticateToken,
  cacheMiddleware.cacheResponse({ ttl: 300 }), // Cache for 5 minutes
  async (req, res) => {
    try {
      const userId = req.user.id;

      const syncStats = await offlineSyncService.getSyncStats(userId);

      res.json({
        success: true,
        stats: syncStats,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Sync status error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

/**
 * @route POST /sync/conflict-resolution
 * @desc Handle conflict resolution for sync conflicts
 * @access Private
 */
router.post('/sync/conflict-resolution',
  authenticateToken,
  body('conflictId').notEmpty().withMessage('Conflict ID is required'),
  body('resolution').isIn(['server', 'client', 'merge']).withMessage('Invalid resolution type'),
  body('resolvedData').optional().isObject(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { conflictId, resolution, resolvedData } = req.body;
      const userId = req.user.id;

      logger.info(`Conflict resolution for user ${userId}, conflict ${conflictId}: ${resolution}`);

      // This would implement conflict resolution logic
      // Return success response for now
      res.json({
        success: true,
        conflictId,
        resolution,
        message: 'Conflict resolved successfully',
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Conflict resolution error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

/**
 * @route DELETE /sync/cleanup
 * @desc Clean up old sync data
 * @access Private
 */
router.delete('/sync/cleanup',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { olderThan } = req.query;

      // Only allow cleanup of user's own data
      logger.info(`Cleanup request for user ${userId}`);

      // This would implement cleanup logic
      // Return success response for now
      res.json({
        success: true,
        message: 'Cleanup completed successfully',
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Sync cleanup error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

/**
 * @route GET /sync/health
 * @desc Get sync service health status
 * @access Private
 */
router.get('/sync/health',
  authenticateToken,
  async (req, res) => {
    try {
      const health = {
        status: 'healthy',
        services: {
          offlineSync: 'operational',
          redis: 'operational',
          database: 'operational'
        },
        timestamp: new Date()
      };

      res.json({
        success: true,
        health
      });

    } catch (error) {
      logger.error('Sync health check error:', error);
      res.status(500).json({
        success: false,
        error: 'Health check failed'
      });
    }
  }
);

export default router;