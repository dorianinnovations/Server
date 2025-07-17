import express from 'express';
import { protect } from '../middleware/auth.js';
import ubpmService from '../services/ubpmService.js';
import websocketService from '../services/websocketService.js';

const router = express.Router();

/**
 * Test UBPM functionality
 * POST /api/test-ubpm/trigger
 * Test endpoint to manually trigger UBPM analysis and notifications
 */
router.post('/trigger', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { triggerType = 'test_trigger' } = req.body;

    console.log(`🧠 UBPM TEST: Triggering analysis for user ${userId} with trigger: ${triggerType}`);

    // Trigger UBPM analysis
    const result = await ubpmService.analyzeUserBehaviorPatterns(userId, triggerType);

    if (result && result.updated) {
      // Send test notification
      const testNotification = {
        id: `test_${Date.now()}`,
        type: 'ubpm_insight',
        significance: result.insight.significance,
        summary: result.insight.summary,
        patterns: result.insight.patterns,
        timestamp: new Date(),
        status: 'new'
      };

      // Send via WebSocket
      websocketService.sendToUser(userId, 'ubpm_notification', testNotification);

      res.json({
        success: true,
        message: 'UBPM analysis triggered successfully',
        result: {
          patternsFound: result.patterns.length,
          significance: result.insight.significance,
          summary: result.insight.summary,
          notification: testNotification
        }
      });
    } else {
      res.json({
        success: true,
        message: 'UBPM analysis completed but no significant patterns found',
        result: null
      });
    }

  } catch (error) {
    console.error('🧠 UBPM TEST: Error triggering analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger UBPM analysis',
      details: error.message
    });
  }
});

/**
 * Test UBPM context generation
 * GET /api/test-ubpm/context
 * Test endpoint to see current UBPM context for AI
 */
router.get('/context', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`🧠 UBPM TEST: Getting context for user ${userId}`);

    const context = await ubpmService.getUBPMContextForAI(userId);

    res.json({
      success: true,
      context: context || 'No UBPM context available yet',
      hasContext: !!context
    });

  } catch (error) {
    console.error('🧠 UBPM TEST: Error getting context:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get UBPM context',
      details: error.message
    });
  }
});

/**
 * Send test UBPM notification
 * POST /api/test-ubpm/notification
 * Test endpoint to send a mock UBPM notification
 */
router.post('/notification', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      significance = 0.8,
      summary = 'Test UBPM insight: You show consistent problem-solving patterns when engaging with complex topics',
      pattern = 'analytical_approach'
    } = req.body;

    const testNotification = {
      id: `mock_${Date.now()}`,
      type: 'ubpm_insight',
      significance,
      summary,
      patterns: [{
        type: 'communication',
        pattern,
        description: 'Demonstrates systematic thinking when approaching new challenges',
        confidence: 0.85
      }],
      timestamp: new Date(),
      status: 'new'
    };

    // Send via WebSocket
    websocketService.sendToUser(userId, 'ubpm_notification', testNotification);

    res.json({
      success: true,
      message: 'Test UBPM notification sent',
      notification: testNotification
    });

  } catch (error) {
    console.error('🧠 UBPM TEST: Error sending notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test notification',
      details: error.message
    });
  }
});

export default router;