import express from 'express';
import { protect } from '../middleware/auth.js';
import UserBehaviorProfile from '../models/UserBehaviorProfile.js';
import User from '../models/User.js';

const router = express.Router();

/**
 * GET /visualizations/progressive-state
 * Progressive visualization showing user's behavioral profile evolution
 */
router.get('/progressive-state', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const behaviorProfile = await UserBehaviorProfile.findOne({ userId });
    const user = await User.findById(userId);
    
    if (!behaviorProfile) {
      return res.json({
        success: true,
        data: {
          stage: 'initialization',
          progress: 0,
          message: 'Building your behavioral profile...',
          visualization: {
            type: 'progressive_dots',
            data: { completion: 0, traits: [], patterns: [] }
          }
        }
      });
    }

    // Calculate progression stages
    const completeness = behaviorProfile.dataQuality?.completeness || 0;
    const traitCount = behaviorProfile.personalityTraits?.length || 0;
    const patternCount = behaviorProfile.behaviorPatterns?.length || 0;
    
    let stage, progress, message;
    
    if (completeness < 0.2) {
      stage = 'discovery';
      progress = completeness * 500; // 0-100%
      message = 'Discovering your patterns...';
    } else if (completeness < 0.5) {
      stage = 'analysis';
      progress = 20 + (completeness - 0.2) * 266; // 20-100%
      message = 'Analyzing behavioral patterns...';
    } else if (completeness < 0.8) {
      stage = 'refinement';
      progress = 50 + (completeness - 0.5) * 166; // 50-100%
      message = 'Refining personality insights...';
    } else {
      stage = 'mastery';
      progress = 80 + (completeness - 0.8) * 100; // 80-100%
      message = 'Profile mastery achieved!';
    }

    // Progressive visualization data
    const visualizationData = {
      type: 'progressive_state',
      stage,
      progress: Math.min(100, progress),
      message,
      data: {
        // Personality traits with confidence-based opacity
        personalityConstellation: behaviorProfile.personalityTraits.map(trait => ({
          trait: trait.trait,
          score: trait.score,
          confidence: trait.confidence,
          brightness: trait.confidence, // For star brightness effect
          position: getConstellationPosition(trait.trait), // Circular positioning
          evolution: getTraitEvolution(trait) // Growth over time
        })),
        
        // Behavioral patterns as flowing energy bars
        behaviorFlow: behaviorProfile.behaviorPatterns.map(pattern => ({
          type: pattern.type,
          pattern: pattern.pattern,
          confidence: pattern.confidence,
          frequency: pattern.frequency,
          flowIntensity: pattern.confidence * pattern.frequency,
          color: getPatternColor(pattern.type),
          lastObserved: pattern.lastObserved
        })),
        
        // Data quality as animated progress rings
        qualityRings: {
          completeness: {
            value: behaviorProfile.dataQuality.completeness,
            color: '#4CAF50',
            animation: 'pulse'
          },
          freshness: {
            value: behaviorProfile.dataQuality.freshness,
            color: '#2196F3', 
            animation: 'rotate'
          },
          reliability: {
            value: Math.min(1, behaviorProfile.dataQuality.reliability * 1000),
            color: '#FF9800',
            animation: 'breathe'
          }
        },
        
        // Communication evolution timeline
        communicationEvolution: getCommunicationEvolution(behaviorProfile),
        
        // Work pattern heatmap data
        temporalHeatmap: getTemporalHeatmap(behaviorProfile),
        
        // Metadata for modern styling
        lastUpdated: behaviorProfile.updatedAt,
        totalInteractions: user?.usage?.chat?.daily || 0,
        profileAge: Math.floor((Date.now() - new Date(behaviorProfile.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      }
    };

    res.json({
      success: true,
      data: visualizationData
    });

  } catch (error) {
    console.error('Error generating progressive visualization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate visualization data'
    });
  }
});

/**
 * GET /visualizations/personality-radar
 * Modern animated personality radar chart
 */
router.get('/personality-radar', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const behaviorProfile = await UserBehaviorProfile.findOne({ userId });
    
    if (!behaviorProfile || !behaviorProfile.personalityTraits?.length) {
      return res.json({
        success: true,
        data: {
          type: 'empty_radar',
          message: 'Building personality profile...',
          progress: 0
        }
      });
    }

    const radarData = {
      type: 'personality_radar',
      traits: behaviorProfile.personalityTraits.map(trait => ({
        trait: trait.trait,
        score: trait.score * 100, // Convert to percentage
        confidence: trait.confidence * 100,
        color: getTraitColor(trait.trait),
        gradient: getTraitGradient(trait.trait),
        description: getTraitDescription(trait.trait)
      })),
      animations: {
        entryDelay: 200, // ms between each trait animation
        fillDuration: 1500, // ms for score fill animation
        pulseInterval: 3000 // ms for confidence pulse
      },
      metadata: {
        averageScore: behaviorProfile.personalityTraits.reduce((sum, t) => sum + t.score, 0) / behaviorProfile.personalityTraits.length,
        strongestTrait: behaviorProfile.personalityTraits.reduce((max, t) => t.score > max.score ? t : max),
        lastUpdated: behaviorProfile.updatedAt
      }
    };

    res.json({
      success: true,
      data: radarData
    });

  } catch (error) {
    console.error('Error generating radar chart:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate radar chart'
    });
  }
});

// Helper functions for positioning and styling
function getConstellationPosition(trait) {
  const positions = {
    analytical: { x: 0, y: -100 },
    curiosity: { x: 95, y: -31 },
    conscientiousness: { x: 59, y: 81 },
    openness: { x: -59, y: 81 },
    resilience: { x: -95, y: -31 }
  };
  return positions[trait] || { x: 0, y: 0 };
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

function getTraitGradient(trait) {
  const gradients = {
    analytical: ['#3B82F6', '#1D4ED8'],
    curiosity: ['#8B5CF6', '#7C3AED'],
    conscientiousness: ['#10B981', '#059669'],
    openness: ['#F59E0B', '#D97706'],
    resilience: ['#EF4444', '#DC2626']
  };
  return gradients[trait] || ['#6B7280', '#4B5563'];
}

function getTraitDescription(trait) {
  const descriptions = {
    analytical: 'Logical problem-solving and systematic thinking',
    curiosity: 'Drive to explore and understand new concepts',
    conscientiousness: 'Organized, reliable, and goal-oriented',
    openness: 'Receptive to new experiences and ideas',
    resilience: 'Ability to adapt and recover from challenges'
  };
  return descriptions[trait] || 'Personality dimension';
}

function getTraitEvolution(trait) {
  // Mock evolution data - in real implementation, track over time
  return {
    trend: 'increasing',
    changeRate: 0.02,
    stability: trait.confidence
  };
}

function getCommunicationEvolution(behaviorProfile) {
  const commPattern = behaviorProfile.behaviorPatterns.find(p => p.type === 'communication');
  if (!commPattern) return null;
  
  return {
    currentStyle: commPattern.pattern,
    confidence: commPattern.confidence,
    keyMetrics: {
      avgResponseLength: commPattern.metadata?.avgResponseLength || 0,
      technicalTerms: commPattern.metadata?.technicalTerms || [],
      questionStyle: commPattern.metadata?.questionStyle || 'unknown'
    },
    timeline: [] // Would contain historical changes
  };
}

function getTemporalHeatmap(behaviorProfile) {
  const temporalPattern = behaviorProfile.behaviorPatterns.find(p => p.type === 'temporal');
  if (!temporalPattern) return null;
  
  return {
    preferredHours: temporalPattern.metadata?.preferredHours || [],
    sessionLength: temporalPattern.metadata?.avgSessionLength || 0,
    messagesPerSession: temporalPattern.metadata?.messagesPerSession || 0,
    workIntensity: temporalPattern.confidence
  };
}

export default router;