import fetch from 'node-fetch';

const baseUrl = 'http://localhost:5000';
let authToken = null;

// Get fresh auth token
const getAuthToken = async () => {
  const signupData = {
    email: `endpoint-test-${Date.now()}@example.com`,
    password: 'testpassword123'
  };
  
  const response = await fetch(`${baseUrl}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signupData)
  });
  
  const data = await response.json();
  return data.token;
};

// Test endpoint function
const testEndpoint = async (path, method = 'GET', body = null) => {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${baseUrl}${path}`, options);
    const text = await response.text();
    
    // Check if response is HTML (error page) or JSON
    const isJson = text.trim().startsWith('{') || text.trim().startsWith('[');
    
    return {
      status: response.status,
      isJson,
      isError: text.includes('Cannot GET') || text.includes('Cannot POST'),
      size: text.length
    };
  } catch (error) {
    return { status: 'ERROR', error: error.message };
  }
};

const runEndpointDiscovery = async () => {
  console.log('🔍 Discovering Working Endpoints');
  console.log('=================================\n');
  
  // Get auth token
  authToken = await getAuthToken();
  console.log('✅ Got fresh auth token\n');
  
  // Test problematic endpoints from our previous test
  const endpointsToTest = [
    // Analytics endpoints (try different paths)
    { path: '/analytics/summary', name: 'Analytics Summary (original)' },
    { path: '/analytics/analytics/memory', name: 'Analytics Memory (corrected)' },
    { path: '/analytics/memory', name: 'Analytics Memory (simple)' },
    { path: '/analytics/llm', name: 'LLM Analytics', method: 'POST', body: { query: 'test' } },
    
    // Conversation endpoints
    { path: '/conversations/recent', name: 'Recent Conversations' },
    { path: '/conversations/sync', name: 'Conversation Sync', method: 'POST', body: { lastSync: new Date().toISOString() } },
    
    // User/Profile endpoints (correct paths)
    { path: '/profile', name: 'User Profile' },
    { path: '/settings', name: 'User Settings' },
    
    // Sync endpoints
    { path: '/mobile/sync', name: 'Mobile Sync', method: 'POST', body: { lastSync: new Date().toISOString() } },
    
    // Emotional analytics
    { path: '/emotions', name: 'Emotions', method: 'POST', body: { emotion: 'happy', intensity: 5 } },
    { path: '/emotional-analytics', name: 'Emotional Analytics' },
    
    // Other endpoints that should work
    { path: '/health', name: 'Health Check' },
    { path: '/personal-insights/growth-summary', name: 'Personal Insights' },
    { path: '/subscription/status', name: 'Subscription Status' }
  ];
  
  console.log('Testing endpoints...\n');
  
  const results = [];
  
  for (const endpoint of endpointsToTest) {
    const result = await testEndpoint(endpoint.path, endpoint.method, endpoint.body);
    
    let status;
    if (result.status === 'ERROR') {
      status = '❌ ERROR';
    } else if (result.isError) {
      status = '🚫 NOT FOUND';
    } else if (!result.isJson) {
      status = '⚠️  HTML RESPONSE';
    } else if (result.status < 300) {
      status = '✅ WORKING';
    } else if (result.status < 500) {
      status = '🔸 CLIENT ERROR';
    } else {
      status = '❌ SERVER ERROR';
    }
    
    console.log(`${status} ${endpoint.name}`);
    console.log(`   Path: ${endpoint.method || 'GET'} ${endpoint.path}`);
    console.log(`   Status: ${result.status}, JSON: ${result.isJson}, Size: ${result.size}b`);
    console.log('');
    
    results.push({
      ...endpoint,
      result,
      working: result.isJson && result.status < 400 && !result.isError
    });
  }
  
  // Summary
  const working = results.filter(r => r.working).length;
  const total = results.length;
  
  console.log('\n📊 ENDPOINT DISCOVERY SUMMARY');
  console.log('=============================');
  console.log(`Working: ${working}/${total} endpoints (${Math.round(working/total*100)}%)\n`);
  
  console.log('✅ WORKING ENDPOINTS:');
  results.filter(r => r.working).forEach(r => {
    console.log(`   ${r.method || 'GET'} ${r.path} - ${r.name}`);
  });
  
  console.log('\n❌ BROKEN ENDPOINTS:');
  results.filter(r => !r.working).forEach(r => {
    console.log(`   ${r.method || 'GET'} ${r.path} - ${r.name} (${r.result.status})`);
  });
  
  console.log('\n🔧 RECOMMENDATIONS:');
  
  const notFound = results.filter(r => r.result.isError).length;
  const htmlResponses = results.filter(r => !r.result.isJson && !r.result.isError).length;
  const serverErrors = results.filter(r => r.result.status >= 500).length;
  
  if (notFound > 0) {
    console.log(`• Fix ${notFound} missing route(s)`);
  }
  if (htmlResponses > 0) {
    console.log(`• Fix ${htmlResponses} endpoint(s) returning HTML instead of JSON`);
  }
  if (serverErrors > 0) {
    console.log(`• Fix ${serverErrors} server error(s)`);
  }
  
  process.exit(0);
};

runEndpointDiscovery();