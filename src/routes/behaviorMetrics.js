import express from 'express';
import { protect } from '../middleware/auth.js';
// import { getBehaviorMetrics } from '../../archive/unused-services/behaviorMetricsService.js'; // Disabled archived service
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /behavior-metrics/overview
 * Clean behavioral metrics for Aether Mobile
 * Focus: Concrete data, bar charts, meaningful patterns
 */
router.get('/overview', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const metrics = await getBehaviorMetrics(userId);
    
    res.json({
      success: true,
      data: metrics,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching behavior metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch behavioral metrics'
    });
  }
});

/**
 * GET /behavior-metrics/communication
 * Detailed communication style analysis
 */
router.get('/communication', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const metrics = await getBehaviorMetrics(userId);
    
    res.json({
      success: true,
      data: {
        communicationProfile: metrics.communicationProfile,
        temporalPatterns: metrics.temporalPatterns,
        responseAnalysis: metrics.responseAnalysis
      }
    });

  } catch (error) {
    logger.error('Error fetching communication metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch communication metrics'
    });
  }
});

/**
 * GET /behavior-metrics/patterns
 * Behavioral pattern confidence and trends
 */
router.get('/patterns', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const metrics = await getBehaviorMetrics(userId);
    
    res.json({
      success: true,
      data: {
        emotionalPatterns: metrics.emotionalPatterns,
        confidenceScores: metrics.confidenceScores,
        patternTrends: metrics.patternTrends
      }
    });

  } catch (error) {
    logger.error('Error fetching pattern metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pattern metrics'
    });
  }
});

export default router;