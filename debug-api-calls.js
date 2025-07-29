// Debug what API calls are actually being made
import express from 'express';
import cors from 'cors';
import { protect } from './src/middleware/auth.js';
import UserBehaviorProfile from './src/models/UserBehaviorProfile.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

await mongoose.connect(process.env.MONGO_URI);
console.log('Connected to MongoDB');

// Debug middleware to log all requests
app.use('/test-ubpm/context', (req, res, next) => {
  console.log('\n🔥 UBPM API CALL RECEIVED:');
  console.log('Method:', req.method);
  console.log('Headers:', {
    authorization: req.headers.authorization ? 'Bearer [PRESENT]' : 'NO TOKEN',
    'user-agent': req.headers['user-agent']
  });
  console.log('Time:', new Date().toISOString());
  next();
});

// The actual UBPM endpoint with enhanced debugging
app.get('/test-ubpm/context', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`\n👤 Authenticated User: ${req.user.email} (${userId})`);
    
    // Get real UBPM profile from database
    const behaviorProfile = await UserBehaviorProfile.findOne({ userId });
    console.log(`📊 Found profile: ${behaviorProfile ? 'YES' : 'NO'}`);
    
    if (!behaviorProfile) {
      console.log('❌ No profile found - returning building_profile state');
      return res.json({
        success: true,
        data: {
          userId,
          status: 'building_profile',
          message: 'Behavioral analysis requires more interactions',
          confidence: 0.1,
          dataPoints: 0,
          lastUpdated: new Date().toISOString()
        }
      });
    }

    console.log(`✅ Profile found with ${behaviorProfile.behaviorPatterns.length} patterns`);
    
    // Extract real behavioral patterns
    const communicationPatterns = behaviorProfile.behaviorPatterns.filter(p => p.type === 'communication');
    const emotionalPatterns = behaviorProfile.behaviorPatterns.filter(p => p.type === 'emotional');
    const temporalPatterns = behaviorProfile.behaviorPatterns.filter(p => p.type === 'temporal');
    
    console.log(`📈 Patterns: ${communicationPatterns.length} comm, ${emotionalPatterns.length} emotional, ${temporalPatterns.length} temporal`);
    
    // Build real behavioral context
    const behavioralContext = {
      communicationStyle: communicationPatterns.length > 0 ? 
        communicationPatterns[0].pattern.replace('_', ' ') : 'analyzing',
      detectedPatterns: communicationPatterns.map(p => p.pattern),
      confidence: communicationPatterns.length > 0 ? communicationPatterns[0].confidence : 0.1
    };

    const emotionalContext = {
      emotionalPatterns: emotionalPatterns.map(p => ({
        pattern: p.pattern,
        description: p.description,
        confidence: p.confidence
      }))
    };

    // FIXED: Only count UBPM patterns, not personalization engine patterns
    const realUBPMPatterns = behaviorProfile.behaviorPatterns.filter(p => 
      p.confidence >= 0.6 && 
      ['communication', 'emotional', 'temporal', 'contextual'].includes(p.type)
    );
    
    const overallConfidence = realUBPMPatterns.length > 0 ? 
      realUBPMPatterns.reduce((sum, p) => sum + p.confidence, 0) / realUBPMPatterns.length : 0.1;

    console.log(`🎯 Confidence: ${Math.round(overallConfidence * 100)}%, Data Points: ${realUBPMPatterns.length}`);

    const ubpmContext = {
      userId,
      behavioralContext,
      emotionalContext,
      personalityTraits: behaviorProfile.personalityTraits || [],
      confidence: overallConfidence,
      dataPoints: realUBPMPatterns.length,
      dataQuality: behaviorProfile.dataQuality,
      lastUpdated: behaviorProfile.lastAnalysisDate || behaviorProfile.updatedAt
    };

    console.log('📤 Sending response with real data');
    res.json({
      success: true,
      data: ubpmContext
    });

  } catch (error) {
    console.error('❌ UBPM Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch UBPM context'
    });
  }
});

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`\n🚀 Debug UBPM server running on http://localhost:${PORT}`);
  console.log('📱 Test with: curl -X GET "http://localhost:5001/test-ubpm/context" -H "Authorization: Bearer YOUR_TOKEN"');
});