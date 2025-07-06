import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import { SECURITY_CONFIG } from "../config/constants.js";

// CORS configuration for production readiness
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    console.log(`CORS request from origin: ${origin}`);
    if (!origin) return callback(null, true);
    if (SECURITY_CONFIG.CORS_ORIGINS.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
      console.log(`CORS blocked: ${msg}`);
      return callback(new Error(msg), false);
    }
    console.log(`CORS allowed for origin: ${origin}`);
    return callback(null, true);
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "authorization"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
});

// Security middleware with helmet
export const securityMiddleware = helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
});

// Rate limiting middleware
export const generalRateLimit = rateLimit({
  windowMs: SECURITY_CONFIG.RATE_LIMITS.GENERAL.windowMs,
  max: SECURITY_CONFIG.RATE_LIMITS.GENERAL.max,
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const completionRateLimit = rateLimit({
  windowMs: SECURITY_CONFIG.RATE_LIMITS.COMPLETION.windowMs,
  max: SECURITY_CONFIG.RATE_LIMITS.COMPLETION.max,
  message: {
    error: "Too many completion requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Optimized compression middleware
export const optimizedCompression = compression({
  level: 6, // Compression level (1-9)
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    // Don't compress responses with this request header
    if (req.headers['x-no-compression']) {
      return false;
    }
    // fallback to standard filter function
    return compression.filter(req, res);
  },
}); 