import fetch from 'node-fetch';
import { env } from '../src/config/environment.js';

const API_BASE = 'http://localhost:5001/api';

// Test user credentials
const testUser = {
  email: 'alice@example.com',
  password: 'password123'
};

let authToken = null;

// Helper function to make authenticated API requests
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
    ...options.headers
  };
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  const data = await response.json();
  return { status: response.status, data };
}

// Test authentication
async function testAuthentication() {
  console.log('🔐 Testing authentication...');
  
  const { status, data } = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(testUser)
  });
  
  if (status === 200 && data.token) {
    authToken = data.token;
    console.log('✅ Authentication successful');
    console.log(`👤 Logged in as: ${data.user.email}`);
    return true;
  } else {
    console.error('❌ Authentication failed:', data);
    return false;
  }
}

// Test cloud events retrieval
async function testCloudEvents() {
  console.log('\n🌟 Testing cloud events retrieval...');
  
  // Test basic events fetch
  const { status: basicStatus, data: basicData } = await apiRequest('/cloud/events');
  
  if (basicStatus === 200) {
    console.log(`✅ Basic events fetch successful - ${basicData.data.events.length} events found`);
    basicData.data.events.forEach((event, index) => {
      console.log(`  ${index + 1}. ${event.title} (${event.category}) - ${new Date(event.dateTime.start).toLocaleDateString()}`);
    });
  } else {
    console.error('❌ Basic events fetch failed:', basicData);
    return false;
  }
  
  // Test AI-enhanced events with emotional context
  const emotionalState = {
    mood: 'curious',
    energy: 7,
    timeOfDay: 'morning',
    interests: ['technology', 'learning', 'creativity']
  };
  
  const { status: aiStatus, data: aiData } = await apiRequest('/cloud/events', {
    method: 'POST',
    body: JSON.stringify({
      emotionalState,
      preferences: { category: 'learning' },
      filters: { location: 'New York' }
    })
  });
  
  if (aiStatus === 200) {
    console.log(`✅ AI-enhanced events fetch successful - ${aiData.data.length} matched events`);
    aiData.data.forEach((event, index) => {
      const score = event.compatibility?.compatibilityScore || 0;
      console.log(`  ${index + 1}. ${event.title} - AI Score: ${score}% (${event.compatibility?.recommendationStrength || 'medium'})`);
    });
  } else {
    console.error('❌ AI-enhanced events fetch failed:', aiData);
  }
  
  return true;
}

// Test event compatibility analysis
async function testEventCompatibility() {
  console.log('\n🎯 Testing event compatibility analysis...');
  
  // First get an event ID
  const { data: eventsData } = await apiRequest('/cloud/events');
  if (!eventsData.data.events.length) {
    console.error('❌ No events available for compatibility testing');
    return false;
  }
  
  const eventId = eventsData.data.events[0]._id;
  const eventTitle = eventsData.data.events[0].title;
  
  const emotionalState = {
    mood: 'excited',
    energy: 8,
    timeOfDay: 'evening',
    interests: ['learning', 'networking', 'growth']
  };
  
  const { status, data } = await apiRequest(`/cloud/events/${eventId}/compatibility`, {
    method: 'POST',
    body: JSON.stringify({ emotionalState })
  });
  
  if (status === 200) {
    console.log(`✅ Compatibility analysis successful for "${eventTitle}"`);
    const comp = data.data.compatibility;
    console.log(`  📊 Compatibility Score: ${comp.compatibilityScore}%`);
    console.log(`  🎭 Mood Boost Potential: ${comp.moodBoostPrediction}/10`);
    console.log(`  ⚡ Energy Match: ${comp.energyMatch}/10`);
    console.log(`  👥 Social Fit: ${comp.socialFit}/10`);
    console.log(`  📝 Reasons: ${comp.reasons.join(', ')}`);
  } else {
    console.error('❌ Compatibility analysis failed:', data);
  }
  
  return true;
}

// Test user compatibility matching
async function testUserCompatibility() {
  console.log('\n👥 Testing user compatibility matching...');
  
  const userEmotionalState = {
    mood: 'social',
    energy: 7,
    timeOfDay: 'afternoon',
    interests: ['technology', 'wellness', 'creativity']
  };
  
  const { status, data } = await apiRequest('/cloud/compatibility/users', {
    method: 'POST',
    body: JSON.stringify({
      userEmotionalState,
      compatibilityContext: {
        lookingFor: 'friendship',
        activityType: 'collaborative'
      }
    })
  });
  
  if (status === 200) {
    console.log(`✅ User compatibility matching successful - ${data.data.length} compatible users found`);
    data.data.forEach((user, index) => {
      const comp = user.compatibility;
      const name = user.userProfile?.name || user.userEmail.split('@')[0];
      console.log(`  ${index + 1}. ${name} - Compatibility: ${comp.compatibilityScore}% (${comp.recommendationLevel})`);
      console.log(`     Strengths: ${comp.strengths.join(', ')}`);
      console.log(`     Suggested activities: ${comp.suggestedActivities.join(', ')}`);
    });
  } else {
    console.error('❌ User compatibility matching failed:', data);
  }
  
  return true;
}

// Test event joining/leaving
async function testEventJoinLeave() {
  console.log('\n🎪 Testing event join/leave functionality...');
  
  // Get an event to join
  const { data: eventsData } = await apiRequest('/cloud/events');
  if (!eventsData.data.events.length) {
    console.error('❌ No events available for join/leave testing');
    return false;
  }
  
  const eventId = eventsData.data.events[0]._id;
  const eventTitle = eventsData.data.events[0].title;
  
  // Join event
  const { status: joinStatus, data: joinData } = await apiRequest(`/cloud/events/${eventId}/join`, {
    method: 'POST'
  });
  
  if (joinStatus === 200) {
    console.log(`✅ Successfully joined event: "${eventTitle}"`);
    console.log(`  👥 Participant count: ${joinData.data.participantCount}`);
    console.log(`  📋 Status: ${joinData.data.userStatus}`);
  } else {
    console.error('❌ Event join failed:', joinData);
    return false;
  }
  
  // Leave event
  const { status: leaveStatus, data: leaveData } = await apiRequest(`/cloud/events/${eventId}/leave`, {
    method: 'POST'
  });
  
  if (leaveStatus === 200) {
    console.log(`✅ Successfully left event: "${eventTitle}"`);
    console.log(`  👥 Participant count: ${leaveData.data.participantCount}`);
    console.log(`  📋 Status: ${leaveData.data.userStatus}`);
  } else {
    console.error('❌ Event leave failed:', leaveData);
  }
  
  return true;
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Cloud Features Integration Tests');
  console.log('=' .repeat(50));
  
  try {
    // Test authentication first
    const authSuccess = await testAuthentication();
    if (!authSuccess) {
      console.log('\n❌ Authentication failed - cannot proceed with other tests');
      return;
    }
    
    // Run all cloud feature tests
    await testCloudEvents();
    await testEventCompatibility();
    await testUserCompatibility();
    await testEventJoinLeave();
    
    console.log('\n🎉 All Cloud Features Tests Completed!');
    console.log('=' .repeat(50));
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
  }
}

// Run the tests
runAllTests();