import User from '../models/User.js';
import logger from '../utils/logger.js';

/**
 * Subscription-based feature gating middleware
 */

const FEATURE_LIMITS = {
  free: {
    contextualChat: { daily: 5, monthly: 50 },
    recommendations: { daily: 3, monthly: 30 },
    historicalInsights: { weekly: 1, monthly: 4 },
    connections: { daily: 0, monthly: 0 },
    advancedAnalytics: false,
    customPersonality: false,
    prioritySpeed: false
  },
  premium: {
    contextualChat: { daily: 100, monthly: 1000 },
    recommendations: { daily: 20, monthly: 300 },
    historicalInsights: { daily: 5, monthly: 50 },
    connections: { daily: 10, monthly: 100 },
    advancedAnalytics: true,
    customPersonality: false,
    prioritySpeed: true
  },
  pro: {
    contextualChat: { daily: -1, monthly: -1 }, // unlimited
    recommendations: { daily: -1, monthly: -1 },
    historicalInsights: { daily: -1, monthly: -1 },
    connections: { daily: -1, monthly: -1 },
    advancedAnalytics: true,
    customPersonality: true,
    prioritySpeed: true
  }
};

const TIER_NAMES = {
  0: 'free',
  1: 'premium', 
  2: 'pro'
};

/**
 * Check if user can access a feature based on their subscription tier and usage
 */
export const checkFeatureAccess = (featureName, usageType = 'daily') => {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }

      const userTier = TIER_NAMES[user.subscriptionTier || 0];
      const limits = FEATURE_LIMITS[userTier];
      
      // Check if feature exists in limits
      if (!(featureName in limits)) {
        return res.status(403).json({ 
          success: false, 
          message: 'Feature not available',
          feature: featureName 
        });
      }

      const featureLimit = limits[featureName];
      
      // Handle boolean features (like advancedAnalytics)
      if (typeof featureLimit === 'boolean') {
        if (!featureLimit) {
          return res.status(402).json({
            success: false,
            message: 'This feature requires a premium subscription',
            feature: featureName,
            upgradeRequired: true,
            currentTier: userTier
          });
        }
        return next();
      }

      // Handle usage-based features
      const limit = featureLimit[usageType];
      if (limit === -1) {
        // Unlimited access
        return next();
      }

      // Check current usage
      const usage = await getCurrentUsage(user._id, featureName, usageType);
      
      if (usage >= limit) {
        const resetTime = getResetTime(usageType);
        return res.status(429).json({
          success: false,
          message: `${featureName} limit reached for ${usageType} usage`,
          limit,
          usage,
          resetTime,
          upgradeAvailable: userTier !== 'pro',
          currentTier: userTier
        });
      }

      // Track usage
      await trackUsage(user._id, featureName, usageType);
      
      // Add subscription info to request
      req.subscription = {
        tier: userTier,
        limits: limits,
        currentUsage: usage + 1
      };

      next();
    } catch (error) {
      logger.error('Subscription gate error:', error);
      res.status(500).json({ success: false, message: 'Subscription check failed' });
    }
  };
};

/**
 * Get current usage for a feature
 */
async function getCurrentUsage(userId, featureName, usageType) {
  const now = new Date();
  let startDate;
  
  switch (usageType) {
    case 'daily':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'weekly':
      const dayOfWeek = now.getDay();
      startDate = new Date(now.getTime() - (dayOfWeek * 24 * 60 * 60 * 1000));
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'monthly':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      startDate = new Date(0);
  }

  const user = await User.findById(userId);
  const usageKey = `usage.${featureName}.${usageType}`;
  const lastResetKey = `usage.${featureName}.lastReset.${usageType}`;
  
  // Check if we need to reset usage
  const lastReset = user.get(lastResetKey) || new Date(0);
  if (lastReset < startDate) {
    await User.findByIdAndUpdate(userId, {
      $set: {
        [usageKey]: 0,
        [lastResetKey]: now
      }
    });
    return 0;
  }

  return user.get(usageKey) || 0;
}

/**
 * Track feature usage
 */
async function trackUsage(userId, featureName, usageType) {
  const usageKey = `usage.${featureName}.${usageType}`;
  await User.findByIdAndUpdate(userId, {
    $inc: { [usageKey]: 1 }
  });
}

/**
 * Get reset time for usage period
 */
function getResetTime(usageType) {
  const now = new Date();
  
  switch (usageType) {
    case 'daily':
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow;
    case 'weekly':
      const nextWeek = new Date(now);
      const daysUntilMonday = (7 - now.getDay() + 1) % 7 || 7;
      nextWeek.setDate(nextWeek.getDate() + daysUntilMonday);
      nextWeek.setHours(0, 0, 0, 0);
      return nextWeek;
    case 'monthly':
      return new Date(now.getFullYear(), now.getMonth() + 1, 1);
    default:
      return null;
  }
}

/**
 * Middleware to add subscription info to all responses
 */
export const addSubscriptionInfo = async (req, res, next) => {
  if (req.user) {
    const user = await User.findById(req.user.id);
    const userTier = TIER_NAMES[user.subscriptionTier || 0];
    
    // Add subscription info to response
    const originalJson = res.json;
    res.json = function(data) {
      if (data && typeof data === 'object') {
        data.subscription = {
          tier: userTier,
          limits: FEATURE_LIMITS[userTier],
          upgradeAvailable: userTier !== 'pro'
        };
      }
      return originalJson.call(this, data);
    };
  }
  next();
};

export default { checkFeatureAccess, addSubscriptionInfo };