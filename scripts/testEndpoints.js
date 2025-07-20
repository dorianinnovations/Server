import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Test the actual API endpoints
 */

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Test credentials - you may need to replace these with actual test user credentials
const TEST_CREDENTIALS = {
  email: 'locationtest@example.com',
  password: 'testpassword123' // You'll need to know the actual password
};

let authToken = null;

async function login() {
  try {
    console.log('🔐 Logging in...');
    const response = await axios.post(`${API_BASE}/login`, TEST_CREDENTIALS);
    
    if (response.data.success && response.data.token) {
      authToken = response.data.token;
      console.log('✅ Login successful');
      return true;
    } else {
      console.log('❌ Login failed:', response.data.message);
      return false;
    }
  } catch (error) {
    console.log('❌ Login error:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testAnalyticsLLMEndpoints() {
  if (!authToken) {
    console.log('❌ No auth token available');
    return;
  }

  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };

  console.log('\n🧠 Testing Analytics LLM Endpoints...');

  try {
    // Test status endpoint
    console.log('\n📊 Testing GET /analytics/llm/status...');
    const statusResponse = await axios.get(`${API_BASE}/analytics/llm/status`, { headers });
    console.log('✅ Status endpoint working:', statusResponse.data.success);
    console.log(`   Available categories: ${statusResponse.data.availableCategories?.join(', ')}`);
    
    // Test main analytics endpoint
    console.log('\n📊 Testing POST /analytics/llm...');
    const analyticsResponse = await axios.post(`${API_BASE}/analytics/llm`, {}, { headers });
    console.log('✅ Main analytics endpoint working:', analyticsResponse.data.success);
    
    // Test insight generation for communication
    console.log('\n📊 Testing POST /analytics/llm/insights (communication)...');
    const insightResponse1 = await axios.post(`${API_BASE}/analytics/llm/insights`, {
      category: 'communication'
    }, { headers });
    
    if (insightResponse1.data.success) {
      console.log('✅ Communication insight generated');
      console.log(`   Insight: "${insightResponse1.data.insight.insight.substring(0, 100)}..."`);
    } else {
      console.log('❌ Communication insight failed:', insightResponse1.data.error);
    }
    
    // Test cooldown by trying again immediately
    console.log('\n⏱️ Testing cooldown (immediate retry)...');
    try {
      const insightResponse2 = await axios.post(`${API_BASE}/analytics/llm/insights`, {
        category: 'communication'
      }, { headers });
      
      if (insightResponse2.status === 429) {
        console.log('✅ Cooldown working - request blocked');
      } else if (insightResponse2.data.success) {
        console.log('⚠️ Cooldown may not be working - insight generated again');
      }
    } catch (error) {
      if (error.response?.status === 429) {
        console.log('✅ Cooldown working - 429 status returned');
        console.log(`   Reason: ${error.response.data.reason}`);
      } else {
        console.log('❌ Unexpected error:', error.response?.data || error.message);
      }
    }
    
    // Test different category
    console.log('\n📊 Testing personality insight...');
    const personalityResponse = await axios.post(`${API_BASE}/analytics/llm/insights`, {
      category: 'personality'
    }, { headers });
    
    if (personalityResponse.data.success) {
      console.log('✅ Personality insight generated');
    } else if (personalityResponse.status === 429) {
      console.log('⏱️ Personality insight on cooldown');
    } else {
      console.log('❌ Personality insight failed:', personalityResponse.data.error);
    }
    
  } catch (error) {
    console.error('❌ Endpoint test error:', error.response?.data || error.message);
  }
}

async function runEndpointTests() {
  console.log('🧪 Starting API Endpoint Tests\n');
  
  const loginSuccess = await login();
  if (loginSuccess) {
    await testAnalyticsLLMEndpoints();
  }
  
  console.log('\n✅ Endpoint tests completed!');
}

// Only run if the server is running
async function checkServerStatus() {
  try {
    const response = await axios.get(`${API_BASE}/health`);
    if (response.status === 200) {
      console.log('✅ Server is running');
      return true;
    }
  } catch (error) {
    console.log('❌ Server is not running. Please start the server first.');
    console.log(`   Expected at: ${API_BASE}`);
    return false;
  }
}

// Check server and run tests
checkServerStatus().then(serverRunning => {
  if (serverRunning) {
    runEndpointTests();
  }
});