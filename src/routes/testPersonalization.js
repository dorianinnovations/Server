import express from 'express';
import { protect } from '../middleware/auth.js';
import personalizationEngine from '../services/personalizationEngine.js';
import connectionEngine from '../services/connectionEngine.js';
import advancedAnalytics from '../services/advancedAnalytics.js';
import dataProcessingPipeline from '../services/dataProcessingPipeline.js';
import UserBehaviorProfile from '../models/UserBehaviorProfile.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * Test all personalization features endpoint
 */
router.post('/test-full-system', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const results = {
      tests: [],
      errors: [],
      summary: {}
    };

    // Test 1: Data Processing Pipeline
    try {
      const eventId = await dataProcessingPipeline.addEvent(userId, 'chat_message', {
        message: 'Hello, I am testing the personalization system',
        emotion: 'curious',
        context: 'system_test',
        timestamp: new Date()
      });
      results.tests.push({
        name: 'Data Processing Pipeline',
        status: 'passed',
        eventId
      });
    } catch (error) {
      results.tests.push({
        name: 'Data Processing Pipeline',
        status: 'failed',
        error: error.message
      });
      results.errors.push(error.message);
    }

    // Test 2: Behavior Profile Creation/Update
    try {
      const profileResult = await personalizationEngine.updateBehaviorProfile(userId, {
        type: 'test',
        content: 'Testing personalization features',
        timestamp: new Date()
      });
      results.tests.push({
        name: 'Behavior Profile Update',
        status: profileResult.success ? 'passed' : 'failed',
        profile: profileResult.profile
      });
    } catch (error) {
      results.tests.push({
        name: 'Behavior Profile Update',
        status: 'failed',
        error: error.message
      });
      results.errors.push(error.message);
    }

    // Test 3: Personalized Recommendations
    try {
      const recommendations = await personalizationEngine.generatePersonalizedRecommendations(userId);
      results.tests.push({
        name: 'Personalized Recommendations',
        status: recommendations.success ? 'passed' : 'failed',
        recommendationCount: recommendations.recommendations ? 
          Object.values(recommendations.recommendations).flat().length : 0
      });
    } catch (error) {
      results.tests.push({
        name: 'Personalized Recommendations',
        status: 'failed',
        error: error.message
      });
      results.errors.push(error.message);
    }

    // Test 4: Contextual Response Generation
    try {
      const contextualResponse = await personalizationEngine.generateContextualResponse(
        userId,
        'Tell me about any historical patterns I might be reliving',
        []
      );
      results.tests.push({
        name: 'Contextual Response Generation',
        status: contextualResponse.response ? 'passed' : 'failed',
        hasHistoricalReference: !!contextualResponse.historicalReference,
        personalizationLevel: contextualResponse.personalizationLevel
      });
    } catch (error) {
      results.tests.push({
        name: 'Contextual Response Generation',
        status: 'failed',
        error: error.message
      });
      results.errors.push(error.message);
    }

    // Test 5: Connection Engine
    try {
      const connections = await connectionEngine.findConnections(userId, 'all', 3);
      results.tests.push({
        name: 'Connection Engine',
        status: connections.success ? 'passed' : 'failed',
        connectionCount: connections.connections ? connections.connections.length : 0
      });
    } catch (error) {
      results.tests.push({
        name: 'Connection Engine',
        status: 'failed',
        error: error.message
      });
      results.errors.push(error.message);
    }

    // Test 6: Advanced Analytics
    try {
      const analytics = await advancedAnalytics.generateComprehensiveAnalytics(userId);
      results.tests.push({
        name: 'Advanced Analytics',
        status: analytics.success ? 'passed' : 'failed',
        analyticsDepth: analytics.analytics ? analytics.analytics.overview?.analysisDepth : 'unknown',
        insightCount: analytics.analytics ? analytics.analytics.insights?.length || 0 : 0
      });
    } catch (error) {
      results.tests.push({
        name: 'Advanced Analytics',
        status: 'failed',
        error: error.message
      });
      results.errors.push(error.message);
    }

    // Test 7: Historical Insights
    try {
      const historicalInsights = await personalizationEngine.generateHistoricalInsights(userId);
      results.tests.push({
        name: 'Historical Insights',
        status: historicalInsights.success ? 'passed' : 'failed',
        hasInsights: historicalInsights.insights ? Object.keys(historicalInsights.insights).length > 0 : false
      });
    } catch (error) {
      results.tests.push({
        name: 'Historical Insights',
        status: 'failed',
        error: error.message
      });
      results.errors.push(error.message);
    }

    // Generate summary
    const passedTests = results.tests.filter(t => t.status === 'passed').length;
    const totalTests = results.tests.length;
    
    results.summary = {
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      successRate: `${Math.round((passedTests / totalTests) * 100)}%`,
      overallStatus: passedTests === totalTests ? 'All systems operational' :
                    passedTests > totalTests / 2 ? 'Mostly operational with some issues' :
                    'Multiple system failures detected',
      timestamp: new Date()
    };

    res.json({
      success: true,
      results
    });

  } catch (error) {
    logger.error('Error in personalization system test:', error);
    res.status(500).json({
      success: false,
      error: 'System test failed',
      details: error.message
    });
  }
});

/**
 * Get current behavior profile
 */
router.get('/behavior-profile', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await UserBehaviorProfile.findOne({ userId });

    res.json({
      success: true,
      profile: profile ? profile.profileSummary : null,
      exists: !!profile
    });

  } catch (error) {
    logger.error('Error getting behavior profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get behavior profile'
    });
  }
});

/**
 * Generate sample data for testing
 */
router.post('/generate-sample-data', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const sampleEvents = [
      {
        type: 'chat_message',
        data: {
          message: 'I love learning about technology and innovation',
          emotion: 'excited',
          context: 'interest_sharing'
        }
      },
      {
        type: 'emotion_update',
        data: {
          emotion: 'curious',
          intensity: 0.8,
          context: 'exploring new ideas',
          source: 'user_input'
        }
      },
      {
        type: 'chat_message',
        data: {
          message: 'Sometimes I feel overwhelmed by all the information out there',
          emotion: 'anxious',
          context: 'information_overload'
        }
      },
      {
        type: 'chat_message',
        data: {
          message: 'I really enjoy deep conversations about philosophy and meaning',
          emotion: 'content',
          context: 'philosophical_interest'
        }
      },
      {
        type: 'goal_update',
        data: {
          goal: {
            goal: 'Learn more about artificial intelligence',
            category: 'learning',
            priority: 8,
            deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
          }
        }
      }
    ];

    // Add sample events to processing pipeline
    const eventIds = [];
    for (const event of sampleEvents) {
      const eventId = await dataProcessingPipeline.addEvent(userId, event.type, event.data);
      eventIds.push(eventId);
    }

    // Add some sample emotions to user log
    await User.findByIdAndUpdate(userId, {
      $push: {
        emotionalLog: {
          $each: [
            { emotion: 'excited', intensity: 8, context: 'learning about AI', timestamp: new Date() },
            { emotion: 'curious', intensity: 7, context: 'exploring new concepts', timestamp: new Date() },
            { emotion: 'content', intensity: 6, context: 'meaningful conversation', timestamp: new Date() },
            { emotion: 'anxious', intensity: 5, context: 'information overwhelm', timestamp: new Date() }
          ]
        }
      }
    });

    res.json({
      success: true,
      message: 'Sample data generated successfully',
      eventIds,
      sampleEventsCount: sampleEvents.length
    });

  } catch (error) {
    logger.error('Error generating sample data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate sample data'
    });
  }
});

/**
 * Get pipeline statistics
 */
router.get('/pipeline-stats', protect, async (req, res) => {
  try {
    const stats = dataProcessingPipeline.getStats();
    
    res.json({
      success: true,
      stats
    });

  } catch (error) {
    logger.error('Error getting pipeline stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pipeline stats'
    });
  }
});

/**
 * Trigger manual profile update
 */
router.post('/update-profile-now', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { interactionData } = req.body;

    const result = await personalizationEngine.updateBehaviorProfile(userId, 
      interactionData || {
        type: 'manual_update',
        content: 'Manual profile update triggered',
        timestamp: new Date()
      }
    );

    res.json({
      success: true,
      result
    });

  } catch (error) {
    logger.error('Error updating profile manually:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

/**
 * Reset behavior profile (for testing)
 */
router.delete('/reset-profile', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    await UserBehaviorProfile.findOneAndDelete({ userId });
    
    res.json({
      success: true,
      message: 'Behavior profile reset successfully'
    });

  } catch (error) {
    logger.error('Error resetting profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset profile'
    });
  }
});

console.log("✓ Personalization test routes initialized");

export default router;