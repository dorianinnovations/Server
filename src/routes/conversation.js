/**
 * Conversation Routes
 * API endpoints for conversation management
 */

import express from 'express';
import { protect } from '../middleware/auth.js';
import conversationService from '../services/conversationService.js';
import { log } from '../utils/logger.js';

const router = express.Router();

/**
 * GET /conversations/recent
 * Get user's recent conversations with pagination
 */
router.get('/conversations/recent', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 conversations
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const search = req.query.search;

    const result = await conversationService.getUserConversations(userId, {
      page,
      limit,
      search
    });

    res.json({
      success: true,
      data: result.conversations,
      total: result.pagination.total,
      pagination: result.pagination
    });
  } catch (error) {
    log.error('Error getting recent conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve conversations'
    });
  }
});

/**
 * GET /conversations/:id
 * Get specific conversation with messages
 */
router.get('/conversations/:id', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    const messageLimit = Math.min(parseInt(req.query.messageLimit) || 500, 500);

    const conversation = await conversationService.getConversation(userId, conversationId, messageLimit);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    res.json({
      success: true,
      data: conversation
    });
  } catch (error) {
    log.error('Error getting conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve conversation'
    });
  }
});

/**
 * POST /conversations
 * Create new conversation
 */
router.post('/conversations', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title } = req.body;

    const conversation = await conversationService.createConversation(userId, title);

    res.status(201).json({
      success: true,
      data: conversation
    });
  } catch (error) {
    log.error('Error creating conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create conversation'
    });
  }
});

/**
 * POST /conversations/sync
 * Sync conversations (for offline support)
 */
router.post('/conversations/sync', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { lastSyncTimestamp } = req.body;

    // For now, just return recent conversations
    // In the future, this could implement incremental sync
    const result = await conversationService.getUserConversations(userId, {
      limit: 50
    });

    res.json({
      success: true,
      data: {
        conversations: result.conversations,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    log.error('Error syncing conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync conversations'
    });
  }
});

/**
 * POST /conversations/:id/messages
 * Add message to conversation
 */
router.post('/conversations/:id/messages', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    const { role, content, attachments, metadata } = req.body;

    if (!role || !content) {
      return res.status(400).json({
        success: false,
        error: 'Role and content are required'
      });
    }

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
      data: conversation
    });
  } catch (error) {
    log.error('Error adding message to conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add message'
    });
  }
});

/**
 * GET /conversations (with search)
 * Search conversations
 */
router.get('/conversations', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const search = req.query.search;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    if (!search) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const result = await conversationService.getUserConversations(userId, {
      search,
      limit
    });

    res.json({
      success: true,
      data: result.conversations,
      total: result.pagination.total
    });
  } catch (error) {
    log.error('Error searching conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search conversations'
    });
  }
});

/**
 * DELETE /conversations/:id
 * Delete specific conversation
 */
router.delete('/conversations/:id', protect, async (req, res) => {
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
    
    // Handle specific error cases
    if (error.message === 'Invalid conversation ID format') {
      return res.status(400).json({
        success: false,
        error: 'Invalid conversation ID'
      });
    } else if (error.message === 'Conversation not found or already deleted') {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to delete conversation'
    });
  }
});

/**
 * DELETE /conversations/all
 * Delete all conversations for user
 */
router.delete('/conversations/all', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await conversationService.deleteAllConversations(userId);

    res.json({
      success: true,
      data: result,
      message: 'All conversations deleted successfully'
    });
  } catch (error) {
    log.error('Error deleting all conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete conversations'
    });
  }
});

/**
 * PUT /conversations/:id/title
 * Update conversation title
 */
router.put('/conversations/:id/title', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required'
      });
    }

    const conversation = await conversationService.updateConversationTitle(userId, conversationId, title);

    res.json({
      success: true,
      data: conversation
    });
  } catch (error) {
    log.error('Error updating conversation title:', error);
    
    if (error.message === 'Conversation not found') {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update conversation title'
    });
  }
});

export default router;