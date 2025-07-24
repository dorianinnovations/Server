/**
 * NUMINA TIER CONFIGURATION
 * Core, Pro, and Aether tiers only
 */

export const TIER_CONFIG = {
  CORE: {
    name: 'Core',
    dailyRequests: 10000,
    requestsPerMinute: 50,
    maxTokensPerRequest: 8000,
    features: {
      basicChat: true,
      emotionalAnalysis: true,
      personalizedInsights: true,
      toolAccess: true,
      memoryRetention: 90, // days
      conversationHistory: 10000 // messages
    }
  },
  PRO: {
    name: 'Pro', 
    dailyRequests: 50000,
    requestsPerMinute: 100,
    maxTokensPerRequest: 16000,
    features: {
      basicChat: true,
      emotionalAnalysis: true,
      personalizedInsights: true,
      toolAccess: true,
      memoryRetention: 90, // days
      conversationHistory: 10000 // messages
    }
  },
  AETHER: {
    name: 'Aether',
    dailyRequests: -1, // unlimited
    requestsPerMinute: 1000,
    maxTokensPerRequest: 32000,
    features: {
      basicChat: true,
      emotionalAnalysis: true,
      personalizedInsights: true,
      toolAccess: true,
      memoryRetention: -1, // unlimited
      conversationHistory: -1, // unlimited
      priorityProcessing: true,
      advancedAnalytics: true
    }
  }
};

export const DEFAULT_TIER = 'CORE';

/**
 * Get user's current tier based on subscription
 */
export function getUserTier(user) {
  if (!user) return DEFAULT_TIER;
  
  // Check for Aether tier (highest premium)
  if (user.subscription?.aether?.isActive) {
    return 'AETHER';
  }
  
  // Check for Pro tier
  if (user.subscription?.pro?.isActive) {
    return 'PRO';
  }
  
  // Default to Core (free tier)
  return 'CORE';
}

/**
 * Check if user has access to a feature
 */
export function hasFeatureAccess(user, featureName) {
  const tier = getUserTier(user);
  const config = TIER_CONFIG[tier];
  return config.features[featureName] || false;
}

/**
 * Get tier limitations
 */
export function getTierLimits(user) {
  const tier = getUserTier(user);
  return TIER_CONFIG[tier];
}