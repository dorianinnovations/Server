import mongoose from 'mongoose';
import dotenv from 'dotenv';
import aiInsightService from '../src/services/aiInsightService.js';
import User from '../src/models/User.js';
import ShortTermMemory from '../src/models/ShortTermMemory.js';
import InsightCooldown from '../src/models/InsightCooldown.js';

dotenv.config();

/**
 * Focused test for cooldown system
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

  const userId = usersWithChats[0]._id;
  console.log(`✅ Found test user: ${userId}`);
  return userId;
}

async function testCooldownFlow(userId) {
  console.log('\n🧪 Testing Complete Cooldown Flow...');
  
  try {
    // Clear any existing cooldowns for clean test
    await InsightCooldown.deleteMany({ userId });
    console.log('🧹 Cleared existing cooldowns');
    
    // Test 1: First generation should work
    console.log('\n1️⃣ Testing first insight generation...');
    const result1 = await aiInsightService.generateCategoryInsight(userId, 'communication', false);
    
    if (result1.success) {
      console.log('✅ First generation successful');
      console.log(`   Processing time: ${result1.processingTime}ms`);
    } else {
      console.log('❌ First generation failed:', result1.error);
      return;
    }
    
    // Test 2: Immediate retry should be blocked
    console.log('\n2️⃣ Testing immediate retry (should be blocked)...');
    const result2 = await aiInsightService.generateCategoryInsight(userId, 'communication', false);
    
    if (!result2.success && result2.reason === 'cooldown_active') {
      console.log('✅ Second generation correctly blocked by cooldown');
      console.log(`   Reason: ${result2.reason}`);
      console.log(`   Remaining: ${result2.cooldown?.remainingFormatted || 'Unknown'}`);
    } else if (result2.success) {
      console.log('❌ Second generation should have been blocked but succeeded');
    } else {
      console.log('⚠️ Second generation failed for different reason:', result2.error);
    }
    
    // Test 3: Force generation should work
    console.log('\n3️⃣ Testing forced generation...');
    const result3 = await aiInsightService.generateCategoryInsight(userId, 'communication', true);
    
    if (result3.success) {
      console.log('✅ Forced generation successful');
    } else {
      console.log('❌ Forced generation failed:', result3.error);
    }
    
    // Test 4: Different category should work
    console.log('\n4️⃣ Testing different category...');
    const result4 = await aiInsightService.generateCategoryInsight(userId, 'personality', false);
    
    if (result4.success) {
      console.log('✅ Different category generation successful');
    } else if (result4.reason === 'cooldown_active') {
      console.log('⏳ Different category also on cooldown');
    } else {
      console.log('❌ Different category failed:', result4.error);
    }
    
    // Test 5: Check cooldown status
    console.log('\n5️⃣ Checking cooldown status...');
    const cooldownStatus = await aiInsightService.getUserCooldownStatus(userId);
    console.log('Cooldown status:', cooldownStatus);
    
    // Test 6: Check database state
    console.log('\n6️⃣ Checking database state...');
    const cooldowns = await InsightCooldown.find({ userId });
    console.log(`Found ${cooldowns.length} cooldown records:`);
    
    for (const cooldown of cooldowns) {
      console.log(`   ${cooldown.category}: ${cooldown.isActive() ? 'ACTIVE' : 'EXPIRED'} - ${cooldown.getRemainingTimeFormatted()}`);
    }
    
  } catch (error) {
    console.error('❌ Cooldown test error:', error);
  }
}

async function runCooldownTest() {
  console.log('⏱️ Starting Cooldown System Test\n');
  
  try {
    await connectToDatabase();
    
    const userId = await findTestUser();
    if (!userId) {
      console.log('❌ Cannot run test without a user');
      process.exit(1);
    }
    
    await testCooldownFlow(userId);
    
    console.log('\n✅ Cooldown test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

runCooldownTest();