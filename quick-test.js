import fetch from 'node-fetch';

const SERVER_URL = 'http://localhost:5000';
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ODA2N2EwMDZmNjg1NWVjNGQ5Yzg3MCIsImlhdCI6MTc1MzI0NTYwMSwiZXhwIjoxNzUzNTA0ODAxfQ.Fbzzy39iEyaGfHcKMpZ9Ex6whlwhzJx0vOvYRyjgy6w';

console.log('🧠 Testing AI Transparency Chain of Thought...\n');

async function quickTest() {
  try {
    const response = await fetch(`${SERVER_URL}/sandbox/chain-of-thought`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        query: 'how can I be more creative in problem solving',
        options: {
          actions: ['explore', 'discover'],
          useUBPM: true
        },
        sessionId: `quick_test_${Date.now()}`,
        stream: true
      })
    });

    if (!response.ok) {
      console.log(`❌ Error: ${response.status} ${response.statusText}`);
      return;
    }

    console.log('✅ Connection established - Watching first 15 seconds...\n');

    const reader = response.body;
    let buffer = '';
    let eventCount = 0;
    const startTime = Date.now();

    // Set timeout to stop after 15 seconds
    const timeout = setTimeout(() => {
      console.log('\n⏰ 15 second test complete!');
      process.exit(0);
    }, 15000);

    reader.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          eventCount++;
          
          if (data === '[DONE]') {
            clearTimeout(timeout);
            console.log('✅ Process completed!');
            process.exit(0);
          }

          try {
            const parsed = JSON.parse(data);
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            
            if (parsed.type === 'step_update') {
              const step = parsed.steps?.find(s => s.id === parsed.currentStep);
              console.log(`[${elapsed}s] 🔄 ${step?.title || 'Unknown'}: ${step?.status || 'unknown'}`);
              if (parsed.message) {
                console.log(`      💭 "${parsed.message}"`);
              }
            } else if (parsed.type === 'final_result') {
              clearTimeout(timeout);
              console.log(`\n🎉 Final Result: ${parsed.data.nodes?.length || 0} nodes generated`);
              if (parsed.data.nodes?.[0]) {
                console.log(`📝 First Node: "${parsed.data.nodes[0].title}"`);
              }
              process.exit(0);
            }
          } catch (parseError) {
            console.log(`⚠️ Parse error: ${data.substring(0, 50)}...`);
          }
        }
      }
    });

    reader.on('end', () => {
      clearTimeout(timeout);
      console.log('📡 Stream ended');
      process.exit(0);
    });

    reader.on('error', (error) => {
      clearTimeout(timeout);
      console.log(`❌ Stream error: ${error.message}`);
      process.exit(1);
    });

  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    process.exit(1);
  }
}

quickTest();