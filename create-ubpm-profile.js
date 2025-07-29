// Create realistic UBPM profile for numinaworks@gmail.com for testing
import mongoose from 'mongoose';
import UserBehaviorProfile from './src/models/UserBehaviorProfile.js';
import User from './src/models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function createUBPMProfile() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const user = await User.findOne({ email: 'numinaworks@gmail.com' });
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log(`✅ Found user: ${user.email}, ID: ${user._id}`);

    // Create realistic behavioral patterns based on what other users have
    const behaviorPatterns = [
      {
        _id: new mongoose.Types.ObjectId(),
        type: 'communication',
        pattern: 'analytical_communicator',
        description: 'Prefers detailed, structured responses with clear reasoning',
        confidence: 0.85,
        frequency: 12,
        metadata: new Map([
          ['interactions', 15],
          ['avgResponseLength', 150],
          ['technicalTerms', ['API', 'database', 'endpoint', 'collection']],
          ['questionStyle', 'investigative'],
          ['timeOfDay', 'evening'],
          ['dayOfWeek', ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']]
        ]),
        lastObserved: new Date()
      },
      {
        _id: new mongoose.Types.ObjectId(),
        type: 'emotional',
        pattern: 'focused_determination',
        description: 'Shows persistence and methodical approach to problem-solving',
        confidence: 0.72,
        frequency: 8,
        metadata: new Map([
          ['followUpQuestions', 6],
          ['debuggingPatterns', ['check logs', 'verify data', 'test endpoint']],
          ['emotionalMarkers', ['let me check', 'I want to understand', 'that\'s interesting']],
          ['timeOfDay', 'evening'],
          ['sessionLength', 'extended']
        ]),
        lastObserved: new Date()
      },
      {
        _id: new mongoose.Types.ObjectId(),
        type: 'temporal',
        pattern: 'deep_work_sessions',
        description: 'Engages in extended problem-solving sessions with sustained focus',
        confidence: 0.78,
        frequency: 5,
        metadata: new Map([
          ['avgSessionLength', 45],
          ['messagesPerSession', 12],
          ['topicPersistence', 'high'],
          ['breakPatterns', ['short breaks', 'context switching']],
          ['preferredHours', [19, 20, 21, 22]],
          ['sessionDuration', 'long']
        ]),
        lastObserved: new Date()
      },
      {
        _id: new mongoose.Types.ObjectId(),
        type: 'contextual',
        pattern: 'systematic_validator',
        description: 'Validates solutions through multiple testing approaches',
        confidence: 0.68,
        frequency: 7,
        metadata: new Map([
          ['testingMethods', ['direct queries', 'API testing', 'data verification']],
          ['validationSteps', 3],
          ['errorHandling', 'thorough'],
          ['decisionSpeed', 'methodical'],
          ['verificationLevel', 'high']
        ]),
        lastObserved: new Date()
      }
    ];

    // Create personality traits based on behavioral patterns (using valid enum values)
    const personalityTraits = [
      { trait: 'analytical', score: 0.88, confidence: 0.85 },
      { trait: 'conscientiousness', score: 0.82, confidence: 0.78 },
      { trait: 'openness', score: 0.79, confidence: 0.72 },
      { trait: 'curiosity', score: 0.84, confidence: 0.80 },
      { trait: 'resilience', score: 0.75, confidence: 0.68 }
    ];

    const profile = new UserBehaviorProfile({
      userId: user._id,
      behaviorPatterns,
      personalityTraits,
      dataQuality: {
        completeness: 0.82,
        freshness: 0.91,
        reliability: 0.78
      },
      lastAnalysisDate: new Date(),
      version: '1.0.0'
    });

    await profile.save();
    console.log('✅ Created UserBehaviorProfile with realistic patterns');
    console.log(`📊 Patterns: ${behaviorPatterns.length}`);
    console.log(`🧠 Personality traits: ${personalityTraits.length}`);
    console.log(`🎯 Overall confidence: ${Math.round(behaviorPatterns.reduce((sum, p) => sum + p.confidence, 0) / behaviorPatterns.length * 100)}%`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
}

createUBPMProfile();