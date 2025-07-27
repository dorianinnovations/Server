import fetch from 'node-fetch';

const baseUrl = 'http://localhost:5000';

// Create test user and get auth token
const setupTestUser = async () => {
  const timestamp = Date.now();
  const userEmail = `final-check-${timestamp}@numina.app`;
  const password = 'testpassword123';
  
  const response = await fetch(`${baseUrl}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userEmail, password })
  });
  
  const data = await response.json();
  return data.token;
};

const quickCheck = async () => {
  console.log('🔍 Final Quick Check - Previously Failed Endpoints');
  console.log('=================================================\n');
  
  const token = await setupTestUser();
  console.log('✅ Fresh user created\n');
  
  const failedEndpoints = [
    { name: 'Analytics Memory', path: '/analytics/memory' },
    { name: 'Analytics Recommendations', path: '/analytics/recommendations' },
    { name: 'Mobile Profile Header', path: '/mobile/profile-header' },
    { name: 'API Documentation', path: '/api/docs', requiresAuth: false },
  ];
  
  for (const endpoint of failedEndpoints) {
    process.stdout.write(`Testing ${endpoint.name}... `);
    
    try {
      const response = await fetch(`${baseUrl}${endpoint.path}`, {
        headers: {
          ...(endpoint.requiresAuth !== false ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      
      const text = await response.text();
      const hasJson = text.includes('{');
      const hasSuccessStatus = response.status < 400;
      
      // Check for problematic text
      const lowerText = text.toLowerCase();
      const hasMockText = lowerText.includes('fallback') || 
                         lowerText.includes('example') || 
                         lowerText.includes('placeholder') ||
                         lowerText.includes('mock');
      
      if (hasSuccessStatus && hasJson && !hasMockText) {
        console.log('✅ FIXED');
      } else {
        console.log('❌ STILL BROKEN');
        if (hasMockText) {
          const found = ['fallback', 'example', 'placeholder', 'mock']
            .filter(word => lowerText.includes(word));
          console.log(`   Found mock text: ${found.join(', ')}`);
        }
        if (!hasSuccessStatus) {
          console.log(`   HTTP ${response.status}`);
        }
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
    }
  }
  
  console.log('\n🎯 Quick check complete - ready for final comprehensive test!');
};

quickCheck();