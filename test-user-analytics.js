#!/usr/bin/env node

/**
 * User Analytics Test - Tests MongoDB aggregation for real user data
 * This creates a comprehensive test of how user messages are aggregated into meaningful insights
 */

import mongoose from 'mongoose';
import User from './src/models/User.js';
import ShortTermMemory from './src/models/ShortTermMemory.js';
import UserBehaviorProfile from './src/models/UserBehaviorProfile.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/numina-test';

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

async function findTestUser() {
  const user = await User.findOne({ email: 'metricstest@example.com' });
  if (!user) {
    console.error('❌ Test user not found');
    process.exit(1);
  }
  console.log('✅ Found test user:', user.email);
  return user;
}

async function analyzeUserConversations(userId) {
  console.log('\n📊 ANALYZING USER CONVERSATIONS');
  console.log('=====================================');

  // Get all user conversations
  const conversations = await ShortTermMemory.find({ userId }).sort({ timestamp: 1 });
  console.log(`📝 Found ${conversations.length} messages`);

  if (conversations.length === 0) {
    console.log('❌ No conversation data found');
    return;
  }

  // Separate user and assistant messages
  const userMessages = conversations.filter(msg => msg.role === 'user');
  const assistantMessages = conversations.filter(msg => msg.role === 'assistant');

  console.log(`👤 User messages: ${userMessages.length}`);
  console.log(`🤖 Assistant messages: ${assistantMessages.length}`);

  // Analyze user message patterns
  console.log('\n🔍 USER MESSAGE ANALYSIS:');
  userMessages.forEach((msg, index) => {
    console.log(`Message ${index + 1}: "${msg.content}"`);
    console.log(`  - Length: ${msg.content.length} characters`);
    console.log(`  - Timestamp: ${msg.timestamp}`);
  });

  return { userMessages, assistantMessages, conversations };
}

async function generatePersonalityInsights(userMessages) {
  console.log('\n🧠 PERSONALITY INSIGHTS GENERATION');
  console.log('====================================');

  const insights = {
    communicationStyle: '',
    emotionalPatterns: [],
    interests: [],
    personalityTraits: [],
    overallAssessment: ''
  };

  const allText = userMessages.map(msg => msg.content).join(' ');
  
  // Analyze communication style
  const avgLength = allText.length / userMessages.length;
  if (avgLength > 100) {
    insights.communicationStyle = 'detailed_expressive';
  } else if (avgLength > 50) {
    insights.communicationStyle = 'moderate_thoughtful';
  } else {
    insights.communicationStyle = 'concise_direct';
  }

  // Detect emotional patterns
  const emotionalKeywords = {
    stress: ['stressed', 'worried', 'overwhelming', 'pressure'],
    curiosity: ['curious', 'explore', 'understand', 'learn'],
    creativity: ['creative', 'problem solving', 'innovative'],
    analytical: ['test', 'analytics', 'patterns', 'data']
  };

  for (const [emotion, keywords] of Object.entries(emotionalKeywords)) {
    const found = keywords.some(keyword => 
      allText.toLowerCase().includes(keyword.toLowerCase())
    );
    if (found) {
      insights.emotionalPatterns.push(emotion);
    }
  }

  // Extract interests and topics
  const topicKeywords = {
    technology: ['analytics', 'system', 'test'],
    work: ['work', 'boss', 'project', 'deadline'],
    personal_growth: ['personality', 'patterns', 'understand']
  };

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    const found = keywords.some(keyword => 
      allText.toLowerCase().includes(keyword.toLowerCase())
    );
    if (found) {
      insights.interests.push(topic);
    }
  }

  // Generate personality traits
  if (insights.emotionalPatterns.includes('analytical')) {
    insights.personalityTraits.push('analytical_minded');
  }
  if (insights.emotionalPatterns.includes('curiosity')) {
    insights.personalityTraits.push('intellectually_curious');
  }
  if (insights.emotionalPatterns.includes('creativity')) {
    insights.personalityTraits.push('creative_problem_solver');
  }

  console.log('📋 Generated Insights:');
  console.log(JSON.stringify(insights, null, 2));

  return insights;
}

async function testMongoAggregation(userId) {
  console.log('\n🔍 MONGODB AGGREGATION TESTS');
  console.log('===============================');

  // Test 1: Message frequency by time of day
  const hourlyActivity = await ShortTermMemory.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: { $hour: '$timestamp' },
        messageCount: { $sum: 1 },
        avgMessageLength: { $avg: { $strLenCP: '$content' } }
      }
    },
    { $sort: { '_id': 1 } }
  ]);

  console.log('⏰ Hourly Activity Pattern:');
  hourlyActivity.forEach(hour => {
    console.log(`  Hour ${hour._id}: ${hour.messageCount} messages, avg length: ${Math.round(hour.avgMessageLength)}`);
  });

  // Test 2: Emotional keyword frequency
  const emotionalAnalysis = await ShortTermMemory.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), role: 'user' } },
    {
      $project: {
        content: 1,
        hasStressWords: {
          $regexMatch: { input: '$content', regex: /stressed|worried|overwhelming|pressure/i }
        },
        hasCuriosityWords: {
          $regexMatch: { input: '$content', regex: /curious|explore|understand|learn/i }
        },
        hasCreativityWords: {
          $regexMatch: { input: '$content', regex: /creative|problem.solving|innovative/i }
        }
      }
    },
    {
      $group: {
        _id: null,
        totalMessages: { $sum: 1 },
        stressMessages: { $sum: { $cond: ['$hasStressWords', 1, 0] } },
        curiosityMessages: { $sum: { $cond: ['$hasCuriosityWords', 1, 0] } },
        creativityMessages: { $sum: { $cond: ['$hasCreativityWords', 1, 0] } }
      }
    }
  ]);

  console.log('\n😊 Emotional Analysis:');
  if (emotionalAnalysis.length > 0) {
    const analysis = emotionalAnalysis[0];
    console.log(`  Total messages: ${analysis.totalMessages}`);
    console.log(`  Stress indicators: ${analysis.stressMessages}`);
    console.log(`  Curiosity indicators: ${analysis.curiosityMessages}`);
    console.log(`  Creativity indicators: ${analysis.creativityMessages}`);
  }

  // Test 3: Conversation patterns
  const conversationPatterns = await ShortTermMemory.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$role',
        messageCount: { $sum: 1 },
        avgLength: { $avg: { $strLenCP: '$content' } },
        totalCharacters: { $sum: { $strLenCP: '$content' } }
      }
    }
  ]);

  console.log('\n💬 Conversation Patterns:');
  conversationPatterns.forEach(pattern => {
    console.log(`  ${pattern._id}: ${pattern.messageCount} messages, avg: ${Math.round(pattern.avgLength)} chars, total: ${pattern.totalCharacters} chars`);
  });

  return { hourlyActivity, emotionalAnalysis, conversationPatterns };
}

async function createStructuredAnalytics(userId, insights, aggregations) {
  console.log('\n📈 CREATING STRUCTURED ANALYTICS');
  console.log('==================================');

  const structuredData = {
    userId,
    analysisTimestamp: new Date().toISOString(),
    userState: 'engaged_analytical_learner',
    recentTopics: insights.interests,
    mood: insights.emotionalPatterns.includes('stress') ? 'slightly_overwhelmed_but_engaged' : 'curious_and_focused',
    preferredStyle: insights.communicationStyle,
    personalityProfile: {
      traits: insights.personalityTraits,
      communicationStyle: insights.communicationStyle,
      emotionalPatterns: insights.emotionalPatterns,
      interests: insights.interests
    },
    behaviorMetrics: {
      totalMessages: aggregations.conversationPatterns.find(p => p._id === 'user')?.messageCount || 0,
      avgMessageLength: Math.round(aggregations.conversationPatterns.find(p => p._id === 'user')?.avgLength || 0),
      mostActiveHours: aggregations.hourlyActivity.map(h => h._id),
      engagementLevel: 'high'
    },
    insights: [
      'User demonstrates analytical thinking and curiosity about self-improvement',
      'Shows emotional awareness and ability to articulate feelings',
      'Prefers structured, detailed responses',
      'Values efficiency and direct communication'
    ],
    recommendations: [
      'Provide detailed, step-by-step guidance',
      'Include analytical frameworks and structured approaches',
      'Acknowledge emotional states while focusing on solutions',
      'Offer tools and resources for self-analysis'
    ]
  };

  console.log('✅ Structured Analytics Generated:');
  console.log(JSON.stringify(structuredData, null, 2));

  return structuredData;
}

async function main() {
  console.log('🚀 STARTING USER ANALYTICS TEST');
  console.log('================================\n');

  await connectDB();
  
  const user = await findTestUser();
  const { userMessages, assistantMessages, conversations } = await analyzeUserConversations(user._id);
  
  if (conversations.length === 0) {
    console.log('❌ No data to analyze. Run some chat conversations first.');
    process.exit(1);
  }

  const insights = await generatePersonalityInsights(userMessages);
  const aggregations = await testMongoAggregation(user._id);
  const structuredAnalytics = await createStructuredAnalytics(user._id, insights, aggregations);

  console.log('\n🎯 SUMMARY');
  console.log('==========');
  console.log(`✅ Analyzed ${conversations.length} messages`);
  console.log(`✅ Generated ${insights.personalityTraits.length} personality traits`);
  console.log(`✅ Identified ${insights.interests.length} interests`);
  console.log(`✅ Created structured analytics data`);
  console.log('\n📊 This data can now be used by the AI for personalized responses!');

  await mongoose.disconnect();
  console.log('\n✅ Test completed successfully!');
}

// Run the test
main().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});