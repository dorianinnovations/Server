import logger from "./logger.js";
import axios from "axios";

// Error handling system initialization

// Custom error classes
export class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication failed") {
    super(message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "Access denied") {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super(message, 429);
  }
}

export class NetworkError extends AppError {
  constructor(message = "Network error occurred", statusCode = 503) {
    super(message, statusCode);
    this.name = "NetworkError";
  }
}

export class TimeoutError extends AppError {
  constructor(message = "Request timeout") {
    super(message, 408);
    this.name = "TimeoutError";
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Service temporarily unavailable") {
    super(message, 503);
    this.name = "ServiceUnavailableError";
  }
}

export class RetryableError extends AppError {
  constructor(message, statusCode = 500, retryAfter = 1000) {
    super(message, statusCode);
    this.name = "RetryableError";
    this.retryAfter = retryAfter;
  }
}

// Custom error classes ready

// Global error handler middleware
export const globalErrorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error (no stack traces in production)
  logger.error("Global error handler", {
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    userId: req.user?.id || "anonymous",
  });

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    const message = "Resource not found";
    error = new NotFoundError(message);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = "Duplicate field value entered";
    error = new ValidationError(message);
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors).map(val => val.message).join(", ");
    error = new ValidationError(message);
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    const message = "Invalid token";
    error = new AuthenticationError(message);
  }

  if (err.name === "TokenExpiredError") {
    const message = "Token expired";
    error = new AuthenticationError(message);
  }

  // Default error response
  const statusCode = error.statusCode || 500;
  const message = error.message || "Internal server error";

  res.status(statusCode).json({
    status: "error",
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

// Circuit breaker implementation
export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.timeout = options.timeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime < this.timeout) {
        throw new ServiceUnavailableError('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
    }
    this.successCount++;
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Retry mechanism with exponential backoff
export const retryOperation = async (operation, options = {}) => {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    exponentialBase = 2,
    jitter = true,
    retryCondition = (error) => {
      // Retry on network errors, timeouts, and 5xx errors
      return (
        error.code === 'ECONNRESET' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        (error.response && error.response.status >= 500) ||
        error instanceof NetworkError ||
        error instanceof TimeoutError ||
        error instanceof RetryableError
      );
    }
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      if (attempt > 0) {
        logger.info(`Operation succeeded after ${attempt} retries`);
      }
      return result;
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries || !retryCondition(error)) {
        break;
      }

      const delay = Math.min(
        baseDelay * Math.pow(exponentialBase, attempt),
        maxDelay
      );
      
      const actualDelay = jitter 
        ? delay + Math.random() * delay * 0.1 
        : delay;

      logger.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${actualDelay}ms`, {
        error: error.message,
        attempt: attempt + 1,
        delay: actualDelay
      });

      await new Promise(resolve => setTimeout(resolve, actualDelay));
    }
  }

  throw lastError;
};

// Global error handler ready

// Async error wrapper
export const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Async error wrapper ready

// Validation helper
export const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      const message = error.details.map(detail => detail.message).join(", ");
      return next(new ValidationError(message));
    }
    next();
  };
};

logger.debug("Request validation helper configured");
// Enhanced error handling middleware with circuit breaker
export const enhancedErrorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Enhanced logging with request context
  const logContext = {
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    userId: req.user?.id || "anonymous",
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString(),
    requestId: req.id || Math.random().toString(36).substr(2, 9)
  };

  logger.error("Enhanced error handler", logContext);

  // Handle specific error types with enhanced responses
  if (err.name === "CastError") {
    const message = "Invalid resource identifier";
    error = new NotFoundError(message);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field} already exists`;
    error = new ValidationError(message);
  }

  if (err.name === "ValidationError") {
    const message = Object.values(err.errors).map(val => val.message).join(", ");
    error = new ValidationError(message);
  }

  // Network and timeout errors
  if (err.code === 'ECONNRESET' || err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
    error = new NetworkError('Network connection failed');
  }

  if (err.code === 'ETIMEDOUT') {
    error = new TimeoutError('Request timeout');
  }

  // JWT errors with enhanced handling
  if (err.name === "JsonWebTokenError") {
    const message = "Invalid authentication token";
    error = new AuthenticationError(message);
  }

  if (err.name === "TokenExpiredError") {
    const message = "Authentication token expired";
    error = new AuthenticationError(message);
  }

  // Rate limit errors
  if (err.statusCode === 429) {
    error = new RateLimitError("Too many requests, please try again later");
  }

  // Default error response with enhanced information
  const statusCode = error.statusCode || 500;
  const message = error.message || "Internal server error";
  
  // Determine if error should be retried
  const isRetryable = (
    error instanceof NetworkError ||
    error instanceof TimeoutError ||
    error instanceof RetryableError ||
    statusCode >= 500
  );

  const errorResponse = {
    status: "error",
    message,
    code: error.name || 'UnknownError',
    requestId: logContext.requestId,
    timestamp: logContext.timestamp,
    ...(isRetryable && { retryable: true, retryAfter: error.retryAfter || 1000 })
  };

  // Add additional context in development
  if (process.env.NODE_ENV === "development") {
    errorResponse.stack = err.stack;
    errorResponse.context = logContext;
  }

  // Add recovery suggestions for common errors
  if (error instanceof NetworkError) {
    errorResponse.suggestion = "Please check your internet connection and try again";
  }
  
  if (error instanceof AuthenticationError) {
    errorResponse.suggestion = "Please log in again to continue";
  }
  
  if (error instanceof RateLimitError) {
    errorResponse.suggestion = "Please wait a moment before trying again";
  }

  res.status(statusCode).json(errorResponse);
};

// Graceful degradation helper
export const gracefulDegrade = (operation, fallback, options = {}) => {
  const { timeout = 5000, circuitBreaker } = options;
  
  return async (...args) => {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new TimeoutError()), timeout);
      });
      
      const operationPromise = circuitBreaker 
        ? circuitBreaker.execute(() => operation(...args))
        : operation(...args);
      
      return await Promise.race([operationPromise, timeoutPromise]);
    } catch (error) {
      logger.warn('Operation failed, falling back to degraded mode', {
        error: error.message,
        operation: operation.name
      });
      
      if (typeof fallback === 'function') {
        return fallback(...args);
      }
      return fallback;
    }
  };
};

// Health check with circuit breaker
export const createHealthCheck = (services) => {
  const circuitBreakers = new Map();
  
  return async () => {
    const results = {};
    
    for (const [name, service] of Object.entries(services)) {
      if (!circuitBreakers.has(name)) {
        circuitBreakers.set(name, new CircuitBreaker());
      }
      
      const breaker = circuitBreakers.get(name);
      
      try {
        await breaker.execute(service.healthCheck);
        results[name] = { status: 'healthy', ...breaker.getStats() };
      } catch (error) {
        results[name] = { 
          status: 'unhealthy', 
          error: error.message,
          ...breaker.getStats()
        };
      }
    }
    
    const overallHealth = Object.values(results).every(r => r.status === 'healthy') 
      ? 'healthy' 
      : 'degraded';
    
    return {
      status: overallHealth,
      timestamp: new Date().toISOString(),
      services: results
    };
  };
};

// Component ready