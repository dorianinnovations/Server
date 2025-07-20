import mongoose from 'mongoose';
import dotenv from 'dotenv';
import aiInsightService from '../src/services/aiInsightService.js';
import User from '../src/models/User.js';
import ShortTermMemory from '../src/models/ShortTermMemory.js';
import UserBehaviorProfile from '../src/models/UserBehaviorProfile.js';
import AnalyticsInsight from '../src/models/AnalyticsInsight.js';
import InsightCooldown from '../src/models/InsightCooldown.js';

dotenv.config();

/**
 * Test script for AI Insight System
 * Tests the complete flow: data retrieval -> insight generation -> cooldown management
 */

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/numina');
    console.log('✅ Connected to database');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

async function findTestUser() {
  // Find a user with some chat history
  const usersWithChats = await ShortTermMemory.aggregate([
    { $group: { _id: '$userId', messageCount: { $sum: 1 } } },
    { $match: { messageCount: { $gte: 10 } } },
    { $limit: 1 }
  ]);

  if (usersWithChats.length === 0) {
    console.log('❌ No users with sufficient chat history found');
    return null;
  }

  const userId = usersWithChats[0]._id;
  const user = await User.findById(userId);
  
  console.log(`✅ Found test user: ${user.email} with ${usersWithChats[0].messageCount} messages`);
  return userId;
}

async function testInsightGeneration(userId) {
  console.log('\n🧠 Testing AI Insight Generation...');
  
  const categories = ['communication', 'personality', 'behavioral', 'emotional', 'growth'];
  
  for (const category of categories) {
    try {
      console.log(`\n📊 Testing ${category} insights...`);
      
      // Generate insight for this category
      const result = await aiInsightService.generateCategoryInsight(userId, category, false);
      
      if (result.success) {
        console.log(`✅ ${category} insight generated successfully`);
        console.log(`   Insight: "${result.insight.insight.substring(0, 100)}..."`);
        console.log(`   Confidence: ${Math.round(result.insight.confidence * 100)}%`);
        console.log(`   Evidence: ${result.insight.evidence.length} points`);
        console.log(`   Processing time: ${result.processingTime}ms`);
      } else if (result.reason === 'cooldown_active') {
        console.log(`⏳ ${category} insight on cooldown`);
        console.log(`   Remaining: ${result.cooldown.remainingFormatted}`);
      } else {
        console.log(`❌ ${category} insight failed: ${result.error}`);
        if (result.fallbackInsight) {
          console.log(`   Fallback: "${result.fallbackInsight.insight.substring(0, 100)}..."`);
        }
      }
      
      // Small delay between categories
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Error testing ${category}:`, error.message);
    }
  }
}

async function testCooldownSystem(userId) {
  console.log('\n⏱️ Testing Cooldown System...');
  
  try {
    // Get current cooldown status
    const cooldownStatus = await aiInsightService.getUserCooldownStatus(userId);
    console.log('Current cooldown status:', cooldownStatus);
    
    // Try to force generate an insight to test cooldown
    console.log('\n🔄 Testing forced insight generation...');
    const forceResult = await aiInsightService.generateCategoryInsight(userId, 'communication', true);
    
    if (forceResult.success) {
      console.log('✅ Forced insight generation successful');
      
      // Now try again without force - should hit cooldown
      console.log('🚫 Testing cooldown blocking...');
      const blockedResult = await aiInsightService.generateCategoryInsight(userId, 'communication', false);
      
      if (blockedResult.reason === 'cooldown_active') {
        console.log('✅ Cooldown system working correctly');
        console.log(`   Blocked with: ${blockedResult.cooldown.remainingFormatted} remaining`);
      } else {
        console.log('⚠️ Cooldown system may not be working correctly');
      }
    } else {
      console.log('❌ Forced insight generation failed:', forceResult.error);
    }
    
  } catch (error) {
    console.error('❌ Error testing cooldown system:', error);
  }
}

async function testDatabaseOperations(userId) {
  console.log('\n💾 Testing Database Operations...');
  
  try {
    // Test getting user insights
    const insights = await aiInsightService.getUserInsights(userId, 5);
    console.log(`✅ Retrieved ${insights.length} recent insights`);
    
    if (insights.length > 0) {
      const latestInsight = insights[0];
      console.log(`   Latest: ${latestInsight.category} - "${latestInsight.insight.substring(0, 80)}..."`);
      console.log(`   Generated: ${latestInsight.timeAgo}`);
      console.log(`   Confidence: ${latestInsight.getConfidencePercentage()}%`);
    }
    
    // Test direct database queries
    const totalInsights = await AnalyticsInsight.countDocuments({ userId });
    const activeCooldowns = await InsightCooldown.countDocuments({ 
      userId, 
      cooldownUntil: { $gt: new Date() } 
    });
    
    console.log(`✅ Database stats: ${totalInsights} total insights, ${activeCooldowns} active cooldowns`);
    
  } catch (error) {
    console.error('❌ Error testing database operations:', error);
  }
}

async function testDataRetrieval(userId) {
  console.log('\n📊 Testing Data Retrieval...');
  
  try {
    const analyticsData = await aiInsightService.getUserAnalyticsData(userId);
    
    if (analyticsData.success) {
      console.log('✅ Analytics data retrieved successfully');
      console.log(`   Total messages: ${analyticsData.data.dataPoints.totalMessages}`);
      console.log(`   Behavior patterns: ${analyticsData.data.dataPoints.behaviorPatterns}`);
      console.log(`   User context: ${analyticsData.data.userContext.communicationStyle}`);
      console.log(`   Most active: ${analyticsData.data.userContext.mostActiveTimeOfDay}`);
    } else {
      console.log('❌ Analytics data retrieval failed:', analyticsData.error);
    }
    
  } catch (error) {
    console.error('❌ Error testing data retrieval:', error);
  }
}

async function runTests() {
  console.log('🧪 Starting AI Insight System Tests\n');
  
  try {
    await connectToDatabase();
    
    const userId = await findTestUser();
    if (!userId) {
      console.log('❌ Cannot run tests without a user with chat history');
      process.exit(1);
    }
    
    // Run all tests
    await testDataRetrieval(userId);
    await testDatabaseOperations(userId);
    await testCooldownSystem(userId);
    await testInsightGeneration(userId);
    
    console.log('\n✅ All tests completed!');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the tests
runTests();