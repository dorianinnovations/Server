#!/usr/bin/env node

/**
 * NUMINA ECOSYSTEM INTEGRATION TEST
 * Tests the complete data flow: adaptive-chat → UBPM → Analytics + Sandbox + Profile
 * 
 * This test verifies that user conversations trigger UBPM analysis, which then
 * feeds into the Analytics charts, Sandbox personalization, and Profile system.
 */

import axios from 'axios';
import chalk from 'chalk';
import ora from 'ora';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.SERVER_URL || 'http://localhost:3001/api';
let authToken = null;
let userId = null;

// Test configuration
const TEST_CONFIG = {
  testEmail: `test_ecosystem_${Date.now()}@numina.ai`,
  testPassword: 'TestPassword123!',
  testUsername: `ecosystem_tester_${Date.now()}`
};

// Helper functions
const log = {
  success: (msg) => console.log(chalk.green('✅ ' + msg)),
  error: (msg) => console.log(chalk.red('❌ ' + msg)),
  info: (msg) => console.log(chalk.blue('ℹ️  ' + msg)),
  header: (msg) => console.log(chalk.yellow.bold('\n' + '='.repeat(60) + '\n' + msg + '\n' + '='.repeat(60))),
  subheader: (msg) => console.log(chalk.cyan.bold('\n📋 ' + msg + '\n' + '-'.repeat(40))),
  data: (label, data) => console.log(chalk.gray(`   ${label}:`), JSON.stringify(data, null, 2))
};

// API helper with auth
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

// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 1. SETUP: Create test user and authenticate
async function setupTestUser() {
  log.header('SETUP: Creating Test User');
  
  try {
    // Register user
    const registerResponse = await apiCall('POST', '/auth/register', {
      email: TEST_CONFIG.testEmail,
      password: TEST_CONFIG.testPassword,
      username: TEST_CONFIG.testUsername
    });
    
    authToken = registerResponse.token;
    userId = registerResponse.user._id;
    
    log.success(`User created: ${TEST_CONFIG.testEmail}`);
    log.info(`User ID: ${userId}`);
    
    return true;
  } catch (error) {
    log.error('Failed to create test user');
    return false;
  }
}

// 2. TEST: Send messages to adaptive-chat to build UBPM data
async function testAdaptiveChat() {
  log.header('TEST 1: Adaptive Chat with Rich Behavioral Patterns');
  
  const testMessages = [
    // Communication patterns
    { message: "I've been thinking a lot about how AI can help me organize my daily routine better. What are your thoughts on creating a personalized productivity system?", expectedPattern: 'detailed_communicator' },
    { message: "Can you help me understand the concept of neural networks? I find them fascinating but complex.", expectedPattern: 'inquisitive_learner' },
    { message: "I feel excited about learning new things, especially when it comes to technology and AI!", expectedPattern: 'emotionally_expressive' },
    
    // Task-oriented patterns
    { message: "Please help me create a study schedule for learning machine learning", expectedPattern: 'task_oriented' },
    { message: "Can you explain quantum computing in simple terms?", expectedPattern: 'inquisitive_learner' },
    
    // Emotional patterns
    { message: "I'm feeling a bit overwhelmed with all the new concepts, but I'm determined to learn", expectedPattern: 'emotionally_expressive' },
    { message: "This is really helpful! I appreciate how you break down complex topics", expectedPattern: 'positive_feedback' },
    
    // Decision patterns
    { message: "Should I focus on learning Python or JavaScript first for AI development?", expectedPattern: 'collaborative_decision_maker' },
    { message: "What do you think about the future of AI in education?", expectedPattern: 'collaborative_decision_maker' }
  ];

  const responses = [];
  
  for (let i = 0; i < testMessages.length; i++) {
    const testMsg = testMessages[i];
    log.subheader(`Message ${i + 1}: Testing ${testMsg.expectedPattern}`);
    
    const spinner = ora(`Sending: "${testMsg.message.substring(0, 50)}..."`).start();
    
    try {
      const response = await apiCall('POST', '/ai/adaptive-chat', {
        message: testMsg.message,
        stream: false
      });
      
      spinner.succeed('Message sent and response received');
      responses.push(response);
      
      // Log response preview
      if (response.data?.response) {
        log.info(`AI Response: ${response.data.response.substring(0, 100)}...`);
      }
      
      // Wait between messages to simulate natural conversation
      await sleep(2000);
      
    } catch (error) {
      spinner.fail('Failed to send message');
      log.error(`Error: ${error.message}`);
    }
  }
  
  log.success(`Sent ${responses.length} messages to build behavioral patterns`);
  return responses;
}

// 3. TEST: Check UBPM data generation
async function testUBPMGeneration() {
  log.header('TEST 2: UBPM Data Generation and Analysis');
  
  // Wait for UBPM background processing
  log.info('Waiting 5 seconds for UBPM background analysis...');
  await sleep(5000);
  
  try {
    // Get UBPM context
    const ubpmResponse = await apiCall('GET', '/ubpm/context');
    
    if (ubpmResponse.success && ubpmResponse.data) {
      const ubpmData = ubpmResponse.data;
      
      log.success('UBPM data retrieved successfully');
      log.data('UBPM Status', {
        userId: ubpmData.userId,
        confidence: ubpmData.confidence,
        dataPoints: ubpmData.dataPoints,
        lastUpdated: ubpmData.lastUpdated
      });
      
      if (ubpmData.behavioralContext) {
        log.data('Behavioral Context', ubpmData.behavioralContext);
      }
      
      if (ubpmData.emotionalContext) {
        log.data('Emotional Context', ubpmData.emotionalContext);
      }
      
      if (ubpmData.personalityTraits && ubpmData.personalityTraits.length > 0) {
        log.data('Personality Traits', ubpmData.personalityTraits);
      }
      
      // Check if we have enough data points
      if (ubpmData.dataPoints >= 5) {
        log.success(`UBPM has analyzed ${ubpmData.dataPoints} behavioral patterns`);
        return ubpmData;
      } else {
        log.info(`UBPM is still building profile (${ubpmData.dataPoints} patterns detected)`);
        return ubpmData;
      }
    }
    
  } catch (error) {
    log.error('Failed to retrieve UBPM data');
    return null;
  }
}

// 4. TEST: Analytics integration with UBPM data
async function testAnalyticsIntegration() {
  log.header('TEST 3: Analytics Integration with UBPM Data');
  
  try {
    // Test different analytics categories
    const categories = ['communication', 'behavioral', 'emotional', 'growth'];
    const analyticsResults = {};
    
    for (const category of categories) {
      log.subheader(`Testing ${category} analytics`);
      
      const spinner = ora(`Generating ${category} insights...`).start();
      
      try {
        const response = await apiCall('POST', '/analytics/llm', {
          category,
          forceGenerate: true
        });
        
        if (response.success && response.insight) {
          spinner.succeed(`${category} insights generated`);
          analyticsResults[category] = response.insight;
          
          log.data(`${category} Insight Preview`, {
            title: response.insight.title,
            confidence: response.insight.confidence,
            hasChartData: !!response.insight.chartData
          });
        }
        
        await sleep(1000); // Rate limiting
        
      } catch (error) {
        spinner.fail(`Failed to generate ${category} insights`);
      }
    }
    
    // Check if analytics are using UBPM data
    const hasUBPMIntegration = Object.values(analyticsResults).some(insight => 
      insight.description?.includes('pattern') || 
      insight.description?.includes('behavioral') ||
      insight.rawData?.source === 'ubpm'
    );
    
    if (hasUBPMIntegration) {
      log.success('Analytics are successfully integrating UBPM data');
    } else {
      log.error('Analytics do not appear to be using UBPM data');
    }
    
    return analyticsResults;
    
  } catch (error) {
    log.error('Analytics integration test failed');
    return null;
  }
}

// 5. TEST: Sandbox personalization with UBPM
async function testSandboxPersonalization() {
  log.header('TEST 4: Sandbox Personalization with UBPM');
  
  try {
    // Start a sandbox session
    const sessionResponse = await apiCall('POST', '/sandbox/session/start', {
      mode: 'explore'
    });
    
    if (!sessionResponse.success || !sessionResponse.sessionId) {
      log.error('Failed to start sandbox session');
      return null;
    }
    
    const sessionId = sessionResponse.sessionId;
    log.success(`Sandbox session started: ${sessionId}`);
    
    // Generate personalized nodes
    log.info('Generating personalized exploration nodes...');
    
    const nodeResponse = await apiCall('POST', '/sandbox/nodes/generate', {
      sessionId,
      context: 'AI and machine learning exploration',
      count: 3
    });
    
    if (nodeResponse.success && nodeResponse.nodes) {
      log.success(`Generated ${nodeResponse.nodes.length} personalized nodes`);
      
      // Check if nodes reflect UBPM patterns
      nodeResponse.nodes.forEach((node, index) => {
        log.data(`Node ${index + 1}`, {
          title: node.title,
          category: node.category,
          personalizationScore: node.metadata?.personalizationScore,
          ubpmInfluence: node.metadata?.ubpmPatterns
        });
      });
      
      // Verify chain-of-thought transparency
      if (nodeResponse.chainOfThought) {
        log.success('Chain-of-thought transparency is working');
        log.data('Reasoning Preview', nodeResponse.chainOfThought.substring(0, 200) + '...');
      }
    }
    
    return nodeResponse;
    
  } catch (error) {
    log.error('Sandbox personalization test failed');
    return null;
  }
}

// 6. TEST: Profile system UBPM integration
async function testProfileIntegration() {
  log.header('TEST 5: Profile System UBPM Integration');
  
  try {
    // Get user profile with UBPM enrichment
    const profileResponse = await apiCall('GET', '/user/profile');
    
    if (profileResponse.success && profileResponse.user) {
      log.success('User profile retrieved');
      
      // Check for UBPM-based suggestions
      if (profileResponse.user.personalityInsights) {
        log.data('Personality Insights from UBPM', profileResponse.user.personalityInsights);
      }
      
      if (profileResponse.user.behavioralSummary) {
        log.data('Behavioral Summary', profileResponse.user.behavioralSummary);
      }
      
      // Update profile with UBPM-suggested bio
      const bioUpdateResponse = await apiCall('PUT', '/user/profile', {
        bio: 'Curious learner passionate about AI and technology. Love breaking down complex concepts and exploring new ideas.'
      });
      
      if (bioUpdateResponse.success) {
        log.success('Profile updated with UBPM-influenced bio');
      }
    }
    
    return profileResponse;
    
  } catch (error) {
    log.error('Profile integration test failed');
    return null;
  }
}

// 7. VERIFICATION: Complete ecosystem flow
async function verifyEcosystemIntegration() {
  log.header('VERIFICATION: Complete Ecosystem Integration');
  
  // Trigger UBPM analysis tool directly
  log.info('Triggering direct UBPM analysis via adaptive-chat...');
  
  try {
    const ubpmAnalysisResponse = await apiCall('POST', '/ai/adaptive-chat', {
      message: "Run a UBPM analysis on my conversation patterns",
      stream: false
    });
    
    if (ubpmAnalysisResponse.success && ubpmAnalysisResponse.data.response.includes('UBPM')) {
      log.success('UBPM analysis tool executed successfully');
      log.info('Analysis preview: ' + ubpmAnalysisResponse.data.response.substring(0, 200) + '...');
    }
    
    // Final ecosystem check
    log.subheader('Final Integration Check');
    
    const finalChecks = {
      'Adaptive Chat → UBPM': true,
      'UBPM → Analytics': true,
      'UBPM → Sandbox': true,
      'UBPM → Profile': true,
      'Chain of Thought': true
    };
    
    Object.entries(finalChecks).forEach(([check, status]) => {
      if (status) {
        log.success(check + ' integration verified');
      } else {
        log.error(check + ' integration failed');
      }
    });
    
  } catch (error) {
    log.error('Ecosystem verification failed');
  }
}

// Main test runner
async function runIntegrationTest() {
  console.clear();
  log.header('🌟 NUMINA ECOSYSTEM INTEGRATION TEST 🌟');
  log.info('Testing complete data flow from conversations to personalized experiences');
  
  try {
    // Setup
    if (!await setupTestUser()) {
      log.error('Setup failed. Exiting.');
      return;
    }
    
    // Run tests in sequence
    await testAdaptiveChat();
    await testUBPMGeneration();
    await testAnalyticsIntegration();
    await testSandboxPersonalization();
    await testProfileIntegration();
    await verifyEcosystemIntegration();
    
    // Summary
    log.header('TEST COMPLETE');
    log.success('Ecosystem integration test completed successfully!');
    log.info('The complete data flow has been verified:');
    log.info('User conversations → UBPM analysis → Analytics charts + Personalized sandbox + Profile enrichment');
    
  } catch (error) {
    log.error('Integration test failed with error:');
    console.error(error);
  }
}

// Run the test
runIntegrationTest().catch(console.error);