import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = 'http://localhost:5000';

// Test authentication first
async function testAuth() {
  try {
    const response = await axios.post(`${API_BASE}/login`, {
      email: 'test@example.com',
      password: 'testpassword'
    });
    
    if (response.data.token) {
      console.log('✓ Authentication successful');
      return response.data.token;
    } else {
      console.log('✗ Authentication failed');
      return null;
    }
  } catch (error) {
    console.log('✗ Authentication error:', error.response?.data?.message || error.message);
    return null;
  }
}

// Test tool availability
async function testToolAvailability(token) {
  try {
    const response = await axios.get(`${API_BASE}/tools/available`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✓ Tool availability test successful');
    console.log('Available tools:', response.data.tools?.length || 0);
    console.log('User context:', response.data.userContext);
    
    return response.data.tools;
  } catch (error) {
    console.log('✗ Tool availability test failed:', error.response?.data?.message || error.message);
    return null;
  }
}

// Test tool execution
async function testToolExecution(token) {
  try {
    const response = await axios.post(`${API_BASE}/tools/execute`, {
      toolName: 'credit_management',
      arguments: {
        action: 'check_balance'
      }
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✓ Tool execution test successful');
    console.log('Result:', response.data.result);
    
    return response.data.result;
  } catch (error) {
    console.log('✗ Tool execution test failed:', error.response?.data?.message || error.message);
    return null;
  }
}

// Test tool registry
async function testToolRegistry(token) {
  try {
    const response = await axios.get(`${API_BASE}/tools/registry`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✓ Tool registry test successful');
    console.log('Registry tools:', response.data.tools?.length || 0);
    
    return response.data.tools;
  } catch (error) {
    console.log('✗ Tool registry test failed:', error.response?.data?.message || error.message);
    return null;
  }
}

// Test credit pool
async function testCreditPool(token) {
  try {
    const response = await axios.get(`${API_BASE}/tools/credit-pool`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✓ Credit pool test successful');
    console.log('Credit pool:', response.data.creditPool);
    
    return response.data.creditPool;
  } catch (error) {
    console.log('✗ Credit pool test failed:', error.response?.data?.message || error.message);
    return null;
  }
}

// Test trigger event
async function testTriggerEvent(token) {
  try {
    const response = await axios.post(`${API_BASE}/tools/trigger-event`, {
      eventType: 'user_action',
      data: {
        action: 'test_action',
        context: {
          test: true
        }
      }
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✓ Trigger event test successful');
    console.log('Event:', response.data.event);
    
    return response.data.event;
  } catch (error) {
    console.log('✗ Trigger event test failed:', error.response?.data?.message || error.message);
    return null;
  }
}

// Run all tests
async function runTests() {
  console.log('🧪 Starting tool system tests...\n');
  
  const token = await testAuth();
  if (!token) {
    console.log('❌ Cannot continue without authentication');
    return;
  }
  
  console.log('\n1. Testing tool availability...');
  const tools = await testToolAvailability(token);
  
  console.log('\n2. Testing tool registry...');
  const registry = await testToolRegistry(token);
  
  console.log('\n3. Testing credit pool...');
  const creditPool = await testCreditPool(token);
  
  console.log('\n4. Testing tool execution...');
  const execution = await testToolExecution(token);
  
  console.log('\n5. Testing trigger event...');
  const event = await testTriggerEvent(token);
  
  console.log('\n🎉 All tests completed!');
}

runTests().catch(console.error);