import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import redisService from './redisService.js';
import websocketService from './websocketService.js';
import User from '../models/User.js';
import EmotionalAnalyticsSession from '../models/EmotionalAnalyticsSession.js';

/**
 * Offline Sync Service
 * Handles data synchronization, conflict resolution, and offline queue processing
 */
class OfflineSyncService {
  constructor() {
    this.syncOperations = new Map();
    this.conflictResolvers = new Map();
    this.setupConflictResolvers();
  }

  /**
   * Setup conflict resolution strategies
   */
  setupConflictResolvers() {
    // Last-write-wins resolver
    this.conflictResolvers.set('last_write_wins', (serverData, clientData) => {
      return new Date(clientData.updatedAt || clientData.timestamp) > new Date(serverData.updatedAt || serverData.timestamp) 
        ? clientData : serverData;
    });

    // Merge resolver for emotional data
    this.conflictResolvers.set('emotional_merge', (serverData, clientData) => {
      return {
        ...serverData,
        ...clientData,
        emotions: [...(serverData.emotions || []), ...(clientData.emotions || [])],
        intensity: Math.max(serverData.intensity || 0, clientData.intensity || 0),
        updatedAt: new Date()
      };
    });

    // User preference merger
    this.conflictResolvers.set('preference_merge', (serverData, clientData) => {
      return {
        ...serverData,
        preferences: {
          ...serverData.preferences,
          ...clientData.preferences
        },
        settings: {
          ...serverData.settings,
          ...clientData.settings
        },
        updatedAt: new Date()
      };
    });

    // Conversation history merger
    this.conflictResolvers.set('conversation_merge', (serverData, clientData) => {
      const serverMessages = serverData.messages || [];
      const clientMessages = clientData.messages || [];
      
      // Merge messages by timestamp, removing duplicates
      const allMessages = [...serverMessages, ...clientMessages];
      const uniqueMessages = allMessages.filter((message, index, self) => 
        index === self.findIndex(m => m.id === message.id)
      );
      
      return {
        ...serverData,
        messages: uniqueMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
        updatedAt: new Date()
      };
    });
  }

  /**
   * Process sync request from client
   */
  async processSyncRequest(userId, syncData) {
    try {
      const syncId = `sync_${userId}_${Date.now()}`;
      const syncKey = `sync:${syncId}`;
      
      // Store sync operation
      this.syncOperations.set(syncId, {
        userId,
        startTime: new Date(),
        status: 'processing',
        conflicts: []
      });

      // Process different data types
      const results = {
        profile: null,
        emotions: null,
        conversations: null,
        settings: null,
        conflicts: []
      };

      // Process profile sync
      if (syncData.profile) {
        results.profile = await this.syncUserProfile(userId, syncData.profile);
      }

      // Process emotions sync
      if (syncData.emotions) {
        results.emotions = await this.syncEmotionalData(userId, syncData.emotions);
      }

      // Process conversations sync
      if (syncData.conversations) {
        results.conversations = await this.syncConversations(userId, syncData.conversations);
      }

      // Process settings sync
      if (syncData.settings) {
        results.settings = await this.syncUserSettings(userId, syncData.settings);
      }

      // Aggregate conflicts
      Object.values(results).forEach(result => {
        if (result && result.conflicts) {
          results.conflicts.push(...result.conflicts);
        }
      });

      // Update sync operation status
      this.syncOperations.set(syncId, {
        ...this.syncOperations.get(syncId),
        status: 'completed',
        endTime: new Date(),
        results
      });

      // Cache sync results
      await redisService.set(syncKey, results, 3600); // 1 hour

      // Notify client via WebSocket
      if (websocketService.isUserOnline(userId)) {
        websocketService.sendToUser(userId, 'sync_completed', {
          syncId,
          results,
          timestamp: new Date()
        });
      }

      return {
        success: true,
        syncId,
        results
      };

    } catch (error) {
      logger.error(`Sync processing error for user ${userId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sync user profile data
   */
  async syncUserProfile(userId, clientProfile) {
    try {
      const serverUser = await User.findById(userId);
      
      if (!serverUser) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Check for conflicts
      const conflicts = [];
      let resolvedData = clientProfile;

      if (serverUser.updatedAt > new Date(clientProfile.updatedAt || clientProfile.timestamp)) {
        conflicts.push({
          type: 'profile_conflict',
          field: 'profile',
          serverData: serverUser.toObject(),
          clientData: clientProfile,
          resolution: 'preference_merge'
        });

        // Resolve conflict
        const resolver = this.conflictResolvers.get('preference_merge');
        resolvedData = resolver(serverUser.toObject(), clientProfile);
      }

      // Update user with resolved data
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: resolvedData },
        { new: true }
      );

      return {
        success: true,
        data: updatedUser,
        conflicts
      };

    } catch (error) {
      logger.error(`Profile sync error for user ${userId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sync emotional data
   */
  async syncEmotionalData(userId, clientEmotions) {
    try {
      const results = {
        synced: 0,
        conflicts: [],
        errors: []
      };

      for (const emotionData of clientEmotions) {
        try {
          // Check if emotion already exists
          const existingEmotion = await EmotionalAnalyticsSession.findOne({
            userId,
            clientId: emotionData.clientId || emotionData.id
          });

          if (existingEmotion) {
            // Check for conflicts
            if (existingEmotion.updatedAt > new Date(emotionData.timestamp)) {
              const conflict = {
                type: 'emotion_conflict',
                field: 'emotional_data',
                serverData: existingEmotion.toObject(),
                clientData: emotionData,
                resolution: 'emotional_merge'
              };

              results.conflicts.push(conflict);

              // Resolve conflict
              const resolver = this.conflictResolvers.get('emotional_merge');
              const resolvedData = resolver(existingEmotion.toObject(), emotionData);

              // Update existing emotion
              await EmotionalAnalyticsSession.findByIdAndUpdate(
                existingEmotion._id,
                { $set: resolvedData }
              );
            }
          } else {
            // Create new emotion entry
            const newEmotion = new EmotionalAnalyticsSession({
              userId,
              ...emotionData,
              clientId: emotionData.clientId || emotionData.id,
              syncedAt: new Date()
            });

            await newEmotion.save();
            results.synced++;
          }

        } catch (error) {
          results.errors.push({
            emotionId: emotionData.id,
            error: error.message
          });
        }
      }

      return {
        success: true,
        results
      };

    } catch (error) {
      logger.error(`Emotional data sync error for user ${userId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sync conversation data
   */
  async syncConversations(userId, clientConversations) {
    try {
      const results = {
        synced: 0,
        conflicts: [],
        errors: []
      };

      // This would integrate with your conversation storage system
      // For now, we'll cache the conversations in Redis
      
      for (const conversation of clientConversations) {
        try {
          const conversationKey = `conversation:${userId}:${conversation.id}`;
          const existingConversation = await redisService.get(conversationKey);

          if (existingConversation) {
            // Check for conflicts
            const serverTimestamp = new Date(existingConversation.updatedAt || existingConversation.timestamp);
            const clientTimestamp = new Date(conversation.updatedAt || conversation.timestamp);

            if (serverTimestamp > clientTimestamp) {
              const conflict = {
                type: 'conversation_conflict',
                field: 'conversation_data',
                serverData: existingConversation,
                clientData: conversation,
                resolution: 'conversation_merge'
              };

              results.conflicts.push(conflict);

              // Resolve conflict
              const resolver = this.conflictResolvers.get('conversation_merge');
              const resolvedData = resolver(existingConversation, conversation);

              // Update conversation
              await redisService.set(conversationKey, resolvedData, 86400 * 30); // 30 days
            }
          } else {
            // Store new conversation
            await redisService.set(conversationKey, {
              ...conversation,
              syncedAt: new Date()
            }, 86400 * 30); // 30 days
            
            results.synced++;
          }

        } catch (error) {
          results.errors.push({
            conversationId: conversation.id,
            error: error.message
          });
        }
      }

      return {
        success: true,
        results
      };

    } catch (error) {
      logger.error(`Conversation sync error for user ${userId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sync user settings
   */
  async syncUserSettings(userId, clientSettings) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      const conflicts = [];
      let resolvedSettings = clientSettings;

      // Check for conflicts
      if (user.settings && user.updatedAt > new Date(clientSettings.updatedAt || clientSettings.timestamp)) {
        conflicts.push({
          type: 'settings_conflict',
          field: 'user_settings',
          serverData: user.settings,
          clientData: clientSettings,
          resolution: 'preference_merge'
        });

        // Resolve conflict
        const resolver = this.conflictResolvers.get('preference_merge');
        resolvedSettings = resolver({ settings: user.settings }, { settings: clientSettings }).settings;
      }

      // Update user settings
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: { settings: resolvedSettings } },
        { new: true }
      );

      return {
        success: true,
        data: updatedUser.settings,
        conflicts
      };

    } catch (error) {
      logger.error(`Settings sync error for user ${userId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get incremental sync data
   */
  async getIncrementalSync(userId, lastSyncTimestamp, dataTypes = []) {
    try {
      const since = new Date(lastSyncTimestamp);
      const syncData = {
        timestamp: new Date(),
        lastSync: since,
        changes: {}
      };

      // Get profile changes
      if (dataTypes.includes('profile')) {
        const user = await User.findById(userId).select('-password');
        if (user && user.updatedAt > since) {
          syncData.changes.profile = {
            type: 'updated',
            data: user,
            timestamp: user.updatedAt
          };
        }
      }

      // Get emotional data changes
      if (dataTypes.includes('emotions')) {
        const emotions = await EmotionalAnalyticsSession.find({
          userId,
          $or: [
            { createdAt: { $gt: since } },
            { updatedAt: { $gt: since } }
          ]
        }).sort({ createdAt: -1 });

        if (emotions.length > 0) {
          syncData.changes.emotions = {
            type: 'updated',
            data: emotions,
            count: emotions.length
          };
        }
      }

      // Get conversation changes
      if (dataTypes.includes('conversations')) {
        const conversationKeys = await redisService.keys(`conversation:${userId}:*`);
        const changedConversations = [];

        for (const key of conversationKeys) {
          const conversation = await redisService.get(key);
          if (conversation && new Date(conversation.updatedAt || conversation.timestamp) > since) {
            changedConversations.push(conversation);
          }
        }

        if (changedConversations.length > 0) {
          syncData.changes.conversations = {
            type: 'updated',
            data: changedConversations,
            count: changedConversations.length
          };
        }
      }

      return {
        success: true,
        ...syncData
      };

    } catch (error) {
      logger.error(`Incremental sync error for user ${userId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process offline queue
   */
  async processOfflineQueue(userId, queueItems) {
    try {
      const results = {
        processed: 0,
        failed: 0,
        errors: []
      };

      // Sort by priority and timestamp
      const sortedItems = queueItems.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority] || 1;
        const bPriority = priorityOrder[b.priority] || 1;
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        
        return new Date(a.timestamp) - new Date(b.timestamp);
      });

      for (const item of sortedItems) {
        try {
          // Check if item is too old (7 days)
          const itemAge = Date.now() - new Date(item.timestamp).getTime();
          if (itemAge > 7 * 24 * 60 * 60 * 1000) {
            results.errors.push({
              itemId: item.id,
              error: 'Item too old to process'
            });
            results.failed++;
            continue;
          }

          // Process based on endpoint
          let processed = false;
          
          switch (item.endpoint) {
            case '/emotions':
              processed = await this.processEmotionQueueItem(userId, item);
              break;
            case '/analytics/session':
              processed = await this.processAnalyticsQueueItem(userId, item);
              break;
            case '/user/settings':
              processed = await this.processSettingsQueueItem(userId, item);
              break;
            default:
              results.errors.push({
                itemId: item.id,
                error: `Unsupported endpoint: ${item.endpoint}`
              });
              results.failed++;
              continue;
          }

          if (processed) {
            results.processed++;
          } else {
            results.failed++;
          }

        } catch (error) {
          results.errors.push({
            itemId: item.id,
            error: error.message
          });
          results.failed++;
        }
      }

      return {
        success: true,
        results
      };

    } catch (error) {
      logger.error(`Offline queue processing error for user ${userId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process emotion queue item
   */
  async processEmotionQueueItem(userId, item) {
    try {
      const emotionData = {
        userId,
        ...item.data,
        queuedAt: new Date(item.timestamp),
        processedAt: new Date()
      };

      const emotion = new EmotionalAnalyticsSession(emotionData);
      await emotion.save();

      return true;
    } catch (error) {
      logger.error(`Emotion queue item processing error:`, error);
      return false;
    }
  }

  /**
   * Process analytics queue item
   */
  async processAnalyticsQueueItem(userId, item) {
    try {
      // Store analytics session data
      const analyticsKey = `analytics:session:${userId}:${item.id}`;
      await redisService.set(analyticsKey, {
        ...item.data,
        queuedAt: new Date(item.timestamp),
        processedAt: new Date()
      }, 86400 * 30); // 30 days

      return true;
    } catch (error) {
      logger.error(`Analytics queue item processing error:`, error);
      return false;
    }
  }

  /**
   * Process settings queue item
   */
  async processSettingsQueueItem(userId, item) {
    try {
      await User.findByIdAndUpdate(userId, {
        $set: { settings: item.data }
      });

      return true;
    } catch (error) {
      logger.error(`Settings queue item processing error:`, error);
      return false;
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(userId) {
    try {
      const stats = {
        totalSyncs: 0,
        recentSyncs: 0,
        conflicts: 0,
        lastSync: null
      };

      // Get sync operations for user
      const syncKeys = await redisService.keys(`sync:*${userId}*`);
      stats.totalSyncs = syncKeys.length;

      // Get recent syncs (last 24 hours)
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recentSyncKeys = syncKeys.filter(key => {
        const timestamp = key.split('_')[2];
        return timestamp && parseInt(timestamp) > twentyFourHoursAgo;
      });
      stats.recentSyncs = recentSyncKeys.length;

      // Get last sync timestamp
      if (syncKeys.length > 0) {
        const lastSyncKey = syncKeys[syncKeys.length - 1];
        const lastSyncData = await redisService.get(lastSyncKey);
        stats.lastSync = lastSyncData?.timestamp || null;
      }

      return stats;

    } catch (error) {
      logger.error(`Sync stats error for user ${userId}:`, error);
      return {
        error: error.message
      };
    }
  }

  /**
   * Clean up old sync operations
   */
  async cleanupOldSyncs() {
    try {
      const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago
      const syncKeys = await redisService.keys('sync:*');
      
      let cleaned = 0;
      for (const key of syncKeys) {
        const timestamp = key.split('_')[2];
        if (timestamp && parseInt(timestamp) < cutoffTime) {
          await redisService.del(key);
          cleaned++;
        }
      }

      logger.info(`Cleaned up ${cleaned} old sync operations`);
      return cleaned;

    } catch (error) {
      logger.error('Sync cleanup error:', error);
      return 0;
    }
  }
}

// Export singleton instance
export default new OfflineSyncService();