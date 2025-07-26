#!/usr/bin/env node

/**
 * Test Script: API Integration Test
 * 
 * Tests the conversation persistence through actual API calls
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000';
const TEST_EMAIL = 'test-api@numina.app';
const TEST_PASSWORD = 'testpass123';

let authToken = null;
let conversationId = null;

// Helper function for API calls
const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} - ${JSON.stringify(data)}`);
  }
  
  return data;
};

// Test user registration/login
const testAuth = async () => {
  console.log('🔐 Testing authentication...');
  
  try {
    // Try to register (might fail if user exists)
    await apiCall('/register', {
      method: 'POST',
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      })
    });
    console.log('✅ User registered');
  } catch (error) {
    // User might already exist, try login
    console.log('ℹ️ User already exists, attempting login...');
  }
  
  // Login
  const loginResult = await apiCall('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    })
  });
  
  authToken = loginResult.token;
  console.log('✅ User authenticated');
  return loginResult;
};

// Test conversation creation via API
const testCreateConversation = async () => {
  console.log('🧪 Testing conversation creation via API...');
  
  const result = await apiCall('/conversations', {
    method: 'POST',
    body: JSON.stringify({
      title: 'API Test Conversation'
    })
  });
  
  conversationId = result.data._id;
  console.log(`✅ Created conversation: ${conversationId}`);
  return result;
};

// Test completion with conversation persistence
const testCompletionWithConversation = async () => {
  console.log('🧪 Testing completion with conversation persistence...');
  
  const result = await apiCall('/completion', {
    method: 'POST',
    body: JSON.stringify({
      prompt: 'Hello! This is a test of the conversation persistence system.',
      conversationId: conversationId,
      temperature: 0.7,
      stream: false
    })
  });
  
  console.log('✅ Completion request successful');
  console.log(`   Response: ${result.content.substring(0, 100)}...`);
  return result;
};

// Test retrieving conversation
const testRetrieveConversation = async () => {
  console.log('🧪 Testing conversation retrieval via API...');
  
  const result = await apiCall(`/conversations/${conversationId}`);
  
  console.log(`✅ Retrieved conversation: ${result.data._id}`);
  console.log(`   Title: ${result.data.title}`);
  console.log(`   Messages: ${result.data.messageCount}`);
  console.log(`   Message count: ${result.data.messages.length}`);
  
  // Show messages
  result.data.messages.forEach((msg, index) => {
    console.log(`   ${index + 1}. [${msg.role}] ${msg.content.substring(0, 50)}...`);
  });
  
  return result;
};

// Test listing conversations
const testListConversations = async () => {
  console.log('🧪 Testing conversation listing via API...');
  
  const result = await apiCall('/conversations');
  
  console.log(`✅ Listed conversations: ${result.data.length} found`);
  result.data.forEach((conv, index) => {
    console.log(`   ${index + 1}. ${conv.title} (${conv.messageCount} messages)`);
  });
  
  return result;
};

// Test adding message to conversation
const testAddMessage = async () => {
  console.log('🧪 Testing adding message to conversation...');
  
  const result = await apiCall(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      role: 'user',
      content: 'Can you tell me more about the features of this system?',
      metadata: { apiTest: true }
    })
  });
  
  console.log('✅ Added message to conversation');
  console.log(`   Conversation ID: ${result.data.conversationId}`);
  console.log(`   Message count: ${result.data.messageCount}`);
  
  return result;
};

// Test updating conversation title
const testUpdateTitle = async () => {
  console.log('🧪 Testing conversation title update...');
  
  const result = await apiCall(`/conversations/${conversationId}/title`, {
    method: 'PUT',
    body: JSON.stringify({
      title: 'Updated API Test Conversation - Feature Complete'
    })
  });
  
  console.log('✅ Updated conversation title');
  console.log(`   New title: ${result.data.title}`);
  
  return result;
};

// Main test function
const runAPITests = async () => {
  try {
    console.log('🚀 Starting API Integration Tests...\n');
    
    // Test 1: Authentication
    await testAuth();
    console.log('');
    
    // Test 2: Create conversation
    await testCreateConversation();
    console.log('');
    
    // Test 3: Completion with conversation
    await testCompletionWithConversation();
    console.log('');
    
    // Test 4: Retrieve conversation
    await testRetrieveConversation();
    console.log('');
    
    // Test 5: Add message
    await testAddMessage();
    console.log('');
    
    // Test 6: List conversations
    await testListConversations();
    console.log('');
    
    // Test 7: Update title
    await testUpdateTitle();
    console.log('');
    
    // Final check - retrieve conversation again
    console.log('🔍 Final verification - retrieving updated conversation...');
    const finalConv = await apiCall(`/conversations/${conversationId}`);
    console.log(`✅ Final conversation state:`);
    console.log(`   Title: ${finalConv.data.title}`);
    console.log(`   Messages: ${finalConv.data.messageCount}`);
    console.log(`   Last Activity: ${finalConv.data.lastActivity}`);
    
    console.log('\n🎉 All API integration tests passed!');
    console.log('\n📊 Test Summary:');
    console.log('✅ User authentication');
    console.log('✅ Conversation creation via API');
    console.log('✅ Completion with conversation persistence');
    console.log('✅ Conversation retrieval');
    console.log('✅ Message addition');
    console.log('✅ Conversation listing');
    console.log('✅ Title updates');
    
    console.log('\n🚀 The conversation persistence system is fully integrated and working!');
    
  } catch (error) {
    console.error('❌ API test failed:', error.message);
    process.exit(1);
  }
};

// Check if server is running
const checkServer = async () => {
  try {
    const response = await fetch(`${API_BASE}/`);
    const data = await response.json();
    if (data.status === 'success') {
      console.log('✅ Server is running');
      return true;
    }
  } catch (error) {
    console.error('❌ Server is not running. Please start the server first with: npm start');
    console.error('   Error:', error.message);
    process.exit(1);
  }
};

// Run tests
const main = async () => {
  await checkServer();
  await runAPITests();
};

main();