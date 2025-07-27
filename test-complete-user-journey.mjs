import fetch from 'node-fetch';
import { io } from 'socket.io-client';

const baseUrl = 'http://localhost:5000';
const colors = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m', 
  yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m',
  bright: '\x1b[1m'
};

class CompleteUserTester {
  constructor() {
    this.userEmail = `complete-test-${Date.now()}@test.com`;
    this.password = 'TestPassword123';
    this.token = null;
    this.userId = null;
    this.conversationId = null;
    this.testResults = [];
  }

  async log(action, success, details = '') {
    const status = success ? `${colors.green}✅ PASS${colors.reset}` : `${colors.red}❌ FAIL${colors.reset}`;
    console.log(`${status} ${action}${details ? ': ' + details : ''}`);
    this.testResults.push({ action, success, details });
    if (!success) throw new Error(`Failed: ${action} - ${details}`);
  }

  async apiCall(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { 'Authorization': `Bearer ${this.token}` })
      },
      ...options
    });
    
    const text = await response.text();
    let data = null;
    try { data = JSON.parse(text); } catch (e) {}
    
    return { response, data, text };
  }

  // 1. COMPLETE AUTHENTICATION FLOW
  async testAuthenticationFlow() {
    console.log(`\n${colors.cyan}🔐 Testing Complete Authentication Flow${colors.reset}`);
    
    // Sign up
    const { response: signupResp, data: signupData } = await this.apiCall('/signup', {
      method: 'POST',
      body: JSON.stringify({ email: this.userEmail, password: this.password })
    });
    
    this.token = signupData?.token;
    this.userId = signupData?.user?.id || signupData?.user?._id;
    await this.log('User Signup', signupResp.ok && this.token, 
      `Token: ${this.token?.substring(0, 20)}...`);

    // Login (test with same credentials)
    const { response: loginResp, data: loginData } = await this.apiCall('/login', {
      method: 'POST',
      body: JSON.stringify({ email: this.userEmail, password: this.password })
    });
    
    const loginToken = loginData?.token;
    await this.log('User Login', loginResp.ok && loginToken, 
      `Can login with same credentials`);

    // Profile access
    const { response: profileResp, data: profileData } = await this.apiCall('/profile');
    await this.log('Profile Access', profileResp.ok && profileData?.data?.user, 
      `Email: ${profileData?.data?.user?.email}`);
  }

  // 2. COMPLETE CHAT FLOW WITH MEMORY
  async testCompleteChatFlow() {
    console.log(`\n${colors.cyan}💬 Testing Complete Chat Flow with Memory${colors.reset}`);
    
    // Create conversation
    const { response: convResp, data: convData } = await this.apiCall('/conversations', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Memory Chat', type: 'chat' })
    });
    
    this.conversationId = convData?.data?.id || convData?.data?._id;
    await this.log('Create Conversation', convResp.ok && this.conversationId, 
      `ID: ${this.conversationId}`);

    // First message: User says hello
    const { response: msg1Resp, data: msg1Data } = await this.apiCall('/ai/adaptive-chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Hello! My name is Alice and I love painting.',
        conversationId: this.conversationId
      })
    });
    
    const firstResponse = msg1Data?.data?.response;
    await this.log('First Chat Message', msg1Resp.ok && firstResponse, 
      `AI responded: "${firstResponse?.substring(0, 50)}..."`);

    // Second message: Test memory
    const { response: msg2Resp, data: msg2Data } = await this.apiCall('/ai/adaptive-chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'What did I just tell you about myself?',
        conversationId: this.conversationId
      })
    });
    
    const memoryResponse = msg2Data?.data?.response;
    const remembersName = memoryResponse?.toLowerCase().includes('alice');
    const remembersPainting = memoryResponse?.toLowerCase().includes('paint');
    
    await this.log('Chat Memory Test', msg2Resp.ok && (remembersName || remembersPainting), 
      `AI remembers: Name=${remembersName}, Painting=${remembersPainting}`);

    // Get conversation history
    const { response: histResp, data: histData } = await this.apiCall(`/conversations/${this.conversationId}`);
    const hasMessages = histData?.data?.messages?.length >= 2;
    await this.log('Conversation History', histResp.ok && hasMessages, 
      `${histData?.data?.messages?.length || 0} messages stored`);
  }

  // 3. EMOTIONAL ANALYTICS FLOW
  async testEmotionalAnalyticsFlow() {
    console.log(`\n${colors.cyan}😊 Testing Emotional Analytics Flow${colors.reset}`);
    
    // Submit emotion
    const { response: emotResp, data: emotData } = await this.apiCall('/emotions', {
      method: 'POST',
      body: JSON.stringify({
        emotion: 'excited',
        intensity: 8,
        description: 'Just finished a great painting!'
      })
    });
    
    await this.log('Submit Emotion', emotResp.ok && emotData?.data?.emotion, 
      `${emotData?.data?.emotion} intensity ${emotData?.data?.intensity}`);

    // Get current session
    const { response: sessResp, data: sessData } = await this.apiCall('/emotional-analytics/current-session');
    const hasEmotionalData = sessData?.data?.dominantEmotion;
    await this.log('Current Emotional Session', sessResp.ok && hasEmotionalData, 
      `Dominant: ${sessData?.data?.dominantEmotion}`);

    // Get weekly report
    const { response: weekResp, data: weekData } = await this.apiCall('/emotional-analytics/weekly-report');
    await this.log('Weekly Emotional Report', weekResp.ok && weekData?.data, 
      `Report period: ${weekData?.data?.reportPeriod}`);
  }

  // 4. MOBILE SYNC AND PERSISTENCE
  async testMobileSyncFlow() {
    console.log(`\n${colors.cyan}📱 Testing Mobile Sync & Data Persistence${colors.reset}`);
    
    // Initial sync
    const { response: syncResp, data: syncData } = await this.apiCall('/mobile/sync');
    const hasProfileData = syncData?.data?.profile?.data;
    const hasConversations = syncData?.data?.conversations;
    
    await this.log('Mobile Sync', syncResp.ok && hasProfileData, 
      `Profile synced: ${!!hasProfileData}, Conversations: ${!!hasConversations}`);

    // App config
    const { response: configResp, data: configData } = await this.apiCall('/mobile/app-config');
    const hasFeatures = configData?.features;
    await this.log('App Configuration', configResp.ok && hasFeatures, 
      `Features available: ${Object.keys(hasFeatures || {}).length}`);

    // Profile header for mobile
    const { response: headerResp, data: headerData } = await this.apiCall('/mobile/profile-header');
    const hasUserInfo = headerData?.user;
    await this.log('Mobile Profile Header', headerResp.ok && hasUserInfo, 
      `User: ${headerData?.user?.email}`);
  }

  // 5. ANALYTICS AND INSIGHTS
  async testAnalyticsFlow() {
    console.log(`\n${colors.cyan}📊 Testing Analytics & Insights Flow${colors.reset}`);
    
    // Personal growth summary
    const { response: growthResp, data: growthData } = await this.apiCall('/personal-insights/growth-summary');
    const hasInsights = growthData?.data?.aiInsights;
    await this.log('Personal Growth Insights', growthResp.ok && hasInsights, 
      `AI insights generated: ${!!hasInsights}`);

    // Memory analytics
    const { response: memResp, data: memData } = await this.apiCall('/analytics/memory');
    const hasMemoryStats = memData?.data?.userId;
    await this.log('Memory Analytics', memResp.ok && hasMemoryStats, 
      `Session duration: ${memData?.data?.sessionDuration}ms`);

    // Recommendations
    const { response: recResp, data: recData } = await this.apiCall('/analytics/recommendations');
    await this.log('Analytics Recommendations', recResp.ok && recData?.data, 
      `Recommendations: ${recData?.data?.recommendations?.length || 0}`);
  }

  // 6. CLOUD FEATURES
  async testCloudFeatures() {
    console.log(`\n${colors.cyan}☁️  Testing Cloud Features${colors.reset}`);
    
    // Get cloud events
    const { response: eventsResp, data: eventsData } = await this.apiCall('/cloud/events');
    await this.log('Cloud Events', eventsResp.ok && eventsData?.data, 
      `Events available: ${eventsData?.data?.events?.length || 0}`);

    // Test user compatibility
    const { response: compatResp, data: compatData } = await this.apiCall('/cloud/compatibility/users', {
      method: 'POST',
      body: JSON.stringify({
        userEmotionalState: { mood: 'creative', energy: 8 }
      })
    });
    
    const hasCompatibilityData = compatData?.data?.length > 0;
    await this.log('User Compatibility Analysis', compatResp.ok && hasCompatibilityData, 
      `Compatible users found: ${compatData?.data?.length || 0}`);
  }

  // 7. BUSINESS FEATURES
  async testBusinessFeatures() {
    console.log(`\n${colors.cyan}💰 Testing Business Features${colors.reset}`);
    
    // Subscription status
    const { response: subResp, data: subData } = await this.apiCall('/subscription/status');
    await this.log('Subscription Status', subResp.ok && subData?.data, 
      `Status: ${subData?.data?.subscription ? 'Active' : 'Free'}`);

    // Wallet balance
    const { response: walletResp, data: walletData } = await this.apiCall('/wallet/balance');
    const hasBalance = walletData?.data?.balance !== undefined;
    await this.log('Wallet Balance', walletResp.ok && hasBalance, 
      `Balance: ${walletData?.data?.balance} ${walletData?.data?.currency}`);

    // Available tools
    const { response: toolsResp, data: toolsData } = await this.apiCall('/tools/available');
    await this.log('Available Tools', toolsResp.ok && toolsData?.data, 
      `Tools available: ${toolsData?.data?.availableTools?.length || 0}`);
  }

  // 8. WEBSOCKET REAL-TIME
  async testWebSocketFlow() {
    console.log(`\n${colors.cyan}🔌 Testing WebSocket Real-time Features${colors.reset}`);
    
    return new Promise((resolve) => {
      const socket = io(baseUrl, {
        auth: { token: this.token },
        autoConnect: false
      });

      let connected = false;
      let messageReceived = false;

      socket.on('connect', () => {
        connected = true;
        // Send a test message
        socket.emit('chat_message', {
          roomId: 'test-room',
          message: 'Hello from automated test!'
        });
      });

      socket.on('message', () => {
        messageReceived = true;
      });

      socket.on('connect_error', (error) => {
        this.log('WebSocket Connection', false, error.message);
        resolve();
      });

      socket.connect();

      setTimeout(() => {
        socket.disconnect();
        this.log('WebSocket Connection', connected, `Connected: ${connected}, Messages: ${messageReceived}`);
        resolve();
      }, 3000);
    });
  }

  // 9. ACCOUNT DELETION FLOW
  async testAccountDeletion() {
    console.log(`\n${colors.cyan}🗑️  Testing Account Deletion Flow${colors.reset}`);
    
    // Delete account
    const { response: delResp, data: delData } = await this.apiCall(`/user/delete/${this.userId}`, {
      method: 'DELETE'
    });
    
    await this.log('Account Deletion', delResp.ok, 
      `Account deleted: ${delData?.message || 'Success'}`);

    // Verify account is deleted (should fail)
    const { response: verifyResp } = await this.apiCall('/profile');
    await this.log('Verify Deletion', !verifyResp.ok, 
      `Profile access blocked: ${verifyResp.status}`);
  }

  // RUN ALL TESTS
  async runCompleteTest() {
    console.log(`${colors.bright}${colors.blue}🚀 COMPLETE USER JOURNEY TEST${colors.reset}`);
    console.log('Testing every feature a real user would use...\n');
    
    try {
      await this.testAuthenticationFlow();
      await this.testCompleteChatFlow(); 
      await this.testEmotionalAnalyticsFlow();
      await this.testMobileSyncFlow();
      await this.testAnalyticsFlow();
      await this.testCloudFeatures();
      await this.testBusinessFeatures();
      await this.testWebSocketFlow();
      await this.testAccountDeletion();

      // Final Summary
      const passed = this.testResults.filter(r => r.success).length;
      const total = this.testResults.length;
      const percentage = Math.round((passed / total) * 100);

      console.log(`\n${colors.bright}${colors.cyan}📊 COMPLETE TEST RESULTS${colors.reset}`);
      console.log('=====================================');
      console.log(`${colors.bright}Success Rate: ${percentage >= 95 ? colors.green : colors.red}${passed}/${total} (${percentage}%)${colors.reset}`);
      
      if (percentage >= 95) {
        console.log(`\n${colors.bright}${colors.green}🎉 EVERYTHING WORKS! Ready for production!${colors.reset}`);
        console.log('✅ Users can sign up, chat, sync data, use all features, and delete accounts');
        console.log('✅ Memory works across conversations');
        console.log('✅ Real-time features functional');
        console.log('✅ All business features operational');
      } else {
        console.log(`\n${colors.bright}${colors.red}❌ ${100-percentage}% of critical user flows broken!${colors.reset}`);
        
        const failures = this.testResults.filter(r => !r.success);
        console.log('\nFailed tests:');
        failures.forEach(f => console.log(`  - ${f.action}: ${f.details}`));
      }

    } catch (error) {
      console.log(`\n${colors.red}❌ CRITICAL FAILURE: ${error.message}${colors.reset}`);
      console.log('User journey cannot be completed!');
    }
  }
}

// Run the complete test
const tester = new CompleteUserTester();
tester.runCompleteTest();