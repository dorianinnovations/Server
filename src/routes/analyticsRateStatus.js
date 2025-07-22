/**
 * Analytics Rate Limiting Status Endpoint
 * Allows checking current rate limit status for debugging
 */

import express from 'express';
import { protect } from '../middleware/auth.js';
import { getAnalyticsRateLimit, clearAnalyticsRateLimits } from '../middleware/analyticsRateLimiter.js';

const router = express.Router();

/**
 * GET /analytics-rate-status
 * Get current analytics rate limiting status for authenticated user
 */
router.get('/', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check status for all analytics endpoints
    const endpoints = [
      'emotional-state',
      'personality-recommendations', 
      'personal-growth-insights',
      'llm-analytics',
      'behavioral-analysis',
      'comprehensive-analytics',
      'ai-insights'
    ];
    
    const status = {};
    
    for (const endpoint of endpoints) {
      const rateLimit = getAnalyticsRateLimit(userId, endpoint);
      status[endpoint] = {
        canCall: rateLimit.canCall,
        remaining: rateLimit.remaining,
        timeRemaining: rateLimit.timeRemaining,
        minutesRemaining: rateLimit.minutesRemaining || 0,
        resetTime: new Date(rateLimit.resetTime).toISOString()
      };
    }
    
    res.json({
      success: true,
      userId,
      rateLimitStatus: status,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching analytics rate status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rate limit status'
    });
  }
});

/**
 * POST /analytics-rate-status/clear
 * Clear all analytics rate limits for authenticated user (for testing)
 */
router.post('/clear', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Only allow clearing in development or for admin users
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Rate limit clearing not allowed in production'
      });
    }
    
    const clearedCount = clearAnalyticsRateLimits(userId);
    
    res.json({
      success: true,
      message: `Cleared analytics rate limits for user ${userId}`,
      clearedEndpoints: clearedCount,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error clearing analytics rate limits:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear rate limits'
    });
  }
});

export default router;