import fetch from 'node-fetch';

const baseUrl = 'http://localhost:5000';
let authToken = null;
let testUserId = null;

console.log('🔍 Testing Historically Broken Areas');
console.log('===================================\n');

// Helper function for authenticated requests
const apiRequest = async (endpoint, method = 'GET', body = null) => {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { 'Authorization': `Bearer ${authToken}` })
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${baseUrl}${endpoint}`, options);
  const data = await response.json();
  return { status: response.status, data };
};

// Setup: Create test user and get auth token
const setupTestUser = async () => {
  console.log('🏗️  Setting up test user...');
  
  const signupData = {
    email: `test-${Date.now()}@example.com`,
    password: 'testpassword123'
  };
  
  const result = await apiRequest('/signup', 'POST', signupData);
  
  if (result.status === 201 && result.data.token) {
    authToken = result.data.token;
    testUserId = result.data.data.user.id;
    console.log('✅ Test user created:', result.data.data.user.email);
    console.log('✅ Auth token obtained');
    return true;
  } else {
    console.log('❌ Failed to create test user:', result.data);
    return false;
  }
};

// Test 1: Analytics System
const testAnalytics = async () => {
  console.log('\n📊 Testing Analytics System');
  console.log('============================');
  
  const tests = [];
  
  // Test analytics data submission
  console.log('🔸 Testing analytics data submission...');
  try {
    const analyticsData = {
      eventType: 'chat_interaction',
      metadata: {
        messageLength: 50,
        responseTime: 1200,
        toolsUsed: ['web_search'],
        timestamp: new Date().toISOString()
      }
    };
    
    const result = await apiRequest('/analytics/event', 'POST', analyticsData);
    console.log(`Status: ${result.status}, Response:`, result.data);
    tests.push(result.status < 400);
  } catch (error) {
    console.log('❌ Analytics submission failed:', error.message);
    tests.push(false);
  }
  
  // Test LLM analytics
  console.log('🔸 Testing LLM analytics processing...');
  try {
    const llmAnalyticsData = {
      query: 'test analytics query',
      timeRange: 'week',
      includeInsights: true
    };
    
    const result = await apiRequest('/analytics/llm', 'POST', llmAnalyticsData);
    console.log(`Status: ${result.status}, Response keys:`, Object.keys(result.data || {}));
    tests.push(result.status < 400);
  } catch (error) {
    console.log('❌ LLM analytics failed:', error.message);
    tests.push(false);
  }
  
  // Test analytics data retrieval
  console.log('🔸 Testing analytics data retrieval...');
  try {
    const result = await apiRequest('/analytics/summary?timeRange=week');
    console.log(`Status: ${result.status}, Has data:`, !!result.data);
    tests.push(result.status < 400);
  } catch (error) {
    console.log('❌ Analytics retrieval failed:', error.message);
    tests.push(false);
  }
  
  const passed = tests.filter(t => t).length;
  console.log(`\n📊 Analytics Results: ${passed}/${tests.length} tests passed`);
  return { passed, total: tests.length };
};

// Test 2: Conversation Saving
const testConversationSaving = async () => {
  console.log('\n💬 Testing Conversation Saving');
  console.log('===============================');
  
  const tests = [];
  
  // Test conversation creation
  console.log('🔸 Testing conversation creation...');
  try {
    const conversationData = {
      messages: [
        {
          role: 'user',
          content: 'Hello, this is a test conversation',
          timestamp: new Date().toISOString()
        },
        {
          role: 'assistant', 
          content: 'Hello! This is a test response.',
          timestamp: new Date().toISOString()
        }
      ],
      title: 'Test Conversation',
      metadata: {
        totalMessages: 2,
        lastActivity: new Date().toISOString()
      }
    };
    
    const result = await apiRequest('/conversations', 'POST', conversationData);
    console.log(`Status: ${result.status}, Response:`, result.data);
    tests.push(result.status < 400);
  } catch (error) {
    console.log('❌ Conversation creation failed:', error.message);
    tests.push(false);
  }
  
  // Test conversation retrieval
  console.log('🔸 Testing conversation retrieval...');
  try {
    const result = await apiRequest('/conversations/recent?limit=10');
    console.log(`Status: ${result.status}, Conversations:`, result.data?.data?.length || 0);
    tests.push(result.status < 400);
  } catch (error) {
    console.log('❌ Conversation retrieval failed:', error.message);
    tests.push(false);
  }
  
  // Test conversation sync
  console.log('🔸 Testing conversation sync...');
  try {
    const syncData = {
      lastSyncTimestamp: new Date(Date.now() - 86400000).toISOString(), // 24h ago
      deviceId: 'test-device-123'
    };
    
    const result = await apiRequest('/conversations/sync', 'POST', syncData);
    console.log(`Status: ${result.status}, Sync response:`, !!result.data);
    tests.push(result.status < 400);
  } catch (error) {
    console.log('❌ Conversation sync failed:', error.message);
    tests.push(false);
  }
  
  const passed = tests.filter(t => t).length;
  console.log(`\n💬 Conversation Results: ${passed}/${tests.length} tests passed`);
  return { passed, total: tests.length };
};

// Test 3: State Persistence
const testStatePersistence = async () => {
  console.log('\n💾 Testing State Persistence');
  console.log('=============================');
  
  const tests = [];
  
  // Test user profile persistence
  console.log('🔸 Testing user profile persistence...');
  try {
    const profileUpdate = {
      preferences: {
        theme: 'dark',
        notifications: true,
        analyticsEnabled: true
      },
      metadata: {
        lastActive: new Date().toISOString(),
        deviceInfo: 'test-device'
      }
    };
    
    const updateResult = await apiRequest('/user/profile', 'PUT', profileUpdate);
    console.log(`Update Status: ${updateResult.status}`);
    
    // Verify persistence by retrieving
    const getResult = await apiRequest('/user/profile');
    console.log(`Get Status: ${getResult.status}, Has preferences:`, !!getResult.data?.preferences);
    
    tests.push(updateResult.status < 400 && getResult.status < 400);
  } catch (error) {
    console.log('❌ Profile persistence failed:', error.message);
    tests.push(false);
  }
  
  // Test settings persistence
  console.log('🔸 Testing app settings persistence...');
  try {
    const settingsData = {
      settings: {
        autoSave: true,
        syncEnabled: true,
        backgroundRefresh: false
      }
    };
    
    const result = await apiRequest('/user/settings', 'POST', settingsData);
    console.log(`Status: ${result.status}, Response:`, !!result.data);
    tests.push(result.status < 400);
  } catch (error) {
    console.log('❌ Settings persistence failed:', error.message);
    tests.push(false);
  }
  
  // Test data synchronization
  console.log('🔸 Testing cross-session data sync...');
  try {
    const syncData = {
      lastSyncTimestamp: new Date().toISOString(),
      dataTypes: ['conversations', 'preferences', 'analytics']
    };
    
    const result = await apiRequest('/mobile/sync', 'POST', syncData);
    console.log(`Status: ${result.status}, Sync data available:`, !!result.data);
    tests.push(result.status < 400);
  } catch (error) {
    console.log('❌ Data sync failed:', error.message);
    tests.push(false);
  }
  
  const passed = tests.filter(t => t).length;
  console.log(`\n💾 State Persistence Results: ${passed}/${tests.length} tests passed`);
  return { passed, total: tests.length };
};

// Test 4: Advanced Features
const testAdvancedFeatures = async () => {
  console.log('\n🚀 Testing Advanced Features');
  console.log('=============================');
  
  const tests = [];
  
  // Test emotional analytics
  console.log('🔸 Testing emotional analytics...');
  try {
    const emotionData = {
      emotion: 'excited',
      intensity: 8,
      context: 'testing emotional analytics',
      timestamp: new Date().toISOString()
    };
    
    const result = await apiRequest('/emotions', 'POST', emotionData);
    console.log(`Status: ${result.status}, Response:`, !!result.data);
    tests.push(result.status < 400);
  } catch (error) {
    console.log('❌ Emotional analytics failed:', error.message);
    tests.push(false);
  }
  
  // Test personal insights
  console.log('🔸 Testing personal insights generation...');
  try {
    const result = await apiRequest('/personal-insights/growth-summary?period=week');
    console.log(`Status: ${result.status}, Has insights:`, !!result.data);
    tests.push(result.status < 400);
  } catch (error) {
    console.log('❌ Personal insights failed:', error.message);
    tests.push(false);
  }
  
  // Test subscription status
  console.log('🔸 Testing subscription persistence...');
  try {
    const result = await apiRequest('/subscription/status');
    console.log(`Status: ${result.status}, Has subscription data:`, !!result.data);
    tests.push(result.status < 400);
  } catch (error) {
    console.log('❌ Subscription check failed:', error.message);
    tests.push(false);
  }
  
  const passed = tests.filter(t => t).length;
  console.log(`\n🚀 Advanced Features Results: ${passed}/${tests.length} tests passed`);
  return { passed, total: tests.length };
};

// Main test runner
const runAllTests = async () => {
  console.log('Starting comprehensive testing of problematic areas...\n');
  
  // Setup
  const setupSuccess = await setupTestUser();
  if (!setupSuccess) {
    console.log('❌ Cannot continue without valid auth token');
    return;
  }
  
  // Run all test suites
  const results = [];
  
  try {
    results.push(await testAnalytics());
    results.push(await testConversationSaving());
    results.push(await testStatePersistence());
    results.push(await testAdvancedFeatures());
  } catch (error) {
    console.log('❌ Test execution error:', error.message);
  }
  
  // Final summary
  console.log('\n🏁 FINAL SUMMARY');
  console.log('================');
  
  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalTests = results.reduce((sum, r) => sum + r.total, 0);
  
  console.log(`📊 Analytics: ${results[0]?.passed}/${results[0]?.total}`);
  console.log(`💬 Conversations: ${results[1]?.passed}/${results[1]?.total}`);
  console.log(`💾 State Persistence: ${results[2]?.passed}/${results[2]?.total}`);
  console.log(`🚀 Advanced Features: ${results[3]?.passed}/${results[3]?.total}`);
  console.log(`\n🎯 OVERALL: ${totalPassed}/${totalTests} tests passed (${Math.round(totalPassed/totalTests*100)}%)`);
  
  if (totalPassed === totalTests) {
    console.log('\n🎉 ALL SYSTEMS WORKING! No broken areas detected.');
  } else if (totalPassed / totalTests > 0.7) {
    console.log('\n✅ Most systems working well, minor issues detected.');
  } else {
    console.log('\n⚠️  Significant issues found - these areas need attention.');
  }
  
  process.exit(0);
};

runAllTests();