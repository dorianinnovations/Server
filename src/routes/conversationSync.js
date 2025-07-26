import express from 'express';
import { protect } from '../middleware/auth.js';
import ShortTermMemory from '../models/ShortTermMemory.js';
import enhancedMemoryService from '../services/enhancedMemoryService.js';
import conversationService from '../services/conversationService.js';
import { HTTP_STATUS } from '../config/constants.js';

const router = express.Router();

/**
 * Get recent conversations for user
 */
router.get('/recent', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;

    const recentMessages = await ShortTermMemory.find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    const conversations = recentMessages.map(msg => ({
      id: msg._id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      metadata: msg.metadata
    }));

    res.json({
      success: true,
      data: conversations
    });

  } catch (error) {
    console.error('Error fetching recent conversations:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to fetch recent conversations'
    });
  }
});

/**
 * Sync conversations from mobile app to server
 * Called on login to restore conversation context
 */
router.post('/sync-conversations', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversations, lastSyncTimestamp } = req.body;

    if (!conversations || !Array.isArray(conversations)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Invalid conversations data'
      });
    }

    let syncedMessages = 0;
    let skippedMessages = 0;

    // Get existing messages to avoid duplicates
    const existingMessages = await ShortTermMemory.find({ userId })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    const existingContent = new Set(existingMessages.map(msg => 
      `${msg.role}:${(msg.content || '').substring(0, 100)}`
    ));

    for (const conversation of conversations) {
      if (!conversation.messages || !Array.isArray(conversation.messages)) {
        continue;
      }

      // Process messages in chronological order
      const sortedMessages = conversation.messages.sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );

      for (const message of sortedMessages) {
        // Skip messages with empty or missing text content
        if (!message.text || message.text.trim() === '') {
          skippedMessages++;
          continue;
        }

        const messageKey = `${message.sender === 'user' ? 'user' : 'assistant'}:${message.text.substring(0, 100)}`;
        
        // Skip if message already exists
        if (existingContent.has(messageKey)) {
          skippedMessages++;
          continue;
        }

        // Convert mobile message format to server format
        const role = message.sender === 'user' ? 'user' : 'assistant';
        let content = message.text.trim();
        const timestamp = new Date(message.timestamp);

        // Additional validation before saving - ensure content is never empty
        if (!content || content.length === 0) {
          skippedMessages++;
          continue;
        }

        // Final safety check: ensure content meets database requirements
        content = content || '[Empty message]';

        // Save to both short-term memory and persistent conversation storage
        try {
          await conversationService.addMessage(
            userId,
            conversation.id,
            role,
            content,
            message.attachments || [],
            {
              syncedFromMobile: true,
              originalId: message.id,
              mood: message.mood,
              hasAttachments: message.attachments?.length > 0
            }
          );

          syncedMessages++;
        } catch (createError) {
          console.error('Failed to create individual message:', {
            error: createError.message,
            userId,
            role,
            contentLength: content?.length,
            timestamp
          });
          skippedMessages++;
        }
      }
    }

    // Update user's last sync timestamp
    await enhancedMemoryService.updateUserConstants(userId, {
      personalInfo: {
        lastConversationSync: new Date(),
        totalSyncedMessages: syncedMessages
      }
    });

    res.json({
      success: true,
      syncedMessages,
      skippedMessages,
      message: `Successfully synced ${syncedMessages} messages, skipped ${skippedMessages} duplicates`
    });

  } catch (error) {
    console.error('Conversation sync error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to sync conversations'
    });
  }
});

/**
 * Get conversation sync status
 */
router.get('/sync-status', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const messageCount = await ShortTermMemory.countDocuments({ userId });
    const latestMessage = await ShortTermMemory.findOne({ userId })
      .sort({ timestamp: -1 })
      .select('timestamp')
      .lean();

    res.json({
      success: true,
      serverMessageCount: messageCount,
      latestMessageTimestamp: latestMessage?.timestamp,
      hasSyncedData: messageCount > 0
    });

  } catch (error) {
    console.error('Sync status error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to get sync status'
    });
  }
});

export default router;