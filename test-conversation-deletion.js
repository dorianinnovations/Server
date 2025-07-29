#!/usr/bin/env node

/**
 * Conversation Deletion API Test Suite
 * Tests both single conversation deletion and bulk deletion endpoints
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.TEST_URL || 'http://localhost:5000';

// Test configuration
const TEST_CONFIG = {
  baseUrl: BASE_URL,
  testUser: {
    email: 'test@example.com',
    password: 'testpassword123'
  }
};

class ConversationDeletionTester {
  constructor() {
    this.authToken = null;
    this.testConversations = [];
  }

  async authenticate() {
    console.log('🔐 Authenticating test user...');
    
    try {
      const response = await fetch(`${TEST_CONFIG.baseUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(TEST_CONFIG.testUser)
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status}`);
      }

      const data = await response.json();
      this.authToken = data.access_token || data.token;
      
      if (!this.authToken) {
        throw new Error('No auth token received');
      }

      console.log('✅ Authentication successful');
      return true;
    } catch (error) {
      console.error('❌ Authentication failed:', error.message);
      return false;
    }
  }

  async createTestConversations() {
    console.log('📝 Creating test conversations...');
    
    const conversationTitles = [
      'Test Conversation 1',
      'Test Conversation 2', 
      'Test Conversation 3',
      'Memory Leak Test Chat',
      'Performance Test Conversation'
    ];

    for (const title of conversationTitles) {
      try {
        const response = await fetch(`${TEST_CONFIG.baseUrl}/conversations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken}`
          },
          body: JSON.stringify({ title })
        });

        if (response.ok) {
          const data = await response.json();
          this.testConversations.push(data.data);
          console.log(`✅ Created conversation: ${title}`);
        } else {
          console.log(`⚠️ Failed to create conversation: ${title} (${response.status})`);
        }
      } catch (error) {
        console.error(`❌ Error creating conversation ${title}:`, error.message);
      }
    }

    console.log(`📊 Created ${this.testConversations.length} test conversations`);
  }

  async testSingleConversationDeletion() {
    console.log('\n🗑️ Testing single conversation deletion...');
    
    if (this.testConversations.length === 0) {
      console.log('⚠️ No test conversations available for deletion test');
      return false;
    }

    const conversationToDelete = this.testConversations[0];
    const startTime = Date.now();

    try {
      const response = await fetch(`${TEST_CONFIG.baseUrl}/conversations/${conversationToDelete._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      const duration = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Single conversation deletion successful');
        console.log(`⏱️ Response time: ${duration}ms`);
        console.log('📄 Response:', JSON.stringify(data, null, 2));
        
        // Remove from our test array
        this.testConversations = this.testConversations.filter(
          conv => conv._id !== conversationToDelete._id
        );
        
        return true;
      } else {
        console.log(`❌ Single deletion failed: ${response.status}`);
        const errorData = await response.text();
        console.log('📄 Error response:', errorData);
        return false;
      }
    } catch (error) {
      console.error('❌ Single deletion error:', error.message);
      return false;
    }
  }

  async testBulkConversationDeletion() {
    console.log('\n🗑️ Testing bulk conversation deletion...');
    
    const startTime = Date.now();

    try {
      const response = await fetch(`${TEST_CONFIG.baseUrl}/conversations/all`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      const duration = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Bulk conversation deletion successful');
        console.log(`⏱️ Response time: ${duration}ms`);
        console.log('📄 Response:', JSON.stringify(data, null, 2));
        
        // Verify deletion counts
        if (data.data && data.data.conversationsDeleted !== undefined) {
          console.log(`📊 Conversations deleted: ${data.data.conversationsDeleted}`);
          console.log(`📊 Memory entries deleted: ${data.data.memoryEntriesDeleted}`);
        }
        
        // Clear our test array
        this.testConversations = [];
        
        return true;
      } else {
        console.log(`❌ Bulk deletion failed: ${response.status}`);
        const errorData = await response.text();
        console.log('📄 Error response:', errorData);
        return false;
      }
    } catch (error) {
      console.error('❌ Bulk deletion error:', error.message);
      return false;
    }
  }

  async testMemoryUsage() {
    console.log('\n📊 Testing memory usage during deletions...');
    
    // Create many conversations to test memory pressure
    console.log('📝 Creating many conversations for memory test...');
    
    const promises = [];
    for (let i = 0; i < 50; i++) {
      const promise = fetch(`${TEST_CONFIG.baseUrl}/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({ title: `Memory Test Conversation ${i}` })
      }).catch(err => console.log(`⚠️ Failed to create conversation ${i}`));
      
      promises.push(promise);
    }

    await Promise.all(promises);
    console.log('✅ Created bulk conversations for memory test');

    // Add messages to conversations to increase memory usage
    console.log('💬 Adding messages to conversations...');
    
    const messagePromises = [];
    for (let i = 0; i < 10; i++) {
      const promise = fetch(`${TEST_CONFIG.baseUrl}/conversations/${this.testConversations[0]?._id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({
          role: 'user',
          content: `Test message ${i} with some content to use memory`,
          metadata: { testData: 'x'.repeat(1000) } // Add some bulk data
        })
      }).catch(err => console.log(`⚠️ Failed to add message ${i}`));
      
      messagePromises.push(promise);
    }

    await Promise.all(messagePromises);
    console.log('✅ Added messages to conversations');

    // Now test bulk deletion under memory pressure
    console.log('🗑️ Testing bulk deletion under memory pressure...');
    const memoryTestStart = Date.now();
    
    const deleteResponse = await fetch(`${TEST_CONFIG.baseUrl}/conversations/all`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    });

    const memoryTestDuration = Date.now() - memoryTestStart;
    
    if (deleteResponse.ok) {
      const data = await deleteResponse.json();
      console.log('✅ Memory pressure deletion test successful');
      console.log(`⏱️ Deletion time under load: ${memoryTestDuration}ms`);
      console.log(`📊 Items deleted: ${data.data?.conversationsDeleted || 0}`);
    } else {
      console.log('❌ Memory pressure deletion test failed');
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Conversation Deletion API Tests');
    console.log(`🌐 Testing against: ${TEST_CONFIG.baseUrl}`);
    console.log('=' .repeat(50));

    // Authenticate
    const authSuccess = await this.authenticate();
    if (!authSuccess) {
      console.log('❌ Cannot proceed without authentication');
      return;
    }

    // Create test data
    await this.createTestConversations();

    // Test single deletion
    await this.testSingleConversationDeletion();

    // Test bulk deletion
    await this.testBulkConversationDeletion();

    // Test memory usage
    await this.testMemoryUsage();

    console.log('\n' + '=' .repeat(50));
    console.log('🎉 All conversation deletion tests completed!');
  }
}

// Health check function
async function healthCheck() {
  console.log('🏥 Performing server health check...');
  
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/test`);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Server is healthy');
      console.log('📄 Server info:', JSON.stringify(data, null, 2));
      return true;
    } else {
      console.log(`❌ Server health check failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Server health check error:', error.message);
    return false;
  }
}

// Main execution
async function main() {
  // Check if server is running
  const isHealthy = await healthCheck();
  if (!isHealthy) {
    console.log('❌ Server is not healthy. Please start the server first.');
    process.exit(1);
  }

  // Run tests
  const tester = new ConversationDeletionTester();
  await tester.runAllTests();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
}

export default ConversationDeletionTester;