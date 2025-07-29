#!/usr/bin/env node

/**
 * Deep dive into MongoDB collections to understand what data we have
 */

import mongoose from 'mongoose';
import UserBehaviorProfile from './src/models/UserBehaviorProfile.js';
import User from './src/models/User.js';
import ShortTermMemory from './src/models/ShortTermMemory.js';
import AnalyticsInsight from './src/models/AnalyticsInsight.js';
import Conversation from './src/models/Conversation.js';
import CollectiveSnapshot from './src/models/CollectiveSnapshot.js';
import Event from './src/models/Event.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dorianinnovations:BFogj1Par1QzmSyy@numinacluster.li7o6uc.mongodb.net/numina?retryWrites=true&w=majority&appName=NuminaCluster';

async function exploreData() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('🔍 Connected to MongoDB Atlas - Numina Cluster\n');

    // 1. Get collection stats
    console.log('📊 COLLECTION STATISTICS:');
    const collections = [
      { name: 'Users', model: User },
      { name: 'UserBehaviorProfiles', model: UserBehaviorProfile },
      { name: 'ShortTermMemory', model: ShortTermMemory },
      { name: 'AnalyticsInsights', model: AnalyticsInsight },
      { name: 'Conversations', model: Conversation },
      { name: 'CollectiveSnapshots', model: CollectiveSnapshot },
      { name: 'Events', model: Event }
    ];

    for (const { name, model } of collections) {
      const count = await model.countDocuments();
      console.log(`   ${name}: ${count} documents`);
    }

    // 2. Dive into UserBehaviorProfiles
    console.log('\n🧠 USER BEHAVIOR PROFILES (Top 3 with most patterns):');
    const topProfiles = await UserBehaviorProfile.find({})
      .sort({ 'behaviorPatterns.length': -1 })
      .limit(3);

    for (const profile of topProfiles) {
      const user = await User.findById(profile.userId).select('email');
      console.log(`\n👤 ${user?.email || 'Unknown'} (${profile.userId})`);
      console.log(`   📈 ${profile.behaviorPatterns?.length || 0} behavior patterns`);
      console.log(`   🎭 ${profile.personalityTraits?.length || 0} personality traits`);
      
      if (profile.behaviorPatterns?.length > 0) {
        console.log('   🔍 Pattern Details:');
        profile.behaviorPatterns.slice(0, 5).forEach(p => {
          console.log(`     • ${p.pattern} (${p.type}): ${Math.round(p.confidence * 100)}% confidence, ${p.frequency} occurrences`);
          if (p.description) console.log(`       "${p.description.substring(0, 80)}..."`);
        });
      }

      if (profile.communicationStyle) {
        console.log('   💬 Communication Style:');
        console.log(`     Tone: ${profile.communicationStyle.preferredTone}`);
        console.log(`     Length: ${profile.communicationStyle.responseLength}`);
        console.log(`     Complexity: ${profile.communicationStyle.complexityLevel}`);
      }
    }

    // 3. Check ShortTermMemory for recent activity
    console.log('\n🧠 SHORT-TERM MEMORY ANALYSIS:');
    const memoryStats = await ShortTermMemory.aggregate([
      {
        $group: {
          _id: '$userId',
          totalMemories: { $sum: 1 },
          avgImportance: { $avg: '$importance' },
          types: { $addToSet: '$type' },
          lastMemory: { $max: '$timestamp' }
        }
      },
      { $sort: { totalMemories: -1 } },
      { $limit: 5 }
    ]);

    memoryStats.forEach(stat => {
      console.log(`   User ${stat._id}: ${stat.totalMemories} memories, avg importance: ${(stat.avgImportance || 0).toFixed(2)}`);
      console.log(`     Types: ${stat.types.join(', ')}`);
      console.log(`     Last activity: ${new Date(stat.lastMemory).toLocaleDateString()}`);
    });

    // 4. Analytics Insights
    console.log('\n📈 ANALYTICS INSIGHTS:');
    const insightCount = await AnalyticsInsight.countDocuments();
    console.log(`   Total insights: ${insightCount}`);
    
    if (insightCount > 0) {
      const insightsByCategory = await AnalyticsInsight.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 }, avgConfidence: { $avg: '$confidence' } } },
        { $sort: { count: -1 } }
      ]);
      
      insightsByCategory.forEach(cat => {
        console.log(`     ${cat._id}: ${cat.count} insights, ${(cat.avgConfidence * 100).toFixed(1)}% avg confidence`);
      });
    }

    // 5. Conversations
    console.log('\n💬 CONVERSATIONS:');
    const convStats = await Conversation.aggregate([
      {
        $group: {
          _id: '$userId',
          totalConversations: { $sum: 1 },
          totalMessages: { $sum: { $size: '$messages' } },
          lastConversation: { $max: '$updatedAt' }
        }
      },
      { $sort: { totalMessages: -1 } },
      { $limit: 5 }
    ]);

    convStats.forEach(stat => {
      console.log(`   User ${stat._id}: ${stat.totalConversations} conversations, ${stat.totalMessages} total messages`);
      console.log(`     Last activity: ${new Date(stat.lastConversation).toLocaleDateString()}`);
    });

    // 6. Collective Snapshots
    console.log('\n🌐 COLLECTIVE SNAPSHOTS:');
    const snapshots = await CollectiveSnapshot.find({}).sort({ generatedAt: -1 }).limit(3);
    snapshots.forEach(snap => {
      console.log(`   ${snap.timeRange} snapshot: ${snap.userCount} users, dominant emotion: ${snap.dominantEmotion}`);
      console.log(`     Generated: ${new Date(snap.generatedAt).toLocaleDateString()}`);
      if (snap.insight) console.log(`     Insight: "${snap.insight.substring(0, 100)}..."`);
    });

    // 7. Sample actual data structures
    console.log('\n🔬 SAMPLE DATA STRUCTURES:');
    
    // Get a rich behavior profile
    const richProfile = await UserBehaviorProfile.findOne({ 
      'behaviorPatterns.2': { $exists: true } 
    });
    
    if (richProfile) {
      console.log('\n   📋 Sample Behavior Pattern:');
      const pattern = richProfile.behaviorPatterns[0];
      console.log(JSON.stringify({
        type: pattern.type,
        pattern: pattern.pattern,
        frequency: pattern.frequency,
        intensity: pattern.intensity,
        confidence: pattern.confidence,
        firstObserved: pattern.firstObserved,
        lastObserved: pattern.lastObserved,
        metadata: pattern.metadata
      }, null, 2));
    }

    // Get sample memory
    const sampleMemory = await ShortTermMemory.findOne({}).sort({ timestamp: -1 });
    if (sampleMemory) {
      console.log('\n   🧠 Sample Memory Entry:');
      console.log(JSON.stringify({
        type: sampleMemory.type,
        importance: sampleMemory.importance,
        content: sampleMemory.content?.substring(0, 100) + '...',
        tags: sampleMemory.tags,
        timestamp: sampleMemory.timestamp
      }, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

exploreData().catch(console.error);