// Copy numinaworks behavioral profile to test user
import mongoose from 'mongoose';
import UserBehaviorProfile from './src/models/UserBehaviorProfile.js';
import dotenv from 'dotenv';

dotenv.config();

async function copyProfile() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Get numinaworks profile
    const numinaProfile = await UserBehaviorProfile.findOne({ userId: '68854f56daac2491888de03c' });
    
    if (!numinaProfile) {
      console.log('❌ No numinaworks profile found');
      return;
    }
    
    // Copy to test user
    const testProfile = new UserBehaviorProfile({
      ...numinaProfile.toObject(),
      _id: undefined, // Let MongoDB generate new ID
      userId: '68891f60a2735b148ff15f90', // Test user ID
    });
    
    await testProfile.save();
    console.log('✅ Copied behavioral profile to test user');
    console.log(`📊 Patterns: ${testProfile.behaviorPatterns.length}`);
    console.log(`🧠 Personality traits: ${testProfile.personalityTraits.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
}

copyProfile();