import { SECURITY_CONFIG } from "../config/constants.js";
import logger from "../utils/logger.js";

// Rate limiting middleware initialization

// Optimized in-memory store for rate limiting with LRU eviction
const MAX_RATE_LIMIT_ENTRIES = 10000; // Prevent memory bloat
const rateLimitStore = new Map();
const rateLimitAccess = new Map(); // Track access times for LRU

// Rate limit store ready

// Clean up expired entries every 2 minutes (more frequent)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  const expiredKeys = [];
  const accessThreshold = now - (10 * 60 * 1000); // 10 minutes of inactivity
  
  // Collect expired and inactive entries
  for (const [key, data] of rateLimitStore.entries()) {
    const lastAccess = rateLimitAccess.get(key) || 0;
    
    if (now > data.resetTime || lastAccess < accessThreshold) {
      expiredKeys.push(key);
    }
  }
  
  // Bulk delete expired entries
  expiredKeys.forEach(key => {
    rateLimitStore.delete(key);
    rateLimitAccess.delete(key);
  });
  
  if (expiredKeys.length > 0) {
    console.log(`🧹 Rate limiter cleanup: removed ${expiredKeys.length} entries`);
  }
  
  // LRU eviction if store is too large
  if (rateLimitStore.size > MAX_RATE_LIMIT_ENTRIES) {
    const sortedByAccess = Array.from(rateLimitAccess.entries())
      .sort((a, b) => a[1] - b[1]) // Sort by access time (oldest first)
      .slice(0, rateLimitStore.size - MAX_RATE_LIMIT_ENTRIES + 100); // Remove extra entries
    
    sortedByAccess.forEach(([key]) => {
      rateLimitStore.delete(key);
      rateLimitAccess.delete(key);
    });
    
    console.log(`🗑️ Rate limiter LRU eviction: removed ${sortedByAccess.length} entries`);
  }
}, 2 * 60 * 1000); // Every 2 minutes

// Graceful cleanup on shutdown
process.on('SIGTERM', () => {
  clearInterval(cleanupInterval);
  rateLimitStore.clear();
  rateLimitAccess.clear();
});

// Cleanup interval configured

/**
 * Create rate limiting middleware
 * @param {Object} options - Rate limiting options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests per window
 * @param {string} options.message - Custom error message
 * @param {Function} options.keyGenerator - Function to generate rate limit key
 * @returns {Function} Express middleware
 */
export const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes default
    max = 100, // 100 requests per window default
    message = "Too many requests, please try again later.",
    keyGenerator = (req) => {
      // Use IP address as default key with fallbacks
      return req.ip || 
             req.headers['x-forwarded-for']?.split(',')[0] || 
             req.connection.remoteAddress || 
             req.socket.remoteAddress ||
             'unknown';
    },
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();
    
    // Update access time for LRU
    rateLimitAccess.set(key, now);
    
    // Get or create rate limit data for this key
    let rateLimitData = rateLimitStore.get(key);
    
    if (!rateLimitData || now > rateLimitData.resetTime) {
      // First request or window expired - reset counter
      rateLimitData = {
        requests: 0, // Start at 0, will increment below
        resetTime: now + windowMs,
        firstRequest: now,
        lastRequest: now
      };
    }
    
    // Increment request count (before response to catch all requests)
    rateLimitData.requests += 1;
    rateLimitData.lastRequest = now;
    
    // Store updated data
    rateLimitStore.set(key, rateLimitData);
    
    // Check if limit exceeded
    const remaining = Math.max(0, max - rateLimitData.requests);
    const isExceeded = rateLimitData.requests > max;
    
    if (isExceeded) {
      const retryAfter = Math.ceil((rateLimitData.resetTime - now) / 1000);
      
      logger.warn("Rate limit exceeded", {
        key: key.substring(0, 20) + '...', // Truncate for privacy
        requests: rateLimitData.requests,
        max,
        windowMs,
        retryAfter,
        userAgent: req.headers['user-agent']?.substring(0, 50)
      });
      
      return res.status(429).json({
        success: false,
        message,
        retryAfter,
        limit: {
          max,
          windowMs,
          remaining: 0,
          resetTime: rateLimitData.resetTime
        }
      });
    }
    
    // Add optimized rate limit headers
    const resetTimeSeconds = Math.ceil(rateLimitData.resetTime / 1000);
    res.set({
      'X-RateLimit-Limit': String(max),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(resetTimeSeconds),
      'X-RateLimit-Window': String(windowMs)
    });
    
    // Optional: Decrement counter for successful/failed requests
    if (skipSuccessfulRequests || skipFailedRequests) {
      const originalSend = res.send;
      res.send = function(data) {
        const shouldSkip = 
          (skipSuccessfulRequests && res.statusCode >= 200 && res.statusCode < 400) ||
          (skipFailedRequests && res.statusCode >= 400);
          
        if (shouldSkip && rateLimitData.requests > 0) {
          rateLimitData.requests -= 1;
          rateLimitStore.set(key, rateLimitData);
        }
        
        return originalSend.call(this, data);
      };
    }
    
    next();
  };
};

// Rate limiter factory ready

/**
 * Predefined rate limiters for different endpoint types
 */
export const rateLimiters = {
  // General API rate limiting
  general: createRateLimiter(SECURITY_CONFIG.RATE_LIMITS.GENERAL),
  
  // Collective data specific rate limiting
  collectiveData: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // 200 requests per 15 minutes (increased from 50)
    message: "Too many collective data requests. Please try again later."
  }),
  
  // Snapshot generation rate limiting
  snapshots: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 snapshot generations per hour
    message: "Too many snapshot generation requests. Please try again later."
  }),
  
  // Export rate limiting
  export: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 exports per hour
    message: "Too many export requests. Please try again later."
  }),
  
  // Admin operations rate limiting
  admin: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 admin operations per 15 minutes
    message: "Too many admin operations. Please try again later."
  }),
  
  // Aggregation service rate limiting
  aggregation: createRateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100, // 100 aggregation requests per 5 minutes (increased from 30)
    message: "Too many aggregation service requests. Please try again later."
  })
};

// Predefined limiters ready

/**
 * User-specific rate limiter (for authenticated users)
 */
export const userRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  keyGenerator: (req) => {
    // Use user ID for authenticated requests
    return req.user ? `user:${req.user.id}` : `ip:${req.ip || 'unknown'}`;
  },
  message: "Too many requests for this user. Please try again later."
});

// User-specific limiter ready
// Middleware ready