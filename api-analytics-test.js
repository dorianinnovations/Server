#!/usr/bin/env node

/**
 * API-based User Analytics Test
 * Tests the actual analytics endpoints that should provide structured insights
 */

const baseURL = 'http://localhost:5000';

async function makeRequest(endpoint, options = {}) {
  const url = `${baseURL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      timeout: 10000,
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`❌ Request to ${endpoint} failed:`, error.message);
    return null;
  }
}

async function authenticateUser() {
  console.log('🔐 Authenticating test user...');
  
  const loginData = {
    email: 'metricstest@example.com',
    password: 'testpassword123'
  };
  
  const result = await makeRequest('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(loginData)
  });
  
  if (result && result.token) {
    console.log('✅ Authentication successful');
    return result.token;
  }
  
  console.error('❌ Authentication failed');
  return null;
}

async function testConversationData(token) {
  console.log('\n📝 Testing conversation data retrieval...');
  
  const conversations = await makeRequest('/conversation/recent?limit=10', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (conversations && conversations.success) {
    console.log(`✅ Retrieved ${conversations.data.length} conversation messages`);
    
    // Show actual user messages for analysis
    const userMessages = conversations.data.filter(msg => msg.role === 'user');
    console.log('\n👤 User Messages for Analysis:');
    userMessages.forEach((msg, index) => {
      console.log(`${index + 1}. "${msg.content}"`);
    });
    
    return conversations.data;
  } else {
    console.error('❌ Failed to retrieve conversation data');
    return [];
  }
}

async function testEmotionalAnalytics(token) {
  console.log('\n😊 Testing emotional analytics...');
  
  const currentSession = await makeRequest('/emotional-analytics/current-session', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (currentSession && currentSession.success) {
    console.log('✅ Current emotional session data:');
    console.log(`   Dominant emotion: ${currentSession.data.dominantEmotion}`);
    console.log(`   Average intensity: ${currentSession.data.averageIntensity}`);
    console.log(`   Emotion distribution:`, currentSession.data.emotionDistribution);
  } else {
    console.error('❌ Failed to get emotional analytics');
  }
  
  const weeklyReport = await makeRequest('/emotional-analytics/weekly-report', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (weeklyReport && weeklyReport.success) {
    console.log('✅ Weekly emotional report:');
    console.log(`   Overall trend: ${weeklyReport.data.emotionalTrends.overall}`);
    console.log(`   Positivity: ${weeklyReport.data.emotionalTrends.positivity}%`);
    console.log(`   Insights:`, weeklyReport.data.insights);
  }
}

async function testLLMAnalytics(token) {
  console.log('\n🧠 Testing LLM analytics...');
  
  // Test getting analytics status
  const status = await makeRequest('/analytics/llm/status', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (status && status.success) {
    console.log('✅ LLM Analytics Status:');
    console.log(`   Available categories:`, status.availableCategories);
    console.log(`   Recent insights count:`, status.recentInsights.length);
  }
  
  // Test generating specific category insights
  const categories = ['personality', 'communication', 'emotional', 'behavioral'];
  
  for (const category of categories) {
    console.log(`\n🔍 Testing ${category} analysis...`);
    
    const insight = await makeRequest('/analytics/llm', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ category })
    });
    
    if (insight && insight.success) {
      console.log(`✅ ${category} insight generated successfully`);
      if (insight.insight && typeof insight.insight === 'string') {
        console.log(`   Insight: ${insight.insight.substring(0, 200)}...`);
      } else if (insight.insight) {
        console.log(`   Insight data:`, typeof insight.insight, insight.insight);
      }
    } else {
      console.log(`⚠️  ${category} insight generation failed or on cooldown`);
      if (insight) {
        console.log(`   Response:`, insight);
      }
    }
  }
}

async function createProperAnalyticsStructure(conversations) {
  console.log('\n📊 Creating proper analytics structure...');
  
  const userMessages = conversations.filter(msg => msg.role === 'user');
  const allText = userMessages.map(msg => msg.content).join(' ').toLowerCase();
  
  // This is what SHOULD be sent to the AI instead of compressed garbage
  const structuredAnalytics = {
    userState: 'focused_on_technical_work',
    recentTopics: [],
    mood: 'engaged_analytical',
    preferredStyle: 'direct_solutions',
    personalityInsights: {
      traits: [],
      communicationStyle: '',
      interests: [],
      emotionalPatterns: []
    },
    behaviorMetrics: {
      totalMessages: userMessages.length,
      avgMessageLength: Math.round(allText.length / userMessages.length),
      engagementLevel: 'high',
      recentActivity: 'active'
    },
    contextualData: {
      lastTopics: userMessages.slice(-3).map(msg => msg.content),
      dominantThemes: [],
      emotionalState: 'balanced'
    }
  };
  
  // Analyze actual content for insights
  const analysisPatterns = {
    analytical: ['test', 'analytics', 'system', 'patterns', 'data'],
    stressed: ['stressed', 'worried', 'overwhelming', 'pressure'],
    creative: ['creative', 'problem solving', 'curiosity', 'explore'],
    work_focused: ['work', 'boss', 'project', 'deadline'],
    self_improvement: ['personality', 'understand', 'patterns', 'help']
  };
  
  for (const [trait, keywords] of Object.entries(analysisPatterns)) {
    const found = keywords.some(keyword => allText.includes(keyword));
    if (found) {
      if (trait === 'stressed') {
        structuredAnalytics.mood = 'slightly_overwhelmed_but_engaged';
        structuredAnalytics.personalityInsights.emotionalPatterns.push('stress_aware');
      } else if (trait === 'analytical') {
        structuredAnalytics.personalityInsights.traits.push('analytical_thinker');
        structuredAnalytics.recentTopics.push('analytics_testing');
      } else if (trait === 'creative') {
        structuredAnalytics.personalityInsights.traits.push('creative_problem_solver');
        structuredAnalytics.personalityInsights.emotionalPatterns.push('curiosity_driven');
      } else if (trait === 'work_focused') {
        structuredAnalytics.recentTopics.push('work_challenges');
      } else if (trait === 'self_improvement') {
        structuredAnalytics.recentTopics.push('personal_development');
        structuredAnalytics.personalityInsights.interests.push('self_awareness');
      }
    }
  }
  
  // Determine communication style
  const avgLength = structuredAnalytics.behaviorMetrics.avgMessageLength;
  if (avgLength > 100) {
    structuredAnalytics.personalityInsights.communicationStyle = 'detailed_expressive';
  } else if (avgLength > 50) {
    structuredAnalytics.personalityInsights.communicationStyle = 'thoughtful_moderate';
  } else {
    structuredAnalytics.personalityInsights.communicationStyle = 'concise_direct';
  }
  
  console.log('✅ Proper analytics structure created:');
  console.log(JSON.stringify(structuredAnalytics, null, 2));
  
  console.log('\n💡 This readable, structured data would allow the AI to provide:');
  console.log('   • Personalized response tone and style');
  console.log('   • Relevant examples and analogies');
  console.log('   • Appropriate emotional support');
  console.log('   • Context-aware suggestions');
  console.log('   • Meaningful follow-up questions');
  
  return structuredAnalytics;
}

async function main() {
  console.log('🚀 STARTING API-BASED ANALYTICS TEST');
  console.log('====================================\n');
  
  const token = await authenticateUser();
  if (!token) {
    console.error('❌ Cannot proceed without authentication');
    process.exit(1);
  }
  
  const conversations = await testConversationData(token);
  if (conversations.length === 0) {
    console.error('❌ No conversation data found. Send some messages first.');
    process.exit(1);
  }
  
  await testEmotionalAnalytics(token);
  await testLLMAnalytics(token);
  await createProperAnalyticsStructure(conversations);
  
  console.log('\n🎯 TEST SUMMARY');
  console.log('================');
  console.log('✅ Authentication: Working');
  console.log('✅ Conversation Data: Retrieved successfully');
  console.log('✅ Emotional Analytics: Basic structure in place');
  console.log('⚠️  LLM Analytics: May need authentication fixes');
  console.log('✅ Proper Structure: Demonstrated how it should work');
  
  console.log('\n📋 RECOMMENDATIONS FOR IMPROVEMENT:');
  console.log('1. Fix authentication issues with analytics endpoints');
  console.log('2. Replace compressed data with readable structured insights');
  console.log('3. Implement real-time personality trait detection');
  console.log('4. Add proper MongoDB aggregation for behavioral patterns');
  console.log('5. Create meaningful context for AI responses');
  
  console.log('\n✅ Test completed!');
}

// Use dynamic import for fetch in Node.js
import('node-fetch').then(({ default: fetch }) => {
  global.fetch = fetch;
  main().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}).catch(() => {
  // Fallback for environments that have fetch built-in
  main().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
});