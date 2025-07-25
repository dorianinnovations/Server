#!/usr/bin/env node

/**
 * Check for users with existing UBPM data
 */

import mongoose from 'mongoose';
import UserBehaviorProfile from './src/models/UserBehaviorProfile.js';
import User from './src/models/User.js';

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/numina-ai';

async function checkUBPMUsers() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('🔍 Connected to MongoDB, checking for UBPM users...\n');

    // Find all users with behavioral profiles
    const profiles = await UserBehaviorProfile.find({}).limit(10);
    
    console.log(`Found ${profiles.length} behavioral profiles:`);
    
    for (const profile of profiles) {
      const user = await User.findById(profile.userId).select('email profile');
      
      console.log(`\n👤 User: ${profile.userId}`);
      console.log(`   Email: ${user?.email || 'Unknown'}`);
      console.log(`   Patterns: ${profile.behaviorPatterns?.length || 0}`);
      console.log(`   Personality Traits: ${profile.personalityTraits?.length || 0}`);
      console.log(`   Last Analysis: ${profile.lastAnalysisDate}`);
      
      if (profile.behaviorPatterns?.length > 0) {
        console.log(`   Sample Patterns:`);
        profile.behaviorPatterns.slice(0, 3).forEach(p => {
          console.log(`     - ${p.pattern}: ${p.description?.substring(0, 60)}... (${Math.round(p.confidence * 100)}%)`);
        });
      }
    }
    
    // Also check for recent memory data
    const { default: ShortTermMemory } = await import('./src/models/ShortTermMemory.js');
    const recentUsers = await ShortTermMemory.aggregate([
      { $group: { _id: '$userId', messageCount: { $sum: 1 } } },
      { $match: { messageCount: { $gte: 5 } } },
      { $sort: { messageCount: -1 } },
      { $limit: 5 }
    ]);
    
    console.log(`\n📊 Users with recent activity (5+ messages):`);
    recentUsers.forEach(u => {
      console.log(`   ${u._id}: ${u.messageCount} messages`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkUBPMUsers().catch(console.error);