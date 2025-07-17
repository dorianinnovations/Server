import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const BASE_URL = 'http://localhost:5000';

let testUserId = null;

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
}

async function testPersonalInsights() {
  console.log('📊 Testing Personal Insights API...\n');

  const token = generateToken(testUserId);
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // Test 1: Weekly Growth Summary
  console.log('1️⃣ Testing weekly growth summary...');
  try {
    const response = await fetch(`${BASE_URL}/personal-insights/growth-summary?timeframe=week`, {
      headers
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Weekly Growth Summary:');
      console.log(`   📈 Emotional logs: ${data.data.metrics.emotionalLogs}`);
      console.log(`   😊 Positivity ratio: ${data.data.metrics.positivityRatio}%`);
      console.log(`   ⚡ Engagement score: ${data.data.metrics.engagementScore}/100`);
      console.log(`   💬 Conversations: ${data.data.metrics.conversationCount}`);
      console.log(
        `   🎭 Top emotions: ${data.data.metrics.topEmotions
          .slice(0, 3)
          .map(e => `${e.emotion}(${e.count})`)
          .join(', ')}`
      );
      console.log(`   🤖 AI Insight: "${data.data.aiInsights.substring(0, 100)}..."`);
    } else {
      console.log(`❌ Weekly growth failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.log(`❌ Weekly growth error: ${error.message}`);
  }

  console.log('\n');

  // Test 2: Monthly Growth Summary
  console.log('2️⃣ Testing monthly growth summary...');
  try {
    const response = await fetch(`${BASE_URL}/personal-insights/growth-summary?timeframe=month`, {
      headers
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Monthly Growth Summary:');
      console.log(`   📊 Period: ${data.data.period}`);
      console.log(`   📈 Emotional logs: ${data.data.metrics.emotionalLogs}`);
      console.log(`   😊 Positivity ratio: ${data.data.metrics.positivityRatio}%`);
      console.log(`   ⚡ Engagement score: ${data.data.metrics.engagementScore}/100`);
    } else {
      console.log(`❌ Monthly growth failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.log(`❌ Monthly growth error: ${error.message}`);
  }

  console.log('\n');

  // Test 3: Milestones
  console.log('3️⃣ Testing milestones...');
  try {
    const response = await fetch(`${BASE_URL}/personal-insights/milestones`, {
      headers
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Milestones:');

      data.data.milestones.forEach(milestone => {
        const status = milestone.achieved ? '🏆' : '⏳';
        console.log(`   ${status} ${milestone.title}: ${milestone.progress}%`);
        console.log(`      ${milestone.description}`);
      });

      const achieved = data.data.milestones.filter(m => m.achieved).length;
      console.log(
        `\n   🎯 Progress: ${achieved}/${data.data.milestones.length} milestones achieved`
      );
      console.log(
        `   📊 Stats: ${data.data.stats.totalEmotionalLogs} logs, ${data.data.stats.daysSinceJoined} days active`
      );
    } else {
      console.log(`❌ Milestones failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.log(`❌ Milestones error: ${error.message}`);
  }

  console.log('\n');
}

async function testDynamicChat() {
  console.log('🤖 Testing Dynamic Chat Response...\n');

  const token = generateToken(testUserId);
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const testMessages = [
    {
      message: 'Hi',
      expected: 'concise',
      description: 'Short message should get concise response'
    },
    {
      message:
        'I\'ve been thinking a lot about my personal growth lately and would love to have a deep conversation about how I can continue developing emotionally and mentally. What are your thoughts on this?',
      expected: 'detailed',
      description: 'Long message should get detailed response'
    },
    {
      message:
        'How can I improve my mood? I\'m feeling stressed and would appreciate some guidance on managing my emotions better.',
      expected: 'support-enhanced',
      description: 'Support request should get enhanced response'
    }
  ];

  for (let i = 0; i < testMessages.length; i++) {
    const test = testMessages[i];
    console.log(`${i + 1}️⃣ ${test.description}`);
    console.log(`   💬 Message: "${test.message}"`);

    try {
      const response = await fetch(`${BASE_URL}/ai/adaptive-chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: test.message,
          stream: false
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ Response length: ${data.content.length} characters`);
        console.log(`   🎯 Style detected: ${data.style || 'not provided'}`);
        console.log(`   📝 Preview: "${data.content.substring(0, 100)}..."`);

        // Basic validation
        if (test.expected === 'concise' && data.content.length > 500) {
          console.log(`   ⚠️  Warning: Expected concise but got ${data.content.length} chars`);
        } else if (test.expected === 'detailed' && data.content.length < 300) {
          console.log(`   ⚠️  Warning: Expected detailed but got ${data.content.length} chars`);
        } else {
          console.log('   ✅ Length appropriate for message type');
        }
      } else {
        console.log(`   ❌ Chat failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`   ❌ Chat error: ${error.message}`);
    }

    console.log('\n');

    // Wait between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function testHealthCheck() {
  console.log('🏥 Testing Health Check...\n');

  try {
    const response = await fetch(`${BASE_URL}/health`);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Server Health:', data.message);
      console.log(`   🕒 Uptime: ${data.uptime}s`);
      console.log(`   💾 Memory: ${Math.round(data.memory.rss / 1024 / 1024)}MB RSS`);
    } else {
      console.log(`❌ Health check failed: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Health check error: ${error.message}`);
  }

  console.log('\n');
}

async function setupTestUser() {
  console.log('🔍 Finding test user...');

  try {
    await mongoose.connect(process.env.MONGO_URI);

    const testUser = await User.findOne({ email: 'testuser1@example.com' });
    if (!testUser) {
      throw new Error('Test user not found. Run npm run seed-test-data first.');
    }

    testUserId = testUser._id.toString();
    console.log(`✅ Found test user: ${testUser.email} (${testUserId})\n`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error setting up test user:', error.message);
    process.exit(1);
  }
}

async function runAllTests() {
  console.log('🧪 Starting API Test Suite...\n');
  console.log('Make sure your server is running on http://localhost:5000');
  console.log('And that you\'ve run the seedTestData.js script\n');

  await setupTestUser();
  await testHealthCheck();
  await testPersonalInsights();
  await testDynamicChat();

  console.log('✅ All API tests completed!');
}

// Error handling
process.on('unhandledRejection', error => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

runAllTests();
