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
    MAX_POOL_SIZE: 50,
    MIN_POOL_SIZE: 5,
    MAX_IDLE_TIME_MS: 30000,
    SERVER_SELECTION_TIMEOUT_MS: 5000,
    SOCKET_TIMEOUT_MS: 45000,
    HEARTBEAT_FREQUENCY_MS: 10000
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

// Memory and Performance Configuration
export const MEMORY_CONFIG = {
  CACHE_TTL: 3600000, 
  GC_THRESHOLD: 100000000,
  MEMORY_MONITORING_INTERVAL: 60000, 
  MAX_RESPONSE_SIZE: 100000 
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