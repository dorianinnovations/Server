import express from 'express';
import { protect } from '../middleware/auth.js';
import intelligenceEngine from '../services/intelligenceEngine.js';

const router = express.Router();

/**
 * GET /intelligence-debug/test
 * Test endpoint without auth to verify route loading
 */
router.get('/test', async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Intelligence Debug System Online",
      features: [
        "✅ Intelligence Engine imported successfully",
        "✅ Route registration working",
        "✅ Debug endpoints ready"
      ],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /intelligence-debug/user/:userId
 * Debug endpoint to inspect full intelligence data
 */
router.get('/user/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Generate fresh intelligence analysis
    const intelligenceContext = await intelligenceEngine.generateIntelligenceContext(
      userId, 
      "debug analysis request"
    );
    
    // Detailed data breakdown
    const dataIntegrity = {
      timestamp: new Date().toISOString(),
      userId: userId,
      intelligenceGenerated: !!intelligenceContext,
      
      // Data structure verification
      structure: {
        hasMicro: !!intelligenceContext?.micro,
        hasMedium: !!intelligenceContext?.medium,
        hasMacro: !!intelligenceContext?.macro,
        hasSynthesis: !!intelligenceContext?.synthesis
      },
      
      // Field counts for each analysis level
      fieldCounts: {
        micro: Object.keys(intelligenceContext?.micro || {}).length,
        medium: Object.keys(intelligenceContext?.medium || {}).length,
        macro: Object.keys(intelligenceContext?.macro || {}).length,
        synthesis: Object.keys(intelligenceContext?.synthesis || {}).length
      },
      
      // Sample data (first level only to avoid overwhelming)
      sampleData: {
        microFields: Object.keys(intelligenceContext?.micro || {}),
        mediumFields: Object.keys(intelligenceContext?.medium || {}),
        macroFields: Object.keys(intelligenceContext?.macro || {}),
        synthesisFields: Object.keys(intelligenceContext?.synthesis || {})
      },
      
      // Performance metrics if available
      performance: intelligenceContext?.performance || null,
      
      // Full raw data (use with caution - can be large)
      fullIntelligence: intelligenceContext
    };
    
    // Count total data points recursively
    const countDataPoints = (obj, depth = 0) => {
      if (depth > 10) return 0; // Prevent infinite recursion
      let count = 0;
      
      for (const key in obj) {
        if (obj[key] !== null && obj[key] !== undefined) {
          count++;
          if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
            count += countDataPoints(obj[key], depth + 1);
          } else if (Array.isArray(obj[key])) {
            count += obj[key].length;
          }
        }
      }
      return count;
    };
    
    dataIntegrity.totalDataPoints = countDataPoints(intelligenceContext);
    
    res.json({
      success: true,
      dataIntegrity,
      summary: {
        intelligenceHealthy: dataIntegrity.structure.hasMicro && 
                           dataIntegrity.structure.hasMedium && 
                           dataIntegrity.structure.hasMacro && 
                           dataIntegrity.structure.hasSynthesis,
        totalFields: dataIntegrity.fieldCounts.micro + 
                    dataIntegrity.fieldCounts.medium + 
                    dataIntegrity.fieldCounts.macro + 
                    dataIntegrity.fieldCounts.synthesis,
        dataRichness: dataIntegrity.totalDataPoints > 50 ? 'rich' : 
                     dataIntegrity.totalDataPoints > 20 ? 'moderate' : 'sparse'
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * GET /intelligence-debug/fields
 * Show expected vs actual intelligence fields
 */
router.get('/fields', protect, async (req, res) => {
  try {
    const expectedFields = {
      micro: [
        'messageComplexity',
        'emotionalShifts', 
        'topicEvolution',
        'communicationStyle',
        'currentState'
      ],
      medium: [
        'weeklyProgressions',
        'learningVelocity',
        'engagementTrends', 
        'behavioralShifts'
      ],
      macro: [
        'personalityEvolution',
        'intellectualGrowth',
        'emotionalMaturation',
        'patternStability'
      ],
      synthesis: [
        'currentMoment',
        'recentJourney',
        'overallTrajectory',
        'remarkableInsights',
        'predictionContext'
      ]
    };
    
    res.json({
      success: true,
      expectedFields,
      totalExpectedFields: Object.values(expectedFields).flat().length,
      description: "Use GET /intelligence-debug/user/:userId to verify actual fields match expected"
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;