import { HTTP_STATUS, MESSAGES } from "../config/constants.js";
import logger from "../utils/logger.js";

/**
 * Admin role middleware - checks if user has admin privileges
 * This is a basic implementation - in production, you should implement proper role-based access control
 */
export const requireAdmin = (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.UNAUTHORIZED
      });
    }

    // For now, we'll use a simple check based on user ID or email
    // In production, implement proper role-based access control
    const adminUserIds = process.env.ADMIN_USER_IDS?.split(',') || [];
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    
    // Check if user ID is in admin list
    if (adminUserIds.includes(req.user.id)) {
      req.isAdmin = true;
      return next();
    }

    // If we have user email, check against admin emails
    if (req.user.email && adminEmails.includes(req.user.email)) {
      req.isAdmin = true;
      return next();
    }

    // For development, you might want to allow certain operations
    // In production, remove this and implement proper admin roles
    if (process.env.NODE_ENV === 'development' && req.user.id) {
      logger.warn("Admin access granted in development mode", {
        userId: req.user.id,
        endpoint: req.originalUrl
      });
      req.isAdmin = true;
      return next();
    }

    logger.warn("Unauthorized admin access attempt", {
      userId: req.user.id,
      endpoint: req.originalUrl,
      ip: req.ip
    });

    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      message: "Admin privileges required"
    });

  } catch (error) {
    logger.error("Error in admin middleware", {
      error: error.message,
      userId: req.user?.id,
      stack: error.stack
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/**
 * API key validation middleware for external integrations
 */
export const validateApiKey = (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "API key required"
      });
    }

    // Validate against environment variable
    const validApiKeys = process.env.API_KEYS?.split(',') || [];
    
    if (!validApiKeys.includes(apiKey)) {
      logger.warn("Invalid API key attempt", {
        ip: req.ip,
        endpoint: req.originalUrl,
        userAgent: req.get('User-Agent')
      });

      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Invalid API key"
      });
    }

    req.apiKey = apiKey;
    next();

  } catch (error) {
    logger.error("Error in API key validation", {
      error: error.message,
      stack: error.stack
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/**
 * Content security middleware - validates request content
 */
export const validateContent = (req, res, next) => {
  try {
    // Check content length
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxContentLength = 10 * 1024 * 1024; // 10MB

    if (contentLength > maxContentLength) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Request content too large"
      });
    }

    // Validate JSON content type for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.headers['content-type'];
      if (contentType && !contentType.includes('application/json')) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "Content-Type must be application/json"
        });
      }
    }

    next();

  } catch (error) {
    logger.error("Error in content validation", {
      error: error.message,
      stack: error.stack
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/**
 * Request sanitization middleware
 */
export const sanitizeRequest = (req, res, next) => {
  try {
    // Sanitize query parameters
    if (req.query) {
      Object.keys(req.query).forEach(key => {
        if (typeof req.query[key] === 'string') {
          // Remove potentially dangerous characters
          req.query[key] = req.query[key].replace(/[<>]/g, '');
        }
      });
    }

    // Sanitize body parameters
    if (req.body) {
      Object.keys(req.body).forEach(key => {
        if (typeof req.body[key] === 'string') {
          // Remove potentially dangerous characters
          req.body[key] = req.body[key].replace(/[<>]/g, '');
        }
      });
    }

    next();

  } catch (error) {
    logger.error("Error in request sanitization", {
      error: error.message,
      stack: error.stack
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/**
 * CORS security middleware
 */
export const corsSecurity = (req, res, next) => {
  try {
    const origin = req.headers.origin;
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      "https://numinaai.netlify.app",
      "http://localhost:5173",
      "http://localhost:5000"
    ];

    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    res.header('Access-Control-Allow-Credentials', 'true');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    next();

  } catch (error) {
    logger.error("Error in CORS security", {
      error: error.message,
      stack: error.stack
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/**
 * Security headers middleware
 */
export const securityHeaders = (req, res, next) => {
  try {
    // Security headers
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    next();

  } catch (error) {
    logger.error("Error in security headers", {
      error: error.message,
      stack: error.stack
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error"
    });
  }
};

console.log("✓ Security middleware ready."); 