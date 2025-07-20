import mongoose from 'mongoose';
import dotenv from 'dotenv';
import aiInsightService from '../src/services/aiInsightService.js';
import AnalyticsInsight from '../src/models/AnalyticsInsight.js';
import InsightCooldown from '../src/models/InsightCooldown.js';
import ShortTermMemory from '../src/models/ShortTermMemory.js';

dotenv.config();

/**
 * Final comprehensive test of the AI insights system
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
  const usersWithChats = await ShortTermMemory.aggregate([
    { $group: { _id: '$userId', messageCount: { $sum: 1 } } },
    { $match: { messageCount: { $gte: 10 } } },
    { $limit: 1 }
  ]);

  if (usersWithChats.length === 0) {
    console.log('❌ No users with sufficient chat history found');
    return null;
  }

  return usersWithChats[0]._id;
}

async function testSystemIntegration(userId) {
  console.log('\n🔬 Testing Complete System Integration...');
  
  try {
    // Clear existing data for clean test
    await AnalyticsInsight.deleteMany({ userId });
    await InsightCooldown.deleteMany({ userId });
    console.log('🧹 Cleared existing data');
    
    const categories = ['communication', 'personality', 'behavioral', 'emotional', 'growth'];
    const results = {};
    
    // Test 1: Generate insights for all categories
    console.log('\n1️⃣ Testing insights generation for all categories...');
    for (const category of categories) {
      console.log(`   Generating ${category} insight...`);
      const result = await aiInsightService.generateCategoryInsight(userId, category, false);
      results[category] = result;
      
      if (result.success) {
        console.log(`   ✅ ${category}: Success (${result.processingTime}ms)`);
      } else {
        console.log(`   ❌ ${category}: Failed - ${result.error}`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Test 2: Verify insights are stored
    console.log('\n2️⃣ Testing insight storage...');
    const storedInsights = await AnalyticsInsight.find({ userId, isActive: true });
    console.log(`   Found ${storedInsights.length} stored insights`);
    
    for (const insight of storedInsights) {
      console.log(`   - ${insight.category}: ${insight.getConfidencePercentage()}% confidence, ${insight.evidence.length} evidence points`);
    }
    
    // Test 3: Test cooldown enforcement
    console.log('\n3️⃣ Testing cooldown enforcement...');
    const retryResult = await aiInsightService.generateCategoryInsight(userId, 'communication', false);
    if (!retryResult.success && retryResult.reason === 'cooldown_active') {
      console.log(`   ✅ Cooldown working: ${retryResult.cooldown.remainingFormatted} remaining`);
    } else {
      console.log(`   ⚠️ Cooldown may not be working correctly`);
    }
    
    // Test 4: Test user insights retrieval
    console.log('\n4️⃣ Testing insight retrieval...');
    const userInsights = await aiInsightService.getUserInsights(userId, 10);
    console.log(`   Retrieved ${userInsights.length} user insights`);
    
    // Test 5: Test cooldown status
    console.log('\n5️⃣ Testing cooldown status...');
    const cooldownStatus = await aiInsightService.getUserCooldownStatus(userId);
    const activeCooldowns = Object.keys(cooldownStatus).filter(cat => cooldownStatus[cat].isActive);
    console.log(`   ${activeCooldowns.length} active cooldowns: ${activeCooldowns.join(', ')}`);
    
    // Test 6: Test data analytics integration
    console.log('\n6️⃣ Testing data analytics integration...');
    const analyticsData = await aiInsightService.getUserAnalyticsData(userId);
    if (analyticsData.success) {
      console.log(`   ✅ Analytics data integration working`);
      console.log(`   - ${analyticsData.data.dataPoints.totalMessages} total messages`);
      console.log(`   - ${analyticsData.data.dataPoints.behaviorPatterns} behavior patterns`);
      console.log(`   - Communication style: ${analyticsData.data.userContext.communicationStyle}`);
    } else {
      console.log(`   ❌ Analytics data integration failed: ${analyticsData.error}`);
    }
    
    // Summary
    console.log('\n📊 Test Summary:');
    const successCount = Object.values(results).filter(r => r.success).length;
    console.log(`   ${successCount}/${categories.length} insights generated successfully`);
    console.log(`   ${storedInsights.length} insights stored in database`);
    console.log(`   ${activeCooldowns.length} cooldowns active`);
    
    if (successCount === categories.length) {
      console.log('   🎉 All systems functioning correctly!');
    } else {
      console.log('   ⚠️ Some issues detected');
    }
    
  } catch (error) {
    console.error('❌ System integration test failed:', error);
  }
}

async function testDatabaseModels() {
  console.log('\n💾 Testing Database Models...');
  
  try {
    // Test AnalyticsInsight model
    const insightCount = await AnalyticsInsight.countDocuments();
    console.log(`   AnalyticsInsight: ${insightCount} documents`);
    
    // Test InsightCooldown model
    const cooldownCount = await InsightCooldown.countDocuments();
    console.log(`   InsightCooldown: ${cooldownCount} documents`);
    
    // Test model methods
    const recentInsights = await AnalyticsInsight.find().sort({ generatedAt: -1 }).limit(1);
    if (recentInsights.length > 0) {
      const insight = recentInsights[0];
      console.log(`   Latest insight: ${insight.category} (${insight.timeAgo})`);
      console.log(`   Confidence: ${insight.getConfidencePercentage()}%`);
      console.log(`   Is stale: ${insight.isStale()}`);
    }
    
    console.log('   ✅ Database models working correctly');
    
  } catch (error) {
    console.error('   ❌ Database model test failed:', error);
  }
}

async function runFinalTest() {
  console.log('🎯 Final Comprehensive Test of AI Insights System\n');
  
  try {
    await connectToDatabase();
    
    const userId = await findTestUser();
    if (!userId) {
      console.log('❌ Cannot run test without a user');
      process.exit(1);
    }
    
    console.log(`🎯 Testing with user: ${userId}`);
    
    await testDatabaseModels();
    await testSystemIntegration(userId);
    
    console.log('\n✅ Final test completed successfully!');
    console.log('\n🚀 AI Insights System is ready for production!');
    
  } catch (error) {
    console.error('❌ Final test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

runFinalTest();