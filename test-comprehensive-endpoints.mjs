import fetch from 'node-fetch';
import { io } from 'socket.io-client';

const baseUrl = 'http://localhost:5000';
let authToken = null;
let userId = null;
let userEmail = null;

// ANSI colors for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Create a new user and get auth token
const setupTestUser = async () => {
  const timestamp = Date.now();
  userEmail = `test-${timestamp}@numina.app`;
  const password = 'testpassword123';
  
  console.log(`${colors.cyan}📧 Creating test user: ${userEmail}${colors.reset}`);
  
  const response = await fetch(`${baseUrl}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userEmail, password })
  });
  
  const data = await response.json();
  if (data.token) {
    authToken = data.token;
    userId = data.user?.id || data.user?._id;
    console.log(`${colors.green}✅ User created successfully${colors.reset}`);
    console.log(`   Token: ${authToken.substring(0, 20)}...`);
    console.log(`   User ID: ${userId}\n`);
    return true;
  }
  return false;
};

// Test a single endpoint
const testEndpoint = async (config) => {
  const { path, method = 'GET', body = null, name, requiresAuth = true, contentType = 'application/json' } = config;
  
  try {
    const options = {
      method,
      headers: {
        'Content-Type': contentType,
        ...(requiresAuth && authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
      }
    };
    
    if (body && contentType === 'application/json') {
      options.body = JSON.stringify(body);
    } else if (body) {
      options.body = body;
    }
    
    const startTime = Date.now();
    const response = await fetch(`${baseUrl}${path}`, options);
    const responseTime = Date.now() - startTime;
    
    const text = await response.text();
    let jsonData = null;
    let isJson = false;
    
    try {
      jsonData = JSON.parse(text);
      isJson = true;
    } catch (e) {
      // Not JSON
    }
    
    const result = {
      status: response.status,
      isJson,
      data: jsonData,
      text: text.substring(0, 200),
      responseTime,
      hasError: response.status >= 400,
      isHtml: text.includes('<!DOCTYPE') || text.includes('<html'),
      isEmpty: text.length === 0
    };
    
    // Analyze response quality
    if (isJson && jsonData) {
      result.hasRealData = !jsonData.mock && !jsonData.fallback;
      result.success = jsonData.success === true || response.status < 300;
      if (jsonData.data) {
        result.dataKeys = Object.keys(jsonData.data);
      }
    }
    
    return result;
  } catch (error) {
    return {
      status: 'ERROR',
      error: error.message,
      hasError: true
    };
  }
};

// Test WebSocket functionality
const testWebSocket = async () => {
  console.log(`\n${colors.magenta}🔌 Testing WebSocket Connection${colors.reset}`);
  console.log('================================\n');
  
  return new Promise((resolve) => {
    const socket = io(baseUrl, {
      auth: { token: authToken },
      autoConnect: false
    });
    
    const results = {
      connected: false,
      authenticated: false,
      messagesReceived: []
    };
    
    socket.on('connect', () => {
      results.connected = true;
      results.authenticated = true;
      console.log(`${colors.green}✅ WebSocket connected successfully${colors.reset}`);
      
      // Test sending a message
      socket.emit('message', { text: 'Test message from comprehensive test' });
    });
    
    socket.on('connect_error', (error) => {
      console.log(`${colors.red}❌ WebSocket connection failed: ${error.message}${colors.reset}`);
    });
    
    socket.on('message', (data) => {
      results.messagesReceived.push(data);
      console.log(`${colors.blue}📨 Received message:${colors.reset}`, data);
    });
    
    socket.connect();
    
    setTimeout(() => {
      socket.disconnect();
      resolve(results);
    }, 3000);
  });
};

// Test conversation flow
const testConversationFlow = async () => {
  console.log(`\n${colors.magenta}💬 Testing Conversation Flow${colors.reset}`);
  console.log('==============================\n');
  
  // Create a conversation
  const createResult = await testEndpoint({
    path: '/conversations',
    method: 'POST',
    body: { title: 'Test Conversation', type: 'chat' },
    name: 'Create Conversation'
  });
  
  if (createResult.isJson && createResult.data?.id) {
    const conversationId = createResult.data.id;
    console.log(`${colors.green}✅ Created conversation: ${conversationId}${colors.reset}`);
    
    // Add a message
    const messageResult = await testEndpoint({
      path: `/conversations/${conversationId}/messages`,
      method: 'POST',
      body: { 
        content: 'Hello, this is a test message!',
        role: 'user'
      },
      name: 'Add Message'
    });
    
    if (messageResult.success) {
      console.log(`${colors.green}✅ Added message to conversation${colors.reset}`);
    }
    
    // Get conversation details
    const detailResult = await testEndpoint({
      path: `/conversations/${conversationId}`,
      name: 'Get Conversation Details'
    });
    
    return {
      created: createResult.success,
      messageAdded: messageResult.success,
      detailsRetrieved: detailResult.success,
      conversationId
    };
  }
  
  return { created: false };
};

// Test AI chat functionality
const testAIChat = async () => {
  console.log(`\n${colors.magenta}🤖 Testing AI Chat Functionality${colors.reset}`);
  console.log('==================================\n');
  
  const chatResult = await testEndpoint({
    path: '/ai/adaptive-chat',
    method: 'POST',
    body: {
      message: 'Tell me an inspiring quote about technology',
      conversationId: null,
      emotionalContext: {
        currentMood: 'curious',
        energyLevel: 7
      }
    },
    name: 'Adaptive Chat'
  });
  
  if (chatResult.isJson && chatResult.data?.response) {
    console.log(`${colors.green}✅ AI Response received:${colors.reset}`);
    console.log(`   "${chatResult.data.response.substring(0, 100)}..."`);
    return true;
  }
  
  return false;
};

// Main test runner
const runComprehensiveTest = async () => {
  console.log(`${colors.bright}${colors.blue}🚀 NUMINA SERVER COMPREHENSIVE ENDPOINT TEST${colors.reset}`);
  console.log('===========================================\n');
  
  // Check if server is running
  const healthCheck = await testEndpoint({
    path: '/health',
    requiresAuth: false,
    name: 'Health Check'
  });
  
  if (healthCheck.hasError) {
    console.log(`${colors.red}❌ Server not running at ${baseUrl}${colors.reset}`);
    process.exit(1);
  }
  
  console.log(`${colors.green}✅ Server is running${colors.reset}\n`);
  
  // Setup test user
  const userCreated = await setupTestUser();
  if (!userCreated) {
    console.log(`${colors.red}❌ Failed to create test user${colors.reset}`);
    process.exit(1);
  }
  
  // Define all endpoints to test
  const endpointsToTest = [
    // Authentication & User Management
    { path: '/user/profile', name: 'User Profile', category: 'User' },
    { path: '/user/settings', name: 'User Settings', category: 'User' },
    { path: '/user/preferences', name: 'User Preferences', category: 'User' },
    
    // Conversations
    { path: '/conversations', name: 'List Conversations', category: 'Conversations' },
    { path: '/conversations/recent', name: 'Recent Conversations', category: 'Conversations' },
    
    // AI & Analytics
    { path: '/ai/adaptive-chat', method: 'POST', body: { message: 'Hello' }, name: 'Adaptive Chat', category: 'AI' },
    { path: '/analytics/llm', method: 'POST', body: { query: 'test' }, name: 'LLM Analytics', category: 'Analytics' },
    { path: '/analytics/memory', name: 'Analytics Memory', category: 'Analytics' },
    { path: '/analytics/recommendations', name: 'Analytics Recommendations', category: 'Analytics' },
    
    // Emotional Analytics
    { path: '/emotional-analytics/current-session', name: 'Current Session', category: 'Emotional' },
    { path: '/emotional-analytics/weekly-report', name: 'Weekly Report', category: 'Emotional' },
    { path: '/emotions', method: 'POST', body: { emotion: 'happy', intensity: 7 }, name: 'Submit Emotion', category: 'Emotional' },
    
    // Cloud & Events
    { path: '/cloud/events', name: 'Cloud Events', category: 'Cloud' },
    { path: '/cloud/compatibility/users', method: 'POST', body: { userEmotionalState: { mood: 'happy' } }, name: 'User Compatibility', category: 'Cloud' },
    
    // Mobile
    { path: '/mobile/sync', name: 'Mobile Sync', category: 'Mobile' },
    { path: '/mobile/app-config', name: 'App Config', category: 'Mobile' },
    { path: '/mobile/realtime-status', name: 'Realtime Status', category: 'Mobile' },
    { path: '/mobile/profile-header', name: 'Profile Header', category: 'Mobile' },
    
    // Sandbox
    { path: '/sandbox/test', name: 'Sandbox Test', category: 'Sandbox' },
    { path: '/sandbox/auth-test', name: 'Sandbox Auth Test', category: 'Sandbox' },
    
    // Personal Insights
    { path: '/personal-insights/growth-summary', name: 'Growth Summary', category: 'Insights' },
    { path: '/personal-insights/milestones', name: 'Milestones', category: 'Insights' },
    
    // Subscription & Wallet
    { path: '/subscription/status', name: 'Subscription Status', category: 'Subscription' },
    { path: '/wallet/balance', name: 'Wallet Balance', category: 'Wallet' },
    { path: '/wallet/summary', name: 'Wallet Summary', category: 'Wallet' },
    
    // Tools
    { path: '/tools/available', name: 'Available Tools', category: 'Tools' },
    { path: '/tools/registry', name: 'Tools Registry', category: 'Tools' },
    
    // Health & Status
    { path: '/health', requiresAuth: false, name: 'Health Status', category: 'Health' },
    { path: '/health/websocket', requiresAuth: false, name: 'WebSocket Health', category: 'Health' },
    { path: '/api/docs', requiresAuth: false, name: 'API Documentation', category: 'Documentation' }
  ];
  
  // Test all endpoints
  const results = [];
  const categoryResults = {};
  
  for (const endpoint of endpointsToTest) {
    process.stdout.write(`Testing ${endpoint.name}... `);
    const result = await testEndpoint(endpoint);
    
    const status = {
      endpoint,
      result,
      working: result.isJson && !result.hasError && result.status < 400
    };
    
    results.push(status);
    
    // Track by category
    if (!categoryResults[endpoint.category]) {
      categoryResults[endpoint.category] = { working: 0, total: 0 };
    }
    categoryResults[endpoint.category].total++;
    if (status.working) {
      categoryResults[endpoint.category].working++;
    }
    
    // Print status
    if (status.working) {
      console.log(`${colors.green}✅ WORKING${colors.reset} (${result.responseTime}ms)`);
      if (result.hasRealData !== false && result.dataKeys) {
        console.log(`   Data keys: ${result.dataKeys.join(', ')}`);
      }
    } else {
      console.log(`${colors.red}❌ BROKEN${colors.reset} (${result.status})`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
  }
  
  // Test WebSocket
  const wsResults = await testWebSocket();
  
  // Test conversation flow
  const conversationResults = await testConversationFlow();
  
  // Test AI chat
  const aiChatWorking = await testAIChat();
  
  // Generate report
  console.log(`\n${colors.bright}${colors.cyan}📊 COMPREHENSIVE TEST RESULTS${colors.reset}`);
  console.log('=============================\n');
  
  // Overall statistics
  const workingCount = results.filter(r => r.working).length;
  const totalCount = results.length;
  const percentage = Math.round((workingCount / totalCount) * 100);
  
  console.log(`${colors.bright}Overall:${colors.reset} ${workingCount}/${totalCount} endpoints working (${percentage}%)\n`);
  
  // Category breakdown
  console.log(`${colors.bright}By Category:${colors.reset}`);
  Object.entries(categoryResults).forEach(([category, stats]) => {
    const catPercentage = Math.round((stats.working / stats.total) * 100);
    const color = catPercentage >= 80 ? colors.green : catPercentage >= 50 ? colors.yellow : colors.red;
    console.log(`  ${category}: ${color}${stats.working}/${stats.total} (${catPercentage}%)${colors.reset}`);
  });
  
  // Working endpoints
  console.log(`\n${colors.bright}${colors.green}✅ WORKING ENDPOINTS:${colors.reset}`);
  results.filter(r => r.working).forEach(r => {
    console.log(`  ${r.endpoint.method || 'GET'} ${r.endpoint.path} - ${r.endpoint.name}`);
  });
  
  // Broken endpoints
  console.log(`\n${colors.bright}${colors.red}❌ BROKEN ENDPOINTS:${colors.reset}`);
  results.filter(r => !r.working).forEach(r => {
    console.log(`  ${r.endpoint.method || 'GET'} ${r.endpoint.path} - ${r.endpoint.name} (${r.result.status})`);
  });
  
  // Feature status
  console.log(`\n${colors.bright}${colors.magenta}🎯 FEATURE STATUS:${colors.reset}`);
  console.log(`  WebSocket: ${wsResults.authenticated ? colors.green + '✅ Working' : colors.red + '❌ Broken'}${colors.reset}`);
  console.log(`  Conversations: ${conversationResults.created ? colors.green + '✅ Working' : colors.red + '❌ Broken'}${colors.reset}`);
  console.log(`  AI Chat: ${aiChatWorking ? colors.green + '✅ Working' : colors.red + '❌ Broken'}${colors.reset}`);
  console.log(`  User Authentication: ${colors.green}✅ Working${colors.reset}`);
  
  // Recommendations
  console.log(`\n${colors.bright}${colors.yellow}🔧 RECOMMENDATIONS:${colors.reset}`);
  
  const brokenByCategory = {};
  results.filter(r => !r.working).forEach(r => {
    if (!brokenByCategory[r.endpoint.category]) {
      brokenByCategory[r.endpoint.category] = [];
    }
    brokenByCategory[r.endpoint.category].push(r.endpoint.name);
  });
  
  Object.entries(brokenByCategory).forEach(([category, endpoints]) => {
    console.log(`\n  ${category}:`);
    endpoints.forEach(ep => console.log(`    - Fix ${ep}`));
  });
  
  // Export results
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: totalCount,
      working: workingCount,
      broken: totalCount - workingCount,
      percentage
    },
    categories: categoryResults,
    workingEndpoints: results.filter(r => r.working).map(r => ({
      path: r.endpoint.path,
      method: r.endpoint.method || 'GET',
      name: r.endpoint.name
    })),
    brokenEndpoints: results.filter(r => !r.working).map(r => ({
      path: r.endpoint.path,
      method: r.endpoint.method || 'GET',
      name: r.endpoint.name,
      error: r.result.status
    })),
    features: {
      websocket: wsResults.authenticated,
      conversations: conversationResults.created,
      aiChat: aiChatWorking,
      authentication: true
    }
  };
  
  // Save report
  const fs = await import('fs/promises');
  await fs.writeFile(
    'endpoint-test-results.json',
    JSON.stringify(report, null, 2)
  );
  
  console.log(`\n${colors.green}✅ Report saved to endpoint-test-results.json${colors.reset}`);
  
  process.exit(0);
};

// Run the test
runComprehensiveTest().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});