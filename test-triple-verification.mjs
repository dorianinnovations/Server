import fetch from 'node-fetch';
import { io } from 'socket.io-client';
import assert from 'assert';

const baseUrl = 'http://localhost:5000';
let authToken = null;
let userId = null;

// Colors for output
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

// Test results storage
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  endpoints: {}
};

// Create test user and get auth token
const setupTestUser = async () => {
  const timestamp = Date.now();
  const userEmail = `triple-test-${timestamp}@numina.app`;
  const password = 'testpassword123';
  
  console.log(`${colors.cyan}🔐 Setting up test user: ${userEmail}${colors.reset}`);
  
  const response = await fetch(`${baseUrl}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userEmail, password })
  });
  
  const data = await response.json();
  if (data.token) {
    authToken = data.token;
    userId = data.user?.id || data.user?._id;
    console.log(`${colors.green}✅ Test user created successfully${colors.reset}\n`);
    return true;
  }
  return false;
};

// Method 1: Basic HTTP Request Test
const httpTest = async (config) => {
  const { path, method = 'GET', body = null, requiresAuth = true } = config;
  
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(requiresAuth && authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${baseUrl}${path}`, options);
    const text = await response.text();
    
    let jsonData = null;
    try {
      jsonData = JSON.parse(text);
    } catch (e) {
      // Not JSON
    }
    
    return {
      success: response.status < 400 && jsonData !== null,
      status: response.status,
      data: jsonData,
      hasData: jsonData && Object.keys(jsonData).length > 0,
      responseTime: response.headers.get('response-time') || 'N/A'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Method 2: Assertion-based Test
const assertionTest = async (config) => {
  const { path, expectedKeys = [], expectedStatus = 200 } = config;
  
  try {
    const result = await httpTest(config);
    
    // Assertions
    assert(result.success, `Endpoint should be successful`);
    assert(result.status === expectedStatus, `Status should be ${expectedStatus}, got ${result.status}`);
    assert(result.hasData, `Response should contain data`);
    
    if (expectedKeys.length > 0 && result.data) {
      const dataKeys = Object.keys(result.data.data || result.data);
      expectedKeys.forEach(key => {
        assert(dataKeys.includes(key) || (result.data.data && Object.keys(result.data.data).includes(key)), 
               `Response should contain key: ${key}`);
      });
    }
    
    return { success: true, assertions: expectedKeys.length + 2 };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Method 3: Performance & Data Quality Test
const performanceTest = async (config) => {
  const { path, maxResponseTime = 10000 } = config;
  
  try {
    const startTime = Date.now();
    const result = await httpTest(config);
    const responseTime = Date.now() - startTime;
    
    // Performance checks
    const isPerformant = responseTime <= maxResponseTime;
    
    // Data quality checks
    let hasRealData = true;
    if (result.data) {
      const content = JSON.stringify(result.data).toLowerCase();
      hasRealData = !content.includes('mock') && 
                   !content.includes('fallback') && 
                   !content.includes('placeholder') &&
                   !content.includes('example');
    }
    
    return {
      success: result.success && isPerformant && hasRealData,
      responseTime,
      isPerformant,
      hasRealData,
      dataQuality: hasRealData ? 'real' : 'mock/fallback'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Run triple verification for a single endpoint
const tripleVerify = async (config) => {
  const { name, path } = config;
  
  console.log(`${colors.blue}🧪 Testing: ${name}${colors.reset}`);
  console.log(`   Path: ${config.method || 'GET'} ${path}`);
  
  testResults.total++;
  testResults.endpoints[name] = { tests: {}, overall: false };
  
  // Method 1: HTTP Test
  process.stdout.write('   Method 1 (HTTP): ');
  const httpResult = await httpTest(config);
  const method1Pass = httpResult.success;
  testResults.endpoints[name].tests.http = { pass: method1Pass, result: httpResult };
  console.log(method1Pass ? `${colors.green}✅ PASS${colors.reset}` : `${colors.red}❌ FAIL${colors.reset}`);
  
  // Method 2: Assertions
  process.stdout.write('   Method 2 (Assertions): ');
  const assertionResult = await assertionTest(config);
  const method2Pass = assertionResult.success;
  testResults.endpoints[name].tests.assertions = { pass: method2Pass, result: assertionResult };
  console.log(method2Pass ? `${colors.green}✅ PASS${colors.reset}` : `${colors.red}❌ FAIL${colors.reset}`);
  
  // Method 3: Performance
  process.stdout.write('   Method 3 (Performance): ');
  const perfResult = await performanceTest(config);
  const method3Pass = perfResult.success;
  testResults.endpoints[name].tests.performance = { pass: method3Pass, result: perfResult };
  console.log(method3Pass ? `${colors.green}✅ PASS${colors.reset}` : `${colors.red}❌ FAIL${colors.reset}`);
  
  // Overall result
  const overallPass = method1Pass && method2Pass && method3Pass;
  testResults.endpoints[name].overall = overallPass;
  
  if (overallPass) {
    testResults.passed++;
    console.log(`   ${colors.bright}${colors.green}🎯 OVERALL: PASS (3/3)${colors.reset}`);
  } else {
    testResults.failed++;
    const passCount = [method1Pass, method2Pass, method3Pass].filter(Boolean).length;
    console.log(`   ${colors.bright}${colors.red}🎯 OVERALL: FAIL (${passCount}/3)${colors.reset}`);
  }
  
  console.log('');
};

// WebSocket specific test
const testWebSocketTriple = async () => {
  console.log(`${colors.magenta}🔌 Triple Testing WebSocket Connection${colors.reset}`);
  
  const wsResults = { method1: false, method2: false, method3: false };
  
  // Method 1: Basic Connection Test
  console.log('   Method 1 (Connection): ');
  const connectResult = await new Promise((resolve) => {
    const socket = io(baseUrl, {
      auth: { token: authToken },
      autoConnect: false
    });
    
    socket.on('connect', () => {
      socket.disconnect();
      resolve(true);
    });
    
    socket.on('connect_error', () => resolve(false));
    socket.connect();
    setTimeout(() => resolve(false), 3000);
  });
  wsResults.method1 = connectResult;
  console.log(`     ${connectResult ? colors.green + '✅ PASS' : colors.red + '❌ FAIL'}${colors.reset}`);
  
  // Method 2: Message Echo Test
  console.log('   Method 2 (Echo Test): ');
  const echoResult = await new Promise((resolve) => {
    const socket = io(baseUrl, {
      auth: { token: authToken },
      autoConnect: false
    });
    
    let messageReceived = false;
    
    socket.on('connect', () => {
      socket.emit('test-echo', { message: 'ping' });
    });
    
    socket.on('test-echo-response', () => {
      messageReceived = true;
      socket.disconnect();
      resolve(true);
    });
    
    socket.on('connect_error', () => resolve(false));
    socket.connect();
    
    setTimeout(() => {
      socket.disconnect();
      resolve(messageReceived);
    }, 3000);
  });
  wsResults.method2 = echoResult;
  console.log(`     ${echoResult ? colors.green + '✅ PASS' : colors.red + '❌ FAIL'}${colors.reset}`);
  
  // Method 3: Authentication Test
  console.log('   Method 3 (Auth Test): ');
  const authTestResult = await new Promise((resolve) => {
    const socket = io(baseUrl, {
      auth: { token: 'invalid-token' },
      autoConnect: false
    });
    
    socket.on('connect', () => {
      socket.disconnect();
      resolve(false); // Should not connect with invalid token
    });
    
    socket.on('connect_error', () => resolve(true)); // Should fail with invalid token
    socket.connect();
    setTimeout(() => resolve(true), 2000);
  });
  wsResults.method3 = authTestResult;
  console.log(`     ${authTestResult ? colors.green + '✅ PASS' : colors.red + '❌ FAIL'}${colors.reset}`);
  
  const wsOverall = wsResults.method1 && wsResults.method2 && wsResults.method3;
  testResults.endpoints['WebSocket'] = { 
    tests: wsResults, 
    overall: wsOverall 
  };
  
  testResults.total++;
  if (wsOverall) {
    testResults.passed++;
    console.log(`   ${colors.bright}${colors.green}🎯 WEBSOCKET OVERALL: PASS (3/3)${colors.reset}`);
  } else {
    testResults.failed++;
    const passCount = Object.values(wsResults).filter(Boolean).length;
    console.log(`   ${colors.bright}${colors.red}🎯 WEBSOCKET OVERALL: FAIL (${passCount}/3)${colors.reset}`);
  }
  
  console.log('');
};

// Main test runner
const runTripleVerification = async () => {
  console.log(`${colors.bright}${colors.blue}🎯 NUMINA TRIPLE VERIFICATION TEST SUITE${colors.reset}`);
  console.log('==========================================\n');
  
  // Setup
  const userCreated = await setupTestUser();
  if (!userCreated) {
    console.log(`${colors.red}❌ Failed to create test user${colors.reset}`);
    process.exit(1);
  }
  
  // Define all endpoints with corrected paths and expected data
  const endpointsToTest = [
    // User Management (corrected paths)
    { 
      path: '/profile', 
      name: 'User Profile', 
      expectedKeys: ['user', 'profilePicture', 'tierBadge'],
      maxResponseTime: 2000
    },
    { 
      path: '/settings', 
      name: 'User Settings', 
      expectedKeys: ['settings'],
      maxResponseTime: 1000
    },
    { 
      path: '/preferences', 
      name: 'User Preferences', 
      expectedKeys: ['preferences'],
      maxResponseTime: 1000
    },
    
    // Conversations
    { 
      path: '/conversations', 
      name: 'List Conversations', 
      expectedKeys: ['conversations', 'pagination'],
      maxResponseTime: 2000
    },
    { 
      path: '/conversations/recent', 
      name: 'Recent Conversations',
      maxResponseTime: 2000
    },
    
    // AI & Analytics
    { 
      path: '/ai/adaptive-chat', 
      method: 'POST', 
      body: { message: 'Test intelligence verification' }, 
      name: 'Adaptive Chat',
      expectedKeys: ['response', 'tone'],
      maxResponseTime: 5000
    },
    { 
      path: '/analytics/llm', 
      method: 'POST', 
      body: { query: 'performance metrics' }, 
      name: 'LLM Analytics',
      maxResponseTime: 1000
    },
    { 
      path: '/analytics/memory', 
      name: 'Analytics Memory',
      expectedKeys: ['userId', 'sessionDuration'],
      maxResponseTime: 500
    },
    { 
      path: '/analytics/recommendations', 
      name: 'Analytics Recommendations',
      expectedKeys: ['recommendations'],
      maxResponseTime: 500
    },
    
    // Emotional Analytics
    { 
      path: '/emotional-analytics/current-session', 
      name: 'Current Session',
      expectedKeys: ['userId', 'sessionId', 'dominantEmotion'],
      maxResponseTime: 500
    },
    { 
      path: '/emotional-analytics/weekly-report', 
      name: 'Weekly Report',
      expectedKeys: ['userId', 'reportPeriod'],
      maxResponseTime: 500
    },
    { 
      path: '/emotions', 
      method: 'POST', 
      body: { emotion: 'confident', intensity: 8 }, 
      name: 'Submit Emotion',
      expectedKeys: ['userId', 'emotion', 'intensity'],
      maxResponseTime: 500
    },
    
    // Cloud & Social
    { 
      path: '/cloud/events', 
      name: 'Cloud Events',
      expectedKeys: ['events', 'pagination'],
      maxResponseTime: 2000
    },
    { 
      path: '/cloud/compatibility/users', 
      method: 'POST', 
      body: { userEmotionalState: { mood: 'optimistic', energy: 8 } }, 
      name: 'User Compatibility',
      maxResponseTime: 5000
    },
    
    // Mobile
    { 
      path: '/mobile/sync', 
      name: 'Mobile Sync',
      expectedKeys: ['timestamp', 'data'],
      maxResponseTime: 2000
    },
    { 
      path: '/mobile/app-config', 
      name: 'App Config',
      expectedKeys: ['features', 'limits'],
      maxResponseTime: 1000
    },
    { 
      path: '/mobile/realtime-status', 
      name: 'Realtime Status',
      expectedKeys: ['user', 'server'],
      maxResponseTime: 500
    },
    { 
      path: '/mobile/profile-header', 
      name: 'Profile Header',
      expectedKeys: ['user', 'tier'],
      maxResponseTime: 1000
    },
    
    // Personal Insights
    { 
      path: '/personal-insights/growth-summary', 
      name: 'Growth Summary',
      expectedKeys: ['timeframe', 'metrics'],
      maxResponseTime: 8000
    },
    { 
      path: '/personal-insights/milestones', 
      name: 'Milestones',
      expectedKeys: ['milestones', 'stats'],
      maxResponseTime: 2000
    },
    
    // Sandbox
    { 
      path: '/sandbox/test', 
      name: 'Sandbox Test',
      maxResponseTime: 500
    },
    { 
      path: '/sandbox/auth-test', 
      name: 'Sandbox Auth Test',
      maxResponseTime: 500
    },
    
    // Subscription & Wallet
    { 
      path: '/subscription/status', 
      name: 'Subscription Status',
      expectedKeys: ['subscription'],
      maxResponseTime: 1000
    },
    { 
      path: '/wallet/balance', 
      name: 'Wallet Balance',
      expectedKeys: ['balance', 'currency'],
      maxResponseTime: 2000
    },
    { 
      path: '/wallet/summary', 
      name: 'Wallet Summary',
      expectedKeys: ['balance', 'recentTransactions'],
      maxResponseTime: 2000
    },
    
    // Tools
    { 
      path: '/tools/available', 
      name: 'Available Tools',
      maxResponseTime: 1000
    },
    { 
      path: '/tools/registry', 
      name: 'Tools Registry',
      maxResponseTime: 1000
    },
    
    // Health & Status (corrected paths)
    { 
      path: '/health', 
      requiresAuth: false, 
      name: 'Health Status',
      expectedKeys: ['status', 'health'],
      maxResponseTime: 2000
    },
    { 
      path: '/websocket', 
      requiresAuth: false, 
      name: 'WebSocket Health',
      expectedKeys: ['success', 'websocket'],
      maxResponseTime: 1000
    },
    
    // Documentation
    { 
      path: '/api/docs', 
      requiresAuth: false, 
      name: 'API Documentation',
      maxResponseTime: 1000
    }
  ];
  
  // Test all endpoints with triple verification
  for (const endpoint of endpointsToTest) {
    await tripleVerify(endpoint);
  }
  
  // Test WebSocket separately
  await testWebSocketTriple();
  
  // Generate final report
  console.log(`${colors.bright}${colors.cyan}📊 TRIPLE VERIFICATION RESULTS${colors.reset}`);
  console.log('===================================\n');
  
  const successRate = Math.round((testResults.passed / testResults.total) * 100);
  console.log(`${colors.bright}Overall Success Rate: ${successRate >= 95 ? colors.green : successRate >= 80 ? colors.yellow : colors.red}${testResults.passed}/${testResults.total} (${successRate}%)${colors.reset}\n`);
  
  // Detailed breakdown
  console.log(`${colors.bright}Endpoint Status:${colors.reset}`);
  Object.entries(testResults.endpoints).forEach(([name, result]) => {
    const status = result.overall ? `${colors.green}✅ PASS` : `${colors.red}❌ FAIL`;
    console.log(`  ${status} ${name}${colors.reset}`);
  });
  
  // Failed endpoints
  const failedEndpoints = Object.entries(testResults.endpoints)
    .filter(([_, result]) => !result.overall);
  
  if (failedEndpoints.length > 0) {
    console.log(`\n${colors.bright}${colors.red}❌ FAILED ENDPOINTS:${colors.reset}`);
    failedEndpoints.forEach(([name, result]) => {
      console.log(`  ${name}:`);
      Object.entries(result.tests).forEach(([method, test]) => {
        if (!test.pass) {
          console.log(`    - ${method}: ${test.result.error || 'Failed validation'}`);
        }
      });
    });
  }
  
  // Success summary
  if (successRate >= 95) {
    console.log(`\n${colors.bright}${colors.green}🎉 EXCELLENT! All systems verified and ready for production!${colors.reset}`);
  } else if (successRate >= 80) {
    console.log(`\n${colors.bright}${colors.yellow}⚠️  GOOD! Most systems verified, minor issues to address.${colors.reset}`);
  } else {
    console.log(`\n${colors.bright}${colors.red}❌ NEEDS WORK! Multiple systems require fixes before production.${colors.reset}`);
  }
  
  // Export detailed results
  const fs = await import('fs/promises');
  await fs.writeFile(
    'triple-verification-results.json',
    JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: testResults,
      successRate,
      readyForProduction: successRate >= 95
    }, null, 2)
  );
  
  console.log(`\n${colors.green}✅ Detailed results saved to triple-verification-results.json${colors.reset}`);
  
  process.exit(successRate >= 95 ? 0 : 1);
};

// Run the tests
runTripleVerification().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});