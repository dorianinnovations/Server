import axios from 'axios';

async function testUBPMIntegration() {
  try {
    // Create test user
    console.log('🔐 Creating test user...');
    const signupResponse = await axios.post('http://localhost:3001/auth/signup', {
      email: `ubpm-test-${Date.now()}@test.com`,
      password: 'testpassword123',
      name: 'UBPM Tester'
    });
    
    const { token } = signupResponse.data.data;
    console.log('✅ User created with token');
    
    const headers = { Authorization: `Bearer ${token}` };
    
    // Test UBPM context endpoint
    console.log('📊 Testing UBPM context...');
    const ubpmResponse = await axios.get('http://localhost:3001/ubpm/context', { headers });
    console.log('UBPM Context:', JSON.stringify(ubpmResponse.data, null, 2));
    
    // Send some chat messages to build behavior profile
    console.log('💬 Building behavior profile with chat messages...');
    const messages = [
      "I'm feeling excited about this new AI technology!",
      "I prefer direct communication and quick responses.",
      "I usually work late at night, around 10-11 PM.",
      "When I'm stressed, I tend to ask shorter questions.",
      "I love learning about new features and capabilities."
    ];
    
    for (let i = 0; i < messages.length; i++) {
      try {
        const chatResponse = await axios.post('http://localhost:3001/ai/adaptive-chat', {
          message: messages[i],
          conversationId: null
        }, { headers });
        console.log(`✅ Message ${i + 1} sent: "${messages[i].substring(0, 30)}..."`);
        
        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (chatError) {
        console.log(`❌ Chat message ${i + 1} failed:`, chatError.response?.data?.error || chatError.message);
      }
    }
    
    // Check UBPM context again after interactions
    console.log('📊 Checking UBPM context after interactions...');
    const ubpmResponse2 = await axios.get('http://localhost:3001/ubpm/context', { headers });
    console.log('Updated UBPM Context:', JSON.stringify(ubpmResponse2.data, null, 2));
    
    // Test analytics integration
    console.log('📈 Testing analytics integration...');
    try {
      const analyticsResponse = await axios.get('http://localhost:3001/analytics/memory', { headers });
      console.log('Analytics Data:', JSON.stringify(analyticsResponse.data, null, 2));
    } catch (analyticsError) {
      console.log('❌ Analytics failed:', analyticsError.response?.data?.error || analyticsError.message);
    }
    
    console.log('\n🎯 UBPM Integration Test Complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testUBPMIntegration();