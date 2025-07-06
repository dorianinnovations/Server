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
  
  // Override methods to prefix keys with user ID
  const originalSet = userCache.set.bind(userCache);
  const originalGet = userCache.get.bind(userCache);
  const originalDelete = userCache.delete.bind(userCache);
  
  userCache.set = (key, value, ttl) => originalSet(`user:${userId}:${key}`, value, ttl);
  userCache.get = (key) => originalGet(`user:${userId}:${key}`);
  userCache.delete = (key) => originalDelete(`user:${userId}:${key}`);
  
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