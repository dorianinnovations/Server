/**
 * Incremental memory update system
 * Reduces API costs by sending only new/changed context instead of full history
 */

/**
 * Calculate context delta between current and previous requests
 * @param {Array} currentMemory - Current memory context
 * @param {Array} previousMemory - Previous memory context (cached)
 * @param {object} options - Delta calculation options
 * @returns {object} Delta context with only new/changed items
 */
export const calculateMemoryDelta = (currentMemory, previousMemory = [], options = {}) => {
  const {
    maxDeltaSize = 10, // Maximum number of new entries to include
    includeContextBoundary = true // Include some previous context for continuity
  } = options;

  if (!currentMemory || !currentMemory.length) {
    return { delta: [], isIncremental: false, stats: { newEntries: 0, totalEntries: 0 } };
  }

  // If no previous memory, return limited current memory
  if (!previousMemory || !previousMemory.length) {
    const limited = currentMemory.slice(-maxDeltaSize);
    return {
      delta: limited,
      isIncremental: false,
      stats: {
        newEntries: limited.length,
        totalEntries: currentMemory.length,
        strategy: 'initial-load'
      }
    };
  }

  // Find the last common timestamp to identify new entries
  const previousTimestamps = new Set(
    previousMemory.map(mem => new Date(mem.timestamp).getTime())
  );

  const newEntries = currentMemory.filter(mem => 
    !previousTimestamps.has(new Date(mem.timestamp).getTime())
  );

  if (newEntries.length === 0) {
    // No new entries, return minimal context
    return {
      delta: currentMemory.slice(-2), // Just the last 2 for context
      isIncremental: true,
      stats: {
        newEntries: 0,
        totalEntries: currentMemory.length,
        strategy: 'no-changes'
      }
    };
  }

  // Build incremental context
  let deltaContext = [];

  // Add context boundary if needed (last few entries from previous)
  if (includeContextBoundary && previousMemory.length > 0) {
    const contextBoundary = previousMemory.slice(-2); // Last 2 entries for continuity
    deltaContext.push(...contextBoundary);
  }

  // Add new entries (limited)
  const limitedNewEntries = newEntries.slice(-maxDeltaSize);
  deltaContext.push(...limitedNewEntries);

  // Remove duplicates based on timestamp
  const uniqueDelta = deltaContext.filter((mem, index, arr) => 
    arr.findIndex(m => new Date(m.timestamp).getTime() === new Date(mem.timestamp).getTime()) === index
  );

  console.log(`📊 INCREMENTAL MEMORY: ${newEntries.length} new entries, sending ${uniqueDelta.length} total (saved ${currentMemory.length - uniqueDelta.length} entries)`);

  return {
    delta: uniqueDelta,
    isIncremental: true,
    stats: {
      newEntries: newEntries.length,
      totalEntries: currentMemory.length,
      deltaSize: uniqueDelta.length,
      savedEntries: currentMemory.length - uniqueDelta.length,
      strategy: 'incremental-update'
    }
  };
};

/**
 * Memory cache for tracking previous contexts per user
 */
class IncrementalMemoryCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.maxCacheSize = options.maxCacheSize || 1000;
    this.ttl = options.ttl || 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Get previous memory context for a user
   * @param {string} userId - User ID
   * @returns {Array|null} Previous memory context
   */
  getPreviousContext(userId) {
    const cached = this.cache.get(userId);
    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(userId);
      return null;
    }

    return cached.memory;
  }

  /**
   * Store current memory context for future incremental updates
   * @param {string} userId - User ID
   * @param {Array} memory - Current memory context
   */
  storePreviousContext(userId, memory) {
    // Clean up old entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(userId, {
      memory: JSON.parse(JSON.stringify(memory)), // Deep clone
      timestamp: Date.now()
    });
  }

  /**
   * Clear expired entries
   */
  cleanup() {
    const now = Date.now();
    for (const [userId, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.ttl) {
        this.cache.delete(userId);
      }
    }
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      ttl: this.ttl
    };
  }
}

// Global incremental memory cache instance
const incrementalCache = new IncrementalMemoryCache();

// Cleanup interval
setInterval(() => {
  incrementalCache.cleanup();
}, 5 * 60 * 1000); // Every 5 minutes

/**
 * Get incremental memory context for a user
 * @param {string} userId - User ID
 * @param {Array} currentMemory - Current full memory context
 * @param {object} options - Options for incremental processing
 * @returns {object} Incremental memory result
 */
export const getIncrementalMemory = (userId, currentMemory, options = {}) => {
  const {
    enableIncremental = true,
    forceFullContext = false
  } = options;

  if (!enableIncremental || forceFullContext) {
    // Store current context for future use
    incrementalCache.storePreviousContext(userId, currentMemory);
    return {
      memory: currentMemory,
      isIncremental: false,
      stats: { strategy: 'full-context', totalEntries: currentMemory.length }
    };
  }

  // Get previous context
  const previousMemory = incrementalCache.getPreviousContext(userId);
  
  // Calculate delta
  const deltaResult = calculateMemoryDelta(currentMemory, previousMemory, options);
  
  // Store current context for next time
  incrementalCache.storePreviousContext(userId, currentMemory);

  return {
    memory: deltaResult.delta,
    isIncremental: deltaResult.isIncremental,
    stats: deltaResult.stats
  };
};

/**
 * Smart context sizing based on conversation patterns
 * @param {object} incrementalResult - Result from getIncrementalMemory
 * @param {object} userBehavior - User behavior patterns
 * @returns {object} Optimized context recommendation
 */
export const optimizeContextSize = (incrementalResult, userBehavior = {}) => {
  const {
    averageMessageLength = 50,
    questionRatio = 0.3,
    technicalTermsRatio = 0.1,
    emotionalIntensity = 0.5
  } = userBehavior;

  let recommendation = {
    contextType: 'standard',
    maxTokens: 500,
    includeImages: true,
    compressionLevel: 'medium'
  };

  // Adjust based on conversation complexity
  if (technicalTermsRatio > 0.3 || averageMessageLength > 100) {
    recommendation.contextType = 'detailed';
    recommendation.maxTokens = 800;
    recommendation.compressionLevel = 'low';
  } else if (questionRatio < 0.1 && averageMessageLength < 30) {
    recommendation.contextType = 'minimal';
    recommendation.maxTokens = 200;
    recommendation.compressionLevel = 'high';
  }

  // Adjust for emotional content
  if (emotionalIntensity > 0.7) {
    recommendation.includeEmotionalContext = true;
    recommendation.maxTokens += 100;
  }

  // Apply incremental savings
  if (incrementalResult.isIncremental && incrementalResult.stats.savedEntries > 5) {
    recommendation.costSavings = {
      entriesSaved: incrementalResult.stats.savedEntries,
      estimatedTokensSaved: incrementalResult.stats.savedEntries * 50, // Rough estimate
      estimatedCostSaved: (incrementalResult.stats.savedEntries * 50 / 1000) * 0.01
    };
  }

  return recommendation;
};

/**
 * Get cache statistics for monitoring
 * @returns {object} Incremental memory system stats
 */
export const getIncrementalStats = () => {
  return {
    cache: incrementalCache.getStats(),
    systemStatus: 'active',
    lastCleanup: new Date().toISOString()
  };
};