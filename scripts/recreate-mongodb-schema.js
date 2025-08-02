/**
 * MongoDB Schema Recreation Script
 * 
 * This script completely recreates the MongoDB schema to fix:
 * - Broken behavioral pattern relationships 
 * - Collection name mismatches
 * - Missing indexes for performance
 * - Inconsistent data structures
 * 
 * ⚠️  WARNING: This will DELETE ALL existing data!
 * Make sure you have backups before running.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

class MongoSchemaRecreator {
  constructor() {
    this.targetCollections = [
      'users',
      'shorttermmemories', 
      'userbehaviorprofiles',
      'conversations',
      'events',
      'tools',
      'userconstants',
      'deletiontasks'
    ];
    
    this.collectionsToKeep = [
      'creditpools',
      'sandbox_sessions', 
      'locked_nodes'
    ];
  }

  async connect() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    this.db = mongoose.connection.db;
  }

  async backupCollections() {
    console.log('\n💾 CREATING BACKUPS...');
    
    for (const collectionName of this.targetCollections) {
      try {
        const count = await this.db.collection(collectionName).countDocuments();
        if (count > 0) {
          console.log(`📦 Backing up ${collectionName}: ${count} documents`);
          
          // Create backup collection name with timestamp
          const backupName = `backup_${collectionName}_${Date.now()}`;
          const docs = await this.db.collection(collectionName).find().toArray();
          
          if (docs.length > 0) {
            await this.db.collection(backupName).insertMany(docs);
            console.log(`✅ Backup created: ${backupName}`);
          }
        }
      } catch (error) {
        console.log(`⚠️  Collection ${collectionName} doesn't exist, skipping backup`);
      }
    }
  }

  async dropTargetCollections() {
    console.log('\n🗑️  DROPPING TARGET COLLECTIONS...');
    
    for (const collectionName of this.targetCollections) {
      try {
        await this.db.collection(collectionName).drop();
        console.log(`❌ Dropped: ${collectionName}`);
      } catch (error) {
        if (error.codeName === 'NamespaceNotFound') {
          console.log(`⚠️  Collection ${collectionName} doesn't exist`);
        } else {
          console.log(`❌ Error dropping ${collectionName}:`, error.message);
        }
      }
    }
  }

  async createCollectionsWithIndexes() {
    console.log('\n🏗️  CREATING COLLECTIONS WITH PROPER INDEXES...');

    // Users Collection
    await this.createUsersCollection();
    
    // ShortTermMemories Collection  
    await this.createShortTermMemoriesCollection();
    
    // UserBehaviorProfiles Collection
    await this.createUserBehaviorProfilesCollection();
    
    // Conversations Collection
    await this.createConversationsCollection();
    
    // Events Collection
    await this.createEventsCollection();
    
    // Tools Collection
    await this.createToolsCollection();
    
    // UserConstants Collection
    await this.createUserConstantsCollection();
    
    // DeletionTasks Collection
    await this.createDeletionTasksCollection();
  }

  async createUsersCollection() {
    console.log('👤 Creating users collection...');
    
    const users = this.db.collection('users');
    
    // Create indexes for users
    await users.createIndex({ email: 1 }, { unique: true });
    await users.createIndex({ createdAt: -1 });
    await users.createIndex({ 'subscription.aether.isActive': 1 });
    await users.createIndex({ 'profile.tier': 1 });
    
    console.log('✅ Users collection created with indexes');
  }

  async createShortTermMemoriesCollection() {
    console.log('🧠 Creating shorttermmemories collection...');
    
    const memories = this.db.collection('shorttermmemories');
    
    // Create performance indexes for memories
    await memories.createIndex({ userId: 1, timestamp: -1 });
    await memories.createIndex({ conversationId: 1, timestamp: -1 });
    await memories.createIndex({ userId: 1, role: 1, timestamp: -1 });
    await memories.createIndex({ timestamp: 1 }, { expireAfterSeconds: 86400 }); // 24h TTL
    
    console.log('✅ ShortTermMemories collection created with indexes');
  }

  async createUserBehaviorProfilesCollection() {
    console.log('🔬 Creating userbehaviorprofiles collection...');
    
    const profiles = this.db.collection('userbehaviorprofiles');
    
    // Create indexes for behavioral profiles
    await profiles.createIndex({ userId: 1 }, { unique: true });
    await profiles.createIndex({ 'lifecycleStage.stage': 1 });
    await profiles.createIndex({ 'interests.category': 1 });
    await profiles.createIndex({ 'personalityTraits.trait': 1 });
    await profiles.createIndex({ updatedAt: -1 });
    await profiles.createIndex({ userId: 1, 'intelligenceData.lastAnalysis': -1 });
    await profiles.createIndex({ userId: 1, 'temporalPatterns.direction': 1 });
    
    console.log('✅ UserBehaviorProfiles collection created with indexes');
  }

  async createConversationsCollection() {
    console.log('💬 Creating conversations collection...');
    
    const conversations = this.db.collection('conversations');
    
    // Create indexes for conversations
    await conversations.createIndex({ userId: 1, timestamp: -1 });
    await conversations.createIndex({ conversationId: 1 });
    await conversations.createIndex({ userId: 1, isActive: 1 });
    
    console.log('✅ Conversations collection created with indexes');
  }

  async createEventsCollection() {
    console.log('📊 Creating events collection...');
    
    const events = this.db.collection('events');
    
    // Create indexes for events
    await events.createIndex({ userId: 1, timestamp: -1 });
    await events.createIndex({ eventType: 1 });
    await events.createIndex({ timestamp: -1 });
    
    console.log('✅ Events collection created with indexes');
  }

  async createToolsCollection() {
    console.log('🔧 Creating tools collection...');
    
    const tools = this.db.collection('tools');
    
    // Create indexes for tools
    await tools.createIndex({ name: 1 }, { unique: true });
    await tools.createIndex({ category: 1 });
    await tools.createIndex({ isActive: 1 });
    
    console.log('✅ Tools collection created with indexes');
  }

  async createUserConstantsCollection() {
    console.log('⚙️ Creating userconstants collection...');
    
    const constants = this.db.collection('userconstants');
    
    // Create indexes for user constants
    await constants.createIndex({ userId: 1 });
    await constants.createIndex({ key: 1 });
    await constants.createIndex({ userId: 1, key: 1 }, { unique: true });
    
    console.log('✅ UserConstants collection created with indexes');
  }

  async createDeletionTasksCollection() {
    console.log('🗑️ Creating deletiontasks collection...');
    
    const deletionTasks = this.db.collection('deletiontasks');
    
    // Create indexes for deletion tasks
    await deletionTasks.createIndex({ userId: 1 });
    await deletionTasks.createIndex({ status: 1 });
    await deletionTasks.createIndex({ scheduledFor: 1 });
    
    console.log('✅ DeletionTasks collection created with indexes');
  }

  async createSampleData() {
    console.log('\n🌱 CREATING SAMPLE DATA FOR TESTING...');
    
    // Create a test user
    const testUser = {
      _id: new mongoose.Types.ObjectId(),
      email: 'schema-test@numina.ai',
      password: '$2b$12$hashedPasswordHere',
      profile: {},
      subscription: {
        aether: {
          isActive: false,
          startDate: null,
          endDate: null,
          plan: null
        }
      },
      usage: {},
      emotionalLog: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await this.db.collection('users').insertOne(testUser);
    console.log('👤 Created test user');
    
    // Create sample memories with varied lengths
    const sampleMemories = [
      {
        userId: testUser._id,
        content: 'Short msg',
        role: 'user',
        timestamp: new Date(Date.now() - 300000),
        conversationId: 'test-conv-1'
      },
      {
        userId: testUser._id,
        content: 'This is a medium length message that contains more context and information for testing',
        role: 'user', 
        timestamp: new Date(Date.now() - 200000),
        conversationId: 'test-conv-1'
      },
      {
        userId: testUser._id,
        content: 'This is a much longer message that contains significantly more text and context to test the avgResponseLength calculation properly. It should provide a good baseline for behavioral pattern analysis.',
        role: 'user',
        timestamp: new Date(Date.now() - 100000),
        conversationId: 'test-conv-1'
      }
    ];
    
    await this.db.collection('shorttermmemories').insertMany(sampleMemories);
    console.log('🧠 Created sample memories with varied lengths');
    
    // Create initial behavior profile
    const behaviorProfile = {
      userId: testUser._id,
      lifecycleStage: { stage: 'exploration' },
      interests: [],
      personalityTraits: [],
      temporalPatterns: [],
      behaviorPatterns: [], // Will be populated by UBPM analysis
      intelligenceData: {
        lastAnalysis: new Date(),
        cognitiveSignature: {}
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await this.db.collection('userbehaviorprofiles').insertOne(behaviorProfile);
    console.log('🔬 Created initial behavior profile');
    
    return testUser._id;
  }

  async validateSchema() {
    console.log('\n🔍 VALIDATING NEW SCHEMA...');
    
    for (const collectionName of this.targetCollections) {
      try {
        const count = await this.db.collection(collectionName).countDocuments();
        const indexes = await this.db.collection(collectionName).indexes();
        
        console.log(`✅ ${collectionName}: ${count} documents, ${indexes.length} indexes`);
        
        // Show index details for critical collections
        if (['shorttermmemories', 'userbehaviorprofiles'].includes(collectionName)) {
          console.log(`   Indexes: ${indexes.map(idx => Object.keys(idx.key).join(', ')).join(' | ')}`);
        }
      } catch (error) {
        console.log(`❌ ${collectionName}: Error -`, error.message);
      }
    }
  }

  async showBackups() {
    console.log('\n💾 AVAILABLE BACKUPS:');
    const collections = await this.db.listCollections().toArray();
    const backups = collections.filter(col => col.name.startsWith('backup_'));
    
    if (backups.length > 0) {
      backups.forEach(backup => {
        console.log(`📦 ${backup.name}`);
      });
      console.log('\n⚠️  To restore: use mongorestore or manual collection copy');
    } else {
      console.log('No backups found');
    }
  }

  async disconnect() {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Main execution
async function recreateSchema() {
  const recreator = new MongoSchemaRecreator();
  
  try {
    console.log('🚀 STARTING MONGODB SCHEMA RECREATION');
    console.log('=====================================');
    
    await recreator.connect();
    
    // Step 1: Backup existing data
    await recreator.backupCollections();
    
    // Step 2: Drop target collections
    await recreator.dropTargetCollections();
    
    // Step 3: Recreate with proper schema
    await recreator.createCollectionsWithIndexes();
    
    // Step 4: Create sample data
    const testUserId = await recreator.createSampleData();
    
    // Step 5: Validate new schema
    await recreator.validateSchema();
    
    // Step 6: Show backup info
    await recreator.showBackups();
    
    console.log('\n🎉 SCHEMA RECREATION COMPLETE!');
    console.log('===============================');
    console.log('✅ All collections recreated with proper indexes');
    console.log('✅ Sample data created for testing');
    console.log(`✅ Test user ID: ${testUserId}`);
    console.log('✅ Ready to test UBMP avgResponseLength fix');
    console.log('\nNext steps:');
    console.log('1. Restart the server');
    console.log('2. Test UBPM analysis with sample data');
    console.log('3. Verify real avgResponseLength appears instead of 150');
    
  } catch (error) {
    console.error('❌ Schema recreation failed:', error);
  } finally {
    await recreator.disconnect();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  recreateSchema();
}

export default recreateSchema;