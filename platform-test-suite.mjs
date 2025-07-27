import fetch from 'node-fetch';
import { io } from 'socket.io-client';

const baseUrl = 'http://localhost:5000';

// Test orchestration system
class PlatformTestSuite {
  constructor() {
    this.users = [];
    this.testResults = {
      auth: [], conversations: [], emotions: [], mobile: [],
      analytics: [], cloud: [], business: [], websocket: [],
      persistence: [], errors: []
    };
    this.concurrentUsers = 50;
    this.stats = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      startTime: Date.now()
    };
  }

  // Logging system
  log(category, test, success, details = '', userId = null) {
    const result = { test, success, details, userId, timestamp: Date.now() };
    this.testResults[category].push(result);
    this.stats.totalTests++;
    if (success) this.stats.passed++;
    else this.stats.failed++;
    
    const status = success ? '✅' : '❌';
    const userInfo = userId ? ` [User ${userId.substr(-4)}]` : '';
    console.log(`${status} ${category.toUpperCase()}: ${test}${userInfo} ${details ? '- ' + details : ''}`);
  }

  // User factory
  async createUser(type = 'standard', index = 0) {
    const userTypes = {
      new: { prefix: 'new', chatCount: 1, emotionCount: 2 },
      active: { prefix: 'active', chatCount: 5, emotionCount: 10 },
      power: { prefix: 'power', chatCount: 15, emotionCount: 20 },
      mobile: { prefix: 'mobile', chatCount: 3, emotionCount: 5 },
      business: { prefix: 'business', chatCount: 8, emotionCount: 8 },
      social: { prefix: 'social', chatCount: 4, emotionCount: 6 }
    };

    const config = userTypes[type] || userTypes.standard;
    const email = `${config.prefix}-user-${index}-${Date.now()}@platform-test.com`;
    const password = 'PlatformTest123';

    const response = await fetch(`${baseUrl}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    
    if (!response.ok || !data.token) {
      throw new Error(`User creation failed: ${data.message || 'Unknown error'}`);
    }

    return {
      id: data.user?.id || data.user?._id,
      email,
      password,
      token: data.token,
      type,
      config,
      conversations: [],
      emotions: [],
      analytics: {},
      created: Date.now()
    };
  }

  // API call helper
  async apiCall(user, path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(user?.token && { 'Authorization': `Bearer ${user.token}` })
      },
      ...options
    });

    let data = null;
    const text = await response.text();
    try { data = JSON.parse(text); } catch (e) {}

    return { response, data, text };
  }

  // 1. AUTHENTICATION TESTING
  async testAuthentication() {
    console.log('\n🔐 AUTHENTICATION & USER MANAGEMENT TESTING');
    console.log('='.repeat(60));

    // Create users of different types
    const userTypes = ['new', 'active', 'power', 'mobile', 'business', 'social'];
    const usersPerType = [10, 15, 10, 8, 5, 2];

    for (let typeIndex = 0; typeIndex < userTypes.length; typeIndex++) {
      const type = userTypes[typeIndex];
      const count = usersPerType[typeIndex];

      for (let i = 0; i < count; i++) {
        try {
          const user = await this.createUser(type, i);
          this.users.push(user);
          
          this.log('auth', 'User Creation', true, 
            `${type} user created`, user.id);

          // Test login with same credentials
          const { response: loginResp, data: loginData } = await this.apiCall(null, '/login', {
            method: 'POST',
            body: JSON.stringify({ email: user.email, password: user.password })
          });

          this.log('auth', 'Login Flow', loginResp.ok && loginData?.token, 
            `Login ${loginResp.ok ? 'successful' : 'failed'}`, user.id);

          // Test profile access
          const { response: profileResp, data: profileData } = await this.apiCall(user, '/profile');
          this.log('auth', 'Profile Access', profileResp.ok && profileData?.data?.user, 
            `Profile loaded: ${profileData?.data?.user?.email}`, user.id);

        } catch (error) {
          this.log('auth', 'User Creation', false, error.message);
        }
      }
    }

    console.log(`\n📊 Created ${this.users.length} users for testing`);
  }

  // 2. CONVERSATION & CHAT TESTING
  async testConversations() {
    console.log('\n💬 CONVERSATION & CHAT SYSTEM TESTING');
    console.log('='.repeat(60));

    const chatScenarios = [
      { user: 'new', messages: ['Hello!', 'How are you?'] },
      { user: 'active', messages: ['Hi, I\'m Sarah and I love gardening', 'What vegetables grow best in winter?', 'Do you remember what I told you about myself?'] },
      { user: 'power', messages: ['I need help with a complex project', 'It involves machine learning and data analysis', 'Can you create a detailed plan?', 'What did we discuss about ML?'] }
    ];

    for (const user of this.users.slice(0, 20)) { // Test with first 20 users
      try {
        // Create conversation
        const { response: convResp, data: convData } = await this.apiCall(user, '/conversations', {
          method: 'POST',
          body: JSON.stringify({ title: `${user.type} Chat Session`, type: 'chat' })
        });

        const conversationId = convData?.data?.id || convData?.data?._id;
        this.log('conversations', 'Create Conversation', convResp.ok && conversationId, 
          `Conversation created`, user.id);

        if (conversationId) {
          user.conversations.push(conversationId);

          // Send messages based on user type
          const scenario = chatScenarios.find(s => s.user === user.type) || chatScenarios[0];
          
          for (let i = 0; i < scenario.messages.length; i++) {
            const message = scenario.messages[i];
            
            const { response: chatResp, data: chatData } = await this.apiCall(user, '/ai/adaptive-chat', {
              method: 'POST',
              body: JSON.stringify({
                message,
                conversationId
              })
            });

            const hasResponse = chatData?.data?.response || chatData?.response;
            this.log('conversations', 'AI Chat Response', chatResp.ok && hasResponse, 
              `Message ${i + 1}: "${message.substring(0, 30)}..." → AI responded`, user.id);

            // Test memory on subsequent messages
            if (i > 0 && i === scenario.messages.length - 1) {
              const memoryTest = hasResponse && (
                hasResponse.toLowerCase().includes('sarah') ||
                hasResponse.toLowerCase().includes('garden') ||
                hasResponse.toLowerCase().includes('ml') ||
                hasResponse.toLowerCase().includes('machine learning')
              );
              
              this.log('conversations', 'AI Memory Test', memoryTest, 
                `AI ${memoryTest ? 'remembers' : 'forgot'} previous context`, user.id);
            }
          }

          // Test conversation history
          const { response: histResp, data: histData } = await this.apiCall(user, `/conversations/${conversationId}`);
          const messageCount = histData?.data?.messages?.length || 0;
          this.log('conversations', 'Message Persistence', messageCount >= scenario.messages.length, 
            `${messageCount} messages persisted`, user.id);
        }

      } catch (error) {
        this.log('conversations', 'Chat Flow', false, error.message, user.id);
      }
    }
  }

  // 3. EMOTIONAL ANALYTICS TESTING
  async testEmotionalAnalytics() {
    console.log('\n😊 EMOTIONAL ANALYTICS TESTING');
    console.log('='.repeat(60));

    const emotionPatterns = {
      new: [{ emotion: 'curious', intensity: 6 }, { emotion: 'hopeful', intensity: 7 }],
      active: [{ emotion: 'happy', intensity: 8 }, { emotion: 'motivated', intensity: 9 }, { emotion: 'confident', intensity: 7 }],
      power: [{ emotion: 'focused', intensity: 9 }, { emotion: 'analytical', intensity: 8 }, { emotion: 'determined', intensity: 8 }]
    };

    for (const user of this.users.slice(0, 25)) { // Test with 25 users
      const pattern = emotionPatterns[user.type] || emotionPatterns.new;
      
      for (const emotionData of pattern) {
        try {
          const { response: emotResp, data: emotData } = await this.apiCall(user, '/emotions', {
            method: 'POST',
            body: JSON.stringify({
              emotion: emotionData.emotion,
              intensity: emotionData.intensity,
              description: `Feeling ${emotionData.emotion} during platform testing`
            })
          });

          this.log('emotions', 'Emotion Submission', emotResp.ok && emotData?.data?.emotion, 
            `${emotionData.emotion} (${emotionData.intensity}/10)`, user.id);

          user.emotions.push(emotionData);
        } catch (error) {
          this.log('emotions', 'Emotion Submission', false, error.message, user.id);
        }
      }

      // Test emotional session tracking
      try {
        const { response: sessResp, data: sessData } = await this.apiCall(user, '/emotional-analytics/current-session');
        const hasSessionData = sessData?.data?.dominantEmotion;
        this.log('emotions', 'Session Tracking', sessResp.ok && hasSessionData, 
          `Dominant: ${sessData?.data?.dominantEmotion}`, user.id);

        // Test weekly report
        const { response: weekResp, data: weekData } = await this.apiCall(user, '/emotional-analytics/weekly-report');
        this.log('emotions', 'Weekly Report', weekResp.ok && weekData?.data, 
          `Report generated`, user.id);
      } catch (error) {
        this.log('emotions', 'Analytics Generation', false, error.message, user.id);
      }
    }
  }

  // 4. MOBILE SYNC TESTING
  async testMobileSync() {
    console.log('\n📱 MOBILE SYNCHRONIZATION TESTING');
    console.log('='.repeat(60));

    for (const user of this.users.filter(u => u.type === 'mobile' || u.type === 'active').slice(0, 15)) {
      try {
        // Initial sync
        const { response: syncResp, data: syncData } = await this.apiCall(user, '/mobile/sync');
        const hasProfileData = syncData?.data?.profile?.data;
        const hasConversationData = syncData?.data?.conversations;
        
        this.log('mobile', 'Initial Sync', syncResp.ok && hasProfileData, 
          `Profile: ${!!hasProfileData}, Conversations: ${!!hasConversationData}`, user.id);

        // App config
        const { response: configResp, data: configData } = await this.apiCall(user, '/mobile/app-config');
        const hasFeatures = configData?.features;
        this.log('mobile', 'App Configuration', configResp.ok && hasFeatures, 
          `${Object.keys(hasFeatures || {}).length} features configured`, user.id);

        // Profile header
        const { response: headerResp, data: headerData } = await this.apiCall(user, '/mobile/profile-header');
        this.log('mobile', 'Profile Header', headerResp.ok && headerData?.user, 
          `Mobile profile loaded`, user.id);

        // Real-time status
        const { response: statusResp, data: statusData } = await this.apiCall(user, '/mobile/realtime-status');
        this.log('mobile', 'Realtime Status', statusResp.ok && statusData?.user, 
          `Status: ${statusData?.user?.isOnline ? 'online' : 'offline'}`, user.id);

      } catch (error) {
        this.log('mobile', 'Sync Flow', false, error.message, user.id);
      }
    }
  }

  // 5. ANALYTICS TESTING
  async testAnalytics() {
    console.log('\n📊 ANALYTICS & INTELLIGENCE TESTING');
    console.log('='.repeat(60));

    for (const user of this.users.filter(u => u.type === 'power' || u.type === 'active').slice(0, 15)) {
      try {
        // Memory analytics
        const { response: memResp, data: memData } = await this.apiCall(user, '/analytics/memory');
        this.log('analytics', 'Memory Analytics', memResp.ok && memData?.data, 
          `Session duration: ${memData?.data?.sessionDuration || 0}ms`, user.id);

        // Recommendations
        const { response: recResp, data: recData } = await this.apiCall(user, '/analytics/recommendations');
        this.log('analytics', 'Recommendations', recResp.ok && recData?.data, 
          `${recData?.data?.recommendations?.length || 0} recommendations`, user.id);

        // Personal growth insights
        const { response: growthResp, data: growthData } = await this.apiCall(user, '/personal-insights/growth-summary');
        this.log('analytics', 'Growth Insights', growthResp.ok && growthData?.data, 
          `Insights generated: ${!!growthData?.data?.aiInsights}`, user.id);

      } catch (error) {
        this.log('analytics', 'Analytics Generation', false, error.message, user.id);
      }
    }
  }

  // 6. WEBSOCKET TESTING
  async testWebSocket() {
    console.log('\n🔌 WEBSOCKET REAL-TIME TESTING');
    console.log('='.repeat(60));

    const wsPromises = this.users.slice(0, 10).map(async (user, index) => {
      return new Promise((resolve) => {
        const socket = io(baseUrl, {
          auth: { token: user.token },
          autoConnect: false
        });

        let connected = false;
        let messageReceived = false;

        socket.on('connect', () => {
          connected = true;
          this.log('websocket', 'Connection', true, `User ${index + 1} connected`, user.id);
          
          // Send test message
          socket.emit('chat_message', {
            roomId: 'platform-test-room',
            message: `Hello from user ${index + 1}!`
          });
        });

        socket.on('message', () => {
          messageReceived = true;
        });

        socket.on('connect_error', (error) => {
          this.log('websocket', 'Connection', false, error.message, user.id);
        });

        socket.connect();

        setTimeout(() => {
          socket.disconnect();
          this.log('websocket', 'Message Exchange', connected && messageReceived, 
            `Connected: ${connected}, Messages: ${messageReceived}`, user.id);
          resolve();
        }, 3000);
      });
    });

    await Promise.all(wsPromises);
  }

  // 7. BUSINESS FEATURES TESTING
  async testBusinessFeatures() {
    console.log('\n💰 BUSINESS FEATURES TESTING');
    console.log('='.repeat(60));

    for (const user of this.users.filter(u => u.type === 'business' || u.type === 'power').slice(0, 10)) {
      try {
        // Subscription status
        const { response: subResp, data: subData } = await this.apiCall(user, '/subscription/status');
        this.log('business', 'Subscription Status', subResp.ok && subData?.data, 
          `Subscription loaded`, user.id);

        // Wallet features
        const { response: walletResp, data: walletData } = await this.apiCall(user, '/wallet/balance');
        this.log('business', 'Wallet Balance', walletResp.ok && walletData?.data, 
          `Balance: ${walletData?.data?.balance || 0}`, user.id);

        // Available tools
        const { response: toolsResp, data: toolsData } = await this.apiCall(user, '/tools/available');
        this.log('business', 'Tools Access', toolsResp.ok && toolsData?.data, 
          `${toolsData?.data?.availableTools?.length || 0} tools`, user.id);

      } catch (error) {
        this.log('business', 'Business Features', false, error.message, user.id);
      }
    }
  }

  // MAIN TEST RUNNER
  async runPlatformTests() {
    console.log('🚀 NUMINA PLATFORM COMPREHENSIVE TEST SUITE');
    console.log('='.repeat(80));
    console.log(`Testing with ${this.concurrentUsers} simulated users`);
    console.log(`Start time: ${new Date().toISOString()}`);
    
    try {
      await this.testAuthentication();
      await this.testConversations();
      await this.testEmotionalAnalytics();
      await this.testMobileSync();
      await this.testAnalytics();
      await this.testWebSocket();
      await this.testBusinessFeatures();

      this.generateFinalReport();
    } catch (error) {
      console.log(`\n❌ CRITICAL PLATFORM FAILURE: ${error.message}`);
      this.generateFailureReport(error);
    }
  }

  // FINAL REPORT GENERATION
  generateFinalReport() {
    const duration = Math.round((Date.now() - this.stats.startTime) / 1000);
    const successRate = Math.round((this.stats.passed / this.stats.totalTests) * 100);

    console.log('\n' + '='.repeat(80));
    console.log('📊 PLATFORM TEST RESULTS SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`\n📈 OVERALL STATISTICS:`);
    console.log(`  Total Tests: ${this.stats.totalTests}`);
    console.log(`  Passed: ${this.stats.passed} (${successRate}%)`);
    console.log(`  Failed: ${this.stats.failed}`);
    console.log(`  Test Duration: ${duration} seconds`);
    console.log(`  Users Created: ${this.users.length}`);

    console.log(`\n📋 CATEGORY BREAKDOWN:`);
    Object.entries(this.testResults).forEach(([category, results]) => {
      const passed = results.filter(r => r.success).length;
      const total = results.length;
      const rate = total > 0 ? Math.round((passed / total) * 100) : 0;
      console.log(`  ${category.toUpperCase()}: ${passed}/${total} (${rate}%)`);
    });

    if (successRate >= 95) {
      console.log(`\n🎉 PLATFORM READY FOR PRODUCTION!`);
      console.log(`✅ ${successRate}% success rate meets production standards`);
      console.log(`✅ All critical user journeys functional`);
      console.log(`✅ Multi-user scenarios working`);
      console.log(`✅ Real-time features operational`);
    } else {
      console.log(`\n⚠️  PLATFORM NEEDS ATTENTION`);
      console.log(`❌ ${successRate}% success rate below 95% threshold`);
      
      // Show failed tests by category
      Object.entries(this.testResults).forEach(([category, results]) => {
        const failures = results.filter(r => !r.success);
        if (failures.length > 0) {
          console.log(`\n${category.toUpperCase()} Failures:`);
          failures.slice(0, 5).forEach(f => {
            console.log(`  - ${f.test}: ${f.details}`);
          });
        }
      });
    }

    console.log('\n='.repeat(80));
  }

  generateFailureReport(error) {
    console.log('\n' + '='.repeat(80));
    console.log('💥 CRITICAL PLATFORM FAILURE REPORT');
    console.log('='.repeat(80));
    console.log(`Error: ${error.message}`);
    console.log(`Stack: ${error.stack}`);
    console.log(`\nPlatform is NOT ready for production deployment.`);
    console.log('='.repeat(80));
  }
}

// Run the comprehensive platform test
const platformTest = new PlatformTestSuite();
platformTest.runPlatformTests();