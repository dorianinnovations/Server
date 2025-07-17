/**
 * Memory analytics and cost tracking system
 * Provides insights into memory usage patterns and optimization effectiveness
 */

/**
 * Global analytics storage
 */
class MemoryAnalytics {
  constructor() {
    this.sessions = new Map();
    this.globalStats = {
      totalRequests: 0,
      totalTokensSaved: 0,
      totalCostSaved: 0,
      optimizationStrategies: new Map(),
      averageResponseTime: 0,
      startTime: Date.now()
    };
  }

  /**
   * Track a completion request
   * @param {string} userId - User ID
   * @param {object} requestData - Request analytics data
   */
  trackRequest(userId, requestData) {
    const {
      contextType = 'standard',
      incrementalStats = {},
      imageOptimization = {},
      responseTime = 0,
      tokensSaved = 0,
      costSaved = 0,
      memoryUsed = 0,
      strategy = 'unknown'
    } = requestData;

    // Update global stats
    this.globalStats.totalRequests++;
    this.globalStats.totalTokensSaved += tokensSaved;
    this.globalStats.totalCostSaved += costSaved;
    
    // Update average response time
    const currentAvg = this.globalStats.averageResponseTime;
    const totalRequests = this.globalStats.totalRequests;
    this.globalStats.averageResponseTime = 
      (currentAvg * (totalRequests - 1) + responseTime) / totalRequests;

    // Track optimization strategy usage
    const strategyCount = this.globalStats.optimizationStrategies.get(strategy) || 0;
    this.globalStats.optimizationStrategies.set(strategy, strategyCount + 1);

    // Update user session
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, {
        userId,
        requests: [],
        totalTokensSaved: 0,
        totalCostSaved: 0,
        averageMemoryUsed: 0,
        patterns: {
          contextTypes: new Map(),
          optimizationEffectiveness: [],
          conversationLength: 0
        },
        startTime: Date.now()
      });
    }

    const session = this.sessions.get(userId);
    session.requests.push({
      timestamp: Date.now(),
      contextType,
      incrementalStats,
      imageOptimization,
      responseTime,
      tokensSaved,
      costSaved,
      memoryUsed,
      strategy
    });

    // Update session totals
    session.totalTokensSaved += tokensSaved;
    session.totalCostSaved += costSaved;
    session.patterns.conversationLength = session.requests.length;

    // Update context type tracking
    const contextCount = session.patterns.contextTypes.get(contextType) || 0;
    session.patterns.contextTypes.set(contextType, contextCount + 1);

    // Update average memory used
    const totalMemory = session.requests.reduce((sum, req) => sum + req.memoryUsed, 0);
    session.averageMemoryUsed = totalMemory / session.requests.length;

    // Calculate optimization effectiveness
    if (tokensSaved > 0) {
      session.patterns.optimizationEffectiveness.push({
        timestamp: Date.now(),
        tokensSaved,
        costSaved,
        strategy
      });
    }

    console.log(`📊 ANALYTICS: User ${userId} - ${strategy} strategy saved ${tokensSaved} tokens, $${costSaved.toFixed(4)}`);
  }

  /**
   * Get analytics for a specific user
   * @param {string} userId - User ID
   * @returns {object} User analytics
   */
  getUserAnalytics(userId) {
    const session = this.sessions.get(userId);
    if (!session) {
      return { error: 'No analytics data found for user' };
    }

    const recentRequests = session.requests.slice(-10); // Last 10 requests
    const totalSavings = session.totalCostSaved;
    const averageTokensSaved = session.totalTokensSaved / session.requests.length;

    return {
      userId,
      sessionDuration: Date.now() - session.startTime,
      totalRequests: session.requests.length,
      totalTokensSaved: session.totalTokensSaved,
      totalCostSaved: session.totalCostSaved,
      averageTokensSaved,
      averageMemoryUsed: session.averageMemoryUsed,
      contextTypeDistribution: Object.fromEntries(session.patterns.contextTypes),
      optimizationEffectiveness: session.patterns.optimizationEffectiveness.slice(-5),
      recentPerformance: recentRequests.map(req => ({
        timestamp: req.timestamp,
        strategy: req.strategy,
        tokensSaved: req.tokensSaved,
        responseTime: req.responseTime
      }))
    };
  }

  /**
   * Get global system analytics
   * @returns {object} Global analytics
   */
  getGlobalAnalytics() {
    const uptime = Date.now() - this.globalStats.startTime;
    const requestsPerHour = (this.globalStats.totalRequests / (uptime / (1000 * 60 * 60))).toFixed(2);
    
    return {
      systemUptime: uptime,
      totalRequests: this.globalStats.totalRequests,
      requestsPerHour: parseFloat(requestsPerHour),
      totalTokensSaved: this.globalStats.totalTokensSaved,
      totalCostSaved: this.globalStats.totalCostSaved,
      averageResponseTime: this.globalStats.averageResponseTime,
      optimizationStrategies: Object.fromEntries(this.globalStats.optimizationStrategies),
      activeUsers: this.sessions.size,
      averageSavingsPerRequest: this.globalStats.totalRequests > 0 
        ? (this.globalStats.totalCostSaved / this.globalStats.totalRequests).toFixed(6)
        : 0
    };
  }

  /**
   * Generate optimization recommendations
   * @param {string} userId - User ID
   * @returns {object} Recommendations
   */
  generateRecommendations(userId) {
    const userAnalytics = this.getUserAnalytics(userId);
    if (userAnalytics.error) {
      return { recommendations: [] };
    }

    const recommendations = [];

    // Analyze context type distribution
    const contextTypes = userAnalytics.contextTypeDistribution;
    const totalRequests = userAnalytics.totalRequests;
    
    if (contextTypes.standard && (contextTypes.standard / totalRequests) > 0.8) {
      recommendations.push({
        type: 'context-optimization',
        priority: 'medium',
        message: 'Consider using focused context mode for technical discussions to save tokens',
        potential_savings: '10-20% token reduction'
      });
    }

    // Analyze memory usage patterns
    if (userAnalytics.averageMemoryUsed > 20) {
      recommendations.push({
        type: 'memory-optimization',
        priority: 'high',
        message: 'High memory usage detected - enable incremental updates and image compression',
        potential_savings: '30-50% memory reduction'
      });
    }

    // Analyze optimization effectiveness
    const avgTokensSaved = userAnalytics.averageTokensSaved;
    if (avgTokensSaved < 50 && totalRequests > 5) {
      recommendations.push({
        type: 'strategy-optimization',
        priority: 'high',
        message: 'Low optimization effectiveness - review conversation patterns and enable advanced features',
        potential_savings: '40-60% cost reduction'
      });
    }

    // Check for image usage patterns
    const hasImageRequests = userAnalytics.recentPerformance.some(req => 
      req.strategy && req.strategy.includes('image')
    );
    
    if (hasImageRequests) {
      recommendations.push({
        type: 'image-optimization',
        priority: 'medium',
        message: 'Image compression and deduplication can significantly reduce costs',
        potential_savings: '50-90% image processing costs'
      });
    }

    return { recommendations, analytics: userAnalytics };
  }

  /**
   * Clean up old session data
   * @param {number} maxAge - Maximum age in milliseconds
   */
  cleanup(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
    const now = Date.now();
    for (const [userId, session] of this.sessions.entries()) {
      if (now - session.startTime > maxAge) {
        this.sessions.delete(userId);
      }
    }
  }
}

// Global analytics instance
const memoryAnalytics = new MemoryAnalytics();

// Cleanup interval
setInterval(() => {
  memoryAnalytics.cleanup();
}, 60 * 60 * 1000); // Every hour

/**
 * Track a completion request
 * @param {string} userId - User ID
 * @param {object} requestData - Request data
 */
export const trackMemoryUsage = (userId, requestData) => {
  memoryAnalytics.trackRequest(userId, requestData);
};

/**
 * Get user analytics
 * @param {string} userId - User ID
 * @returns {object} User analytics
 */
export const getUserMemoryAnalytics = (userId) => {
  return memoryAnalytics.getUserAnalytics(userId);
};

/**
 * Get global analytics
 * @returns {object} Global analytics
 */
export const getGlobalMemoryAnalytics = () => {
  return memoryAnalytics.getGlobalAnalytics();
};

/**
 * Generate optimization recommendations
 * @param {string} userId - User ID
 * @returns {object} Recommendations
 */
export const getOptimizationRecommendations = (userId) => {
  return memoryAnalytics.generateRecommendations(userId);
};

/**
 * Calculate cost savings from optimization strategies
 * @param {object} before - Before optimization stats
 * @param {object} after - After optimization stats
 * @returns {object} Savings calculation
 */
export const calculateOptimizationSavings = (before, after) => {
  const tokensSaved = Math.max(0, before.tokens - after.tokens);
  const costSaved = tokensSaved * 0.00001; // Rough estimate: $0.01 per 1K tokens
  const percentageSaved = before.tokens > 0 ? (tokensSaved / before.tokens * 100) : 0;

  return {
    tokensSaved,
    costSaved: parseFloat(costSaved.toFixed(6)),
    percentageSaved: parseFloat(percentageSaved.toFixed(2)),
    strategy: after.strategy || 'unknown',
    timestamp: Date.now()
  };
};