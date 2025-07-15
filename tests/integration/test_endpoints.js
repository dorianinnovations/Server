import axios from 'axios';

const BASE_URL = 'http://localhost:5000';
let authToken = '';

const testData = {
  testUser: {
    email: 'ai-test@numina.app',
    password: 'AITestPass123!'
  },
  emotionalState: {
    recentEmotions: [
      { type: 'happy', intensity: 7, timestamp: new Date() },
      { type: 'calm', intensity: 6, timestamp: new Date() }
    ],
    conversationHistory: [
      { role: 'user', content: 'I feel great today!' },
      { role: 'assistant', content: 'That\'s wonderful to hear!' }
    ],
    timeContext: {
      timeOfDay: 'morning',
      dayOfWeek: 'sunday'
    }
  },
  emotionalProfile: {
    emotionalPreferences: { preferredMood: 'calm', energyLevel: 'medium' },
    personalityTraits: { openness: 8, extraversion: 6 },
    communicationStyle: 'thoughtful',
    socialPreferences: { groupSize: 'small', activityType: 'creative' }
  }
};

async function createTestUser() {
  try {
    console.log('🔍 Creating test user...');
    const response = await axios.post(`${BASE_URL}/signup`, testData.testUser);
    authToken = response.data.token;
    console.log('✅ User created and logged in');
    return response.data;
  } catch (error) {
    if (error.response?.status === 409 || error.response?.data?.message?.includes('already exists')) {
      console.log('ℹ️ User already exists, attempting login...');
      return await loginUser();
    }
    console.error('❌ Error creating user:', error.response?.data || error.message);
    throw error;
  }
}

async function loginUser() {
  try {
    console.log('🔐 Logging in...');
    const response = await axios.post(`${BASE_URL}/login`, testData.testUser);
    authToken = response.data.token;
    console.log('✅ Login successful');
    return response.data;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data?.message);
    throw error;
  }
}

async function testAIEndpoints() {
  const headers = { Authorization: `Bearer ${authToken}` };
  
  console.log('\n🧠 Testing AI Endpoints...');
  
  try {
    // Test emotional state analysis
    console.log('📊 Testing /ai/emotional-state...');
    const emotionalStateResponse = await axios.post(
      `${BASE_URL}/ai/emotional-state`,
      testData.emotionalState,
      { headers }
    );
    console.log('✅ Emotional state analysis successful');
    console.log('📈 Result:', JSON.stringify(emotionalStateResponse.data.data, null, 2));
    
    // Test personality recommendations
    console.log('\n🎭 Testing /ai/personality-recommendations...');
    const personalityResponse = await axios.post(
      `${BASE_URL}/ai/personality-recommendations`,
      {
        emotionalProfile: testData.emotionalProfile,
        interactionHistory: testData.emotionalState.conversationHistory,
        preferences: { focus: 'social_growth' }
      },
      { headers }
    );
    console.log('✅ Personality recommendations successful');
    console.log('🎯 Result:', JSON.stringify(personalityResponse.data.data, null, 2));
    
    // Test adaptive chat
    console.log('\n💬 Testing /ai/adaptive-chat...');
    const chatResponse = await axios.post(
      `${BASE_URL}/ai/adaptive-chat`,
      {
        message: 'I want to meet new people but feel nervous about it',
        emotionalContext: testData.emotionalState,
        personalityProfile: testData.emotionalProfile,
        conversationGoal: 'social_support'
      },
      { headers }
    );
    console.log('✅ Adaptive chat successful');
    console.log('🗨️ Result:', JSON.stringify(chatResponse.data.data, null, 2));
    
  } catch (error) {
    console.error('❌ AI endpoint test failed:', error.response?.data?.error || error.message);
    return false;
  }
  
  return true;
}

async function testCloudEndpoints() {
  const headers = { Authorization: `Bearer ${authToken}` };
  
  console.log('\n☁️ Testing Cloud Endpoints...');
  
  try {
    // Test events retrieval
    console.log('📅 Testing GET /cloud/events...');
    const getEventsResponse = await axios.get(
      `${BASE_URL}/cloud/events?limit=5`,
      { headers }
    );
    console.log('✅ Get events successful');
    console.log('📋 Found', getEventsResponse.data.data.events.length, 'events');
    
    // Test enhanced events with emotional matching
    console.log('\n🎯 Testing POST /cloud/events (enhanced)...');
    const enhancedEventsResponse = await axios.post(
      `${BASE_URL}/cloud/events`,
      {
        emotionalState: testData.emotionalState,
        filters: { category: 'wellness' }
      },
      { headers }
    );
    console.log('✅ Enhanced events successful');
    console.log('🔍 Found', enhancedEventsResponse.data.data.length, 'matched events');
    
    // Test user compatibility
    console.log('\n👥 Testing /cloud/compatibility/users...');
    const compatibilityResponse = await axios.post(
      `${BASE_URL}/cloud/compatibility/users`,
      {
        userEmotionalState: testData.emotionalState,
        compatibilityContext: { goal: 'friendship' }
      },
      { headers }
    );
    console.log('✅ User compatibility analysis successful');
    console.log('🤝 Found', compatibilityResponse.data.data.length, 'compatible users');
    
  } catch (error) {
    console.error('❌ Cloud endpoint test failed:', error.response?.data?.error || error.message);
    return false;
  }
  
  return true;
}

async function testUserEndpoints() {
  const headers = { Authorization: `Bearer ${authToken}` };
  
  console.log('\n👤 Testing User Endpoints...');
  
  try {
    // Test emotional profile update
    console.log('🧠 Testing PUT /emotional-profile...');
    const profileResponse = await axios.put(
      `${BASE_URL}/emotional-profile`,
      testData.emotionalProfile,
      { headers }
    );
    console.log('✅ Emotional profile update successful');
    console.log('📝 Result:', profileResponse.data.message);
    
  } catch (error) {
    console.error('❌ User endpoint test failed:', error.response?.data?.error || error.message);
    return false;
  }
  
  return true;
}

async function runAllTests() {
  try {
    console.log('🚀 Starting Backend Integration Tests\n');
    
    // Setup
    await createTestUser();
    
    // Test all endpoints
    const aiSuccess = await testAIEndpoints();
    const cloudSuccess = await testCloudEndpoints();
    const userSuccess = await testUserEndpoints();
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log('🧠 AI Endpoints:', aiSuccess ? '✅ PASS' : '❌ FAIL');
    console.log('☁️ Cloud Endpoints:', cloudSuccess ? '✅ PASS' : '❌ FAIL');
    console.log('👤 User Endpoints:', userSuccess ? '✅ PASS' : '❌ FAIL');
    
    const allSuccess = aiSuccess && cloudSuccess && userSuccess;
    console.log('\n🎯 Overall Result:', allSuccess ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
    
    if (allSuccess) {
      console.log('\n🎉 Backend integration is ready! All AI-powered features are working correctly.');
    } else {
      console.log('\n⚠️ Some endpoints need attention. Check the error messages above.');
    }
    
  } catch (error) {
    console.error('❌ Test setup failed:', error.message);
    process.exit(1);
  }
}

// Check if server is running
async function checkServer() {
  try {
    await axios.get(`${BASE_URL}/health`);
    console.log('✅ Server is running');
    return true;
  } catch (error) {
    console.log('❌ Server is not running. Please start with: npm start');
    return false;
  }
}

// Run tests
async function main() {
  const serverRunning = await checkServer();
  if (serverRunning) {
    await runAllTests();
  }
  process.exit(0);
}

main().catch(console.error);