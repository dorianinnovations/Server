import { CircuitBreaker, retryOperation, NetworkError, TimeoutError } from '../utils/errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Resilience Service for handling network failures, retries, and graceful degradation
 * Provides circuit breakers, retry logic, and fallback mechanisms
 */
class ResilienceService {
  constructor() {
    this.circuitBreakers = new Map();
    this.requestCache = new Map();
    this.fallbackResponses = new Map();
    this.healthStatus = new Map();
    
    // Initialize circuit breakers for critical services
    this.initializeCircuitBreakers();
    
    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Initialize circuit breakers for critical services
   */
  initializeCircuitBreakers() {
    const services = ['llm', 'database', 'redis', 'websocket', 'email', 'stripe'];
    
    services.forEach(service => {
      this.circuitBreakers.set(service, new CircuitBreaker({
        failureThreshold: service === 'database' ? 3 : 5, // DB is more critical
        timeout: service === 'llm' ? 120000 : 60000, // LLM needs more time
        monitoringPeriod: 10000
      }));
    });
    
    logger.info('Circuit breakers initialized for services', { services });
  }

  /**
   * Execute operation with circuit breaker and retry logic
   */
  async executeWithResilience(serviceName, operation, options = {}) {
    const {
      maxRetries = 3,
      fallback = null,
      cacheKey = null,
      cacheTTL = 300000, // 5 minutes
      skipCircuitBreaker = false
    } = options;

    const circuitBreaker = this.circuitBreakers.get(serviceName);
    
    try {
      // Check cache first if key provided
      if (cacheKey && this.requestCache.has(cacheKey)) {
        const cached = this.requestCache.get(cacheKey);
        if (Date.now() - cached.timestamp < cacheTTL) {
          logger.debug('Returning cached response', { serviceName, cacheKey });
          return cached.data;
        }
        this.requestCache.delete(cacheKey);
      }

      // Execute with circuit breaker and retry
      const result = await retryOperation(async () => {
        if (skipCircuitBreaker || !circuitBreaker) {
          return await operation();
        }
        return await circuitBreaker.execute(operation);
      }, { maxRetries });

      // Cache successful result
      if (cacheKey) {
        this.requestCache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
      }

      // Update health status
      this.healthStatus.set(serviceName, {
        status: 'healthy',
        lastSuccess: Date.now(),
        consecutiveFailures: 0
      });

      return result;

    } catch (error) {
      // Update health status
      const currentHealth = this.healthStatus.get(serviceName) || { consecutiveFailures: 0 };
      this.healthStatus.set(serviceName, {
        status: 'unhealthy',
        lastFailure: Date.now(),
        lastError: error.message,
        consecutiveFailures: currentHealth.consecutiveFailures + 1
      });

      logger.error(`Service ${serviceName} failed after retries`, {
        error: error.message,
        circuitBreakerState: circuitBreaker?.getStats()
      });

      // Try fallback if available
      if (fallback) {
        logger.warn(`Using fallback for service ${serviceName}`);
        try {
          const fallbackResult = typeof fallback === 'function' ? await fallback() : fallback;
          
          // Mark as degraded service
          this.healthStatus.set(serviceName, {
            ...this.healthStatus.get(serviceName),
            status: 'degraded',
            usingFallback: true
          });
          
          return fallbackResult;
        } catch (fallbackError) {
          logger.error(`Fallback also failed for service ${serviceName}`, {
            error: fallbackError.message
          });
        }
      }

      throw error;
    }
  }

  /**
   * Register fallback for a service
   */
  registerFallback(serviceName, fallbackFn) {
    this.fallbackResponses.set(serviceName, fallbackFn);
    logger.debug(`Fallback registered for service ${serviceName}`);
  }

  /**
   * Get health status for all services
   */
  getHealthStatus() {
    const overall = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {}
    };

    for (const [serviceName, breaker] of this.circuitBreakers) {
      const health = this.healthStatus.get(serviceName) || { status: 'unknown' };
      const breakerStats = breaker.getStats();
      
      overall.services[serviceName] = {
        ...health,
        circuitBreaker: breakerStats
      };

      // Determine overall status
      if (health.status === 'unhealthy') {
        overall.status = 'unhealthy';
      } else if (health.status === 'degraded' && overall.status === 'healthy') {
        overall.status = 'degraded';
      }
    }

    return overall;
  }

  /**
   * Reset circuit breaker for a service
   */
  resetCircuitBreaker(serviceName) {
    const breaker = this.circuitBreakers.get(serviceName);
    if (breaker) {
      breaker.state = 'CLOSED';
      breaker.failureCount = 0;
      breaker.lastFailureTime = null;
      logger.info(`Circuit breaker reset for service ${serviceName}`);
    }
  }

  /**
   * Create a resilient HTTP client with retry and circuit breaker
   */
  createResilientHttpClient(baseConfig = {}) {
    const axios = require('axios');
    
    const client = axios.create({
      timeout: 30000,
      ...baseConfig
    });

    // Request interceptor for logging
    client.interceptors.request.use((config) => {
      config.metadata = { startTime: Date.now() };
      logger.debug('HTTP Request', {
        method: config.method,
        url: config.url,
        timeout: config.timeout
      });
      return config;
    });

    // Response interceptor with retry logic
    client.interceptors.response.use(
      (response) => {
        const duration = Date.now() - response.config.metadata.startTime;
        logger.debug('HTTP Response Success', {
          method: response.config.method,
          url: response.config.url,
          status: response.status,
          duration
        });
        return response;
      },
      async (error) => {
        const duration = error.config?.metadata ? 
          Date.now() - error.config.metadata.startTime : 0;
        
        logger.warn('HTTP Response Error', {
          method: error.config?.method,
          url: error.config?.url,
          status: error.response?.status,
          duration,
          error: error.message
        });

        // Convert to appropriate error types
        if (error.code === 'ECONNABORTED') {
          throw new TimeoutError('Request timeout');
        }
        
        if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          throw new NetworkError('Network connection failed');
        }

        throw error;
      }
    );

    return client;
  }

  /**
   * Start health monitoring for services
   */
  startHealthMonitoring() {
    setInterval(() => {
      this.cleanupExpiredCache();
      this.logHealthSummary();
    }, 60000); // Every minute
  }

  /**
   * Cleanup expired cache entries
   */
  cleanupExpiredCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.requestCache) {
      if (now - entry.timestamp > 300000) { // 5 minutes
        this.requestCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} expired cache entries`);
    }
  }

  /**
   * Log health summary
   */
  logHealthSummary() {
    const health = this.getHealthStatus();
    const unhealthyServices = Object.entries(health.services)
      .filter(([_, status]) => status.status === 'unhealthy')
      .map(([name]) => name);
    
    if (unhealthyServices.length > 0) {
      logger.warn('Unhealthy services detected', { services: unhealthyServices });
    }
  }

  /**
   * Create degraded response for when services are down
   */
  createDegradedResponse(message = "Service temporarily unavailable", data = null) {
    return {
      status: 'degraded',
      message,
      data,
      timestamp: new Date().toISOString(),
      suggestion: 'Please try again in a few moments'
    };
  }

  /**
   * Batch operations with individual error handling
   */
  async executeBatch(operations, options = {}) {
    const { 
      failFast = false, 
      maxConcurrency = 5,
      continueOnError = true 
    } = options;

    const results = [];
    const errors = [];
    
    // Process in batches to avoid overwhelming services
    for (let i = 0; i < operations.length; i += maxConcurrency) {
      const batch = operations.slice(i, i + maxConcurrency);
      
      const batchPromises = batch.map(async (operation, index) => {
        try {
          const result = await operation();
          return { success: true, data: result, index: i + index };
        } catch (error) {
          const errorResult = { success: false, error: error.message, index: i + index };
          errors.push(errorResult);
          
          if (failFast) {
            throw error;
          }
          
          return errorResult;
        }
      });

      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        if (failFast) {
          throw error;
        }
      }
    }

    return {
      results: results.filter(r => r.success).map(r => r.data),
      errors,
      totalProcessed: results.length,
      successCount: results.filter(r => r.success).length,
      errorCount: errors.length
    };
  }
}

// Export singleton instance
export default new ResilienceService();