import winston from "winston";
import { format } from "winston";

console.log("📝 Initializing logging system...");

// Custom format for structured logging
const logFormat = format.combine(
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format.errors({ stack: true }),
  format.json(),
  format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta,
    });
  })
);

console.log("✓Log format configured");

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      ),
    }),
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
    }),
  ],
});

console.log("✓Winston logger instance created");

// Performance tracking
export const trackPerformance = (operation, startTime) => {
  const duration = Date.now() - startTime;
  logger.info("Performance tracked", {
    operation,
    duration,
    timestamp: new Date().toISOString(),
  });
  return duration;
};

console.log("✓Performance tracking function configured");

// Request logging middleware
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log request
  logger.info("Request received", {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    userId: req.user?.id || "anonymous",
  });

  // Log response
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    logger.info("Request completed", {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.id || "anonymous",
    });
  });

  next();
};

console.log("✓Request logging middleware configured");

// Error logging middleware
export const errorLogger = (err, req, res, next) => {
  logger.error("Error occurred", {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: req.user?.id || "anonymous",
  });
  next(err);
};

console.log("✓Error logging middleware configured");

console.log("✓Logging system initialization completed");

export default logger; 