import { MEMORY_CONFIG } from '../config/constants.js';
import logger from '../utils/logger.js';
import globalCache from '../utils/cache.js';

/**
 * Performance Optimization Service
 * Handles automatic performance tuning, memory management, and resource optimization
 */
class PerformanceOptimizer {
  constructor() {
    this.isOptimizing = false;
    this.optimizationHistory = [];
    this.performanceMetrics = {
      averageResponseTime: 0,
      memoryUsage: 0,
      cacheHitRate: 0,
      gcFrequency: 0,
      activeConnections: 0
    };
    this.optimizationStrategies = new Map();
    this.lastOptimization = Date.now();
  }

  /**
   * Initialize the performance optimizer
   */
  initialize() {
    console.log('🚀 Initializing Performance Optimizer...');
    
    // Register optimization strategies
    this.registerOptimizationStrategies();
    
    // Start continuous monitoring
    this.startContinuousMonitoring();
    
    // Set up automatic optimizations
    this.setupAutomaticOptimizations();
    
    console.log('✅ Performance Optimizer initialized');
  }

  /**
   * Register different optimization strategies
   */
  registerOptimizationStrategies() {
    // Memory pressure optimization
    this.optimizationStrategies.set('memory_pressure', {
      condition: () => {
        const usage = process.memoryUsage();
        const heapRatio = usage.heapUsed / usage.heapTotal;
        return heapRatio > MEMORY_CONFIG.HEAP_USAGE_THRESHOLD;
      },
      action: () => this.optimizeMemoryUsage(),
      priority: 1,
      cooldown: 30000 // 30 seconds
    });

    // Cache optimization
    this.optimizationStrategies.set('cache_optimization', {
      condition: () => {
        const stats = globalCache.getStats();
        const hitRate = parseFloat(stats.hitRate);
        return hitRate < 70; // Less than 70% hit rate
      },
      action: () => this.optimizeCacheStrategy(),
      priority: 2,
      cooldown: 60000 // 1 minute
    });

    // Garbage collection optimization
    this.optimizationStrategies.set('gc_optimization', {
      condition: () => {
        const usage = process.memoryUsage();
        return usage.heapUsed > MEMORY_CONFIG.GC_THRESHOLD;
      },
      action: () => this.optimizeGarbageCollection(),
      priority: 3,
      cooldown: 45000 // 45 seconds
    });

    // Response time optimization
    this.optimizationStrategies.set('response_time', {
      condition: () => this.performanceMetrics.averageResponseTime > 2000,
      action: () => this.optimizeResponseTime(),
      priority: 2,
      cooldown: 120000 // 2 minutes
    });
  }

  /**
   * Start continuous performance monitoring
   */
  startContinuousMonitoring() {
    setInterval(() => {
      this.updatePerformanceMetrics();
      this.checkOptimizationTriggers();
    }, 15000); // Every 15 seconds
  }

  /**
   * Update current performance metrics
   */
  updatePerformanceMetrics() {
    const memoryUsage = process.memoryUsage();
    const cacheStats = globalCache.getStats();
    
    this.performanceMetrics = {
      ...this.performanceMetrics,
      memoryUsage: Math.round(memoryUsage.heapUsed / 1048576), // MB
      heapUsageRatio: memoryUsage.heapUsed / memoryUsage.heapTotal,
      cacheHitRate: parseFloat(cacheStats.hitRate) || 0,
      cacheSize: cacheStats.size,
      timestamp: Date.now()
    };
  }

  /**
   * Check if any optimization strategies should be triggered
   */
  async checkOptimizationTriggers() {
    if (this.isOptimizing) return;

    const now = Date.now();
    const strategies = Array.from(this.optimizationStrategies.entries())
      .filter(([name, strategy]) => {
        const lastRun = this.optimizationHistory
          .filter(h => h.strategy === name)
          .map(h => h.timestamp)
          .sort((a, b) => b - a)[0] || 0;
        
        return strategy.condition() && (now - lastRun) > strategy.cooldown;
      })
      .sort((a, b) => a[1].priority - b[1].priority);

    if (strategies.length > 0) {
      const [strategyName, strategy] = strategies[0];
      await this.executeOptimization(strategyName, strategy);
    }
  }

  /**
   * Execute a specific optimization strategy
   */
  async executeOptimization(strategyName, strategy) {
    this.isOptimizing = true;
    const startTime = process.hrtime.bigint();
    
    console.log(`🔧 Executing optimization strategy: ${strategyName}`);
    
    try {
      const result = await strategy.action();
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000; // ms
      
      const optimizationRecord = {
        strategy: strategyName,
        timestamp: Date.now(),
        duration: Math.round(duration),
        result,
        success: true
      };
      
      this.optimizationHistory.push(optimizationRecord);
      
      // Keep only last 100 optimization records
      if (this.optimizationHistory.length > 100) {
        this.optimizationHistory = this.optimizationHistory.slice(-100);
      }
      
      logger.info(`✅ Optimization completed: ${strategyName} in ${Math.round(duration)}ms`, result);
      
    } catch (error) {
      logger.error(`❌ Optimization failed: ${strategyName}`, error);
      
      this.optimizationHistory.push({
        strategy: strategyName,
        timestamp: Date.now(),
        duration: Number(process.hrtime.bigint() - startTime) / 1000000,
        success: false,
        error: error.message
      });
    }
    
    this.isOptimizing = false;
  }

  /**
   * Optimize memory usage
   */
  async optimizeMemoryUsage() {
    const beforeUsage = process.memoryUsage();
    const results = {
      beforeMemory: Math.round(beforeUsage.heapUsed / 1048576),
      actions: []
    };

    // Clean up cache aggressively
    const cacheCleanup = globalCache.cleanupByMemoryPressure();
    if (cacheCleanup > 0) {
      results.actions.push(`Cleaned ${cacheCleanup} cache entries`);
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      results.actions.push('Forced garbage collection');
    }

    // Clear require cache for unused modules (careful with this)
    if (process.env.NODE_ENV === 'development') {
      const beforeCacheSize = Object.keys(require.cache).length;
      // Only clear non-core modules that haven't been accessed recently
      // This is a more conservative approach
      results.actions.push(`Require cache maintained (${beforeCacheSize} modules)`);
    }

    const afterUsage = process.memoryUsage();
    results.afterMemory = Math.round(afterUsage.heapUsed / 1048576);
    results.memoryFreed = results.beforeMemory - results.afterMemory;

    return results;
  }

  /**
   * Optimize cache strategy
   */
  async optimizeCacheStrategy() {
    const cacheStats = globalCache.getStats();
    const results = {
      beforeStats: { ...cacheStats },
      actions: []
    };

    // Clean up expired entries
    const expiredCleaned = globalCache.cleanup();
    if (expiredCleaned > 0) {
      results.actions.push(`Cleaned ${expiredCleaned} expired entries`);
    }

    // If hit rate is low, clear some cache to make room for more relevant data
    if (parseFloat(cacheStats.hitRate) < 50) {
      const cleaned = globalCache.cleanupByMemoryPressure();
      results.actions.push(`LRU cleanup: removed ${cleaned} entries`);
    }

    const afterStats = globalCache.getStats();
    results.afterStats = { ...afterStats };
    results.hitRateImprovement = parseFloat(afterStats.hitRate) - parseFloat(cacheStats.hitRate);

    return results;
  }

  /**
   * Optimize garbage collection
   */
  async optimizeGarbageCollection() {
    const beforeUsage = process.memoryUsage();
    const results = {
      beforeMemory: Math.round(beforeUsage.heapUsed / 1048576),
      gcAvailable: !!global.gc
    };

    if (global.gc) {
      const gcStart = process.hrtime.bigint();
      global.gc();
      const gcDuration = Number(process.hrtime.bigint() - gcStart) / 1000000;
      
      const afterUsage = process.memoryUsage();
      results.afterMemory = Math.round(afterUsage.heapUsed / 1048576);
      results.memoryFreed = results.beforeMemory - results.afterMemory;
      results.gcDuration = Math.round(gcDuration);
    } else {
      results.message = 'Garbage collection not available (use --expose-gc flag)';
    }

    return results;
  }

  /**
   * Optimize response time
   */
  async optimizeResponseTime() {
    const results = {
      beforeResponseTime: this.performanceMetrics.averageResponseTime,
      actions: []
    };

    // Preemptively clean up resources that might slow down responses
    const cacheCleanup = globalCache.cleanup();
    if (cacheCleanup > 0) {
      results.actions.push(`Cache cleanup: ${cacheCleanup} entries`);
    }

    // If memory usage is high, it might be affecting response times
    const memoryUsage = process.memoryUsage();
    const heapRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;
    
    if (heapRatio > 0.8) {
      if (global.gc) {
        global.gc();
        results.actions.push('Garbage collection for response time');
      }
    }

    results.optimizationApplied = results.actions.length > 0;
    
    return results;
  }

  /**
   * Set up automatic optimizations based on time intervals
   */
  setupAutomaticOptimizations() {
    // Periodic cache maintenance (every 5 minutes)
    setInterval(() => {
      const cleaned = globalCache.cleanup();
      if (cleaned > 0) {
        console.log(`🧹 Automatic cache cleanup: removed ${cleaned} expired entries`);
      }
    }, 5 * 60 * 1000);

    // Memory health check (every 10 minutes)
    setInterval(() => {
      const usage = process.memoryUsage();
      const heapRatio = usage.heapUsed / usage.heapTotal;
      
      if (heapRatio > 0.9) {
        console.log('⚠️ Critical memory usage detected, triggering emergency cleanup');
        this.executeOptimization('memory_pressure', this.optimizationStrategies.get('memory_pressure'));
      }
    }, 10 * 60 * 1000);

    console.log('📅 Automatic optimization schedules configured');
  }

  /**
   * Get current performance report
   */
  getPerformanceReport() {
    const recentOptimizations = this.optimizationHistory
      .filter(opt => Date.now() - opt.timestamp < 3600000) // Last hour
      .slice(-10);

    return {
      currentMetrics: this.performanceMetrics,
      recentOptimizations,
      cacheStats: globalCache.getStats(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      lastOptimization: this.lastOptimization,
      optimizationCount: this.optimizationHistory.length
    };
  }

  /**
   * Manual optimization trigger
   */
  async runManualOptimization() {
    console.log('🔧 Running manual performance optimization...');
    
    const promises = [];
    
    // Run all applicable optimizations
    for (const [name, strategy] of this.optimizationStrategies) {
      if (strategy.condition()) {
        promises.push(this.executeOptimization(name, strategy));
      }
    }
    
    await Promise.all(promises);
    
    return this.getPerformanceReport();
  }
}

// Export singleton instance
export default new PerformanceOptimizer();