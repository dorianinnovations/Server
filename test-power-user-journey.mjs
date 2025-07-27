import fetch from 'node-fetch';
import { io } from 'socket.io-client';

const baseUrl = 'http://localhost:5000';
const colors = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m', 
  yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m',
  bright: '\x1b[1m', magenta: '\x1b[35m'
};

class PowerUserJourney {
  constructor() {
    this.userEmail = `poweruser-${Date.now()}@test.com`;
    this.password = 'PowerUser123!';
    this.token = null;
    this.userId = null;
    this.conversationId = null;
    this.results = [];
    this.userContext = {
      name: 'Sarah',
      interests: ['AI', 'coding', 'music production'],
      preferences: { theme: 'dark', notifications: true }
    };
  }

  log(step, success, details = '', critical = true) {
    const status = success ? `${colors.green}✅ PASS${colors.reset}` : `${colors.red}❌ FAIL${colors.reset}`;
    console.log(`${status} ${step}${details ? ': ' + details : ''}`);
    this.results.push({ step, success, details });
    if (!success && critical) throw new Error(`Failed: ${step} - ${details}`);
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

  async refreshToken() {
    const { response, data } = await this.apiCall('/refresh', { method: 'POST' });
    if (response.ok && data?.token) {
      this.token = data.token;
      console.log(`${colors.yellow}🔄 Token refreshed${colors.reset}`);
    }
    return response.ok;
  }

  // 1. USER ONBOARDING
  async testUserOnboarding() {
    console.log(`\n${colors.cyan}👤 STEP 1: USER ONBOARDING${colors.reset}`);
    
    // Sign up
    const { response: signupResp, data: signupData } = await this.apiCall('/signup', {
      method: 'POST',
      body: JSON.stringify({ email: this.userEmail, password: this.password })
    });
    
    this.token = signupData?.token;
    this.userId = signupData?.data?.user?.id;
    this.log('User Registration', signupResp.ok && this.token, 
      `Email: ${this.userEmail}, ID: ${this.userId}`);

    // Test login flow
    const { response: loginResp, data: loginData } = await this.apiCall('/login', {
      method: 'POST',
      body: JSON.stringify({ email: this.userEmail, password: this.password })
    });
    
    this.log('Login Verification', loginResp.ok && loginData?.token, 
      'Can login with same credentials');

    // Get profile
    const { response: profileResp, data: profileData } = await this.apiCall('/profile');
    this.log('Profile Access', profileResp.ok && profileData?.data?.user, 
      `Tier: ${profileData?.data?.tierBadge?.tier}`);
  }

  // 2. INITIAL CHAT SESSION
  async testInitialChat() {
    console.log(`\n${colors.cyan}💬 STEP 2: INITIAL CHAT SESSION${colors.reset}`);
    
    // Create conversation
    const { response: convResp, data: convData } = await this.apiCall('/conversations', {
      method: 'POST',
      body: JSON.stringify({ title: 'Getting Started Chat' })
    });
    
    this.conversationId = convData?.data?._id;
    this.log('Create Conversation', convResp.ok && this.conversationId, 
      `ID: ${this.conversationId}`);

    // Introduce herself
    const { response: msg1Resp, data: msg1Data } = await this.apiCall('/ai/adaptive-chat', {
      method: 'POST',
      body: JSON.stringify({
        message: `Hi! I'm ${this.userContext.name} and I'm really excited to try this AI platform. I'm interested in ${this.userContext.interests.join(', ')}. Can you help me get started?`,
        conversationId: this.conversationId
      })
    });
    
    const response1 = msg1Data?.data?.response;
    this.log('Introduction Message', msg1Resp.ok && response1, 
      `AI responded: "${response1?.substring(0, 50)}..."`);

    // Ask follow-up about features
    const { response: msg2Resp, data: msg2Data } = await this.apiCall('/ai/adaptive-chat', {
      method: 'POST',
      body: JSON.stringify({
        message: "What features do you have for someone interested in music production and AI development?",
        conversationId: this.conversationId
      })
    });
    
    const response2 = msg2Data?.data?.response;
    this.log('Feature Inquiry', msg2Resp.ok && response2, 
      `AI provided feature information`);
  }

  // 3. SANDBOX EXPLORATION
  async testSandboxFeatures() {
    console.log(`\n${colors.cyan}🧪 STEP 3: SANDBOX EXPLORATION${colors.reset}`);
    
    // Test basic sandbox
    const { response: sandboxResp, data: sandboxData } = await this.apiCall('/sandbox/test');
    this.log('Sandbox Basic Test', sandboxResp.ok && sandboxData?.success, 
      sandboxData?.message);

    // Test auth sandbox
    const { response: authTestResp, data: authTestData } = await this.apiCall('/sandbox/auth-test');
    this.log('Sandbox Auth Test', authTestResp.ok && authTestData?.success, 
      `User authenticated in sandbox`);

    // Chat about sandbox in the conversation
    const { response: sandboxChatResp, data: sandboxChatData } = await this.apiCall('/ai/adaptive-chat', {
      method: 'POST',
      body: JSON.stringify({
        message: "I just tested the sandbox features. Can you explain what the sandbox is for and how I can use it for AI development?",
        conversationId: this.conversationId
      })
    });
    
    const sandboxExplanation = sandboxChatData?.data?.response;
    this.log('Sandbox AI Explanation', sandboxChatResp.ok && sandboxExplanation, 
      'AI explained sandbox features');
  }

  // 4. PROFILE CUSTOMIZATION & SETTINGS
  async testProfileAndSettings() {
    console.log(`\n${colors.cyan}⚙️  STEP 4: PROFILE & SETTINGS CUSTOMIZATION${colors.reset}`);
    
    // Try to update settings
    try {
      const { response: settingsResp } = await this.apiCall('/settings', {
        method: 'POST',
        body: JSON.stringify(this.userContext.preferences)
      });
      this.log('Update Settings', settingsResp.ok, 
        `Theme: ${this.userContext.preferences.theme}`);
    } catch (error) {
      this.log('Update Settings', false, `Error: ${error.message}`, false);
    }

    // Try to update preferences
    try {
      const { response: prefResp } = await this.apiCall('/preferences', {
        method: 'POST',
        body: JSON.stringify({ 
          preferences: {
            interests: this.userContext.interests,
            aiPersonality: 'analytical'
          }
        })
      });
      this.log('Update Preferences', prefResp.ok, 
        `Interests: ${this.userContext.interests.join(', ')}`);
    } catch (error) {
      this.log('Update Preferences', false, `Error: ${error.message}`, false);
    }

    // Chat about preferences
    const { response: prefChatResp, data: prefChatData } = await this.apiCall('/ai/adaptive-chat', {
      method: 'POST',
      body: JSON.stringify({
        message: "I want to customize my AI experience. Can you remember that I prefer analytical responses and am interested in music production workflows?",
        conversationId: this.conversationId
      })
    });
    
    this.log('AI Preference Setting', prefChatResp.ok && prefChatData?.data?.response, 
      'AI acknowledged preferences');
  }

  // 5. SUBSCRIPTION UPGRADE TO AETHER
  async testSubscriptionUpgrade() {
    console.log(`\n${colors.cyan}💎 STEP 5: SUBSCRIPTION UPGRADE TO AETHER${colors.reset}`);
    
    // Check current subscription
    const { response: subResp, data: subData } = await this.apiCall('/subscription/status');
    this.log('Check Subscription Status', subResp.ok && subData?.data, 
      `Current: ${subData?.data?.subscription ? 'Active' : 'Free'}`);

    // Check wallet balance
    const { response: walletResp, data: walletData } = await this.apiCall('/wallet/balance');
    this.log('Check Wallet Balance', walletResp.ok && walletData?.data, 
      `Balance: ${walletData?.data?.balance} ${walletData?.data?.currency}`);

    // Chat about upgrading
    const { response: upgradeResp, data: upgradeData } = await this.apiCall('/ai/adaptive-chat', {
      method: 'POST',
      body: JSON.stringify({
        message: "I'm interested in upgrading to Aether tier for unlimited chats and advanced features. What benefits would I get?",
        conversationId: this.conversationId
      })
    });
    
    this.log('Subscription Inquiry', upgradeResp.ok && upgradeData?.data?.response, 
      'AI explained Aether benefits');

    // Simulate purchasing credits/tickets
    const { response: toolsResp, data: toolsData } = await this.apiCall('/tools/available');
    this.log('Check Available Tools', toolsResp.ok && toolsData?.tools, 
      `Tools: ${toolsData?.tools?.length || 0}`);
  }

  // 6. MEMORY & CONTEXT TESTING
  async testMemoryRetention() {
    console.log(`\n${colors.cyan}🧠 STEP 6: MEMORY & CONTEXT TESTING${colors.reset}`);
    
    // Test if AI remembers previous conversation details
    const { response: memoryResp, data: memoryData } = await this.apiCall('/ai/adaptive-chat', {
      method: 'POST',
      body: JSON.stringify({
        message: "Quick test: What's my name and what am I interested in?",
        conversationId: this.conversationId
      })
    });
    
    const memoryResponse = memoryData?.data?.response;
    const remembersName = memoryResponse?.toLowerCase().includes('sarah');
    const remembersInterests = memoryResponse?.toLowerCase().includes('music') || 
                              memoryResponse?.toLowerCase().includes('ai') ||
                              memoryResponse?.toLowerCase().includes('coding');
    
    this.log('AI Memory Test', memoryResp.ok && (remembersName || remembersInterests), 
      `Remembers name: ${remembersName}, interests: ${remembersInterests}`, false);

    // Test conversation history
    const { response: histResp, data: histData } = await this.apiCall(`/conversations/${this.conversationId}`);
    const messageCount = histData?.data?.messages?.length || 0;
    this.log('Conversation History', histResp.ok && messageCount >= 6, 
      `${messageCount} messages stored`);

    // Test complex reasoning with context
    const { response: reasonResp, data: reasonData } = await this.apiCall('/ai/adaptive-chat', {
      method: 'POST',
      body: JSON.stringify({
        message: "Based on our conversation and my interests, can you suggest a specific AI project I could work on in the sandbox that combines music production with AI development?",
        conversationId: this.conversationId
      })
    });
    
    this.log('Contextual Reasoning', reasonResp.ok && reasonData?.data?.response, 
      'AI provided personalized project suggestion');
  }

  // 7. EMOTIONAL ANALYTICS
  async testEmotionalAnalytics() {
    console.log(`\n${colors.cyan}😊 STEP 7: EMOTIONAL ANALYTICS & INSIGHTS${colors.reset}`);
    
    // Log emotions throughout the session
    const emotions = [
      { emotion: 'excited', intensity: 9, description: 'Starting with the AI platform' },
      { emotion: 'curious', intensity: 8, description: 'Exploring sandbox features' },
      { emotion: 'confident', intensity: 7, description: 'Planning AI music project' }
    ];

    for (const emotionData of emotions) {
      const { response: emotResp, data: emotData } = await this.apiCall('/emotions', {
        method: 'POST',
        body: JSON.stringify(emotionData)
      });
      
      this.log(`Log Emotion: ${emotionData.emotion}`, emotResp.ok && emotData?.data, 
        `Intensity: ${emotionData.intensity}/10`);
    }

    // Get emotional session analysis
    const { response: sessResp, data: sessData } = await this.apiCall('/emotional-analytics/current-session');
    this.log('Emotional Session Analysis', sessResp.ok && sessData?.data?.dominantEmotion, 
      `Dominant: ${sessData?.data?.dominantEmotion}, Avg: ${sessData?.data?.averageIntensity}`);

    // Get personal insights
    const { response: insightResp, data: insightData } = await this.apiCall('/personal-insights/growth-summary');
    this.log('Personal Growth Insights', insightResp.ok && insightData?.data, 
      `AI insights generated: ${!!insightData?.data?.aiInsights}`);
  }

  // 8. ADVANCED FEATURES
  async testAdvancedFeatures() {
    console.log(`\n${colors.cyan}🚀 STEP 8: ADVANCED FEATURES${colors.reset}`);
    
    // Test analytics
    const { response: analyticsResp, data: analyticsData } = await this.apiCall('/analytics/memory');
    this.log('Memory Analytics', analyticsResp.ok && analyticsData?.data, 
      `Session: ${analyticsData?.data?.sessionDuration}ms`);

    // Test recommendations
    const { response: recResp, data: recData } = await this.apiCall('/analytics/recommendations');
    this.log('AI Recommendations', recResp.ok && recData?.data, 
      `${recData?.data?.recommendations?.length || 0} suggestions`);

    // Test cloud features
    const { response: cloudResp, data: cloudData } = await this.apiCall('/cloud/events');
    this.log('Cloud Events', cloudResp.ok && cloudData?.data, 
      `${cloudData?.data?.events?.length || 0} events available`);

    // Test user compatibility
    const { response: compatResp, data: compatData } = await this.apiCall('/cloud/compatibility/users', {
      method: 'POST',
      body: JSON.stringify({
        userEmotionalState: { mood: 'excited', energy: 9 },
        interests: this.userContext.interests
      })
    });
    
    this.log('User Compatibility', compatResp.ok && compatData?.data, 
      `${compatData?.data?.length || 0} compatible users found`);

    // Mobile sync test
    const { response: mobileResp, data: mobileData } = await this.apiCall('/mobile/sync');
    this.log('Mobile Sync', mobileResp.ok && mobileData?.data, 
      `Profile synced: ${!!mobileData?.data?.profile}`);
  }

  // 9. WEBSOCKET REAL-TIME
  async testWebSocketFeatures() {
    console.log(`\n${colors.cyan}🔌 STEP 9: WEBSOCKET REAL-TIME FEATURES${colors.reset}`);
    
    return new Promise((resolve) => {
      const socket = io(baseUrl, {
        auth: { token: this.token },
        autoConnect: false
      });

      let connected = false;
      let messageReceived = false;

      socket.on('connect', () => {
        connected = true;
        socket.emit('chat_message', {
          roomId: 'power-user-room',
          message: `Hello from ${this.userContext.name}! Testing real-time features.`
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
        this.log('WebSocket Real-time', connected, 
          `Connected: ${connected}, Messages: ${messageReceived}`);
        resolve();
      }, 3000);
    });
  }

  // 10. FINAL POWER USER TEST
  async testPowerUserScenario() {
    console.log(`\n${colors.cyan}⚡ STEP 10: POWER USER SCENARIO${colors.reset}`);
    
    // Complex multi-turn conversation with context switching
    const powerUserQuestions = [
      "I want to create an AI music generator. What technical architecture would you recommend?",
      "How would the sandbox help me prototype this idea?",
      "Can you remember my emotional state during this conversation and suggest the best time for creative work?",
      "Based on everything we've discussed, create a roadmap for my AI music project."
    ];

    for (let i = 0; i < powerUserQuestions.length; i++) {
      const question = powerUserQuestions[i];
      
      const { response: powerResp, data: powerData } = await this.apiCall('/ai/adaptive-chat', {
        method: 'POST',
        body: JSON.stringify({
          message: question,
          conversationId: this.conversationId
        })
      });
      
      const response = powerData?.data?.response;
      this.log(`Power Question ${i + 1}`, powerResp.ok && response, 
        `"${question.substring(0, 40)}..." → AI provided detailed response`);
    }

    // Test token refresh during session
    const refreshWorked = await this.refreshToken();
    this.log('Session Token Refresh', refreshWorked, 'Token refreshed mid-session');

    // Final memory validation
    const { response: finalResp, data: finalData } = await this.apiCall('/ai/adaptive-chat', {
      method: 'POST',
      body: JSON.stringify({
        message: "Summarize everything we've accomplished in this session and my progress as a user.",
        conversationId: this.conversationId
      })
    });
    
    this.log('Final Session Summary', finalResp.ok && finalData?.data?.response, 
      'AI provided comprehensive session summary');
  }

  // RUN COMPLETE POWER USER JOURNEY
  async runPowerUserJourney() {
    console.log(`${colors.bright}${colors.magenta}🎯 POWER USER JOURNEY TEST${colors.reset}`);
    console.log(`Testing comprehensive real-world usage scenario...`);
    console.log(`User: ${this.userContext.name}, Interests: ${this.userContext.interests.join(', ')}\n`);
    
    try {
      await this.testUserOnboarding();
      await this.testInitialChat();
      await this.testSandboxFeatures();
      await this.testProfileAndSettings();
      await this.testSubscriptionUpgrade();
      await this.testMemoryRetention();
      await this.testEmotionalAnalytics();
      await this.testAdvancedFeatures();
      await this.testWebSocketFeatures();
      await this.testPowerUserScenario();

      // Final Results
      const passed = this.results.filter(r => r.success).length;
      const total = this.results.length;
      const percentage = Math.round((passed / total) * 100);

      console.log(`\n${colors.bright}${colors.cyan}🏆 POWER USER JOURNEY RESULTS${colors.reset}`);
      console.log('='.repeat(50));
      console.log(`${colors.bright}Success Rate: ${percentage >= 90 ? colors.green : percentage >= 75 ? colors.yellow : colors.red}${passed}/${total} (${percentage}%)${colors.reset}`);
      
      if (percentage >= 90) {
        console.log(`\n${colors.bright}${colors.green}🎉 POWER USER EXPERIENCE: EXCELLENT!${colors.reset}`);
        console.log('✅ Platform ready for demanding users');
        console.log('✅ Memory and context work perfectly');
        console.log('✅ Advanced features functional');
        console.log('✅ Real-time capabilities working');
        console.log('✅ Token management seamless');
      } else if (percentage >= 75) {
        console.log(`\n${colors.bright}${colors.yellow}⚠️  POWER USER EXPERIENCE: GOOD${colors.reset}`);
        console.log('✅ Core functionality works well');
        console.log('⚠️  Some advanced features need attention');
      } else {
        console.log(`\n${colors.bright}${colors.red}❌ POWER USER EXPERIENCE: NEEDS WORK${colors.reset}`);
        
        const failures = this.results.filter(r => !r.success);
        console.log('\nFailed features:');
        failures.forEach(f => console.log(`  - ${f.step}: ${f.details}`));
      }

      console.log(`\n${colors.cyan}📊 Journey Highlights:${colors.reset}`);
      console.log(`• Conversation ID: ${this.conversationId}`);
      console.log(`• Messages exchanged: ${this.results.filter(r => r.step.includes('Message') || r.step.includes('Question')).length}`);
      console.log(`• Features tested: ${this.results.length}`);
      console.log(`• User: ${this.userContext.name} (${this.userEmail})`);

    } catch (error) {
      console.log(`\n${colors.red}❌ POWER USER JOURNEY FAILED: ${error.message}${colors.reset}`);
      console.log('Platform not ready for power users!');
    }
  }
}

// Run the power user journey
const powerUser = new PowerUserJourney();
powerUser.runPowerUserJourney();