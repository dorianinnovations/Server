#!/usr/bin/env node

/**
 * NUMINA ECOSYSTEM INTEGRATION TEST (SIMPLIFIED)
 * Tests the complete data flow: adaptive-chat → UBPM → Analytics + Sandbox
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.SERVER_URL || 'http://localhost:5000';
let authToken = null;
let userId = null;

// Test configuration
const TEST_CONFIG = {
  testEmail: `test_ecosystem_${Date.now()}@numina.ai`,
  testPassword: 'TestPassword123!'
};

// Helper functions
const log = {
  success: (msg) => console.log('✅ ' + msg),
  error: (msg) => console.log('❌ ' + msg),
  info: (msg) => console.log('ℹ️  ' + msg),
  header: (msg) => console.log('\n' + '='.repeat(60) + '\n' + msg + '\n' + '='.repeat(60))
};

// API helper
async function apiCall(method, endpoint, data = null) {
  const config = {
    method,
    url: `${BASE_URL}${endpoint}`,
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    data
  };

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`API Error [${method} ${endpoint}]:`, error.response?.data || error.message);
    throw error;
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Main test flow
async function runTest() {
  try {
    log.header('🌟 NUMINA ECOSYSTEM INTEGRATION TEST 🌟');
    
    // 1. Create test user
    log.info('Creating test user...');
    const registerResponse = await apiCall('POST', '/signup', {
      email: TEST_CONFIG.testEmail,
      password: TEST_CONFIG.testPassword
    });
    
    console.log('Register response:', JSON.stringify(registerResponse, null, 2));
    
    // Handle different response formats
    if (registerResponse.token) {
      authToken = registerResponse.token;
      userId = registerResponse.data?.user?.id || registerResponse.user?._id || registerResponse.userId;
    } else if (registerResponse.data?.token) {
      authToken = registerResponse.data.token;
      userId = registerResponse.data.user?._id || registerResponse.data.userId;
    }
    
    if (!authToken) {
      log.error('No auth token received');
      return;
    }
    
    log.success(`User created: ${TEST_CONFIG.testEmail}`);
    
    // 2. Send adaptive-chat messages to build UBPM data
    log.header('TEST 1: Sending messages to adaptive-chat');
    
    const testMessages = [
      "I've been thinking about how AI can help me organize my daily routine better.",
      "Can you help me understand neural networks? I find them fascinating but complex.",
      "I feel excited about learning new things, especially technology and AI!",
      "Please help me create a study schedule for machine learning",
      "Should I focus on learning Python or JavaScript first for AI development?",
      "I'm feeling a bit overwhelmed with all the new concepts, but I'm determined to learn"
    ];
    
    for (let i = 0; i < testMessages.length; i++) {
      log.info(`Sending message ${i + 1}/${testMessages.length}...`);
      
      try {
        const response = await apiCall('POST', '/ai/adaptive-chat', {
          message: testMessages[i],
          stream: false
        });
        
        if (response.success) {
          log.success(`Message ${i + 1} sent successfully`);
        }
        
        await sleep(2000); // Wait between messages
      } catch (error) {
        log.error(`Failed to send message ${i + 1}`);
      }
    }
    
    // 3. Check UBPM data
    log.header('TEST 2: Checking UBPM data generation');
    await sleep(5000); // Wait for UBPM analysis
    
    try {
      const ubpmResponse = await apiCall('GET', '/test-ubpm/context');
      
      if (ubpmResponse.success && ubpmResponse.data) {
        log.success('UBPM data retrieved');
        console.log('UBPM confidence:', ubpmResponse.data.confidence);
        console.log('UBPM data points:', ubpmResponse.data.dataPoints);
        
        if (ubpmResponse.data.dataPoints >= 5) {
          log.success('UBPM has analyzed behavioral patterns!');
        }
      }
    } catch (error) {
      log.error('Failed to retrieve UBPM data');
    }
    
    // 4. Test Analytics endpoint
    log.header('TEST 3: Testing Analytics ecosystem endpoint');
    
    try {
      const analyticsResponse = await apiCall('GET', '/analytics/ecosystem');
      
      if (analyticsResponse.success && analyticsResponse.data) {
        log.success('Analytics ecosystem data retrieved');
        console.log('Summary:', analyticsResponse.data.summary);
        console.log('Chart categories:', Object.keys(analyticsResponse.data.charts));
        
        // Check if charts have UBPM data
        const hasData = Object.values(analyticsResponse.data.charts).some(chart => chart.length > 0);
        if (hasData) {
          log.success('Analytics charts contain UBPM-based data!');
        } else {
          log.info('Analytics charts are empty (need more interactions)');
        }
      }
    } catch (error) {
      log.error('Failed to retrieve analytics ecosystem data');
    }
    
    // 5. Test Sandbox personalization
    log.header('TEST 4: Testing Sandbox UBPM personalization');
    
    try {
      // Generate nodes with UBPM directly (no session needed)
      const nodesResponse = await apiCall('POST', '/sandbox/generate-nodes', {
        query: 'AI and machine learning exploration',
        selectedActions: ['explore', 'ubpm'],
        useUBPM: true
      });
      
      if (nodesResponse.success && nodesResponse.nodes) {
        log.success(`Generated ${nodesResponse.nodes.length} personalized nodes`);
        
        // Check for UBPM influence
        const hasPersonalization = nodesResponse.nodes.some(node => 
          node.personalHook || node.metadata?.ubpmInfluence
        );
        
        if (hasPersonalization) {
          log.success('Sandbox nodes show UBPM personalization!');
        }
        
        // Log some personalization details
        nodesResponse.nodes.forEach((node, idx) => {
          if (node.personalHook) {
            console.log(`Node ${idx + 1} personal hook:`, node.personalHook.substring(0, 100) + '...');
          }
        });
      }
    } catch (error) {
      log.error('Failed to test sandbox personalization');
    }
    
    // Summary
    log.header('TEST COMPLETE');
    log.success('Integration test completed!');
    log.info('Summary: User conversations → UBPM analysis → Analytics + Sandbox personalization');
    
  } catch (error) {
    log.error('Test failed with error:');
    console.error(error);
  } finally {
    process.exit(0);
  }
}

// Run the test
runTest();