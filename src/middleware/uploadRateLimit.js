import rateLimit from 'express-rate-limit';
import logger from '../utils/logger.js';

// Rate limiter for upload endpoints
export const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 uploads per windowMs
  message: {
    success: false,
    error: 'Too many upload attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn('Upload rate limit exceeded', {
      ip: req.ip,
      userId: req.user?.userId,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      success: false,
      error: 'Too many upload attempts, please try again later.',
      retryAfter: '15 minutes'
    });
  },
  skip: (req) => {
    // Skip rate limiting for authenticated users with premium tiers
    return req.user?.tier === 'PREMIUM' || req.user?.tier === 'ENTERPRISE';
  }
});

// Stricter rate limit for vision processing
export const visionRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // Limit each IP to 5 vision uploads per windowMs
  message: {
    success: false,
    error: 'Too many vision processing requests, please try again later.',
    retryAfter: '10 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Vision rate limit exceeded', {
      ip: req.ip,
      userId: req.user?.userId,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      success: false,
      error: 'Too many vision processing requests, please try again later.',
      retryAfter: '10 minutes'
    });
  }
});

export default { uploadRateLimit, visionRateLimit };