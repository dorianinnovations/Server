import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import ShortTermMemory from '../models/ShortTermMemory.js';
import { log } from '../utils/logger.js';

class ConversationService {
  /**
   * Create a new conversation
   */
  async createConversation(userId, title = null) {
    try {
      const conversation = new Conversation({
        userId,
        title,
        messages: [],
        lastActivity: new Date()
      });
      
      await conversation.save();
      log.debug(`Created new conversation ${conversation._id} for user ${userId}`);
      return conversation;
    } catch (error) {
      log.error('Error creating conversation:', error);
      throw error;
    }
  }

  /**
   * Add message to conversation and short-term memory
   */
  async addMessage(userId, conversationId, role, content, attachments = [], metadata = {}) {
    try {
      let conversation;
      
      if (conversationId) {
        // Skip temporary IDs and invalid ObjectIds - treat as new conversation
        if (conversationId.startsWith('temp_') || !mongoose.Types.ObjectId.isValid(conversationId)) {
          log.info(`Temporary or invalid conversationId: ${conversationId}, creating new conversation`);
          conversationId = null; // Force creation of new conversation
        } else {
          conversation = await Conversation.findOne({ _id: conversationId, userId });
        }
      }
      
      // Create new conversation if none exists
      if (!conversation) {
        conversation = await this.createConversation(userId);
      }
      
      // Add to persistent conversation
      conversation.addMessage(role, content, attachments, metadata);
      await conversation.save();
      
      // Also add to short-term memory for immediate context
      await ShortTermMemory.create({
        userId,
        conversationId: conversation._id.toString(),
        role,
        content,
        attachments,
        metadata: {
          ...metadata,
          persistentConversationId: conversation._id
        }
      });
      
      return conversation;
    } catch (error) {
      log.error('Error adding message to conversation:', error);
      throw error;
    }
  }

  /**
   * Get user's conversations with pagination
   */
  async getUserConversations(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        includeArchived = false,
        search = null
      } = options;
      
      const query = { userId };
      
      if (!includeArchived) {
        query.isArchived = { $ne: true };
      }
      
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { summary: { $regex: search, $options: 'i' } },
          { 'messages.content': { $regex: search, $options: 'i' } }
        ];
      }
      
      const conversations = await Conversation.find(query)
        .sort({ lastActivity: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('title lastActivity messageCount isArchived tags summary createdAt')
        .lean();
      
      const total = await Conversation.countDocuments(query);
      
      return {
        conversations,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      log.error('Error getting user conversations:', error);
      throw error;
    }
  }

  /**
   * Get specific conversation with messages
   */
  async getConversation(userId, conversationId, messageLimit = 100) {
    try {
      const conversation = await Conversation.findOne({
        _id: conversationId,
        userId
      }).lean();
      
      if (!conversation) {
        return null;
      }
      
      // Return recent messages if conversation is large
      if (conversation.messages.length > messageLimit) {
        conversation.messages = conversation.messages.slice(-messageLimit);
      }
      
      return conversation;
    } catch (error) {
      log.error('Error getting conversation:', error);
      throw error;
    }
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(userId, conversationId) {
    try {
      const conversation = await Conversation.findOne({
        _id: conversationId,
        userId
      });
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }
      
      conversation.archive();
      await conversation.save();
      
      log.debug(`Archived conversation ${conversationId} for user ${userId}`);
      return conversation;
    } catch (error) {
      log.error('Error archiving conversation:', error);
      throw error;
    }
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(userId, conversationId) {
    try {
      const result = await Conversation.deleteOne({
        _id: conversationId,
        userId
      });
      
      if (result.deletedCount === 0) {
        throw new Error('Conversation not found');
      }
      
      // Also clean up related short-term memory
      await ShortTermMemory.deleteMany({
        userId,
        conversationId: conversationId
      });
      
      log.debug(`Deleted conversation ${conversationId} for user ${userId}`);
      return true;
    } catch (error) {
      log.error('Error deleting conversation:', error);
      throw error;
    }
  }

  /**
   * Delete all conversations for a user
   */
  async deleteAllConversations(userId) {
    try {
      // Delete all conversations for this user
      const conversationResult = await Conversation.deleteMany({ userId });
      
      // Also clean up all related short-term memory for this user
      const memoryResult = await ShortTermMemory.deleteMany({ userId });
      
      log.debug(`Deleted ${conversationResult.deletedCount} conversations and ${memoryResult.deletedCount} memory entries for user ${userId}`);
      
      return {
        conversationsDeleted: conversationResult.deletedCount,
        memoryEntriesDeleted: memoryResult.deletedCount
      };
    } catch (error) {
      log.error('Error deleting all conversations:', error);
      throw error;
    }
  }

  /**
   * Update conversation title
   */
  async updateConversationTitle(userId, conversationId, title) {
    try {
      const conversation = await Conversation.findOneAndUpdate(
        { _id: conversationId, userId },
        { title, lastActivity: new Date() },
        { new: true }
      );
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }
      
      return conversation;
    } catch (error) {
      log.error('Error updating conversation title:', error);
      throw error;
    }
  }

  /**
   * Get conversation context for AI (recent messages across conversations)
   */
  async getConversationContext(userId, currentConversationId = null, limit = 50) {
    try {
      // Get recent messages from short-term memory (24h window)
      const recentMemory = await ShortTermMemory.find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
      
      // If we have a current conversation, also include older messages from it
      let conversationHistory = [];
      if (currentConversationId) {
        const conversation = await Conversation.findOne({
          _id: currentConversationId,
          userId
        }).select('messages').lean();
        
        if (conversation) {
          conversationHistory = conversation.messages.slice(-20); // Last 20 messages
        }
      }
      
      return {
        recentMemory,
        conversationHistory
      };
    } catch (error) {
      log.error('Error getting conversation context:', error);
      throw error;
    }
  }

  /**
   * Migrate existing short-term memory to persistent conversations
   */
  async migrateShortTermMemory(userId) {
    try {
      const memories = await ShortTermMemory.find({ userId })
        .sort({ timestamp: 1 })
        .lean();
      
      if (memories.length === 0) {
        return null;
      }
      
      // Group memories by conversationId or create single conversation
      const conversationGroups = new Map();
      
      for (const memory of memories) {
        const key = memory.conversationId || 'default';
        if (!conversationGroups.has(key)) {
          conversationGroups.set(key, []);
        }
        conversationGroups.get(key).push(memory);
      }
      
      const createdConversations = [];
      
      for (const [key, messages] of conversationGroups) {
        const conversation = new Conversation({
          userId,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            attachments: msg.attachments || [],
            metadata: msg.metadata || {}
          })),
          lastActivity: new Date(Math.max(...messages.map(m => new Date(m.timestamp))))
        });
        
        await conversation.save();
        createdConversations.push(conversation);
      }
      
      log.debug(`Migrated ${memories.length} messages to ${createdConversations.length} conversations for user ${userId}`);
      return createdConversations;
    } catch (error) {
      log.error('Error migrating short-term memory:', error);
      throw error;
    }
  }
}

export default new ConversationService();