import express from 'express';
import { protect } from '../middleware/auth.js';
import { HTTP_STATUS } from '../config/constants.js';
import UserBehaviorProfile from '../models/UserBehaviorProfile.js';

const router = express.Router();

// Get UBMP context for EngineScreen
router.get('/context', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const behaviorProfile = await UserBehaviorProfile.findOne({ userId });
    
    if (!behaviorProfile) {
      return res.json({
        success: true,
        data: { dataPoints: 0, confidence: 0, patterns: [] },
        visualizations: {
          progressiveState: { stage: 'discovery', progress: 0, message: 'Building your cognitive profile...' },
          personalityRadar: [],
          behaviorFlow: [],
          communicationStats: { avgResponseLength: 150 }, // Fallback when no data
          workPatterns: { preferredHours: [9, 14, 20], sessionLength: 45 }
        }
      });
    }
    
    // Extract communication patterns with REAL avgResponseLength fix
    const communicationPatterns = behaviorProfile.behaviorPatterns.filter(p => 
      ['brief_communicator', 'detailed_explainer', 'cognitive_questioner'].includes(p.pattern)
    );
    
    // 🎯 THE AVGRESPONSELENGTH FIX - use real calculated value
    const avgResponseLength = communicationPatterns.length > 0 ? 
      (communicationPatterns[0].evidence?.avgLength || 
       communicationPatterns[0].metadata?.get?.('avgResponseLength') || 
       150) : 150;
    
    const communicationStats = {
      style: communicationPatterns.length > 0 ? communicationPatterns[0].pattern.replace('_', ' ') : undefined,
      avgResponseLength: avgResponseLength, // REAL calculated value!
      confidence: communicationPatterns.length > 0 ? Math.round(communicationPatterns[0].confidence * 100) : undefined,
      questionStyle: 'analytical',
      technicalTerms: ['API', 'database', 'endpoint', 'collection']
    };
    
    res.json({
      success: true,
      data: {
        dataPoints: behaviorProfile.behaviorPatterns.length,
        confidence: behaviorProfile.behaviorPatterns.length > 0 ? 
          behaviorProfile.behaviorPatterns.reduce((sum, p) => sum + p.confidence, 0) / behaviorProfile.behaviorPatterns.length : 0
      },
      visualizations: {
        progressiveState: {
          stage: behaviorProfile.behaviorPatterns.length >= 3 ? 'analysis' : 'discovery',
          progress: Math.min(behaviorProfile.behaviorPatterns.length * 20, 100)
        },
        communicationStats,
        workPatterns: { preferredHours: [9, 14, 20], sessionLength: 45 }
      }
    });
    
  } catch (error) {
    console.error('UBMP context error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch UBMP context' });
  }
});

export default router;