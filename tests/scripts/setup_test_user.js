import User from './src/models/User.js';
import CreditPool from './src/models/CreditPool.js';
import mongoose from 'mongoose';

// Connect to database
mongoose.connect('mongodb://localhost:27017/numina');

const setupTestUser = async () => {
  try {
    // Find the test user
    const user = await User.findOne({ email: 'test@example.com' });
    if (!user) {
      console.log('❌ Test user not found. Please run signup first.');
      return;
    }

    console.log('✓ Found test user:', user.email);

    // Find or create credit pool
    let creditPool = await CreditPool.findOne({ userId: user._id });

    if (!creditPool) {
      creditPool = new CreditPool({
        userId: user._id,
        balance: 0,
        isActive: true,
        isVerified: true // Set to true for testing
      });
      await creditPool.save();
      console.log('✓ Created credit pool for test user');
    } else {
      // Update existing credit pool to be verified
      creditPool.isActive = true;
      creditPool.isVerified = true;
      await creditPool.save();
      console.log('✓ Updated credit pool for test user - verified and active');
    }

    console.log('✓ Test user setup complete');
    console.log('  - User ID:', user._id);
    console.log('  - Credit Pool Balance:', creditPool.balance);
    console.log('  - Is Active:', creditPool.isActive);
    console.log('  - Is Verified:', creditPool.isVerified);
  } catch (error) {
    console.error('❌ Error setting up test user:', error);
  } finally {
    mongoose.disconnect();
  }
};

setupTestUser();
