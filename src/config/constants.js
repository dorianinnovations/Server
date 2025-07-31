// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

// Response Messages
export const MESSAGES = {
  SUCCESS: 'success',
  ERROR: 'error',
  DEGRADED: 'degraded',
  USER_NOT_FOUND: 'User not found.',
  INVALID_TOKEN: 'Invalid or expired token.',
  UNAUTHORIZED: 'You are not logged in! Please log in to get access.',
  EMAIL_IN_USE: 'Email already in use.',
  INVALID_CREDENTIALS: 'Incorrect email or password.',
  INVALID_PROMPT: 'Invalid or missing prompt.',
  SIGNUP_FAILED: 'Failed to create user.',
  LOGIN_FAILED: 'Login failed.',
  PROFILE_FETCH_FAILED: 'Failed to fetch profile.',
  HEALTH_CHECK_FAILED: 'Health check failed',
  VALIDATION_ERROR: 'Validation failed'
};

// Database Configuration
export const DB_CONFIG = {
  CONNECTION_POOL: {
    MAX_POOL_SIZE: 20, // Reduced from 50 for better resource management
    MIN_POOL_SIZE: 2, // Reduced from 5 for lighter footprint
    MAX_IDLE_TIME_MS: 20000, // Reduced from 30s for faster cleanup
    SERVER_SELECTION_TIMEOUT_MS: 3000, // Reduced from 5s for faster failover
    SOCKET_TIMEOUT_MS: 30000, // Reduced from 45s for faster detection
    HEARTBEAT_FREQUENCY_MS: 5000, // Increased from 10s for better monitoring
    BUFFER_MAX_ENTRIES: 0, // Disable buffering for immediate error detection
    CONNECT_TIMEOUT_MS: 10000, // 10 second connect timeout
    WRITE_CONCERN_TIMEOUT_MS: 5000 // 5 second write concern timeout
  },
  STATES: {
    DISCONNECTED: 'disconnected',
    CONNECTED: 'connected',
    CONNECTING: 'connecting',
    DISCONNECTING: 'disconnecting'
  }
};

// Task Configuration
export const TASK_CONFIG = {
  STATUSES: {
    QUEUED: 'queued',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed'
  },
  TYPES: {
    EMAIL_SUMMARY: 'email_summary',
    CALENDAR_REMINDER: 'calendar_reminder',
    TASK_REMINDER: 'task_reminder'
  },
  PRIORITIES: {
    LOW: 0,
    MEDIUM: 5,
    HIGH: 10
  }
};

// Memory and Performance Configuration (Fixed for critical memory leaks)
export const MEMORY_CONFIG = {
  CACHE_TTL: 300000, // 5 minutes (reduced from 15 to prevent buildup)
  GC_THRESHOLD: 80000000, // 80MB (reduced from 128MB for earlier cleanup)
  MEMORY_MONITORING_INTERVAL: 10000, // 10 seconds (more frequent monitoring)
  MAX_RESPONSE_SIZE: 25000, // 25KB
  MAX_CACHE_SIZE: 200, // Reduced cache size further (from 500 to 200)
  CACHE_CLEANUP_INTERVAL: 120000, // 2 minutes (more frequent cleanup)
  HEAP_USAGE_THRESHOLD: 0.85, // 85% before cleanup (much lower threshold)
  COMPRESSION_THRESHOLD: 512, // 512B compression
  FORCE_GC_THRESHOLD: 0.90, // Force GC at 90% (earlier intervention)
  LOW_MEMORY_MODE: true, // Enable memory conservation mode
  GC_COOLDOWN_MS: 30000 // 30 seconds cooldown (shorter for faster response)
};

// Security Configuration
export const SECURITY_CONFIG = {
  CORS_ORIGINS: [
    "https://numinaai.netlify.app",
    "http://localhost:5173",
    "http://localhost:5000",
    "https://server-a7od.onrender.com"
  ],
  RATE_LIMITS: {
    GENERAL: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // requests per windowMs
    },
    COMPLETION: {
      windowMs: 60 * 1000, // 1 minute
      max: 10 // requests per windowMs
    },
    COLLECTIVE_DATA: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 50 // requests per windowMs
    },
    SNAPSHOTS: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10 // requests per windowMs
    },
    EXPORT: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5 // requests per windowMs
    },
    ADMIN: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 20 // requests per windowMs
    },
    AGGREGATION: {
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 30 // requests per windowMs
    }
  },
  JWT_EXPIRES_IN: '1d',
  BCRYPT_ROUNDS: 12
};

// Logging Configuration
export const LOG_CONFIG = {
  LEVELS: {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug'
  },
  FORMATS: {
    TIMESTAMP: 'YYYY-MM-DD HH:mm:ss',
    COMBINED: 'combined',
    JSON: 'json'
  }
};