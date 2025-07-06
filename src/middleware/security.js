import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";

// CORS configuration for production readiness
const allowedOrigins = [
  "https://numinaai.netlify.app",
  "http://localhost:5173",
  "http://localhost:5000",
  "https://server-a7od.onrender.com",
];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin.`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
});

// Optimized rate limiting for LLM usage - much more permissive
export const rateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes (shorter window)
  max: 500, // 500 requests per 5 minutes (100 requests per minute)
  message: "Rate limit exceeded. Please wait a moment before trying again.",
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for certain IPs if needed
  skip: (req) => {
    // Skip rate limiting for localhost during development
    if (req.ip === '127.0.0.1' || req.ip === '::1') {
      return true;
    }
    return false;
  },
});

// Separate, more restrictive rate limiter for completion endpoints
export const completionRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 completion requests per minute
  message: "Too many completion requests. Please wait a moment.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user ID if authenticated, otherwise by IP
    return req.user?.id || req.ip;
  },
});

// Security and compression middleware
export const securityMiddleware = [
  helmet(), // Apply security headers
  compression(), // Enable gzip compression for responses
]; 