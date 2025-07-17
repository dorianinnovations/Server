import { io } from 'socket.io-client';
import jwt from 'jsonwebtoken';

// Test WebSocket functionality with multiple simulated users
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const testUsers = [
  { id: '507f1f77bcf86cd799439011', username: 'Alice' },
  { id: '507f1f77bcf86cd799439012', username: 'Bob' },
  { id: '507f1f77bcf86cd799439013', username: 'Charlie' }
];

const emotions = ['happy', 'excited', 'calm', 'anxious', 'grateful', 'tired'];
const shareTypes = ['check_in', 'support_request', 'celebration'];

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
}

function createTestSocket(user) {
  const token = generateToken(user.id);
  const socket = io('http://localhost:5000', {
    auth: { token }
  });

  socket.on('connect', () => {
    console.log(`✅ ${user.username} connected`);
  });

  socket.on('connected', data => {
    console.log(`📱 ${user.username} received connection confirmation:`, data.message);
  });

  socket.on('emotional_share_received', data => {
    console.log(
      `💝 ${user.username} received emotional share from ${data.fromUser.username}: ${data.emotion} (${data.intensity}/10)`
    );
    if (data.message) {
      console.log(`   Message: "${data.message}"`);
    }
  });

  socket.on('emotional_share_sent', data => {
    console.log(`📤 ${user.username} confirmed share sent: ${data.emotion}`);
  });

  socket.on('support_request', data => {
    console.log(`🆘 ${user.username} saw support request: intensity ${data.intensity}/10`);
    if (data.context) {
      console.log(`   Context: "${data.context}"`);
    }
  });

  socket.on('support_request_sent', data => {
    console.log(`✉️ ${user.username} support request sent: ${data.message}`);
  });

  socket.on('milestone_achieved', data => {
    console.log(`🎉 Community saw ${data.userData.username} achieved: ${data.title}`);
  });

  socket.on('milestone_celebrated', data => {
    console.log(`🏆 ${user.username} milestone celebration: ${data.message}`);
  });

  socket.on('disconnect', () => {
    console.log(`❌ ${user.username} disconnected`);
  });

  return socket;
}

async function runTests() {
  console.log('🧪 Starting WebSocket tests...\n');

  // Create connections for all test users
  const sockets = testUsers.map(user => ({
    user,
    socket: createTestSocket(user)
  }));

  // Wait for connections
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n🎯 Testing emotional sharing...');

  // Test 1: Alice shares emotion with Bob
  setTimeout(() => {
    sockets[0].socket.emit('share_emotional_state', {
      targetUserId: testUsers[1].id,
      emotion: 'excited',
      intensity: 8,
      message: 'Just got promoted at work!',
      shareType: 'celebration'
    });
  }, 1000);

  // Test 2: Bob requests support
  setTimeout(() => {
    sockets[1].socket.emit('request_support', {
      intensity: 7,
      context: 'Having a stressful day at work',
      anonymous: false
    });
  }, 3000);

  // Test 3: Charlie celebrates milestone
  setTimeout(() => {
    sockets[2].socket.emit('celebrate_milestone', {
      milestoneId: 'week_warrior',
      title: '7 Day Consistency Streak!',
      shareWithCommunity: true
    });
  }, 5000);

  // Test 4: Cross-sharing between all users
  setTimeout(() => {
    console.log('\n🔄 Testing cross-user interactions...');

    sockets.forEach((sender, index) => {
      const targetIndex = (index + 1) % sockets.length;
      const emotion = emotions[Math.floor(Math.random() * emotions.length)];

      sender.socket.emit('share_emotional_state', {
        targetUserId: testUsers[targetIndex].id,
        emotion: emotion,
        intensity: Math.floor(Math.random() * 5) + 6, // 6-10
        shareType: shareTypes[Math.floor(Math.random() * shareTypes.length)]
      });
    });
  }, 7000);

  // Test 5: Join support network (simulate moderators)
  setTimeout(() => {
    console.log('\n🛡️ Testing support network...');
    sockets[0].socket.emit('join', 'support_network');
    sockets[1].socket.emit('join', 'community_celebrations');
  }, 9000);

  // Test 6: Anonymous support request
  setTimeout(() => {
    sockets[2].socket.emit('request_support', {
      intensity: 9,
      context: 'Really struggling today, could use some encouragement',
      anonymous: true
    });
  }, 11000);

  // Clean up after tests
  setTimeout(() => {
    console.log('\n🧹 Cleaning up connections...');
    sockets.forEach(({ socket }) => socket.disconnect());

    setTimeout(() => {
      console.log('\n✅ WebSocket tests completed!');
      process.exit(0);
    }, 1000);
  }, 15000);
}

// Error handling
process.on('unhandledRejection', error => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', error => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

console.log('🚀 Starting WebSocket test suite...');
console.log('Make sure your server is running on http://localhost:5000\n');

runTests();
