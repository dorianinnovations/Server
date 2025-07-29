import { 
  enhancedErrorHandler, 
  CircuitBreaker, 
  retryOperation,
  NetworkError,
  TimeoutError,
  ServiceUnavailableError
} from '../utils/errorHandler.js';
import resilienceService from '../services/resilienceService.js';
import logger from '../utils/logger.js';

/**
 * Enhanced error resilience middleware for comprehensive error handling
 */
export class ErrorResilienceMiddleware {
  constructor() {
    this.requestMetrics = new Map();
    this.errorPatterns = new Map();
    this.maintenanceMode = false;
  }

  /**
   * Request tracking middleware
   */
  trackRequest() {
    return (req, res, next) => {
      const requestId = req.id || Math.random().toString(36).substr(2, 9);
      req.id = requestId;
      
      const startTime = Date.now();
      req.startTime = startTime;
      
      // Track request metrics
      this.requestMetrics.set(requestId, {
        method: req.method,
        url: req.url,
        startTime,
        userId: req.user?.id,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      // Cleanup old metrics (older than 10 minutes)
      this.cleanupOldMetrics();

      // Add request context to response
      res.setHeader('X-Request-ID', requestId);
      
      next();
    };
  }

  /**
   * Service timeout middleware
   */
  timeoutHandler(timeoutMs = 30000) {
    return (req, res, next) => {
      const timeout = setTimeout(() => {
        if (!res.headersSent) {
          const error = new TimeoutError(`Request timeout after ${timeoutMs}ms`);
          next(error);
        }
      }, timeoutMs);

      res.on('finish', () => clearTimeout(timeout));
      res.on('close', () => clearTimeout(timeout));
      
      next();
    };
  }

  /**
   * Maintenance mode middleware
   */
  maintenanceModeHandler() {
    return (req, res, next) => {
      if (this.maintenanceMode && !req.url.includes('/health')) {
        return res.status(503).json({
          status: 'error',
          message: 'Service temporarily unavailable for maintenance',
          retryAfter: 300000, // 5 minutes
          suggestion: 'Please try again in a few minutes'
        });
      }
      next();
    };
  }

  /**
   * Request rate limiting with circuit breaker
   */
  intelligentRateLimit(options = {}) {
    const {
      windowMs = 60000,
      maxRequests = 100,
      circuitBreakerThreshold = 10
    } = options;

    const requestCounts = new Map();
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: circuitBreakerThreshold,
      timeout: windowMs
    });

    return async (req, res, next) => {
      const clientId = req.ip + (req.user?.id || '');
      const now = Date.now();
      
      try {
        await circuitBreaker.execute(async () => {
          // Clean up old entries
          for (const [key, data] of requestCounts) {
            if (now - data.windowStart > windowMs) {
              requestCounts.delete(key);
            }
          }

          // Check current requests
          const clientData = requestCounts.get(clientId) || { count: 0, windowStart: now };
          
          if (now - clientData.windowStart > windowMs) {
            clientData.count = 1;
            clientData.windowStart = now;
          } else {
            clientData.count++;
          }

          requestCounts.set(clientId, clientData);

          if (clientData.count > maxRequests) {
            throw new Error('Rate limit exceeded');
          }
        });

        next();
      } catch (error) {
        res.status(429).json({
          status: 'error',
          message: 'Too many requests',
          retryAfter: Math.ceil((windowMs - (now - (requestCounts.get(clientId)?.windowStart || now))) / 1000),
          suggestion: 'Please slow down your requests'
        });
      }
    };
  }

  /**
   * Graceful degradation middleware
   */
  gracefulDegradation() {
    return async (req, res, next) => {
      // Add degradation helpers to request
      req.degradation = {
        isHealthy: (serviceName) => {
          const health = resilienceService.getHealthStatus();
          return health.services[serviceName]?.status === 'healthy';
        },
        
        fallbackResponse: (data, message = 'Using cached/fallback data') => {
          return {
            status: 'degraded',
            message,
            data,
            timestamp: new Date().toISOString()
          };
        },
        
        skipNonEssential: (serviceName) => {
          const health = resilienceService.getHealthStatus();
          return health.services[serviceName]?.status !== 'healthy';
        }
      };

      next();
    };
  }

  /**
   * API version compatibility middleware
   */
  apiVersionHandler() {
    return (req, res, next) => {
      const apiVersion = req.headers['api-version'] || '1.0';
      const supportedVersions = ['1.0', '1.1', '2.0'];
      
      if (!supportedVersions.includes(apiVersion)) {
        return res.status(400).json({
          status: 'error',
          message: `API version ${apiVersion} not supported`,
          supportedVersions,
          suggestion: 'Please update your client or use a supported API version'
        });
      }
      
      req.apiVersion = apiVersion;
      res.setHeader('API-Version', apiVersion);
      next();
    };
  }

  /**
   * Response compression and caching middleware
   */
  responseOptimization() {
    return (req, res, next) => {
      const originalJson = res.json;
      
      res.json = function(obj) {
        // Add performance metrics
        if (req.startTime) {
          obj.responseTime = Date.now() - req.startTime;
        }
        
        // Add cache headers for GET requests
        if (req.method === 'GET' && res.statusCode === 200) {
          res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
        }
        
        // Add CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, API-Version');
        
        return originalJson.call(this, obj);
      };
      
      next();
    };
  }

  /**
   * Database connection error handler
   */
  databaseErrorHandler() {
    return (error, req, res, next) => {
      if (error.name === 'MongoError' || error.name === 'MongooseError') {
        logger.error('Database error detected', {
          error: error.message,
          code: error.code,
          requestId: req.id
        });

        // Check if it's a connection error
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          return res.status(503).json({
            status: 'error',
            message: 'Database temporarily unavailable',
            code: 'DATABASE_UNAVAILABLE',
            retryAfter: 5000,
            suggestion: 'Please try again in a moment'
          });
        }

        // Check if it's a timeout
        if (error.code === 'ETIMEOUT') {
          return res.status(408).json({
            status: 'error',
            message: 'Database operation timeout',
            code: 'DATABASE_TIMEOUT',
            retryAfter: 2000,
            suggestion: 'Operation took too long, please try again'
          });
        }
      }
      
      next(error);
    };
  }

  /**
   * External service error handler
   */
  externalServiceErrorHandler() {
    return (error, req, res, next) => {
      // Handle common external service errors
      if (error.response && error.response.status >= 500) {
        logger.warn('External service error', {
          service: error.config?.baseURL || 'unknown',
          status: error.response.status,
          requestId: req.id
        });

        return res.status(502).json({
          status: 'error',
          message: 'External service temporarily unavailable',
          code: 'EXTERNAL_SERVICE_ERROR',
          retryAfter: 10000,
          suggestion: 'Please try again later'
        });
      }

      // Handle rate limiting from external services
      if (error.response && error.response.status === 429) {
        const retryAfter = error.response.headers['retry-after'] || 60;
        
        return res.status(429).json({
          status: 'error',
          message: 'External service rate limit exceeded',
          code: 'EXTERNAL_RATE_LIMIT',
          retryAfter: parseInt(retryAfter) * 1000,
          suggestion: 'Please wait before making more requests'
        });
      }

      next(error);
    };
  }

  /**
   * Cleanup old request metrics
   */
  cleanupOldMetrics() {
    const tenMinutesAgo = Date.now() - 600000;
    
    for (const [requestId, metrics] of this.requestMetrics) {
      if (metrics.startTime < tenMinutesAgo) {
        this.requestMetrics.delete(requestId);
      }
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {
      totalRequests: this.requestMetrics.size,
      errorPatterns: Array.from(this.errorPatterns.entries()),
      maintenanceMode: this.maintenanceMode,
      serviceHealth: resilienceService.getHealthStatus(),
      timestamp: new Date().toISOString()
    };

    return stats;
  }

  /**
   * Enable maintenance mode
   */
  enableMaintenanceMode() {
    this.maintenanceMode = true;
    logger.info('Maintenance mode enabled');
  }

  /**
   * Disable maintenance mode
   */
  disableMaintenanceMode() {
    this.maintenanceMode = false;
    logger.info('Maintenance mode disabled');
  }

  /**
   * Final error handler with comprehensive reporting
   */
  finalErrorHandler() {
    return (error, req, res, next) => {
      // Update error patterns
      const errorType = error.name || 'UnknownError';
      const currentCount = this.errorPatterns.get(errorType) || 0;
      this.errorPatterns.set(errorType, currentCount + 1);

      // Log comprehensive error information
      logger.error('Unhandled error in final handler', {
        error: error.message,
        stack: error.stack,
        requestId: req.id,
        method: req.method,
        url: req.url,
        userId: req.user?.id,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      // Use enhanced error handler
      enhancedErrorHandler(error, req, res, next);
    };
  }
}

// Export singleton instance
export default new ErrorResilienceMiddleware();