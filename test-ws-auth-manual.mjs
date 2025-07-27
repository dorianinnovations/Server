import { io } from 'socket.io-client';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

console.log('🧪 Testing WebSocket Authentication Fix');
console.log('=====================================\n');

// Test 1: Token with 'id' field (mobile app format)
const testMobileFormat = () => {
  return new Promise((resolve) => {
    console.log('📱 Test 1: Mobile app token format (id field)');
    const token = jwt.sign({ id: '68853ad424f237cf3d0fa160' }, JWT_SECRET, { expiresIn: '1h' });
    
    const socket = io('http://localhost:5000', {
      auth: { token },
      autoConnect: false
    });

    socket.on('connect', () => {
      console.log('✅ PASS: Mobile format connected successfully');
      socket.disconnect();
      resolve(true);
    });

    socket.on('connect_error', (error) => {
      console.log('❌ FAIL: Mobile format failed:', error.message);
      resolve(false);
    });

    socket.connect();
    setTimeout(() => {
      socket.disconnect();
      resolve(false);
    }, 5000);
  });
};

// Test 2: Token with 'userId' field (legacy format)
const testLegacyFormat = () => {
  return new Promise((resolve) => {
    console.log('🏛️  Test 2: Legacy token format (userId field)');
    const token = jwt.sign({ userId: '68853ad424f237cf3d0fa160' }, JWT_SECRET, { expiresIn: '1h' });
    
    const socket = io('http://localhost:5000', {
      auth: { token },
      autoConnect: false
    });

    socket.on('connect', () => {
      console.log('✅ PASS: Legacy format connected successfully');
      socket.disconnect();
      resolve(true);
    });

    socket.on('connect_error', (error) => {
      console.log('❌ FAIL: Legacy format failed:', error.message);
      resolve(false);
    });

    socket.connect();
    setTimeout(() => {
      socket.disconnect();
      resolve(false);
    }, 5000);
  });
};

// Test 3: No token (should fail)
const testNoToken = () => {
  return new Promise((resolve) => {
    console.log('🚫 Test 3: No token (should fail)');
    
    const socket = io('http://localhost:5000', {
      autoConnect: false
    });

    socket.on('connect', () => {
      console.log('❌ FAIL: No token connected (should have failed)');
      socket.disconnect();
      resolve(false);
    });

    socket.on('connect_error', (error) => {
      console.log('✅ PASS: No token correctly rejected:', error.message);
      resolve(true);
    });

    socket.connect();
    setTimeout(() => {
      socket.disconnect();
      resolve(true);
    }, 5000);
  });
};

// Run all tests
const runTests = async () => {
  const results = [];
  
  results.push(await testMobileFormat());
  console.log('');
  results.push(await testLegacyFormat());
  console.log('');
  results.push(await testNoToken());
  
  console.log('\n🏁 Test Results:');
  console.log('================');
  console.log(`Mobile format:  ${results[0] ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Legacy format:  ${results[1] ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`No token:       ${results[2] ? '✅ PASS' : '❌ FAIL'}`);
  
  const passed = results.filter(r => r).length;
  console.log(`\n📊 Summary: ${passed}/3 tests passed`);
  
  if (passed === 3) {
    console.log('🎉 All WebSocket authentication tests PASSED!');
    console.log('✅ The JWT token compatibility fix is working correctly');
  } else {
    console.log('⚠️  Some tests failed - check server logs');
  }
  
  process.exit(0);
};

runTests();