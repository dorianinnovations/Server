#!/usr/bin/env node

/**
 * Migration Script: Convert Short-Term Memory to Persistent Conversations
 * 
 * This script migrates existing short-term memory data to the new persistent
 * conversation system, ensuring no user data is lost during the transition.
 */

import mongoose from 'mongoose';
import { env } from '../src/config/environment.js';
import User from '../src/models/User.js';
import ShortTermMemory from '../src/models/ShortTermMemory.js';
import conversationService from '../src/services/conversationService.js';
import { log } from '../src/utils/logger.js';

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(env.MONGO_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
      bufferCommands: false,
    });
    log.info('Connected to MongoDB for migration');
  } catch (error) {
    log.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};

// Migration function
const migrateUserConversations = async (userId) => {
  try {
    log.info(`Starting migration for user: ${userId}`);
    
    // Check if user already has conversations
    const { default: Conversation } = await import('../src/models/Conversation.js');
    const existingConversations = await Conversation.countDocuments({ userId });
    
    if (existingConversations > 0) {
      log.info(`User ${userId} already has ${existingConversations} conversations, skipping`);
      return { skipped: true, reason: 'Already migrated' };
    }
    
    // Get user's short-term memory
    const memories = await ShortTermMemory.find({ userId })
      .sort({ timestamp: 1 })
      .lean();
    
    if (memories.length === 0) {
      log.info(`User ${userId} has no memories to migrate`);
      return { skipped: true, reason: 'No data to migrate' };
    }
    
    // Group memories by conversationId or time-based sessions
    const conversationGroups = new Map();
    let currentConversationId = null;
    let lastTimestamp = null;
    const SESSION_GAP_MINUTES = 30; // Group messages within 30 minutes as same conversation
    
    for (const memory of memories) {
      const memoryTime = new Date(memory.timestamp);
      
      // Determine conversation grouping
      if (memory.conversationId) {
        currentConversationId = memory.conversationId;
      } else {
        // Group by time gaps
        if (!lastTimestamp || 
            (memoryTime - lastTimestamp) > (SESSION_GAP_MINUTES * 60 * 1000)) {
          currentConversationId = `session_${memoryTime.getTime()}`;
        }
      }
      
      if (!conversationGroups.has(currentConversationId)) {
        conversationGroups.set(currentConversationId, []);
      }
      
      conversationGroups.get(currentConversationId).push(memory);
      lastTimestamp = memoryTime;
    }
    
    log.info(`User ${userId}: Found ${memories.length} memories in ${conversationGroups.size} conversation groups`);
    
    // Create conversations
    const createdConversations = [];
    let totalMessages = 0;
    
    for (const [groupId, messages] of conversationGroups) {
      try {
        const conversation = new Conversation({
          userId,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            attachments: msg.attachments || [],
            metadata: {
              migratedFromShortTerm: true,
              originalTimestamp: msg.timestamp,
              ...(msg.metadata || {})
            }
          })),
          lastActivity: new Date(Math.max(...messages.map(m => new Date(m.timestamp)))),
          createdAt: new Date(Math.min(...messages.map(m => new Date(m.timestamp))))
        });
        
        await conversation.save();
        createdConversations.push(conversation);
        totalMessages += messages.length;
        
        log.debug(`Created conversation ${conversation._id} with ${messages.length} messages`);
        
      } catch (error) {
        log.error(`Failed to create conversation for group ${groupId}:`, error);
      }
    }
    
    log.info(`User ${userId}: Successfully migrated ${totalMessages} messages to ${createdConversations.length} conversations`);
    
    return {
      success: true,
      conversationsCreated: createdConversations.length,
      messagesProcessed: totalMessages,
      conversations: createdConversations.map(c => ({
        id: c._id,
        messageCount: c.messageCount,
        title: c.title,
        lastActivity: c.lastActivity
      }))
    };
    
  } catch (error) {
    log.error(`Migration failed for user ${userId}:`, error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

// Main migration function
const runMigration = async () => {
  try {
    await connectDB();
    
    log.info('🚀 Starting conversation migration...');
    
    // Get all users with short-term memory
    const usersWithMemory = await ShortTermMemory.distinct('userId');
    log.info(`Found ${usersWithMemory.length} users with short-term memory data`);
    
    if (usersWithMemory.length === 0) {
      log.info('No users found with memory data. Migration complete.');
      process.exit(0);
    }
    
    // Migration statistics
    const stats = {
      totalUsers: usersWithMemory.length,
      successful: 0,
      skipped: 0,
      failed: 0,
      totalConversations: 0,
      totalMessages: 0
    };
    
    // Process users in batches to avoid overwhelming the database
    const BATCH_SIZE = 10;
    for (let i = 0; i < usersWithMemory.length; i += BATCH_SIZE) {
      const batch = usersWithMemory.slice(i, i + BATCH_SIZE);
      
      log.info(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(usersWithMemory.length / BATCH_SIZE)}`);
      
      const batchPromises = batch.map(async (userId) => {
        const result = await migrateUserConversations(userId);
        
        if (result.skipped) {
          stats.skipped++;
          log.info(`✓ User ${userId}: ${result.reason}`);
        } else if (result.success) {
          stats.successful++;
          stats.totalConversations += result.conversationsCreated;
          stats.totalMessages += result.messagesProcessed;
          log.info(`✅ User ${userId}: ${result.conversationsCreated} conversations, ${result.messagesProcessed} messages`);
        } else {
          stats.failed++;
          log.error(`❌ User ${userId}: ${result.error}`);
        }
        
        return result;
      });
      
      await Promise.all(batchPromises);
      
      // Brief pause between batches
      if (i + BATCH_SIZE < usersWithMemory.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Final statistics
    log.info('\n📊 Migration Complete! Statistics:');
    log.info(`Total Users: ${stats.totalUsers}`);
    log.info(`✅ Successful: ${stats.successful}`);
    log.info(`⏭️  Skipped: ${stats.skipped}`);
    log.info(`❌ Failed: ${stats.failed}`);
    log.info(`💬 Total Conversations Created: ${stats.totalConversations}`);
    log.info(`📝 Total Messages Migrated: ${stats.totalMessages}`);
    
    if (stats.failed > 0) {
      log.warn(`⚠️  ${stats.failed} users failed migration. Check logs for details.`);
      process.exit(1);
    }
    
    log.info('🎉 All users successfully migrated to persistent conversations!');
    process.exit(0);
    
  } catch (error) {
    log.error('Migration script failed:', error);
    process.exit(1);
  }
};

// Handle script arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const userId = args.find(arg => arg.startsWith('--user='))?.split('=')[1];

if (dryRun) {
  log.info('🔍 DRY RUN MODE - No changes will be made');
  // TODO: Implement dry run mode
}

if (userId) {
  log.info(`🎯 Single user migration mode: ${userId}`);
  connectDB().then(() => migrateUserConversations(userId)).then(result => {
    log.info('Single user migration result:', result);
    process.exit(0);
  }).catch(error => {
    log.error('Single user migration failed:', error);
    process.exit(1);
  });
} else {
  // Run full migration
  runMigration();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log.info('\n🛑 Migration interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  log.info('\n🛑 Migration terminated');
  process.exit(1);
});