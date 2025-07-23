import express from 'express';
import { protect } from '../middleware/auth.js';
import { HTTP_STATUS } from '../config/constants.js';

const router = express.Router();

/**
 * Get UBPM context for testing/development
 */
router.get('/context', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Mock UBPM context data structure
    const ubpmContext = {
      userId,
      behavioralContext: {
        communicationStyle: 'analytical',
        preferredInteractionMode: 'detailed',
        responseTime: 'moderate',
        topicPreferences: ['technology', 'personal-growth', 'learning']
      },
      personalityContext: {
        openness: 0.7,
        conscientiousness: 0.8,
        extraversion: 0.5,
        agreeableness: 0.6,
        neuroticism: 0.3
      },
      temporalContext: {
        mostActiveHours: [9, 10, 14, 20],
        preferredSessionLength: 15,
        consistencyScore: 0.75
      },
      confidence: 0.6,
      dataPoints: 150,
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      data: ubpmContext
    });

  } catch (error) {
    console.error('Error fetching UBPM context:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to fetch UBPM context'
    });
  }
});

export default router;