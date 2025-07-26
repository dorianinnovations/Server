import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { protect } from '../middleware/auth.js';
import conversationService from '../services/conversationService.js';
import { HTTP_STATUS } from '../config/constants.js';
import { log } from '../utils/logger.js';

const router = express.Router();

/**
 * @route GET /conversations/recent
 * @desc Get user's recent conversations (mobile app compatible)
 * @access Private
 */
router.get('/recent', 
  protect,
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 20;

      const result = await conversationService.getUserConversations(userId, {
        page: 1,
        limit,
        includeArchived: false,
        sortBy: 'lastActivity',
        sortOrder: 'desc'
      });

      res.json({
        success: true,
        data: result.conversations || [],
        total: result.pagination?.total || 0
      });

    } catch (error) {
      log.error('Error fetching recent conversations:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to fetch recent conversations'
      });
    }
  }
);

/**
 * @route POST /conversations/sync
 * @desc Sync conversations for mobile app
 * @access Private
 */
router.post('/sync',
  protect,
  body('lastSyncTimestamp').optional().isISO8601().withMessage('Invalid timestamp format'),
  body('deviceId').optional().isString().trim().withMessage('Device ID must be a string'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      const { lastSyncTimestamp, deviceId } = req.body;

      // Get conversations modified since last sync
      const since = lastSyncTimestamp ? new Date(lastSyncTimestamp) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago default

      const result = await conversationService.getUserConversations(userId, {
        page: 1,
        limit: 100,
        includeArchived: true,
        modifiedSince: since
      });

      res.json({
        success: true,
        data: {
          conversations: result.conversations || [],
          syncTimestamp: new Date().toISOString(),
          deviceId: deviceId || 'unknown'
        },
        total: result.conversations?.length || 0
      });

    } catch (error) {
      log.error('Error syncing conversations:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to sync conversations'
      });
    }
  }
);

/**
 * @route GET /conversations
 * @desc Get user's conversations with pagination
 * @access Private
 */
router.get('/', 
  protect,
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('includeArchived').optional().isBoolean().withMessage('includeArchived must be boolean'),
  query('search').optional().isString().trim().withMessage('Search must be a string'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        includeArchived: req.query.includeArchived === 'true',
        search: req.query.search || null
      };

      const result = await conversationService.getUserConversations(userId, options);

      res.json({
        success: true,
        data: result.conversations,
        pagination: result.pagination
      });

    } catch (error) {
      log.error('Error fetching conversations:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to fetch conversations'
      });
    }
  }
);

/**
 * @route GET /conversations/:id
 * @desc Get specific conversation with messages
 * @access Private
 */
router.get('/:id',
  protect,
  query('messageLimit').optional().isInt({ min: 10, max: 500 }).withMessage('Message limit must be between 10 and 500'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      const conversationId = req.params.id;
      const messageLimit = parseInt(req.query.messageLimit) || 100;

      const conversation = await conversationService.getConversation(userId, conversationId, messageLimit);

      if (!conversation) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          error: 'Conversation not found'
        });
      }

      res.json({
        success: true,
        data: conversation
      });

    } catch (error) {
      log.error('Error fetching conversation:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to fetch conversation'
      });
    }
  }
);

/**
 * @route POST /conversations
 * @desc Create a new conversation
 * @access Private
 */
router.post('/',
  protect,
  body('title').optional().isString().trim().isLength({ max: 200 }).withMessage('Title must be a string with max 200 characters'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      const { title } = req.body;

      const conversation = await conversationService.createConversation(userId, title);

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        data: conversation
      });

    } catch (error) {
      log.error('Error creating conversation:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to create conversation'
      });
    }
  }
);

/**
 * @route POST /conversations/:id/messages
 * @desc Add message to conversation
 * @access Private
 */
router.post('/:id/messages',
  protect,
  body('role').isIn(['user', 'assistant', 'system']).withMessage('Role must be user, assistant, or system'),
  body('content').notEmpty().withMessage('Content is required'),
  body('attachments').optional().isArray().withMessage('Attachments must be an array'),
  body('metadata').optional().isObject().withMessage('Metadata must be an object'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      const conversationId = req.params.id;
      const { role, content, attachments = [], metadata = {} } = req.body;

      const conversation = await conversationService.addMessage(
        userId, 
        conversationId, 
        role, 
        content, 
        attachments, 
        metadata
      );

      res.json({
        success: true,
        data: {
          conversationId: conversation._id,
          messageCount: conversation.messageCount,
          lastActivity: conversation.lastActivity
        }
      });

    } catch (error) {
      log.error('Error adding message to conversation:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to add message to conversation'
      });
    }
  }
);

/**
 * @route PUT /conversations/:id/title
 * @desc Update conversation title
 * @access Private
 */
router.put('/:id/title',
  protect,
  body('title').notEmpty().withMessage('Title is required').isLength({ max: 200 }).withMessage('Title must be max 200 characters'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      const conversationId = req.params.id;
      const { title } = req.body;

      const conversation = await conversationService.updateConversationTitle(userId, conversationId, title);

      res.json({
        success: true,
        data: {
          id: conversation._id,
          title: conversation.title,
          lastActivity: conversation.lastActivity
        }
      });

    } catch (error) {
      log.error('Error updating conversation title:', error);
      if (error.message === 'Conversation not found') {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          error: 'Conversation not found'
        });
      }
      
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to update conversation title'
      });
    }
  }
);

/**
 * @route PUT /conversations/:id/archive
 * @desc Archive a conversation
 * @access Private
 */
router.put('/:id/archive', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;

    const conversation = await conversationService.archiveConversation(userId, conversationId);

    res.json({
      success: true,
      data: {
        id: conversation._id,
        isArchived: conversation.isArchived,
        lastActivity: conversation.lastActivity
      }
    });

  } catch (error) {
    log.error('Error archiving conversation:', error);
    if (error.message === 'Conversation not found') {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Conversation not found'
      });
    }
    
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to archive conversation'
    });
  }
});

/**
 * @route DELETE /conversations/:id
 * @desc Delete a conversation
 * @access Private
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;

    await conversationService.deleteConversation(userId, conversationId);

    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });

  } catch (error) {
    log.error('Error deleting conversation:', error);
    if (error.message === 'Conversation not found') {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Conversation not found'
      });
    }
    
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to delete conversation'
    });
  }
});

/**
 * @route GET /conversations/context/:id?
 * @desc Get conversation context for AI processing
 * @access Private
 */
router.get('/context/:id?',
  protect,
  query('limit').optional().isInt({ min: 10, max: 200 }).withMessage('Limit must be between 10 and 200'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      const conversationId = req.params.id || null;
      const limit = parseInt(req.query.limit) || 50;

      const context = await conversationService.getConversationContext(userId, conversationId, limit);

      res.json({
        success: true,
        data: context
      });

    } catch (error) {
      log.error('Error fetching conversation context:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to fetch conversation context'
      });
    }
  }
);

/**
 * @route POST /conversations/migrate
 * @desc Migrate existing short-term memory to persistent conversations
 * @access Private
 */
router.post('/migrate', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await conversationService.migrateShortTermMemory(userId);

    if (!conversations) {
      return res.json({
        success: true,
        message: 'No messages to migrate',
        data: []
      });
    }

    res.json({
      success: true,
      message: `Successfully migrated to ${conversations.length} conversations`,
      data: conversations.map(conv => ({
        id: conv._id,
        title: conv.title,
        messageCount: conv.messageCount,
        lastActivity: conv.lastActivity
      }))
    });

  } catch (error) {
    log.error('Error migrating conversations:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to migrate conversations'
    });
  }
});

export default router;