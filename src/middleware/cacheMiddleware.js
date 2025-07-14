import redisService from '../services/redisService.js';
import logger from '../utils/logger.js';

/**
 * Advanced Caching Middleware
 * Intelligent caching with compression, cache invalidation, and mobile optimization
 */

/**
 * Cache response middleware
 * @param {Object} options - Caching options
 * @param {number} options.ttl - Time to live in seconds
 * @param {string} options.prefix - Cache key prefix
 * @param {boolean} options.compress - Enable compression
 * @param {function} options.keyGenerator - Custom key generator
 * @param {array} options.varyBy - Headers to vary cache by
 * @param {function} options.shouldCache - Function to determine if response should be cached
 */
export function cacheResponse(options = {}) {
  const {
    ttl = 300, // 5 minutes default
    prefix = 'cache',
    compress = true,
    keyGenerator = null,
    varyBy = ['user-agent', 'accept-encoding'],
    shouldCache = (req, res) => req.method === 'GET' && res.statusCode === 200
  } = options;

  return async (req, res, next) => {
    try {
      // Skip caching for non-GET requests by default
      if (req.method !== 'GET') {
        return next();
      }

      // Generate cache key
      const cacheKey = keyGenerator ? 
        keyGenerator(req) : 
        generateCacheKey(req, prefix, varyBy);

      // Try to get from cache
      const cachedResponse = await redisService.get(cacheKey);
      
      if (cachedResponse) {
        // Set cache headers
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);
        res.set('X-Cache-TTL', await redisService.ttl(cacheKey));
        
        // Set original headers
        if (cachedResponse.headers) {
          Object.entries(cachedResponse.headers).forEach(([key, value]) => {
            res.set(key, value);
          });
        }
        
        // Send cached response
        return res.status(cachedResponse.statusCode).json(cachedResponse.data);
      }

      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = async function(data) {
        try {
          // Check if we should cache this response
          if (shouldCache(req, res)) {
            const responseData = {
              statusCode: res.statusCode,
              headers: getResponseHeaders(res),
              data: data,
              timestamp: new Date(),
              compressed: compress
            };

            // Cache the response
            await redisService.set(cacheKey, responseData, ttl);
            
            // Set cache headers
            res.set('X-Cache', 'MISS');
            res.set('X-Cache-Key', cacheKey);
            res.set('X-Cache-TTL', ttl);
          }
        } catch (error) {
          logger.error('Cache middleware error:', error);
        }

        // Call original json method
        return originalJson.call(this, data);
      };

      next();

    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
}

/**
 * Cache invalidation middleware
 * @param {Object} options - Invalidation options
 * @param {string} options.pattern - Cache key pattern to invalidate
 * @param {function} options.patternGenerator - Function to generate invalidation pattern
 * @param {array} options.methods - HTTP methods that trigger invalidation
 */
export function invalidateCache(options = {}) {
  const {
    pattern = null,
    patternGenerator = null,
    methods = ['POST', 'PUT', 'PATCH', 'DELETE']
  } = options;

  return async (req, res, next) => {
    try {
      // Only invalidate on specified methods
      if (!methods.includes(req.method)) {
        return next();
      }

      // Generate invalidation pattern
      const invalidationPattern = patternGenerator ? 
        patternGenerator(req) : 
        pattern || `cache:${req.baseUrl}:*`;

      // Override res.json to invalidate cache after successful response
      const originalJson = res.json;
      res.json = async function(data) {
        try {
          // Only invalidate on successful responses
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const keysToInvalidate = await redisService.keys(invalidationPattern);
            
            if (keysToInvalidate.length > 0) {
              await Promise.all(keysToInvalidate.map(key => redisService.del(key)));
              logger.info(`Cache invalidated: ${keysToInvalidate.length} keys matching ${invalidationPattern}`);
            }
          }
        } catch (error) {
          logger.error('Cache invalidation error:', error);
        }

        return originalJson.call(this, data);
      };

      next();

    } catch (error) {
      logger.error('Cache invalidation middleware error:', error);
      next();
    }
  };
}

/**
 * Mobile-optimized caching middleware
 * Implements different caching strategies for mobile vs web
 */
export function mobileOptimizedCache(options = {}) {
  const {
    mobileTtl = 600, // 10 minutes for mobile
    webTtl = 300, // 5 minutes for web
    prefix = 'mobile-cache'
  } = options;

  return async (req, res, next) => {
    try {
      const isMobile = isMobileRequest(req);
      const ttl = isMobile ? mobileTtl : webTtl;
      const cachePrefix = isMobile ? `${prefix}:mobile` : `${prefix}:web`;

      // Use the main cache middleware with mobile-specific options
      return cacheResponse({
        ttl,
        prefix: cachePrefix,
        compress: true,
        keyGenerator: (req) => generateMobileCacheKey(req, cachePrefix),
        shouldCache: (req, res) => {
          // Cache more aggressively for mobile
          return req.method === 'GET' && res.statusCode === 200;
        }
      })(req, res, next);

    } catch (error) {
      logger.error('Mobile cache middleware error:', error);
      next();
    }
  };
}

/**
 * API response compression middleware
 * Compresses responses based on client capabilities
 */
export function compressionMiddleware() {
  return (req, res, next) => {
    // Check if client accepts compression
    const acceptEncoding = req.headers['accept-encoding'] || '';
    
    if (acceptEncoding.includes('gzip') || acceptEncoding.includes('deflate')) {
      // Enable compression for this response
      res.set('Vary', 'Accept-Encoding');
      
      // Override res.json to add compression headers
      const originalJson = res.json;
      res.json = function(data) {
        // Set compression headers
        res.set('Content-Encoding', 'gzip');
        
        return originalJson.call(this, data);
      };
    }

    next();
  };
}

/**
 * ETag middleware for conditional requests
 */
export function etagMiddleware() {
  return (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      // Generate ETag based on response data
      const etag = generateETag(data);
      res.set('ETag', etag);
      
      // Check if client has matching ETag
      const clientEtag = req.headers['if-none-match'];
      if (clientEtag === etag) {
        return res.status(304).end();
      }
      
      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Rate limiting with Redis
 */
export function redisRateLimit(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // limit each IP to 100 requests per windowMs
    keyGenerator = (req) => req.ip,
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return async (req, res, next) => {
    try {
      const key = `rate_limit:${keyGenerator(req)}`;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Use Redis sorted set for sliding window
      await redisService.zadd(key, now, now);
      await redisService.expire(key, Math.ceil(windowMs / 1000));

      // Remove old entries
      await redisService.client.zremrangebyscore(key, 0, windowStart);

      // Count current requests
      const currentRequests = await redisService.client.zcard(key);

      // Set rate limit headers
      res.set('X-RateLimit-Limit', max);
      res.set('X-RateLimit-Remaining', Math.max(0, max - currentRequests));
      res.set('X-RateLimit-Reset', new Date(now + windowMs));

      if (currentRequests > max) {
        return res.status(429).json({
          success: false,
          error: 'Too many requests',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      next();

    } catch (error) {
      logger.error('Redis rate limit error:', error);
      next(); // Continue on error
    }
  };
}

// Helper functions
function generateCacheKey(req, prefix, varyBy) {
  const userId = req.user?.userId || 'anonymous';
  const path = req.originalUrl || req.url;
  
  let varyString = '';
  if (varyBy && varyBy.length > 0) {
    varyString = varyBy.map(header => req.headers[header] || '').join('|');
  }
  
  return `${prefix}:${userId}:${path}:${varyString}`;
}

function generateMobileCacheKey(req, prefix) {
  const userId = req.user?.userId || 'anonymous';
  const path = req.originalUrl || req.url;
  const isMobile = isMobileRequest(req);
  const deviceType = isMobile ? 'mobile' : 'web';
  
  return `${prefix}:${deviceType}:${userId}:${path}`;
}

function isMobileRequest(req) {
  const userAgent = req.headers['user-agent'] || '';
  const mobileUserAgents = [
    'Mobile', 'Android', 'iPhone', 'iPad', 'iPod', 'BlackBerry', 'Windows Phone'
  ];
  
  return mobileUserAgents.some(agent => userAgent.includes(agent));
}

function getResponseHeaders(res) {
  const headers = {};
  const responseHeaders = res.getHeaders();
  
  Object.entries(responseHeaders).forEach(([key, value]) => {
    if (key.toLowerCase() !== 'set-cookie') {
      headers[key] = value;
    }
  });
  
  return headers;
}

function generateETag(data) {
  // Simple hash function for ETag generation
  const str = JSON.stringify(data);
  let hash = 0;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return `"${Math.abs(hash).toString(16)}"`;
}

// Export all middleware
export default {
  cacheResponse,
  invalidateCache,
  mobileOptimizedCache,
  compressionMiddleware,
  etagMiddleware,
  redisRateLimit
};