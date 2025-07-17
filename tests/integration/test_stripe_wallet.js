import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = 'http://localhost:5000';
let authToken = null;

// Test authentication and get token
async function authenticate() {
  try {
    const response = await axios.post(`${API_BASE}/login`, {
      email: 'test@example.com',
      password: 'testpassword'
    });

    if (response.data.token) {
      authToken = response.data.token;
      console.log('✓ Authentication successful');
      return true;
    } else {
      console.log('✗ Authentication failed');
      return false;
    }
  } catch (error) {
    console.log('✗ Authentication error:', error.response?.data?.message || error.message);
    return false;
  }
}

// Test Stripe customer setup
async function testStripeCustomerSetup() {
  try {
    console.log('\n📋 Testing Stripe Customer Setup...');

    const response = await axios.post(
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

    if (response.data.success) {
      console.log('✓ Stripe customer setup successful');
      console.log('Customer ID:', response.data.result.result.customerId);
      return response.data.result.result.customerId;
    } else {
      console.log('✗ Stripe customer setup failed:', response.data.error);
      return null;
    }
  } catch (error) {
    console.log('✗ Stripe customer setup error:', error.response?.data?.error || error.message);
    return null;
  }
}

// Test payment intent creation
async function testPaymentIntentCreation() {
  try {
    console.log('\n💳 Testing Payment Intent Creation...');

    const response = await axios.post(
      `${API_BASE}/tools/execute`,
      {
        toolName: 'credit_management',
        arguments: {
          action: 'create_payment_intent',
          amount: 50.0
        }
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    if (response.data.success) {
      console.log('✓ Payment intent created successfully');
      console.log('Payment Intent ID:', response.data.result.result.paymentIntentId);
      console.log(
        'Client Secret:',
        response.data.result.result.clientSecret ? 'Present' : 'Missing'
      );
      return response.data.result.result;
    } else {
      console.log('✗ Payment intent creation failed:', response.data.error);
      return null;
    }
  } catch (error) {
    console.log('✗ Payment intent creation error:', error.response?.data?.error || error.message);
    return null;
  }
}

// Test adding funds via Stripe (simulated)
async function testAddFundsStripe() {
  try {
    console.log('\n💰 Testing Add Funds via Stripe...');

    const response = await axios.post(
      `${API_BASE}/tools/execute`,
      {
        toolName: 'credit_management',
        arguments: {
          action: 'add_funds_stripe',
          amount: 50.0,
          paymentMethodId: 'pm_test_card_visa'
        }
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    if (response.data.success) {
      console.log('✓ Funds added successfully via Stripe');
      console.log('New Balance:', response.data.result.result.newBalance);
      console.log('Transaction ID:', response.data.result.result.transactionId);
      return response.data.result.result;
    } else {
      console.log('✗ Add funds failed:', response.data.error);
      return null;
    }
  } catch (error) {
    console.log('✗ Add funds error:', error.response?.data?.error || error.message);
    return null;
  }
}

// Test checking balance after funding
async function testCheckBalanceAfterFunding() {
  try {
    console.log('\n🏦 Testing Balance Check After Funding...');

    const response = await axios.post(
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

    if (response.data.success) {
      console.log('✓ Balance check successful');
      console.log('Current Balance:', response.data.result.result.balance);
      console.log('Today Spent:', response.data.result.result.todaySpent);
      console.log('Is Verified:', response.data.result.result.isVerified);
      return response.data.result.result;
    } else {
      console.log('✗ Balance check failed:', response.data.error);
      return null;
    }
  } catch (error) {
    console.log('✗ Balance check error:', error.response?.data?.error || error.message);
    return null;
  }
}

// Test Spotify playlist creation with payment
async function testSpotifyPlaylistWithPayment() {
  try {
    console.log('\n🎵 Testing Spotify Playlist Creation (with payment)...');

    const response = await axios.post(
      `${API_BASE}/tools/execute`,
      {
        toolName: 'spotify_playlist',
        arguments: {
          playlistName: 'My Test Playlist',
          description: 'A test playlist created via Numina',
          mood: 'happy',
          isPublic: false
        }
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    if (response.data.success) {
      console.log('✓ Spotify playlist creation successful');
      console.log('Result:', response.data.result.result);
      return response.data.result.result;
    } else {
      console.log('✗ Spotify playlist creation failed:', response.data.error);
      return null;
    }
  } catch (error) {
    console.log('✗ Spotify playlist creation error:', error.response?.data?.error || error.message);
    return null;
  }
}

// Test restaurant reservation with payment
async function testRestaurantReservationWithPayment() {
  try {
    console.log('\n🍽️ Testing Restaurant Reservation (with payment)...');

    const response = await axios.post(
      `${API_BASE}/tools/execute`,
      {
        toolName: 'reservation_booking',
        arguments: {
          restaurantName: 'The Fine Dining',
          date: '2025-07-20',
          time: '19:00',
          partySize: 2,
          specialRequests: 'Window table preferred'
        }
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    if (response.data.success) {
      console.log('✓ Restaurant reservation successful');
      console.log('Booking ID:', response.data.result.result.bookingId);
      console.log('Confirmation:', response.data.result.result.confirmation);
      return response.data.result.result;
    } else {
      console.log('✗ Restaurant reservation failed:', response.data.error);
      return null;
    }
  } catch (error) {
    console.log('✗ Restaurant reservation error:', error.response?.data?.error || error.message);
    return null;
  }
}

// Test itinerary generation with payment
async function testItineraryGenerationWithPayment() {
  try {
    console.log('\n🗺️ Testing Itinerary Generation (with payment)...');

    const response = await axios.post(
      `${API_BASE}/tools/execute`,
      {
        toolName: 'itinerary_generator',
        arguments: {
          destination: 'New York',
          duration: 3,
          budget: 1000,
          startDate: '2025-08-01',
          interests: ['culture', 'food'],
          includeAccommodation: true,
          includeActivities: true,
          includeRestaurants: true
        }
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    if (response.data.success) {
      console.log('✓ Itinerary generation successful');
      console.log('Total Cost:', response.data.result.result.itinerary.totalCost);
      console.log('Within Budget:', response.data.result.result.itinerary.withinBudget);
      console.log('Days:', response.data.result.result.itinerary.dailySchedule.length);
      return response.data.result.result;
    } else {
      console.log('✗ Itinerary generation failed:', response.data.error);
      return null;
    }
  } catch (error) {
    console.log('✗ Itinerary generation error:', error.response?.data?.error || error.message);
    return null;
  }
}

// Test insufficient funds scenario
async function testInsufficientFunds() {
  try {
    console.log('\n🚫 Testing Insufficient Funds Scenario...');

    // Test spending more than available balance
    const response = await axios.post(
      `${API_BASE}/tools/execute`,
      {
        toolName: 'credit_management',
        arguments: {
          action: 'check_spending',
          amount: 1000 // Amount exceeding expected limit
        }
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    if (response.data.success) {
      console.log('✓ Spending check completed');
      console.log('Can Spend:', response.data.result.result.canSpend);
      console.log('Reasons:', response.data.result.result.reasons);
      return response.data.result.result;
    } else {
      console.log('✗ Spending check failed:', response.data.error);
      return null;
    }
  } catch (error) {
    console.log('✗ Spending check error:', error.response?.data?.error || error.message);
    return null;
  }
}

// Test transaction history
async function testTransactionHistory() {
  try {
    console.log('\n📊 Testing Transaction History...');

    const response = await axios.post(
      `${API_BASE}/tools/execute`,
      {
        toolName: 'credit_management',
        arguments: {
          action: 'get_transactions'
        }
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    if (response.data.success) {
      console.log('✓ Transaction history retrieved');
      console.log('Total Transactions:', response.data.result.result.totalCount);
      console.log('Recent Transactions:', response.data.result.result.transactions.length);
      return response.data.result.result;
    } else {
      console.log('✗ Transaction history failed:', response.data.error);
      return null;
    }
  } catch (error) {
    console.log('✗ Transaction history error:', error.response?.data?.error || error.message);
    return null;
  }
}

// Test final balance check
async function testFinalBalanceCheck() {
  try {
    console.log('\n💳 Final Balance Check...');

    const response = await axios.post(
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

    if (response.data.success) {
      console.log('✓ Final balance check successful');
      console.log('Final Balance:', response.data.result.result.balance);
      console.log('Today Spent:', response.data.result.result.todaySpent);
      console.log('Remaining Daily Limit:', response.data.result.result.remainingDailyLimit);
      return response.data.result.result;
    } else {
      console.log('✗ Final balance check failed:', response.data.error);
      return null;
    }
  } catch (error) {
    console.log('✗ Final balance check error:', error.response?.data?.error || error.message);
    return null;
  }
}

// Run comprehensive test suite
async function runFullTestSuite() {
  console.log('🧪 Starting Comprehensive Stripe Wallet Test Suite...\n');

  // Step 1: Authentication
  const authenticated = await authenticate();
  if (!authenticated) {
    console.log('❌ Cannot continue without authentication');
    return;
  }

  // Step 2: Stripe Customer Setup
  const customerId = await testStripeCustomerSetup();

  // Step 3: Payment Intent Creation
  const paymentIntent = await testPaymentIntentCreation();

  // Step 4: Add Funds via Stripe
  const fundingResult = await testAddFundsStripe();

  // Step 5: Check Balance After Funding
  const balanceAfterFunding = await testCheckBalanceAfterFunding();

  // Step 6: Test Paid Tools
  console.log('\n🔧 Testing Paid Tools...');
  const spotifyResult = await testSpotifyPlaylistWithPayment();
  const reservationResult = await testRestaurantReservationWithPayment();
  const itineraryResult = await testItineraryGenerationWithPayment();

  // Step 7: Test Edge Cases
  console.log('\n⚠️ Testing Edge Cases...');
  const insufficientFundsResult = await testInsufficientFunds();

  // Step 8: Transaction History
  const transactionHistory = await testTransactionHistory();

  // Step 9: Final Balance Check
  const finalBalance = await testFinalBalanceCheck();

  // Summary
  console.log('\n📋 Test Summary:');
  console.log('================');
  console.log('Authentication:', authenticated ? '✓' : '✗');
  console.log('Stripe Customer Setup:', customerId ? '✓' : '✗');
  console.log('Payment Intent Creation:', paymentIntent ? '✓' : '✗');
  console.log('Add Funds via Stripe:', fundingResult ? '✓' : '✗');
  console.log('Spotify Playlist Creation:', spotifyResult ? '✓' : '✗');
  console.log('Restaurant Reservation:', reservationResult ? '✓' : '✗');
  console.log('Itinerary Generation:', itineraryResult ? '✓' : '✗');
  console.log('Insufficient Funds Check:', insufficientFundsResult ? '✓' : '✗');
  console.log('Transaction History:', transactionHistory ? '✓' : '✗');
  console.log('Final Balance Check:', finalBalance ? '✓' : '✗');

  console.log('\n🎉 Test suite completed!');
}

runFullTestSuite().catch(console.error);
