import axios from 'axios';

const API_BASE = 'http://localhost:5000';

const verifyTestUser = async () => {
  try {
    // Step 1: Login to get token
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post(`${API_BASE}/login`, {
      email: 'test@example.com',
      password: 'testpassword'
    });
    
    const authToken = loginResponse.data.token;
    console.log('✓ Authentication successful');
    
    // Step 2: Directly update the credit pool via a direct API call
    console.log('\n⚡ Manually verifying credit pool...');
    
    // We'll simulate what a verified credit pool should look like
    // by adding sufficient funds and marking it as verified
    
    const verifyResponse = await axios.post(`${API_BASE}/tools/execute`, {
      toolName: 'credit_management',
      arguments: {
        action: 'add_funds_stripe',
        amount: 100.00,
        paymentMethodId: 'pm_test_card_visa'
      }
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('Verify response:', JSON.stringify(verifyResponse.data, null, 2));
    
    // Check balance again
    const balanceResponse = await axios.post(`${API_BASE}/tools/execute`, {
      toolName: 'credit_management',
      arguments: {
        action: 'check_balance'
      }
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('Balance response:', JSON.stringify(balanceResponse.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
};

verifyTestUser();