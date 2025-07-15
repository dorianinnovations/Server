import { io } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const BASE_URL = 'http://localhost:5000';

// Get fresh token
async function getAuthToken() {
  const response = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'testuser1@example.com',
      password: 'testpass123'
    })
  });
  
  const data = await response.json();
  return data.token;
}

async function testNuminaSenses() {
  console.log('🎭 Testing Dynamic Numina Senses...\n');

  try {
    // Get authentication token
    const token = await getAuthToken();
    console.log('✅ Got authentication token');

    // Connect to WebSocket with auth
    const socket = io(BASE_URL, {
      auth: { token }
    });

    socket.on('connect', () => {
      console.log('✅ Connected to WebSocket server');
    });

    socket.on('connected', (data) => {
      console.log(`📱 Connection confirmed: ${data.message}`);
    });

    // 🎯 Listen for Numina Senses updates
    socket.on('numina_senses_updated', (data) => {
      console.log(`\n🎭 NUMINA SENSES UPDATE:`);
      console.log(`   Emotion: ${data.emotion}`);
      console.log(`   Intensity: ${data.intensity}`);
      console.log(`   Confidence: ${Math.round(data.confidence * 100)}%`);
      console.log(`   Reasoning: ${data.reasoning}`);
      console.log(`   Source: ${data.source}`);
      console.log(`   Time: ${new Date(data.timestamp).toLocaleTimeString()}\n`);
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from WebSocket');
    });

    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('🧪 Sending test messages to trigger emotion detection...\n');

    const testMessages = [
      {
        message: "I am feeling really excited about this new project!",
        expectedEmotion: "excited"
      },
      {
        message: "I'm feeling quite stressed and overwhelmed with everything going on",
        expectedEmotion: "anxious"
      },
      {
        message: "Today was amazing! I feel so happy and grateful",
        expectedEmotion: "happy"
      },
      {
        message: "I need some help, I'm feeling lost and confused",
        expectedEmotion: "sad/anxious"
      }
    ];

    for (let i = 0; i < testMessages.length; i++) {
      const test = testMessages[i];
      console.log(`${i + 1}. Testing: "${test.message}"`);
      console.log(`   Expected emotion: ${test.expectedEmotion}`);

      try {
        const response = await fetch(`${BASE_URL}/ai/adaptive-chat`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: test.message,
            stream: false
          })
        });

        if (response.ok) {
          console.log(`   ✅ Chat sent successfully`);
        } else {
          console.log(`   ❌ Chat failed: ${response.status}`);
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }

      // Wait between messages to see individual updates
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Keep listening for a bit more
    console.log('\n🎧 Listening for additional updates...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    socket.disconnect();
    console.log('✅ Test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testNuminaSenses().then(() => process.exit(0));