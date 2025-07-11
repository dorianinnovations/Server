import { SECURITY_CONFIG } from "../config/constants.js";
import logger from "../utils/logger.js";

// In-memory store for rate limiting (in production, use Redis)
const rateLimitStore = new Map();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

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
      // Use IP address as default key
      return req.ip || req.connection.remoteAddress || 'unknown';
    }
  } = options;

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();
    
    // Get or create rate limit data for this key
    let rateLimitData = rateLimitStore.get(key);
    
    if (!rateLimitData || now > rateLimitData.resetTime) {
      // First request or window expired
      rateLimitData = {
        requests: 1,
        resetTime: now + windowMs,
        firstRequest: now
      };
    } else {
      // Increment request count
      rateLimitData.requests += 1;
    }
    
    // Store updated data
    rateLimitStore.set(key, rateLimitData);
    
    // Check if limit exceeded
    if (rateLimitData.requests > max) {
      const retryAfter = Math.ceil((rateLimitData.resetTime - now) / 1000);
      
      logger.warn("Rate limit exceeded", {
        key,
        requests: rateLimitData.requests,
        max,
        windowMs,
        retryAfter
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
    
    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': max,
      'X-RateLimit-Remaining': Math.max(0, max - rateLimitData.requests),
      'X-RateLimit-Reset': rateLimitData.resetTime,
      'X-RateLimit-Window': windowMs
    });
    
    next();
  };
};

/**
 * Predefined rate limiters for different endpoint types
 */
export const rateLimiters = {
  // General API rate limiting
  general: createRateLimiter(SECURITY_CONFIG.RATE_LIMITS.GENERAL),
  
  // Collective data specific rate limiting
  collectiveData: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 requests per 15 minutes
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
    max: 30, // 30 aggregation requests per 5 minutes
    message: "Too many aggregation service requests. Please try again later."
  })
};

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

console.log("✓ Rate limiting middleware ready."); 