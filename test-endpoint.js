// Quick test of UBPM endpoint with real data
import mongoose from 'mongoose';
import UserBehaviorProfile from './src/models/UserBehaviorProfile.js';
import User from './src/models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function testUBPMEndpoint() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const user = await User.findOne({ email: 'numinaworks@gmail.com' });
    const profile = await UserBehaviorProfile.findOne({ userId: user._id });
    
    // Simulate what the UBPM endpoint should return
    const behavioralPatterns = profile.behaviorPatterns.filter(p => p.type === 'communication');
    const emotionalPatterns = profile.behaviorPatterns.filter(p => p.type === 'emotional');
    const personalityTraits = profile.personalityTraits || [];
    
    const behavioralContext = {
      communicationStyle: behavioralPatterns.length > 0 ? 
        behavioralPatterns[0].pattern.replace('_', ' ') : 'analyzing',
      detectedPatterns: behavioralPatterns.map(p => p.pattern),
      confidence: behavioralPatterns.length > 0 ? behavioralPatterns[0].confidence : 0.1
    };

    const emotionalContext = {
      emotionalPatterns: emotionalPatterns.map(p => ({
        pattern: p.pattern,
        description: p.description,
        confidence: p.confidence
      }))
    };

    // UBPM patterns with confidence >= 0.6
    const ubpmTypes = ['communication', 'emotional', 'temporal', 'contextual'];
    const realUBPMPatterns = profile.behaviorPatterns.filter(p => 
      p.confidence >= 0.6 && ubpmTypes.includes(p.type)
    );
    
    const overallConfidence = realUBPMPatterns.length > 0 ? 
      realUBPMPatterns.reduce((sum, p) => sum + p.confidence, 0) / realUBPMPatterns.length : 0.1;

    const ubpmResponse = {
      success: true,
      data: {
        userId: user._id,
        behavioralContext,
        emotionalContext,
        personalityTraits,
        confidence: overallConfidence,
        dataPoints: realUBPMPatterns.length,
        dataQuality: profile.dataQuality,
        lastUpdated: profile.updatedAt
      }
    };

    console.log('🎯 EXPECTED UBPM RESPONSE:');
    console.log('==========================');
    console.log(JSON.stringify(ubpmResponse, null, 2));
    
    console.log('\n📊 KEY METRICS FOR MOBILE APP:');
    console.log(`Profile Confidence: ${Math.round(overallConfidence * 100)}%`);
    console.log(`Behavioral Patterns: ${behavioralContext.detectedPatterns.length}`);
    console.log(`Communication Style: ${behavioralContext.communicationStyle}`);
    console.log(`Emotional Patterns: ${emotionalContext.emotionalPatterns.length}`);
    console.log(`Personality Traits: ${personalityTraits.length}`);
    console.log(`Data Points: ${realUBPMPatterns.length}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
}

testUBPMEndpoint();