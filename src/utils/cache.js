// Enhanced in-memory cache with smart caching capabilities
export const createCache = () => {
  const cache = {
    items: new Map(),
    maxSize: 500, // Increased cache size for better performance
    ttl: 60 * 5 * 1000, // 5 minutes default TTL
    hitCount: 0,
    missCount: 0,
    accessTimes: new Map(), // Track access times for LRU

    set(key, value, customTtl) {
      // Clean cache if it's getting too large using LRU strategy
      if (this.items.size >= this.maxSize) {
        this.evictLRU();
      }

      const ttl = customTtl || this.ttl;
      this.items.set(key, {
        value,
        expires: Date.now() + ttl,
        created: Date.now(),
        accessed: Date.now(),
        accessCount: 1,
      });
      this.accessTimes.set(key, Date.now());
    },

    get(key) {
      const item = this.items.get(key);
      if (!item) {
        this.missCount++;
        return null;
      }

      if (Date.now() > item.expires) {
        this.items.delete(key);
        this.accessTimes.delete(key);
        this.missCount++;
        return null;
      }

      // Update access statistics
      item.accessed = Date.now();
      item.accessCount++;
      this.accessTimes.set(key, Date.now());
      this.hitCount++;

      return item.value;
    },

    has(key) {
      const item = this.items.get(key);
      if (!item) return false;
      
      if (Date.now() > item.expires) {
        this.items.delete(key);
        this.accessTimes.delete(key);
        return false;
      }
      
      return true;
    },

    delete(key) {
      const deleted = this.items.delete(key);
      this.accessTimes.delete(key);
      return deleted;
    },

    clear() {
      this.items.clear();
      this.accessTimes.clear();
      this.hitCount = 0;
      this.missCount = 0;
    },

    // LRU eviction strategy
    evictLRU() {
      const sortedByAccess = [...this.accessTimes.entries()]
        .sort((a, b) => a[1] - b[1]);
      
      const keysToDelete = sortedByAccess.slice(0, Math.floor(this.maxSize * 0.2));
      keysToDelete.forEach(([key]) => {
        this.items.delete(key);
        this.accessTimes.delete(key);
      });
    },

    // Get cache statistics
    getStats() {
      const total = this.hitCount + this.missCount;
      return {
        size: this.items.size,
        maxSize: this.maxSize,
        hitCount: this.hitCount,
        missCount: this.missCount,
        hitRate: total > 0 ? (this.hitCount / total * 100).toFixed(2) + '%' : '0%',
        memoryUsage: this.getMemoryUsage(),
      };
    },

    getMemoryUsage() {
      let totalSize = 0;
      for (const [key, item] of this.items) {
        totalSize += JSON.stringify(key).length + JSON.stringify(item).length;
      }
      return Math.round(totalSize / 1024) + 'KB';
    },

    // Cleanup expired items
    cleanup() {
      const now = Date.now();
      for (const [key, item] of this.items) {
        if (now > item.expires) {
          this.items.delete(key);
          this.accessTimes.delete(key);
        }
      }
    },
  };

  // Setup periodic cleanup
  setInterval(() => {
    cache.cleanup();
  }, 60 * 1000); // Cleanup every minute

  return cache;
};

// Smart caching for user data
export const createUserCache = () => {
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const cache = new Map();

  return {
    async getCachedUser(userId, fetchFunction) {
      const key = `user:${userId}`;
      const cached = cache.get(key);
      
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
      }
      
      const user = await fetchFunction();
      cache.set(key, { data: user, timestamp: Date.now() });
      return user;
    },

    async getCachedMemory(userId, fetchFunction) {
      const key = `memory:${userId}`;
      const cached = cache.get(key);
      
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
      }
      
      const memory = await fetchFunction();
      cache.set(key, { data: memory, timestamp: Date.now() });
      return memory;
    },

    invalidateUser(userId) {
      cache.delete(`user:${userId}`);
      cache.delete(`memory:${userId}`);
    },

    clear() {
      cache.clear();
    },

    getStats() {
      return {
        size: cache.size,
        keys: [...cache.keys()],
      };
    },
  };
};

// Enhanced memory monitoring with performance tracking
export const setupMemoryMonitoring = () => {
  let previousMemory = process.memoryUsage();
  let gcCount = 0;

  const monitoringInterval = setInterval(() => {
    const memUsage = process.memoryUsage();
    const memoryDiff = {
      rss: memUsage.rss - previousMemory.rss,
      heapUsed: memUsage.heapUsed - previousMemory.heapUsed,
      heapTotal: memUsage.heapTotal - previousMemory.heapTotal,
    };

    console.log(
      `Memory: ${Math.round(memUsage.rss / 1024 / 1024)}MB RSS, ` +
      `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB Heap ` +
      `(${memoryDiff.rss > 0 ? '+' : ''}${Math.round(memoryDiff.rss / 1024 / 1024)}MB)`
    );

    // More aggressive GC for high memory usage
    if (memUsage.heapUsed > 150 * 1024 * 1024) { // 150MB threshold
      console.log("High memory usage detected, triggering garbage collection");
      if (global.gc) {
        console.log("Running garbage collection");
        global.gc();
        gcCount++;
      }
    }

    // Log GC statistics
    if (gcCount > 0 && gcCount % 10 === 0) {
      console.log(`GC has been triggered ${gcCount} times`);
    }

    previousMemory = memUsage;
  }, 60 * 1000); // Check every minute

  // Cleanup on exit
  process.on('exit', () => {
    clearInterval(monitoringInterval);
  });

  return {
    stop: () => clearInterval(monitoringInterval),
    getGCCount: () => gcCount,
  };
}; 