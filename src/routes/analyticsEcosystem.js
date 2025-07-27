import express from 'express';
import { protect } from '../middleware/auth.js';
import UserBehaviorProfile from '../models/UserBehaviorProfile.js';
import ShortTermMemory from '../models/ShortTermMemory.js';
import ubpmService from '../services/ubpmService.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /analytics/ecosystem
 * Returns UBPM-based analytics data formatted for charts
 * This is the main endpoint for the Analytics screen in the mobile app
 */
router.get('/ecosystem', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get UBPM profile
    const behaviorProfile = await UserBehaviorProfile.findOne({ userId });
    
    if (!behaviorProfile || !behaviorProfile.behaviorPatterns || behaviorProfile.behaviorPatterns.length === 0) {
      // Return empty state for new users
      return res.json({
        success: true,
        data: {
          summary: {
            ubpmRichness: "Building profile...",
            algorithmicCategorization: "Analyzing patterns...",
            uniquePersonalization: "0% - Need more interactions",
            recentPatterns: []
          },
          charts: {
            communication: [],
            behavioral: [],
            emotional: [],
            temporal: []
          },
          metadata: {
            lastUpdated: new Date(),
            dataPoints: 0,
            confidence: 0.1,
            message: "Interact more to see your behavioral patterns"
          }
        }
      });
    }
    
    // Calculate UBPM richness based on data quality and pattern diversity
    const patternTypes = new Set(behaviorProfile.behaviorPatterns.map(p => p.type));
    const avgConfidence = behaviorProfile.behaviorPatterns.reduce((sum, p) => sum + p.confidence, 0) / behaviorProfile.behaviorPatterns.length;
    const ubpmRichness = Math.round((behaviorProfile.dataQuality.completeness * 0.5 + avgConfidence * 0.5) * 100);
    
    // Determine algorithmic categorization based on dominant patterns
    const categorization = determineAlgorithmicCategorization(behaviorProfile.behaviorPatterns);
    
    // Get recent patterns for summary
    const recentPatterns = behaviorProfile.behaviorPatterns
      .sort((a, b) => new Date(b.lastObserved) - new Date(a.lastObserved))
      .slice(0, 4)
      .map(p => p.pattern);
    
    // Format chart data by category
    const chartData = {
      communication: formatPatternChartData(behaviorProfile.behaviorPatterns.filter(p => p.type === 'communication')),
      behavioral: formatPatternChartData(behaviorProfile.behaviorPatterns.filter(p => p.type === 'decision_making' || p.type === 'stress_response')),
      emotional: formatPatternChartData(behaviorProfile.behaviorPatterns.filter(p => p.type === 'emotional')),
      temporal: formatPatternChartData(behaviorProfile.behaviorPatterns.filter(p => p.type === 'temporal'))
    };
    
    // Build response matching the vision from ECOSYSTEM_INTEGRATION_PLAN.md
    const analyticsData = {
      summary: {
        ubpmRichness: `${ubpmRichness}% profile completion`,
        algorithmicCategorization: categorization,
        uniquePersonalization: `${Math.round(avgConfidence * 100)}% accuracy`,
        recentPatterns: recentPatterns
      },
      charts: chartData,
      metadata: {
        lastUpdated: behaviorProfile.lastAnalysisDate,
        dataPoints: behaviorProfile.behaviorPatterns.length,
        confidence: avgConfidence,
        patternDiversity: patternTypes.size
      }
    };
    
    res.json({
      success: true,
      data: analyticsData
    });
    
  } catch (error) {
    logger.error('Analytics ecosystem endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics data'
    });
  }
});

/**
 * POST /analytics/ecosystem/trigger
 * Manually trigger UBPM analysis for testing
 */
router.post('/ecosystem/trigger', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Trigger UBPM analysis
    const result = await ubpmService.analyzeUserBehaviorPatterns(userId, 'manual_trigger');
    
    if (result && result.updated) {
      res.json({
        success: true,
        message: 'UBPM analysis triggered successfully',
        patternsFound: result.patterns.length,
        insight: result.insight
      });
    } else {
      res.json({
        success: false,
        message: 'UBPM analysis skipped (cooldown or insufficient data)'
      });
    }
    
  } catch (error) {
    logger.error('UBPM trigger error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger UBPM analysis'
    });
  }
});

// Helper functions

function determineAlgorithmicCategorization(patterns) {
  if (!patterns || patterns.length === 0) return "Insufficient data";
  
  // Count pattern occurrences by type
  const patternCounts = {};
  patterns.forEach(p => {
    patternCounts[p.pattern] = (patternCounts[p.pattern] || 0) + 1;
  });
  
  // Find dominant patterns
  const dominantPatterns = Object.entries(patternCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 2)
    .map(([pattern]) => pattern);
  
  // Map to user-friendly categorizations
  const categoryMap = {
    'detailed_communicator': 'Advanced Technical Learner',
    'inquisitive_learner': 'Curious Knowledge Seeker',
    'emotionally_expressive': 'Empathetic Communicator',
    'task_oriented': 'Goal-Driven Achiever',
    'collaborative_decision_maker': 'Thoughtful Collaborator',
    'stable_positive_outlook': 'Optimistic Thinker',
    'brief_communicator': 'Efficient Communicator'
  };
  
  // Return primary categorization
  return categoryMap[dominantPatterns[0]] || 'Unique Behavioral Profile';
}

function formatPatternChartData(patterns) {
  if (!patterns || patterns.length === 0) return [];
  
  // Format for chart visualization
  return patterns.map(p => ({
    pattern: p.pattern.replace(/_/g, ' '),
    confidence: Math.round(p.confidence * 100),
    frequency: p.frequency || 1,
    description: p.description,
    evidence: p.evidence || {}
  }))
  .sort((a, b) => b.confidence - a.confidence);
}

export default router;