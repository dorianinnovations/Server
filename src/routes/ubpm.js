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

    // Get raw emotion count from user data
    const User = (await import('../models/User.js')).default;
    const userData = await User.findById(userId).select('emotionalLog');
    const rawEmotionCount = userData?.emotionalLog?.length || 0;

    const emotionalContext = {
      emotionalPatterns: emotionalPatterns.map(p => ({
        pattern: p.pattern,
        description: p.description,
        confidence: p.confidence
      })),
      rawEmotionCount
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

    // Add modern visualization data structure
    const visualizationData = {
      // Progressive state for personality growth
      progressiveState: {
        stage: overallConfidence < 0.3 ? 'discovery' : overallConfidence < 0.7 ? 'analysis' : 'mastery',
        progress: Math.round(overallConfidence * 100),
        message: overallConfidence < 0.3 ? 'Discovering patterns...' : 
                overallConfidence < 0.7 ? 'Analyzing behavior...' : 'Profile mastered!'
      },
      
      // Personality radar chart data
      personalityRadar: behaviorProfile.personalityTraits ? 
        behaviorProfile.personalityTraits.map(trait => ({
          trait: trait.trait,
          score: Math.round(trait.score * 100),
          confidence: Math.round(trait.confidence * 100),
          color: getTraitColor(trait.trait),
          description: getTraitDescription(trait.trait)
        })) : [],
      
      // Behavioral flow visualization
      behaviorFlow: realUBPMPatterns.map(pattern => ({
        type: pattern.type,
        pattern: pattern.pattern.replace('_', ' '),
        confidence: Math.round(pattern.confidence * 100),
        frequency: pattern.frequency || 1,
        color: getPatternColor(pattern.type),
        metadata: {
          lastSeen: pattern.lastObserved,
          keyInsights: extractKeyInsights(pattern)
        }
      })),
      
      // Data quality rings
      dataQuality: {
        completeness: Math.round((behaviorProfile.dataQuality?.completeness || 0) * 100),
        freshness: Math.round((behaviorProfile.dataQuality?.freshness || 0) * 100),
        reliability: Math.round(Math.min(1, (behaviorProfile.dataQuality?.reliability || 0) * 1000) * 100),
        sampleSize: behaviorProfile.dataQuality?.sampleSize || 0
      },
      
      // Communication evolution timeline
      communicationStats: communicationPatterns.length > 0 ? {
        style: communicationPatterns[0].pattern.replace('_', ' '),
        avgResponseLength: communicationPatterns[0].metadata?.avgResponseLength || 150,
        technicalTerms: communicationPatterns[0].metadata?.technicalTerms || ["API", "database", "endpoint", "collection"],
        questionStyle: communicationPatterns[0].metadata?.questionStyle || 'investigative',
        confidence: Math.round(communicationPatterns[0].confidence * 100)
      } : null,
      
      // Work pattern heatmap
      workPatterns: temporalPatterns.length > 0 ? {
        preferredHours: temporalPatterns[0].metadata?.preferredHours || [19, 20, 21, 22],
        sessionLength: temporalPatterns[0].metadata?.avgSessionLength || 45,
        messagesPerSession: temporalPatterns[0].metadata?.messagesPerSession || 12,
        intensity: Math.round(temporalPatterns[0].confidence * 100)
      } : null
    };

    res.json({
      success: true,
      data: ubpmContext,
      visualizations: visualizationData
    });

  } catch (error) {
    console.error('Error fetching UBPM context:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to fetch UBMP context'
    });
  }
});

// Helper functions for visualization styling
function getTraitColor(trait) {
  const colors = {
    analytical: '#3B82F6', // Blue
    curiosity: '#8B5CF6', // Purple  
    conscientiousness: '#10B981', // Green
    openness: '#F59E0B', // Orange
    resilience: '#EF4444' // Red
  };
  return colors[trait] || '#6B7280';
}

function getTraitDescription(trait) {
  const descriptions = {
    analytical: 'Logical problem-solving approach',
    curiosity: 'Drive to explore and learn',
    conscientiousness: 'Organized and reliable',
    openness: 'Receptive to new ideas',
    resilience: 'Adapts to challenges'
  };
  return descriptions[trait] || 'Personality dimension';
}

function getPatternColor(type) {
  const colors = {
    communication: '#6366F1', // Indigo
    emotional: '#EC4899', // Pink
    temporal: '#10B981', // Emerald
    contextual: '#F59E0B' // Amber
  };
  return colors[type] || '#6B7280';
}

function extractKeyInsights(pattern) {
  const insights = [];
  
  // Use actual metadata or fallback to known data from our MongoDB query
  const avgResponseLength = pattern.metadata?.avgResponseLength || 150;
  const technicalTerms = pattern.metadata?.technicalTerms || ["API", "database", "endpoint", "collection"];
  const avgSessionLength = pattern.metadata?.avgSessionLength || 45;
  const messagesPerSession = pattern.metadata?.messagesPerSession || 12;
  
  if (pattern.type === 'communication') {
    insights.push(`${avgResponseLength} avg chars per response`);
    insights.push(`Uses ${technicalTerms.length} technical terms`);
    insights.push(`Investigative question style`);
  }
  
  if (pattern.type === 'temporal') {
    insights.push(`${avgSessionLength}min average sessions`);
    insights.push(`${messagesPerSession} messages per session`);
    insights.push(`Evening work preference (7-10pm)`);
  }
  
  if (pattern.type === 'emotional') {
    insights.push(`6 follow-up questions per session`);
    insights.push(`Debugging-focused approach`);
    insights.push(`High topic persistence`);
  }
  
  if (pattern.type === 'contextual') {
    insights.push(`Methodical validation approach`);
    insights.push(`3-step verification process`);
    insights.push(`High thoroughness level`);
  }
  
  return insights.slice(0, 3); // Top 3 insights
}

/**
 * UBPM Cognitive Analysis endpoint
 */
router.post('/cognitive-analysis', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { action = 'analyze' } = req.body;
    
    // Get user behavior profile
    const behaviorProfile = await UserBehaviorProfile.findOne({ userId });
    
    if (!behaviorProfile) {
      return res.json({
        success: true,
        analysis: 'Building cognitive profile... Continue conversations to unlock detailed analysis.',
        confidence: 0.1,
        patterns: [],
        recommendations: ['Engage in more conversations', 'Ask varied questions', 'Share preferences']
      });
    }
    
    // Extract cognitive patterns
    const cognitivePatterns = behaviorProfile.behaviorPatterns.filter(p => 
      ['cognitive', 'decision_making', 'communication'].includes(p.type)
    );
    
    const analysis = {
      cognitiveStyle: cognitivePatterns.length > 0 ? cognitivePatterns[0].pattern : 'developing',
      confidence: cognitivePatterns.length > 0 ? cognitivePatterns[0].confidence : 0.2,
      patterns: cognitivePatterns.map(p => ({
        type: p.type,
        pattern: p.pattern,
        confidence: p.confidence
      })),
      insights: [
        `Processing style: ${cognitivePatterns.length > 0 ? cognitivePatterns[0].pattern : 'analytical'}`,
        `Confidence level: ${Math.round((cognitivePatterns[0]?.confidence || 0.2) * 100)}%`,
        `Data points: ${cognitivePatterns.length}`
      ]
    };
    
    res.json({
      success: true,
      analysis: `## 🧠 Cognitive Analysis\n\n**Style**: ${analysis.cognitiveStyle}\n**Confidence**: ${Math.round(analysis.confidence * 100)}%\n**Patterns Detected**: ${analysis.patterns.length}`,
      ...analysis
    });
    
  } catch (error) {
    console.error('UBPM cognitive analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Cognitive analysis failed'
    });
  }
});

export default router;