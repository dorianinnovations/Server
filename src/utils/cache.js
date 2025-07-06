import { MEMORY_CONFIG } from "../config/constants.js";

// --- Enhanced Cache Implementation ---
class MemoryCache {
  constructor() {
    this.cache = new Map();
    this.expirationTimes = new Map();
  }

  set(key, value, ttl = MEMORY_CONFIG.CACHE_TTL) {
    const expirationTime = Date.now() + ttl;
    this.cache.set(key, value);
    this.expirationTimes.set(key, expirationTime);
    return this;
  }

  get(key) {
    const expirationTime = this.expirationTimes.get(key);
    if (expirationTime && Date.now() > expirationTime) {
      this.delete(key);
      return undefined;
    }
    return this.cache.get(key);
  }

  delete(key) {
    this.cache.delete(key);
    this.expirationTimes.delete(key);
    return this;
  }

  clear() {
    this.cache.clear();
    this.expirationTimes.clear();
    return this;
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.cache.keys());
  }

  // Clean up expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, expirationTime] of this.expirationTimes.entries()) {
      if (now > expirationTime) {
        this.delete(key);
      }
    }
  }
}

// Global cache instance
const globalCache = new MemoryCache();

// Factory function to create cache instances
export const createCache = () => new MemoryCache();

// User-specific cache factory with user ID prefix
export const createUserCache = (userId) => {
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

// Memory monitoring and garbage collection
let gcCount = 0;
let lastGcTime = Date.now();

export const setupMemoryMonitoring = () => {
  const monitorMemory = () => {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(memoryUsage.rss / 1024 / 1024);
    
    // Clean up expired cache entries
    globalCache.cleanup();
    
    // Log memory usage periodically
    if (Date.now() - lastGcTime > MEMORY_CONFIG.MEMORY_MONITORING_INTERVAL) {
      console.log(
        `Memory: ${heapUsedMB}MB/${heapTotalMB}MB heap, ${rssMB}MB RSS, Cache: ${globalCache.size()} items`
      );
      lastGcTime = Date.now();
    }
    
    // Trigger garbage collection if memory usage is high
    if (memoryUsage.heapUsed > MEMORY_CONFIG.GC_THRESHOLD) {
      console.log("High memory usage detected, triggering garbage collection");
      if (global.gc) {
        console.log("Running garbage collection");
        global.gc();
        gcCount++;
        
        // Log GC stats
        const newMemoryUsage = process.memoryUsage();
        const newHeapUsedMB = Math.round(newMemoryUsage.heapUsed / 1024 / 1024);
        console.log(`GC has been triggered ${gcCount} times`);
        console.log(`Memory after GC: ${newHeapUsedMB}MB heap`);
      }
    }
  };
  
  // Monitor memory every minute
  setInterval(monitorMemory, MEMORY_CONFIG.MEMORY_MONITORING_INTERVAL);
  
  // Initial memory check
  monitorMemory();
};

// Export the global cache instance
export default globalCache; 