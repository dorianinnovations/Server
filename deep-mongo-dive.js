#!/usr/bin/env node

/**
 * DEEP DIVE into MongoDB - Find ALL the rich data hiding in there
 */

import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://dorianinnovations:BFogj1Par1QzmSyy@numinacluster.li7o6uc.mongodb.net/numina?retryWrites=true&w=majority&appName=NuminaCluster';

async function deepDive() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('🔍 DEEP DIVING INTO MONGODB - Finding ALL hidden data...\n');

    const db = mongoose.connection.db;

    // 1. DISCOVER ALL COLLECTIONS (including hidden ones)
    console.log('📋 ALL COLLECTIONS IN DATABASE:');
    const collections = await db.listCollections().toArray();
    collections.forEach(coll => {
      console.log(`   ${coll.name} (type: ${coll.type})`);
    });
    
    // 2. GET DETAILED STATS FOR EACH COLLECTION
    console.log('\n📊 DETAILED COLLECTION STATISTICS:');
    for (const collection of collections) {
      try {
        const stats = await db.collection(collection.name).stats();
        const count = await db.collection(collection.name).countDocuments();
        const sampleDoc = await db.collection(collection.name).findOne({});
        
        console.log(`\n🗂️  ${collection.name}:`);
        console.log(`   Documents: ${count}`);
        console.log(`   Storage Size: ${(stats.storageSize / 1024).toFixed(1)} KB`);
        console.log(`   Avg Document Size: ${stats.avgObjSize || 0} bytes`);
        console.log(`   Indexes: ${stats.nindexes || 0}`);
        
        if (sampleDoc) {
          console.log(`   Sample Keys: ${Object.keys(sampleDoc).join(', ')}`);
        }
      } catch (err) {
        console.log(`   ❌ Could not get stats for ${collection.name}`);
      }
    }

    // 3. DEEP DIVE INTO SPECIFIC COLLECTIONS
    console.log('\n🧠 BEHAVIORAL PROFILES - DEEP ANALYSIS:');
    
    // Find users with the richest behavioral data
    const richestProfiles = await db.collection('userbehaviorprofiles').aggregate([
      {
        $addFields: {
          patternCount: { $size: { $ifNull: ['$behaviorPatterns', []] } },
          personalityCount: { $size: { $ifNull: ['$personalityTraits', []] } },
          interestCount: { $size: { $ifNull: ['$interestCategories', []] } }
        }
      },
      {
        $sort: { 
          patternCount: -1, 
          personalityCount: -1, 
          interestCount: -1 
        }
      },
      { $limit: 3 }
    ]).toArray();

    for (const profile of richestProfiles) {
      console.log(`\n👤 User ${profile.userId} - RICH PROFILE:`);
      console.log(`   📈 ${profile.patternCount} behavior patterns`);
      console.log(`   🎭 ${profile.personalityCount} personality traits`);
      console.log(`   🎯 ${profile.interestCount} interest categories`);
      
      // Show actual pattern details
      if (profile.behaviorPatterns && profile.behaviorPatterns.length > 0) {
        console.log(`   🔍 Top Patterns:`);
        profile.behaviorPatterns.slice(0, 3).forEach(pattern => {
          console.log(`     • ${pattern.pattern} (${pattern.type}): ${Math.round(pattern.confidence * 100)}% confidence`);
          console.log(`       Frequency: ${pattern.frequency}, Intensity: ${pattern.intensity}`);
          if (pattern.description) {
            console.log(`       Description: "${pattern.description.substring(0, 100)}..."`);
          }
        });
      }

      // Show personality traits if they exist
      if (profile.personalityTraits && profile.personalityTraits.length > 0) {
        console.log(`   🎭 Personality Traits:`);
        profile.personalityTraits.forEach(trait => {
          console.log(`     • ${trait.trait}: ${Math.round(trait.score * 100)}% (${Math.round(trait.confidence * 100)}% confidence)`);
        });
      }

      // Show interests
      if (profile.interestCategories && profile.interestCategories.length > 0) {
        console.log(`   🎯 Interest Categories:`);
        profile.interestCategories.forEach(interest => {
          console.log(`     • ${interest.category}: ${Math.round(interest.strength * 100)}% strength`);
          if (interest.keywords && interest.keywords.length > 0) {
            console.log(`       Keywords: ${interest.keywords.slice(0, 5).join(', ')}`);
          }
        });
      }

      // Show communication style details
      if (profile.communicationStyle) {
        console.log(`   💬 Communication Style:`);
        const style = profile.communicationStyle;
        console.log(`     Tone: ${style.preferredTone}, Length: ${style.responseLength}`);
        console.log(`     Complexity: ${style.complexityLevel}`);
        if (style.preferredFormats) {
          console.log(`     Formats: ${style.preferredFormats.join(', ')}`);
        }
      }
    }

    // 4. CONVERSATION DEEP DIVE
    console.log('\n💬 CONVERSATIONS - DEEP ANALYSIS:');
    const richConversations = await db.collection('conversations').aggregate([
      {
        $addFields: {
          messageCount: { $size: { $ifNull: ['$messages', []] } }
        }
      },
      { $sort: { messageCount: -1 } },
      { $limit: 3 }
    ]).toArray();

    for (const conv of richConversations) {
      console.log(`\n📝 Conversation ${conv._id}:`);
      console.log(`   Messages: ${conv.messageCount}`);
      console.log(`   Title: ${conv.title || 'Untitled'}`);
      console.log(`   Created: ${new Date(conv.createdAt).toLocaleDateString()}`);
      console.log(`   Last Updated: ${new Date(conv.updatedAt).toLocaleDateString()}`);
      
      if (conv.messages && conv.messages.length > 0) {
        console.log(`   📋 Sample Messages:`);
        conv.messages.slice(0, 3).forEach((msg, idx) => {
          console.log(`     ${idx + 1}. ${msg.role}: "${msg.content.substring(0, 80)}..."`);
          console.log(`        Timestamp: ${new Date(msg.timestamp).toLocaleString()}`);
        });
      }
    }

    // 5. FIND ALL UNIQUE DATA STRUCTURES
    console.log('\n🔬 UNIQUE DATA STRUCTURES FOUND:');
    
    // Sample from each collection to see data structures
    for (const collection of collections) {
      try {
        const sample = await db.collection(collection.name).findOne({});
        if (sample && Object.keys(sample).length > 2) {
          console.log(`\n📄 ${collection.name} Structure:`);
          console.log(JSON.stringify(sample, null, 2).substring(0, 500) + '...');
        }
      } catch (err) {
        console.log(`   ❌ Could not sample ${collection.name}`);
      }
    }

    // 6. TEMPORAL ANALYSIS - Find time-based patterns
    console.log('\n⏰ TEMPORAL ANALYSIS:');
    
    // Behavior patterns over time
    const temporalPatterns = await db.collection('userbehaviorprofiles').aggregate([
      { $unwind: '$behaviorPatterns' },
      {
        $group: {
          _id: {
            pattern: '$behaviorPatterns.pattern',
            week: { 
              $dateToString: { 
                format: "%Y-W%V", 
                date: '$behaviorPatterns.lastObserved' 
              }
            }
          },
          count: { $sum: 1 },
          avgConfidence: { $avg: '$behaviorPatterns.confidence' },
          totalFrequency: { $sum: '$behaviorPatterns.frequency' }
        }
      },
      { $sort: { '_id.week': -1, count: -1 } },
      { $limit: 10 }
    ]).toArray();

    console.log('   📈 Pattern Evolution (by week):');
    temporalPatterns.forEach(pattern => {
      console.log(`     ${pattern._id.pattern} (${pattern._id.week}): ${pattern.count} users, ${Math.round(pattern.avgConfidence * 100)}% conf, ${pattern.totalFrequency} freq`);
    });

    // 7. USER JOURNEY ANALYSIS
    console.log('\n🛤️  USER JOURNEY ANALYSIS:');
    const userJourneys = await db.collection('users').aggregate([
      {
        $lookup: {
          from: 'userbehaviorprofiles',
          localField: '_id',
          foreignField: 'userId',
          as: 'behavior'
        }
      },
      {
        $lookup: {
          from: 'conversations',
          localField: '_id',
          foreignField: 'userId', 
          as: 'conversations'
        }
      },
      {
        $addFields: {
          patternCount: { $size: { $arrayElemAt: ['$behavior.behaviorPatterns', 0] } },
          conversationCount: { $size: '$conversations' },
          totalMessages: { 
            $sum: { 
              $map: { 
                input: '$conversations', 
                as: 'conv', 
                in: { $size: { $ifNull: ['$$conv.messages', []] } } 
              } 
            } 
          }
        }
      },
      { $sort: { totalMessages: -1 } },
      { $limit: 5 }
    ]).toArray();

    console.log('   🏆 Most Active Users:');
    userJourneys.forEach(user => {
      console.log(`     ${user.email}: ${user.totalMessages} messages, ${user.conversationCount} conversations, ${user.patternCount || 0} patterns`);
      console.log(`       Joined: ${new Date(user.createdAt).toLocaleDateString()}`);
      console.log(`       Last Login: ${user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}`);
    });

    // 8. FIND HIDDEN GEMS - Complex queries
    console.log('\n💎 HIDDEN GEMS & COMPLEX PATTERNS:');
    
    // Users with multiple behavioral types
    const multiModalUsers = await db.collection('userbehaviorprofiles').aggregate([
      { $unwind: '$behaviorPatterns' },
      {
        $group: {
          _id: '$userId',
          uniqueTypes: { $addToSet: '$behaviorPatterns.type' },
          patterns: { $push: '$behaviorPatterns.pattern' },
          avgConfidence: { $avg: '$behaviorPatterns.confidence' }
        }
      },
      {
        $addFields: {
          typeCount: { $size: '$uniqueTypes' }
        }
      },
      { $sort: { typeCount: -1, avgConfidence: -1 } },
      { $limit: 5 }
    ]).toArray();

    console.log('   🧠 Most Complex Behavioral Profiles:');
    multiModalUsers.forEach(user => {
      console.log(`     User ${user._id}: ${user.typeCount} behavior types, ${Math.round(user.avgConfidence * 100)}% avg confidence`);
      console.log(`       Types: ${user.uniqueTypes.join(', ')}`);
      console.log(`       Patterns: ${user.patterns.slice(0, 3).join(', ')}...`);
    });

  } catch (error) {
    console.error('❌ Deep dive error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Deep dive complete - Disconnected from MongoDB');
  }
}

deepDive().catch(console.error);