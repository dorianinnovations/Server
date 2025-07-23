import fetch from 'node-fetch';

const SERVER_URL = 'http://localhost:5000';
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ODA2ODNiYzFmNWUxZjQ2OTkwYzFmZCIsImlhdCI6MTc1MzI0NTc1NywiZXhwIjoxNzUzNTA0OTU3fQ.UE5UNsClayKScb9d64xjv6oZ9FAcj2-AcMbZW1bMWSY';

console.log('🔍 Debug: Testing chain of thought connectivity...\n');

async function debugTest() {
  try {
    // First test simple endpoint
    console.log('1. Testing basic auth...');
    const authTest = await fetch(`${SERVER_URL}/sandbox/auth-test`, {
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });
    console.log(`   Status: ${authTest.status} ${authTest.statusText}`);
    
    if (authTest.ok) {
      const authResult = await authTest.json();
      console.log(`   User ID: ${authResult.user?.id}`);
    }

    console.log('\n2. Testing chain of thought endpoint...');
    const response = await fetch(`${SERVER_URL}/sandbox/chain-of-thought`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        query: 'simple test query',
        options: { actions: ['explore'] },
        sessionId: 'debug_test',
        stream: true
      })
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Content-Type: ${response.headers.get('content-type')}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   Error: ${errorText}`);
      return;
    }

    console.log('\n3. Reading first few chunks...');
    const reader = response.body;
    let chunkCount = 0;
    
    reader.on('data', (chunk) => {
      chunkCount++;
      const text = chunk.toString();
      console.log(`   Chunk ${chunkCount}: ${text.length} bytes`);
      console.log(`   Content: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
      
      if (chunkCount >= 3) {
        console.log('\n✅ Successfully receiving streaming data!');
        process.exit(0);
      }
    });

    reader.on('error', (error) => {
      console.log(`   Stream error: ${error.message}`);
      process.exit(1);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      console.log('\n⏰ Timeout - no data received');
      process.exit(1);
    }, 10000);

  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    process.exit(1);
  }
}

debugTest();