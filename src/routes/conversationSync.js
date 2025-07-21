import express from 'express';
import { protect } from '../middleware/auth.js';
import ShortTermMemory from '../models/ShortTermMemory.js';
import enhancedMemoryService from '../services/enhancedMemoryService.js';
import { HTTP_STATUS } from '../config/constants.js';

const router = express.Router();

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
      `${msg.role}:${msg.content.substring(0, 100)}`
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
        const messageKey = `${message.sender === 'user' ? 'user' : 'assistant'}:${message.text.substring(0, 100)}`;
        
        // Skip if message already exists
        if (existingContent.has(messageKey)) {
          skippedMessages++;
          continue;
        }

        // Convert mobile message format to server format
        const role = message.sender === 'user' ? 'user' : 'assistant';
        const content = message.text;
        const timestamp = new Date(message.timestamp);

        // Save to server memory
        await ShortTermMemory.create({
          userId,
          role,
          content,
          timestamp,
          conversationId: conversation.id,
          metadata: {
            syncedFromMobile: true,
            originalId: message.id,
            mood: message.mood,
            hasAttachments: message.attachments?.length > 0
          }
        });

        syncedMessages++;
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