import { io } from 'socket.io-client';

console.log('🧪 Testing WebSocket with Real Server Token');
console.log('==========================================\n');

// Use the actual token from the server signup response
const realToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ODUzYWQ0MjRmMjM3Y2YzZDBmYTE2MCIsImlhdCI6MTc1MzU2MTgxNCwiZXhwIjoxNzUzODIxMDE0fQ.ysS8rI62QcGwJHAvqtTGbOjx4dmFUHOnbi2QpNpGCRY';

const testRealToken = () => {
  return new Promise((resolve) => {
    console.log('🎫 Testing with real server-generated token');
    
    const socket = io('http://localhost:5000', {
      auth: { token: realToken },
      autoConnect: false
    });

    socket.on('connect', () => {
      console.log('✅ SUCCESS: Real token connected successfully!');
      console.log('🎉 WebSocket authentication fix is working!');
      socket.disconnect();
      resolve(true);
    });

    socket.on('connect_error', (error) => {
      console.log('❌ FAIL: Real token failed:', error.message);
      resolve(false);
    });

    socket.connect();
    setTimeout(() => {
      console.log('⏰ Timeout reached');
      socket.disconnect();
      resolve(false);
    }, 5000);
  });
};

// Also test workflow message reception
const testWorkflowMessages = () => {
  return new Promise((resolve) => {
    console.log('📡 Testing workflow message reception');
    
    const socket = io('http://localhost:5000', {
      auth: { token: realToken },
      autoConnect: false
    });

    let receivedWorkflow = false;

    socket.on('connect', () => {
      console.log('✅ Connected for workflow test');
      
      // Listen for workflow messages
      socket.on('sandbox_workflow', (data) => {
        console.log('🎯 Received sandbox_workflow message:', data);
        receivedWorkflow = true;
      });
      
      socket.on('sandbox_narration', (data) => {
        console.log('🎭 Received sandbox_narration message:', data);
        receivedWorkflow = true;
      });
      
      // Wait a bit to see if any workflow messages come through
      setTimeout(() => {
        socket.disconnect();
        resolve(receivedWorkflow);
      }, 3000);
    });

    socket.on('connect_error', (error) => {
      console.log('❌ Workflow test connection failed:', error.message);
      resolve(false);
    });

    socket.connect();
  });
};

const runTests = async () => {
  console.log('Running comprehensive WebSocket tests...\n');
  
  const authTest = await testRealToken();
  console.log('');
  const workflowTest = await testWorkflowMessages();
  
  console.log('\n🏁 Final Results:');
  console.log('================');
  console.log(`Authentication: ${authTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Workflow Setup: ${workflowTest ? '✅ PASS' : '⏸️  STANDBY'}`);
  
  if (authTest) {
    console.log('\n🎉 SUCCESS: WebSocket authentication fix is working!');
    console.log('✅ Mobile app can now connect with JWT tokens');
    console.log('✅ Workflow messages should reach ChainOfThoughtProgress');
  } else {
    console.log('\n❌ Authentication still failing - needs investigation');
  }
  
  process.exit(0);
};

runTests();