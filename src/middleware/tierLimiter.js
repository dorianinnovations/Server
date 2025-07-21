/**
 * TIER LIMITATION MIDDLEWARE
 * Enforces Core, Pro, and Aether tier limitations for chat requests
 */

import User from '../models/User.js';
import { getUserTier, getTierLimits, hasFeatureAccess } from '../config/tiers.js';
import { log } from '../utils/logger.js';

/**
 * Rate limiting storage (in-memory for now, should use Redis in production)
 */
const rateLimitStore = new Map();

/**
 * Clean up old rate limit entries (run periodically)
 */
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.resetTime > oneHour) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000); // Clean every 5 minutes

/**
 * Main tier limitation middleware
 */
export const checkTierLimits = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    const userTier = getUserTier(user);
    const limits = getTierLimits(user);
    const now = Date.now();

    // Check daily request limit
    const dailyUsage = await getDailyUsage(user._id);
    if (limits.dailyRequests !== -1 && dailyUsage >= limits.dailyRequests) {
      const resetTime = getNextDayReset();
      return res.status(429).json({
        success: false,
        error: 'Daily request limit reached',
        message: 'Thank you for using Numina, please upgrade to Pro, or Aether for more chatting',
        tier: userTier,
        limit: limits.dailyRequests,
        usage: dailyUsage,
        resetTime: resetTime.toISOString(),
        upgradeRequired: userTier !== 'AETHER',
        upgradeOptions: userTier === 'CORE' ? ['PRO', 'AETHER'] : ['AETHER']
      });
    }

    // Check rate limiting (requests per minute)
    const rateLimitKey = `rate_${user._id}`;
    const rateLimitData = rateLimitStore.get(rateLimitKey) || {
      count: 0,
      resetTime: now + 60000 // 1 minute from now
    };

    if (now > rateLimitData.resetTime) {
      // Reset the counter
      rateLimitData.count = 0;
      rateLimitData.resetTime = now + 60000;
    }

    if (rateLimitData.count >= limits.requestsPerMinute) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: 'Thank you for using Numina, please upgrade to Pro, or Aether for more chatting',
        tier: userTier,
        limit: limits.requestsPerMinute,
        usage: rateLimitData.count,
        resetTime: new Date(rateLimitData.resetTime).toISOString(),
        upgradeRequired: userTier !== 'AETHER',
        upgradeOptions: userTier === 'CORE' ? ['PRO', 'AETHER'] : ['AETHER']
      });
    }

    // Increment rate limit counter
    rateLimitData.count++;
    rateLimitStore.set(rateLimitKey, rateLimitData);

    // Track daily usage
    await incrementDailyUsage(user._id);

    // Add tier info to request
    req.tierInfo = {
      tier: userTier,
      limits,
      dailyUsage: dailyUsage + 1,
      remainingDaily: limits.dailyRequests === -1 ? -1 : limits.dailyRequests - dailyUsage - 1
    };

    next();
  } catch (error) {
    log.error('Tier limitation error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check tier limitations'
    });
  }
};

/**
 * Check if user has access to specific features
 */
export const requireFeature = (featureName) => {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }

      if (!hasFeatureAccess(user, featureName)) {
        const userTier = getUserTier(user);
        return res.status(403).json({
          success: false,
          error: `Feature '${featureName}' not available in ${userTier} tier`,
          tier: userTier,
          featureRequired: featureName,
          upgradeRequired: true
        });
      }

      next();
    } catch (error) {
      log.error('Feature access check error', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check feature access'
      });
    }
  };
};

/**
 * Get daily usage for a user
 */
async function getDailyUsage(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const user = await User.findById(userId);
  const usageKey = 'usage.chat.daily';
  const resetKey = 'usage.chat.lastReset';
  
  const lastReset = user.get(resetKey) || new Date(0);
  
  if (lastReset < today) {
    // Reset daily usage
    await User.findByIdAndUpdate(userId, {
      $set: {
        [usageKey]: 0,
        [resetKey]: new Date()
      }
    });
    return 0;
  }
  
  return user.get(usageKey) || 0;
}

/**
 * Increment daily usage for a user
 */
async function incrementDailyUsage(userId) {
  const usageKey = 'usage.chat.daily';
  await User.findByIdAndUpdate(userId, {
    $inc: { [usageKey]: 1 }
  });
}

/**
 * Get next day reset time
 */
function getNextDayReset() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

/**
 * Middleware to add tier info to all responses
 */
export const addTierInfo = async (req, res, next) => {
  if (req.user) {
    try {
      const user = await User.findById(req.user.id);
      const userTier = getUserTier(user);
      const limits = getTierLimits(user);
      const dailyUsage = await getDailyUsage(user._id);

      // Add tier info to response
      const originalJson = res.json;
      res.json = function(data) {
        if (data && typeof data === 'object' && data.success !== false) {
          data.tierInfo = {
            tier: userTier,
            dailyUsage,
            dailyLimit: limits.dailyRequests,
            remainingDaily: limits.dailyRequests === -1 ? -1 : Math.max(0, limits.dailyRequests - dailyUsage),
            features: limits.features
          };
        }
        return originalJson.call(this, data);
      };
    } catch (error) {
      log.error('Add tier info error', error);
    }
  }
  next();
};

export default { checkTierLimits, requireFeature, addTierInfo };