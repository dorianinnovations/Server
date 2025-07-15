import axios from 'axios';

const API_BASE = 'http://localhost:5000';

const setupVerifiedAccount = async () => {
  try {
    // Step 1: Login to get token
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post(`${API_BASE}/login`, {
      email: 'test@example.com',
      password: 'testpassword'
    });
    
    const authToken = loginResponse.data.token;
    console.log('✓ Authentication successful');
    
    // Step 2: Verify the account
    console.log('\n✅ Verifying account...');
    const verifyResponse = await axios.post(`${API_BASE}/tools/execute`, {
      toolName: 'credit_management',
      arguments: {
        action: 'verify_account'
      }
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (verifyResponse.data.success) {
      console.log('✓ Account verified successfully');
    } else {
      console.log('⚠️ Account verification issue:', verifyResponse.data.error);
    }
    
    // Step 3: Add funds
    console.log('\n💰 Adding funds...');
    const fundsResponse = await axios.post(`${API_BASE}/tools/execute`, {
      toolName: 'credit_management',
      arguments: {
        action: 'add_funds_stripe',
        amount: 100.00,
        paymentMethodId: 'pm_test_card_visa'
      }
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (fundsResponse.data.success) {
      console.log('✓ Funds added successfully');
      const balance = fundsResponse.data.result.result.newBalance;
      console.log('  New Balance:', balance);
    } else {
      console.log('⚠️ Funds addition issue:', fundsResponse.data.error);
    }
    
    // Step 4: Final balance check
    console.log('\n🏦 Final balance check...');
    const balanceResponse = await axios.post(`${API_BASE}/tools/execute`, {
      toolName: 'credit_management',
      arguments: {
        action: 'check_balance'
      }
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (balanceResponse.data.success) {
      const result = balanceResponse.data.result.result;
      console.log('✓ Final status:');
      console.log('  Balance:', result.balance);
      console.log('  Is Active:', result.isActive);
      console.log('  Is Verified:', result.isVerified);
      console.log('  Daily Limit Remaining:', result.remainingDailyLimit);
    }
    
    console.log('\n🎉 Account setup complete! Ready for testing.');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
};

setupVerifiedAccount();