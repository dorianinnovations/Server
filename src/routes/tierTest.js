import express from 'express';
import { protect } from '../middleware/auth.js';
import { checkTierLimits, requireFeature, addTierInfo } from '../middleware/tierLimiter.js';
import { getUserTier, getTierLimits } from '../config/tiers.js';
import User from '../models/User.js';

const router = express.Router();

/**
 * GET /tier-test/info
 * Get user's current tier information
 */
router.get('/info', protect, addTierInfo, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const tier = getUserTier(user);
    const limits = getTierLimits(user);

    res.json({
      success: true,
      data: {
        tier,
        limits,
        subscription: {
          pro: user.subscription?.pro || null,
          aether: user.subscription?.aether || null
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /tier-test/basic-chat
 * Test basic chat with tier limits
 */
router.post('/basic-chat', protect, checkTierLimits, async (req, res) => {
  try {
    const { message } = req.body;
    
    res.json({
      success: true,
      data: {
        message: `Echo: ${message}`,
        tierInfo: req.tierInfo
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /tier-test/emotional-analysis
 * Test emotional analysis feature (Pro+ only)
 */
router.post('/emotional-analysis', protect, requireFeature('emotionalAnalysis'), async (req, res) => {
  try {
    const { text } = req.body;
    
    res.json({
      success: true,
      data: {
        analysis: `Emotional analysis of: "${text}" - This is a Pro+ feature!`,
        emotion: 'positive',
        confidence: 0.85
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /tier-test/personalized-insights
 * Test personalized insights feature (Pro+ only)
 */
router.post('/personalized-insights', protect, requireFeature('personalizedInsights'), async (req, res) => {
  try {
    const { userData } = req.body;
    
    res.json({
      success: true,
      data: {
        insights: `Personalized insights for user data: ${JSON.stringify(userData)} - This is a Pro+ feature!`,
        recommendations: ['Continue being awesome', 'Try new challenges']
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /tier-test/tool-access
 * Test tool access feature (Pro+ only)
 */
router.post('/tool-access', protect, requireFeature('toolAccess'), async (req, res) => {
  try {
    const { toolName } = req.body;
    
    res.json({
      success: true,
      data: {
        result: `Tool "${toolName}" executed successfully - This is a Pro+ feature!`,
        toolResponse: 'Mock tool response'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /tier-test/upgrade-user
 * Test endpoint to upgrade user tier (for testing only)
 */
router.post('/upgrade-user', protect, async (req, res) => {
  try {
    const { tier } = req.body;
    const user = await User.findById(req.user.id);
    
    if (tier === 'PRO') {
      user.subscription.pro.isActive = true;
      user.subscription.pro.startDate = new Date();
      user.subscription.pro.plan = 'monthly';
    } else if (tier === 'AETHER') {
      user.subscription.aether.isActive = true;
      user.subscription.aether.startDate = new Date();
      user.subscription.aether.plan = 'monthly';
      // Deactivate pro if upgrading to aether
      user.subscription.pro.isActive = false;
    } else if (tier === 'CORE') {
      user.subscription.pro.isActive = false;
      user.subscription.aether.isActive = false;
    }
    
    await user.save();
    
    res.json({
      success: true,
      data: {
        message: `User upgraded to ${tier} tier`,
        newTier: getUserTier(user)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;