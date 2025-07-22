/**
 * ANALYTICS RATE LIMITER
 * Strict rate limiting for expensive GPT-4o analytics endpoints
 * Max 1 call per hour per user per endpoint to prevent cost overruns
 */

import logger from '../utils/logger.js';

// In-memory store for analytics rate limiting (use Redis in production)
const analyticsRateLimitStore = new Map();

// Clean up expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  for (const [key, data] of analyticsRateLimitStore.entries()) {
    if (now - data.lastCall > oneHour) {
      analyticsRateLimitStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

/**
 * Create analytics rate limiter middleware
 * Enforces 1 call per hour per user per endpoint
 */
export const createAnalyticsRateLimiter = (endpointName, options = {}) => {
  const {
    windowMs = 60 * 60 * 1000, // 1 hour default
    maxCalls = 1, // 1 call per hour default
    message = `Analytics endpoint '${endpointName}' is rate limited to ${maxCalls} call per hour to prevent excessive costs.`,
    skipSuccessfulResponses = false
  } = options;

  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required for analytics endpoints'
        });
      }

      const key = `analytics:${endpointName}:${userId}`;
      const now = Date.now();
      
      // Get rate limit data for this user and endpoint
      let rateLimitData = analyticsRateLimitStore.get(key);
      
      if (!rateLimitData) {
        rateLimitData = {
          calls: 0,
          lastCall: 0,
          resetTime: now + windowMs
        };
      }
      
      // Check if window has reset
      if (now >= rateLimitData.resetTime) {
        rateLimitData = {
          calls: 0,
          lastCall: 0,
          resetTime: now + windowMs
        };
      }
      
      // Check if limit exceeded
      if (rateLimitData.calls >= maxCalls) {
        const timeRemaining = rateLimitData.resetTime - now;
        const minutesRemaining = Math.ceil(timeRemaining / (60 * 1000));
        
        logger.warn(`Analytics rate limit exceeded`, {
          userId,
          endpoint: endpointName,
          calls: rateLimitData.calls,
          maxCalls,
          timeRemaining: minutesRemaining
        });
        
        return res.status(429).json({
          success: false,
          error: 'Analytics rate limit exceeded',
          message: `${message} Try again in ${minutesRemaining} minutes.`,
          endpoint: endpointName,
          rateLimitInfo: {
            limit: maxCalls,
            windowMs,
            remaining: 0,
            resetTime: rateLimitData.resetTime,
            timeRemaining: timeRemaining,
            minutesRemaining
          }
        });
      }
      
      // Increment call count
      rateLimitData.calls++;
      rateLimitData.lastCall = now;
      analyticsRateLimitStore.set(key, rateLimitData);
      
      // Add rate limit headers
      res.set({
        'X-Analytics-RateLimit-Limit': maxCalls,
        'X-Analytics-RateLimit-Remaining': Math.max(0, maxCalls - rateLimitData.calls),
        'X-Analytics-RateLimit-Reset': rateLimitData.resetTime,
        'X-Analytics-RateLimit-Window': windowMs,
        'X-Analytics-RateLimit-Endpoint': endpointName
      });
      
      logger.info(`Analytics call tracked`, {
        userId,
        endpoint: endpointName,
        calls: rateLimitData.calls,
        maxCalls,
        remaining: maxCalls - rateLimitData.calls
      });
      
      next();
      
    } catch (error) {
      logger.error('Analytics rate limiter error', { error, endpointName });
      // Don't block request on rate limiter error, just log it
      next();
    }
  };
};

/**
 * Predefined analytics rate limiters for expensive endpoints
 */
export const analyticsRateLimiters = {
  // AI emotional state analysis (expensive)
  emotionalState: createAnalyticsRateLimiter('emotional-state', {
    maxCalls: 1,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'AI emotional state analysis is limited to 1 call per hour per user'
  }),
  
  // Personality recommendations (expensive)
  personalityRecommendations: createAnalyticsRateLimiter('personality-recommendations', {
    maxCalls: 1,
    windowMs: 60 * 60 * 1000,
    message: 'Personality recommendations are limited to 1 call per hour per user'
  }),
  
  // Personal growth insights (very expensive)
  personalGrowthInsights: createAnalyticsRateLimiter('personal-growth-insights', {
    maxCalls: 1,
    windowMs: 60 * 60 * 1000,
    message: 'Personal growth insights are limited to 1 call per hour per user'
  }),
  
  // LLM analytics processing (very expensive)
  llmAnalytics: createAnalyticsRateLimiter('llm-analytics', {
    maxCalls: 1,
    windowMs: 60 * 60 * 1000,
    message: 'LLM analytics processing is limited to 1 call per hour per user'
  }),
  
  // Behavioral analysis (expensive)
  behavioralAnalysis: createAnalyticsRateLimiter('behavioral-analysis', {
    maxCalls: 1,
    windowMs: 60 * 60 * 1000,
    message: 'Behavioral analysis is limited to 1 call per hour per user'
  }),
  
  
  // Comprehensive analytics (very expensive - multiple API calls)
  comprehensiveAnalytics: createAnalyticsRateLimiter('comprehensive-analytics', {
    maxCalls: 1,
    windowMs: 60 * 60 * 1000,
    message: 'Comprehensive analytics are limited to 1 call per hour per user'
  }),
  
  // AI insight generation (expensive)
  aiInsights: createAnalyticsRateLimiter('ai-insights', {
    maxCalls: 1,
    windowMs: 60 * 60 * 1000,
    message: 'AI insights generation is limited to 1 call per hour per user'
  })
};

/**
 * Get rate limit status for a user and endpoint
 */
export const getAnalyticsRateLimit = (userId, endpointName) => {
  const key = `analytics:${endpointName}:${userId}`;
  const rateLimitData = analyticsRateLimitStore.get(key);
  const now = Date.now();
  
  if (!rateLimitData) {
    return {
      canCall: true,
      remaining: 1,
      resetTime: now + (60 * 60 * 1000),
      timeRemaining: 0
    };
  }
  
  const canCall = now >= rateLimitData.resetTime || rateLimitData.calls < 1;
  const timeRemaining = Math.max(0, rateLimitData.resetTime - now);
  
  return {
    canCall,
    remaining: canCall ? 1 : 0,
    resetTime: rateLimitData.resetTime,
    timeRemaining,
    minutesRemaining: Math.ceil(timeRemaining / (60 * 1000))
  };
};

/**
 * Clear analytics rate limits for a user (admin function)
 */
export const clearAnalyticsRateLimits = (userId) => {
  const keysToDelete = [];
  
  for (const key of analyticsRateLimitStore.keys()) {
    if (key.includes(`:${userId}`)) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => analyticsRateLimitStore.delete(key));
  
  logger.info(`Cleared analytics rate limits for user ${userId}`, {
    clearedEndpoints: keysToDelete.length
  });
  
  return keysToDelete.length;
};

export default {
  createAnalyticsRateLimiter,
  analyticsRateLimiters,
  getAnalyticsRateLimit,
  clearAnalyticsRateLimits
};