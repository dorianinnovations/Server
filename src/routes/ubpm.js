import express from 'express';
import { protect } from '../middleware/auth.js';
import { HTTP_STATUS } from '../config/constants.js';
import ubpmService from '../services/ubpmService.js';
import UserBehaviorProfile from '../models/UserBehaviorProfile.js';

const router = express.Router();

/**
 * Get UBPM context for testing/development
 */
router.get('/context', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get real UBPM profile from database
    const behaviorProfile = await UserBehaviorProfile.findOne({ userId });
    
    if (!behaviorProfile) {
      // User has no behavioral data yet - return minimal context
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

    // Extract real behavioral patterns
    const communicationPatterns = behaviorProfile.behaviorPatterns.filter(p => p.type === 'communication');
    const emotionalPatterns = behaviorProfile.behaviorPatterns.filter(p => p.type === 'emotional');
    const temporalPatterns = behaviorProfile.behaviorPatterns.filter(p => p.type === 'temporal');
    
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

    const temporalContext = {
      patterns: temporalPatterns.map(p => ({
        pattern: p.pattern,
        evidence: p.evidence || {}
      })),
      consistency: behaviorProfile.dataQuality?.freshness || 0.5
    };

    // FIXED: Only count UBPM patterns, not personalization engine patterns
    // UBPM patterns have higher confidence (0.6+) and specific types
    const realUBPMPatterns = behaviorProfile.behaviorPatterns.filter(p => 
      p.confidence >= 0.6 && 
      ['communication', 'emotional', 'temporal', 'decision_making', 'stress_response'].includes(p.type)
    );
    
    const overallConfidence = realUBPMPatterns.length > 0 ? 
      realUBPMPatterns.reduce((sum, p) => sum + p.confidence, 0) / realUBPMPatterns.length : 0.1;

    const ubpmContext = {
      userId,
      behavioralContext,
      emotionalContext,
      temporalContext,
      personalityTraits: behaviorProfile.personalityTraits || [],
      confidence: overallConfidence,
      dataPoints: realUBPMPatterns.length, // Only real UBPM patterns
      dataQuality: behaviorProfile.dataQuality,
      lastUpdated: behaviorProfile.lastAnalysisDate || new Date().toISOString(),
      note: realUBPMPatterns.length === 0 ? 'UBPM analysis requires 5+ interactions for pattern detection' : undefined
    };

    res.json({
      success: true,
      data: ubpmContext
    });

  } catch (error) {
    console.error('Error fetching UBPM context:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to fetch UBMP context'
    });
  }
});

export default router;