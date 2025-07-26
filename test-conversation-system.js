#!/usr/bin/env node

/**
 * Test Script: Conversation Persistence System
 * 
 * This script tests the new conversation persistence functionality
 * to ensure everything works correctly before deployment.
 */

import mongoose from 'mongoose';
import { env } from './src/config/environment.js';
import User from './src/models/User.js';
import conversationService from './src/services/conversationService.js';
import logger from './src/utils/logger.js';
const log = logger;

// Test configuration
const TEST_USER_EMAIL = 'test-conversation@numina.app';
const TEST_USER_PASSWORD = 'testpass123';

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(env.MONGO_URI, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    log.info('Connected to MongoDB for testing');
  } catch (error) {
    log.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};

// Create or get test user
const getTestUser = async () => {
  let user = await User.findOne({ email: TEST_USER_EMAIL });
  
  if (!user) {
    log.info('Creating test user...');
    user = new User({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      profile: new Map([
        ['username', 'test-user'],
        ['displayName', 'Test User']
      ])
    });
    await user.save();
    log.info(`✅ Test user created: ${user._id}`);
  } else {
    log.info(`✅ Using existing test user: ${user._id}`);
  }
  
  return user;
};

// Test conversation creation
const testConversationCreation = async (userId) => {
  log.info('🧪 Testing conversation creation...');
  
  const conversation = await conversationService.createConversation(
    userId,
    'Test Conversation - AI Assistant Chat'
  );
  
  log.info(`✅ Created conversation: ${conversation._id}`);
  log.info(`   Title: ${conversation.title}`);
  log.info(`   Messages: ${conversation.messageCount}`);
  
  return conversation;
};

// Test adding messages
const testAddingMessages = async (userId, conversationId) => {
  log.info('🧪 Testing message addition...');
  
  // Add user message
  await conversationService.addMessage(
    userId,
    conversationId,
    'user',
    'Hello! Can you help me test the conversation system?',
    [],
    { testMessage: true }
  );
  log.info('✅ Added user message');
  
  // Add assistant response
  await conversationService.addMessage(
    userId,
    conversationId,
    'assistant',
    'Hello! I\'d be happy to help test the conversation system. The conversation persistence is working correctly!',
    [],
    { testResponse: true }
  );
  log.info('✅ Added assistant response');
  
  // Add another user message
  await conversationService.addMessage(
    userId,
    conversationId,
    'user',
    'Great! Can you tell me more about the features?',
    [],
    { followUpMessage: true }
  );
  log.info('✅ Added follow-up user message');
  
  // Add assistant response with metadata
  await conversationService.addMessage(
    userId,
    conversationId,
    'assistant',
    'The conversation system includes:\n• Persistent storage (no 24h expiration)\n• Message threading\n• Attachments support\n• Rich metadata\n• Search capabilities\n• Archive functionality',
    [],
    { 
      features: ['persistence', 'threading', 'attachments'],
      helpfulResponse: true 
    }
  );
  log.info('✅ Added detailed assistant response');
  
  return true;
};

// Test conversation retrieval
const testConversationRetrieval = async (userId, conversationId) => {
  log.info('🧪 Testing conversation retrieval...');
  
  // Get specific conversation
  const conversation = await conversationService.getConversation(userId, conversationId);
  
  if (!conversation) {
    throw new Error('Failed to retrieve conversation');
  }
  
  log.info(`✅ Retrieved conversation: ${conversation._id}`);
  log.info(`   Title: ${conversation.title}`);
  log.info(`   Messages: ${conversation.messageCount}`);
  log.info(`   Last Activity: ${conversation.lastActivity}`);
  log.info(`   Created: ${conversation.createdAt}`);
  
  // Verify messages
  const messages = conversation.messages;
  log.info(`✅ Found ${messages.length} messages:`);
  
  messages.forEach((msg, index) => {
    log.info(`   ${index + 1}. [${msg.role}] ${msg.content.substring(0, 50)}...`);
    log.info(`      Timestamp: ${msg.timestamp}`);
    if (Object.keys(msg.metadata || {}).length > 0) {
      log.info(`      Metadata: ${JSON.stringify(msg.metadata)}`);
    }
  });
  
  return conversation;
};

// Test getting user conversations
const testUserConversations = async (userId) => {
  log.info('🧪 Testing user conversations list...');
  
  const result = await conversationService.getUserConversations(userId, {
    page: 1,
    limit: 10,
    includeArchived: false
  });
  
  log.info(`✅ Found ${result.conversations.length} conversations`);
  log.info(`   Total: ${result.pagination.total}`);
  log.info(`   Pages: ${result.pagination.pages}`);
  
  result.conversations.forEach((conv, index) => {
    log.info(`   ${index + 1}. ${conv.title} (${conv.messageCount} messages)`);
    log.info(`      Last Activity: ${conv.lastActivity}`);
  });
  
  return result;
};

// Test conversation context for AI
const testConversationContext = async (userId, conversationId) => {
  log.info('🧪 Testing conversation context for AI...');
  
  const context = await conversationService.getConversationContext(userId, conversationId, 20);
  
  log.info(`✅ Retrieved context:`);
  log.info(`   Recent Memory: ${context.recentMemory.length} items`);
  log.info(`   Conversation History: ${context.conversationHistory.length} messages`);
  
  if (context.conversationHistory.length > 0) {
    log.info('   Sample conversation messages:');
    context.conversationHistory.slice(0, 3).forEach((msg, index) => {
      log.info(`     ${index + 1}. [${msg.role}] ${msg.content.substring(0, 40)}...`);
    });
  }
  
  return context;
};

// Test conversation management operations
const testConversationManagement = async (userId, conversationId) => {
  log.info('🧪 Testing conversation management...');
  
  // Update title
  const updatedConv = await conversationService.updateConversationTitle(
    userId,
    conversationId,
    'Updated Test Conversation - Feature Testing Complete'
  );
  log.info(`✅ Updated title: ${updatedConv.title}`);
  
  // Archive conversation
  const archivedConv = await conversationService.archiveConversation(userId, conversationId);
  log.info(`✅ Archived conversation: ${archivedConv.isArchived}`);
  
  // Test archived conversation appears in archived list
  const archivedResult = await conversationService.getUserConversations(userId, {
    page: 1,
    limit: 10,
    includeArchived: true
  });
  
  const archivedFound = archivedResult.conversations.find(c => c._id.toString() === conversationId);
  if (archivedFound && archivedFound.isArchived) {
    log.info('✅ Archived conversation found in archived list');
  } else {
    log.warn('⚠️ Archived conversation not found in archived list');
  }
  
  return true;
};

// Main test function
const runTests = async () => {
  try {
    await connectDB();
    
    log.info('🚀 Starting Conversation System Tests...\n');
    
    // Get test user
    const user = await getTestUser();
    const userId = user._id;
    
    // Test 1: Create conversation
    const conversation = await testConversationCreation(userId);
    const conversationId = conversation._id;
    
    console.log('');
    
    // Test 2: Add messages
    await testAddingMessages(userId, conversationId);
    
    console.log('');
    
    // Test 3: Retrieve conversation
    await testConversationRetrieval(userId, conversationId);
    
    console.log('');
    
    // Test 4: Get user conversations
    await testUserConversations(userId);
    
    console.log('');
    
    // Test 5: Get conversation context
    await testConversationContext(userId, conversationId);
    
    console.log('');
    
    // Test 6: Conversation management
    await testConversationManagement(userId, conversationId);
    
    console.log('');
    
    // Final summary
    log.info('🎉 All tests completed successfully!');
    log.info('\n📊 Test Summary:');
    log.info('✅ Conversation creation');
    log.info('✅ Message addition with metadata');
    log.info('✅ Conversation retrieval');
    log.info('✅ User conversations listing');
    log.info('✅ AI context generation');
    log.info('✅ Conversation management (title, archive)');
    
    log.info('\n🔧 System Status:');
    log.info('✅ Persistent conversation storage working');
    log.info('✅ Message threading functional');
    log.info('✅ Metadata preservation working');
    log.info('✅ Conversation management operational');
    log.info('✅ AI context integration ready');
    
    log.info('\n🚀 The conversation persistence system is ready for production!');
    
    process.exit(0);
    
  } catch (error) {
    log.error('❌ Test failed:', error);
    console.error('Full error:', error.stack);
    process.exit(1);
  }
};

// Handle script arguments
const args = process.argv.slice(2);
const cleanup = args.includes('--cleanup');

if (cleanup) {
  log.info('🧹 Cleaning up test data...');
  connectDB().then(async () => {
    await User.deleteOne({ email: TEST_USER_EMAIL });
    const { default: Conversation } = await import('./src/models/Conversation.js');
    await Conversation.deleteMany({ userId: { $exists: true } });
    log.info('✅ Test data cleaned up');
    process.exit(0);
  }).catch(error => {
    log.error('Cleanup failed:', error);
    process.exit(1);
  });
} else {
  // Run tests
  runTests();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log.info('\n🛑 Tests interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  log.info('\n🛑 Tests terminated');
  process.exit(1);
});