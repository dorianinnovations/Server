import winston, { format } from "winston";

const isDevelopment = process.env.NODE_ENV === 'development';

// Safe JSON stringify that handles circular references
const safeStringify = (obj, space) => {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, val) => {
    if (val != null && typeof val === "object") {
      if (seen.has(val)) {
        return "[Circular]";
      }
      seen.add(val);
    }
    return val;
  }, space);
};

// Enhanced custom format for better readability
const logFormat = format.combine(
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format.errors({ stack: true }),
  format.json()
);

// Console format with emojis for development
const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: "HH:mm:ss" }),
  format.printf(({ timestamp, level, message, service, userId, ...meta }) => {
    const serviceTag = service ? `[${service}]` : '';
    const userTag = userId ? `{${userId}}` : '';
    const metaStr = Object.keys(meta).length > 0 ? safeStringify(meta) : '';
    return `${timestamp} ${level}${serviceTag}${userTag}: ${message} ${metaStr}`.trim();
  })
);

// Create logger instance with environment-aware configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info"),
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
      silent: process.env.NODE_ENV === 'test'
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

// Structured logging helpers with emojis for categorization
export const log = {
  // System operations
  system: (message, meta = {}) => logger.info(`🖥️  ${message}`, { service: 'SYSTEM', ...meta }),
  database: (message, meta = {}) => logger.info(`🗄️  ${message}`, { service: 'DB', ...meta }),
  auth: (message, meta = {}) => logger.info(`🔐 ${message}`, { service: 'AUTH', ...meta }),
  api: (message, meta = {}) => logger.info(`📡 ${message}`, { service: 'API', ...meta }),
  
  // AI and tools
  ai: (message, meta = {}) => logger.info(`🤖 ${message}`, { service: 'AI', ...meta }),
  tool: (message, meta = {}) => logger.info(`🔧 ${message}`, { service: 'TOOL', ...meta }),
  
  // Performance and monitoring
  perf: (message, meta = {}) => logger.info(`⚡ ${message}`, { service: 'PERF', ...meta }),
  cache: (message, meta = {}) => logger.info(`💾 ${message}`, { service: 'CACHE', ...meta }),
  
  // Development only logs
  debug: (message, meta = {}) => {
    if (isDevelopment) {
      logger.debug(`🔍 ${message}`, { service: 'DEBUG', ...meta });
    }
  },
  
  // Success operations
  success: (message, meta = {}) => logger.info(`✅ ${message}`, { service: 'SUCCESS', ...meta }),
  
  // Warnings and errors
  warn: (message, meta = {}) => logger.warn(`⚠️  ${message}`, { service: 'WARN', ...meta }),
  error: (message, error, meta = {}) => {
    const errorMeta = error ? { 
      error: error.message, 
      stack: error.stack,
      ...meta 
    } : meta;
    logger.error(`❌ ${message}`, { service: 'ERROR', ...errorMeta });
  }
};

if (isDevelopment) {
  log.system("Logging system initialized");
}

// Performance tracking with structured logging
export const trackPerformance = (operation, startTime, meta = {}) => {
  const duration = Date.now() - startTime;
  log.perf(`${operation} completed`, { duration, ...meta });
  return duration;
};

// Request logging middleware with better structure
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Only log non-health check requests to reduce noise
  if (!req.url.includes('/health')) {
    log.api(`${req.method} ${req.url}`, {
      ip: req.ip,
      userId: req.user?.id
    });
  }

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    
    // Only log slow requests or errors in production
    const shouldLog = isDevelopment || duration > 1000 || res.statusCode >= 400;
    
    if (shouldLog && !req.url.includes('/health')) {
      const level = res.statusCode >= 400 ? 'warn' : 'info';
      const message = res.statusCode >= 400 ? 'Request failed' : 'Request completed';
      
      log.api(message, {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        userId: req.user?.id
      });
    }
  });

  next();
};

// Enhanced error logging middleware
export const errorLogger = (err, req, res, next) => {
  // Clean error logging without stack traces in production
  const errorData = {
    error: err.message,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: req.user?.id
  };
  
  // Only add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorData.stack = err.stack;
  }
  
  log.error("Request error", err, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: req.user?.id
  });
  next(err);
};

export default logger; 