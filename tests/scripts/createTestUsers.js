import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import CollectiveDataConsent from '../src/models/CollectiveDataConsent.js';
import logger from '../src/utils/logger.js';

dotenv.config();

// Test user data with diverse emotional logs
const testUsers = [
  {
    email: 'testuser1@example.com',
    password: 'testpass123',
    emotions: [
      { emotion: 'happy', intensity: 8, context: 'work accomplishment' },
      { emotion: 'excited', intensity: 7, context: 'weekend plans' },
      { emotion: 'content', intensity: 6, context: 'morning routine' },
      { emotion: 'grateful', intensity: 9, context: 'family time' },
      { emotion: 'energetic', intensity: 8, context: 'after exercise' }
    ]
  },
  {
    email: 'testuser2@example.com',
    password: 'testpass123',
    emotions: [
      { emotion: 'calm', intensity: 7, context: 'meditation' },
      { emotion: 'focused', intensity: 8, context: 'deep work' },
      { emotion: 'hopeful', intensity: 6, context: 'new project' },
      { emotion: 'relaxed', intensity: 7, context: 'weekend morning' },
      { emotion: 'inspired', intensity: 9, context: 'reading book' }
    ]
  },
  {
    email: 'testuser3@example.com',
    password: 'testpass123',
    emotions: [
      { emotion: 'curious', intensity: 7, context: 'learning new skill' },
      { emotion: 'determined', intensity: 8, context: 'personal goal' },
      { emotion: 'satisfied', intensity: 6, context: 'completed task' },
      { emotion: 'optimistic', intensity: 7, context: 'future plans' },
      { emotion: 'peaceful', intensity: 8, context: 'nature walk' }
    ]
  },
  {
    email: 'testuser4@example.com',
    password: 'testpass123',
    emotions: [
      { emotion: 'motivated', intensity: 9, context: 'career growth' },
      { emotion: 'creative', intensity: 8, context: 'art project' },
      { emotion: 'confident', intensity: 7, context: 'presentation' },
      { emotion: 'joyful', intensity: 9, context: 'celebration' },
      { emotion: 'thoughtful', intensity: 6, context: 'reflection' }
    ]
  },
  {
    email: 'testuser5@example.com',
    password: 'testpass123',
    emotions: [
      { emotion: 'adventurous', intensity: 8, context: 'travel planning' },
      { emotion: 'amazed', intensity: 9, context: 'nature documentary' },
      { emotion: 'appreciative', intensity: 7, context: 'good meal' },
      { emotion: 'refreshed', intensity: 8, context: 'morning coffee' },
      { emotion: 'connected', intensity: 9, context: 'friend conversation' }
    ]
  },
  {
    email: 'testuser6@example.com',
    password: 'testpass123',
    emotions: [
      { emotion: 'proud', intensity: 8, context: 'personal achievement' },
      { emotion: 'amused', intensity: 7, context: 'funny video' },
      { emotion: 'nostalgic', intensity: 6, context: 'old photos' },
      { emotion: 'wonder', intensity: 9, context: 'stargazing' },
      { emotion: 'serene', intensity: 8, context: 'garden time' }
    ]
  }
];

async function createTestUsers() {
  try {
    logger.info('Starting test user creation...');

    for (const userData of testUsers) {
      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        logger.info(`User ${userData.email} already exists, skipping...`);
        continue;
      }

      // Create user with emotional log
      const user = new User({
        email: userData.email,
        password: userData.password,
        emotionalLog: userData.emotions.map(emotion => ({
          ...emotion,
          timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Random timestamp within last 30 days
        }))
      });

      await user.save();
      logger.info(`Created user: ${userData.email}`);

      // Create consent record
      const consent = new CollectiveDataConsent({
        userId: user._id,
        consentStatus: 'granted',
        dataTypes: {
          emotions: true,
          intensity: true,
          context: true,
          demographics: true,
          activityPatterns: true
        },
        consentDate: new Date(),
        consentVersion: '1.0',
        ipAddress: '127.0.0.1',
        userAgent: 'TestScript/1.0',
        notes: 'Test user with full consent'
      });

      await consent.save();
      logger.info(`Created consent for user: ${userData.email}`);
    }

    logger.info('Test user creation completed successfully!');

    // Show summary
    const totalUsers = await User.countDocuments();
    const totalConsents = await CollectiveDataConsent.countDocuments({ consentStatus: 'granted' });

    logger.info(`Summary: ${totalUsers} total users, ${totalConsents} users with consent`);
  } catch (error) {
    logger.error('Error creating test users:', error);
    throw error;
  }
}

// Connect to database and run
async function run() {
  try {
    // Use the same connection string as the main app
    const mongoUri =
      process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/numina-dev';
    await mongoose.connect(mongoUri);
    logger.info('Connected to database');

    await createTestUsers();

    await mongoose.disconnect();
    logger.info('Disconnected from database');
  } catch (error) {
    logger.error('Script failed:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}

export { createTestUsers };
