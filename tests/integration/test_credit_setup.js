import axios from 'axios';

const API_BASE = 'http://localhost:5000';

const testCreditPoolSetup = async () => {
  try {
    // Step 1: Login to get token
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post(`${API_BASE}/login`, {
      email: 'test@example.com',
      password: 'testpassword'
    });

    const authToken = loginResponse.data.token;
    console.log('✓ Authentication successful');

    // Step 2: Setup Stripe customer
    console.log('\n📋 Setting up Stripe customer...');
    const stripeResponse = await axios.post(
      `${API_BASE}/tools/execute`,
      {
        toolName: 'credit_management',
        arguments: {
          action: 'setup_stripe_customer'
        }
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    if (stripeResponse.data.success) {
      console.log('✓ Stripe customer setup:', stripeResponse.data.result.result.message);
    } else {
      console.log('⚠️ Stripe setup issue:', stripeResponse.data.error);
    }

    // Step 3: Add funds via Stripe
    console.log('\n💰 Adding funds via Stripe...');
    const fundsResponse = await axios.post(
      `${API_BASE}/tools/execute`,
      {
        toolName: 'credit_management',
        arguments: {
          action: 'add_funds_stripe',
          amount: 100.0,
          paymentMethodId: 'pm_test_card_visa'
        }
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    if (fundsResponse.data.success) {
      console.log('✓ Funds added successfully');
      console.log('  New Balance:', fundsResponse.data.result.result.newBalance);
    } else {
      console.log('⚠️ Funds addition issue:', fundsResponse.data.error);
    }

    // Step 4: Check balance
    console.log('\n🏦 Checking balance...');
    const balanceResponse = await axios.post(
      `${API_BASE}/tools/execute`,
      {
        toolName: 'credit_management',
        arguments: {
          action: 'check_balance'
        }
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    if (balanceResponse.data.success) {
      console.log('✓ Balance check successful');
      console.log('  Balance:', balanceResponse.data.result.result.balance);
      console.log('  Is Active:', balanceResponse.data.result.result.isActive);
      console.log('  Is Verified:', balanceResponse.data.result.result.isVerified);
    } else {
      console.log('⚠️ Balance check issue:', balanceResponse.data.error);
    }

    console.log('\n🎉 Credit pool setup complete!');
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
    }
  }
};

testCreditPoolSetup();
