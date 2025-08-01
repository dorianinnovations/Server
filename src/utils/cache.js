import { MEMORY_CONFIG } from "../config/constants.js";

// Cache system initializing

// --- Enhanced Cache Implementation ---
class MemoryCache {
  constructor(maxSize = MEMORY_CONFIG.MAX_CACHE_SIZE || 1000) {
    this.cache = new Map();
    this.expirationTimes = new Map();
    this.accessTimes = new Map(); // Track access for LRU eviction
    this.maxSize = maxSize;
    this.hitCount = 0;
    this.missCount = 0;
  }

  set(key, value, ttl = MEMORY_CONFIG.CACHE_TTL) {
    const now = Date.now();
    const expirationTime = now + ttl;
    
    // If at max capacity, evict least recently used item
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this._evictLRU();
    }
    
    this.cache.set(key, value);
    this.expirationTimes.set(key, expirationTime);
    this.accessTimes.set(key, now);
    return this;
  }

  get(key) {
    const now = Date.now();
    const expirationTime = this.expirationTimes.get(key);
    
    // Check expiration first
    if (expirationTime && now > expirationTime) {
      this.delete(key);
      this.missCount++;
      return null;
    }
    
    // Check if key exists in cache
    if (this.cache.has(key)) {
      this.accessTimes.set(key, now); // Update access time for LRU
      this.hitCount++;
      return this.cache.get(key);
    }
    
    this.missCount++;
    return null; // Key doesn't exist
  }

  // LRU eviction helper
  _evictLRU() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, accessTime] of this.accessTimes) {
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  delete(key) {
    this.cache.delete(key);
    this.expirationTimes.delete(key);
    this.accessTimes.delete(key);
    return this;
  }

  clear() {
    this.cache.clear();
    this.expirationTimes.clear();
    this.accessTimes.clear();
    this.hitCount = 0;
    this.missCount = 0;
    return this;
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.cache.keys());
  }

  // Get cache statistics
  getStats() {
    const total = this.hitCount + this.missCount;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: total > 0 ? ((this.hitCount / total) * 100).toFixed(2) + '%' : '0%',
      memoryUsage: this._estimateMemoryUsage()
    };
  }

  // Estimate memory usage
  _estimateMemoryUsage() {
    let size = 0;
    for (const [key, value] of this.cache) {
      size += this._getObjectSize(key) + this._getObjectSize(value);
    }
    return Math.round(size / 1024) + ' KB';
  }

  // Rough object size estimation
  _getObjectSize(obj) {
    if (obj === null || obj === undefined) return 0;
    if (typeof obj === 'string') return obj.length * 2; // UTF-16
    if (typeof obj === 'number') return 8;
    if (typeof obj === 'boolean') return 4;
    if (typeof obj === 'object') {
      return JSON.stringify(obj).length * 2; // Rough estimate
    }
    return 0;
  }

  // Clean up expired entries (optimized)
  cleanup() {
    const now = Date.now();
    const expiredKeys = [];
    
    // Collect expired keys first
    for (const [key, expirationTime] of this.expirationTimes.entries()) {
      if (now > expirationTime) {
        expiredKeys.push(key);
      }
    }
    
    // Then delete them (avoids modifying Map while iterating)
    for (const key of expiredKeys) {
      this.delete(key);
    }
    
    return expiredKeys.length; // Return number of items cleaned
  }

  // Cleanup by memory pressure
  cleanupByMemoryPressure() {
    const memUsage = process.memoryUsage();
    const heapUsedRatio = memUsage.heapUsed / memUsage.heapTotal;
    
    if (heapUsedRatio > MEMORY_CONFIG.HEAP_USAGE_THRESHOLD) {
      // Aggressively clean up half the cache, starting with LRU items
      const targetSize = Math.floor(this.cache.size / 2);
      const sortedByAccess = Array.from(this.accessTimes.entries())
        .sort((a, b) => a[1] - b[1]) // Sort by access time (oldest first)
        .slice(0, this.cache.size - targetSize);
      
      for (const [key] of sortedByAccess) {
        this.delete(key);
      }
      
      return sortedByAccess.length;
    }
    
    return 0;
  }
}

// Memory cache class ready

// Global cache instance
const globalCache = new MemoryCache();

// Global cache ready

// Factory function to create cache instances
export const createCache = () => {
  // Creating cache instance
  return new MemoryCache();
};

// User-specific cache factory with user ID prefix
export const createUserCache = (userId) => {
  console.log(`✓Creating user-specific cache for user: ${userId}`);
  const userCache = new MemoryCache();
  
  // Override methods to prefix keys with user ID if userId is provided
  const originalSet = userCache.set.bind(userCache);
  const originalGet = userCache.get.bind(userCache);
  const originalDelete = userCache.delete.bind(userCache);
  
  if (userId) {
    userCache.set = (key, value, ttl) => originalSet(`user:${userId}:${key}`, value, ttl);
    userCache.get = (key) => originalGet(`user:${userId}:${key}`);
    userCache.delete = (key) => originalDelete(`user:${userId}:${key}`);
  }

  // Add cache-first methods for user data
  userCache.getCachedUser = async (targetUserId, fallbackFunction) => {
    const cacheKey = `user:${targetUserId}`;
    
    // Try to get from cache first
    let cachedUser = userCache.get(cacheKey);
    if (cachedUser) {
      console.log(`✓ Cache hit for user ${targetUserId}`);
      return cachedUser;
    }
    
    // If not in cache, execute fallback function
    console.log(`⚡ Cache miss for user ${targetUserId}, fetching from database`);
    try {
      const userData = await fallbackFunction();
      if (userData) {
        // Cache the result for 5 minutes
        userCache.set(cacheKey, userData, 5 * 60 * 1000);
        console.log(`✓ Cached user ${targetUserId} data`);
      }
      return userData;
    } catch (error) {
      console.error(`❌ Failed to fetch user ${targetUserId}:`, error);
      throw error;
    }
  };

  // Add cache-first methods for memory data
  userCache.getCachedMemory = async (targetUserId, fallbackFunction) => {
    const cacheKey = `memory:${targetUserId}`;
    
    // Try to get from cache first
    let cachedMemory = userCache.get(cacheKey);
    if (cachedMemory) {
      console.log(`✓ Cache hit for memory ${targetUserId}`);
      return cachedMemory;
    }
    
    // If not in cache, execute fallback function
    console.log(`⚡ Cache miss for memory ${targetUserId}, fetching from database`);
    try {
      const memoryData = await fallbackFunction();
      if (memoryData) {
        // Cache the result for 2 minutes (shorter TTL for more dynamic data)
        userCache.set(cacheKey, memoryData, 2 * 60 * 1000);
        console.log(`✓ Cached memory ${targetUserId} data`);
      }
      return memoryData;
    } catch (error) {
      console.error(`❌ Failed to fetch memory for ${targetUserId}:`, error);
      throw error;
    }
  };

  // Add method to invalidate user-specific cache entries
  userCache.invalidateUser = (targetUserId) => {
    const userKey = `user:${targetUserId}`;
    const memoryKey = `memory:${targetUserId}`;
    
    userCache.delete(userKey);
    userCache.delete(memoryKey);
    
    console.log(`🗑️ Invalidated cache for user ${targetUserId}`);
  };
  
  return userCache;
};

// Memory monitoring and garbage collection (optimized)
let gcCount = 0;
let lastGcTime = Date.now();
let lastLogTime = Date.now();
let memoryPressureCount = 0;

export const setupMemoryMonitoring = () => {
  // Setting up enhanced memory monitoring
  
  const monitorMemory = () => {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1048576); // More efficient division
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1048576);
    const rssMB = Math.round(memoryUsage.rss / 1048576);
    const externalMB = Math.round(memoryUsage.external / 1048576);
    const heapUsageRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;
    const now = Date.now();
    
    // Clean up expired cache entries
    const expiredCount = globalCache.cleanup();
    
    // Memory pressure detection and cleanup
    if (heapUsageRatio > MEMORY_CONFIG.HEAP_USAGE_THRESHOLD) {
      memoryPressureCount++;
      const cleanedCount = globalCache.cleanupByMemoryPressure();
      // Memory pressure detected - cleaning cache
    } else {
      memoryPressureCount = 0; // Reset counter when pressure is relieved
    }
    
    // Log memory usage periodically (but not too frequently)
    if (now - lastLogTime > MEMORY_CONFIG.MEMORY_MONITORING_INTERVAL * 2) {
      const cacheStats = globalCache.getStats();
      // Memory stats logged
      lastLogTime = now;
    }
    
    // Trigger garbage collection if memory usage is critically high
    if (memoryUsage.heapUsed > MEMORY_CONFIG.GC_THRESHOLD || memoryPressureCount > 3) {
      // High memory usage - triggering GC
      
      if (global.gc) {
        const gcStart = process.hrtime.bigint();
        global.gc();
        const gcDuration = Number(process.hrtime.bigint() - gcStart) / 1000000; // ms
        gcCount++;
        memoryPressureCount = 0; // Reset after GC
        
        // Log GC stats
        const newMemoryUsage = process.memoryUsage();
        const newHeapUsedMB = Math.round(newMemoryUsage.heapUsed / 1048576);
        const memoryFreed = heapUsedMB - newHeapUsedMB;
        
        // GC completed
      } else {
        // GC not available (use --expose-gc flag)
      }
    }
  };
  
  // Monitor memory more frequently for better responsiveness
  const monitoringInterval = setInterval(monitorMemory, MEMORY_CONFIG.MEMORY_MONITORING_INTERVAL);
  
  // Additional cleanup interval for cache
  const cacheCleanupInterval = setInterval(() => {
    const cleaned = globalCache.cleanup();
    if (cleaned > 0) {
      // Cache cleanup: removed expired entries
    }
  }, MEMORY_CONFIG.CACHE_CLEANUP_INTERVAL || 300000);
  
  // Initial memory check
  monitorMemory();
  
  // Graceful shutdown cleanup
  process.on('SIGTERM', () => {
    clearInterval(monitoringInterval);
    clearInterval(cacheCleanupInterval);
    globalCache.clear();
    console.log('🛑 Memory monitoring stopped and cache cleared');
  });
  
  // Memory monitoring initialized
};

// Component ready

// Export the global cache instance
export default globalCache;