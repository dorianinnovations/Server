import logger from '../utils/logger.js';
// import { AnalyticsService } from '../../archive/unused-services/analytics.js'; // Disabled archived service

// Performance middleware initializing

export const performanceMiddleware = (req, res, next) => {
  const start = process.hrtime.bigint(); // Use high-resolution timer
  
  // Track specific operations with optimized structure
  req.performanceMetrics = {
    start: Number(start),
    startTime: Date.now(), // Keep Date.now() for compatibility
    operations: new Map(), // Use Map for better performance
    memory: {
      start: process.memoryUsage().heapUsed
    },
    requestSize: Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8')
  };
  
  // Optimized helper function to track operation duration
  req.trackOperation = (operation, duration) => {
    req.performanceMetrics.operations.set(operation, duration);
  };
  
  // Optimized helper function to track memory usage
  req.trackMemory = (operation) => {
    const current = process.memoryUsage().heapUsed;
    const delta = current - req.performanceMetrics.memory.start;
    req.performanceMetrics.memory[operation] = {
      current: Math.round(current / 1048576), // More efficient division
      delta: Math.round(delta / 1048576)
    };
  };
  
  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const metrics = req.performanceMetrics;
    const total = Number(end - BigInt(metrics.start)) / 1000000; // Convert to milliseconds
    const memUsage = process.memoryUsage();
    const finalMemory = Math.round(memUsage.heapUsed / 1048576);
    const responseSize = res.get('content-length') || 0;
    
    // Convert Map to Object for logging (only if needed)
    const operationsObj = metrics.operations.size > 0 ? 
      Object.fromEntries(metrics.operations) : {};
    
    // Log performance metrics with more details
    const logData = {
      method: req.method,
      path: req.path,
      duration: Math.round(total * 100) / 100, // Round to 2 decimal places
      operations: operationsObj,
      memory: {
        heap: finalMemory,
        rss: Math.round(memUsage.rss / 1048576),
        external: Math.round(memUsage.external / 1048576)
      },
      requestSize: metrics.requestSize,
      responseSize: parseInt(responseSize) || 0,
      statusCode: res.statusCode
    };
    
    // Optimized threshold checking with early returns
    const shouldLogSlow = total > 2000;
    const shouldLogModerate = total > 1000 && !shouldLogSlow;
    const shouldTrackAnalytics = total > 1000;
    
    if (shouldLogSlow) {
      logger.warn(`Slow request: ${req.method} ${req.path} - ${Math.round(total)}ms`);
    } else if (shouldLogModerate) {
      logger.info(`Request: ${req.method} ${req.path} - ${Math.round(total)}ms`);
    }
    
    // Track specific operation performance with Map.get()
    const taskInference = metrics.operations.get('task_inference');
    const emotionLogging = metrics.operations.get('emotion_logging');
    const stringSanitization = metrics.operations.get('string_sanitization');
    
    if (taskInference > 100) {
      logger.warn(`🐌 Slow task inference: ${taskInference}ms`);
    }
    
    if (emotionLogging > 50) {
      logger.warn(`🐌 Slow emotion logging: ${emotionLogging}ms`);
    }
    
    if (stringSanitization > 20) {
      logger.warn(`🐌 Slow string sanitization: ${stringSanitization}ms`);
    }
    
    // Track analytics for slow operations (only when necessary)
    if (shouldTrackAnalytics) {
      // AnalyticsService disabled - archived service
      // AnalyticsService.trackEvent(
      //   'performance_metric',
      //   'performance',
      //   {
      //     operation: 'request_processing',
      //     duration: Math.round(total),
      //     path: req.path,
      //     operations: operationsObj,
      //     memoryUsage: finalMemory,
      //     requestSize: metrics.requestSize,
      //     responseSize: logData.responseSize
      //   }
      // );
    }
  });
  
  next();
};

// Middleware ready

export const completionPerformanceMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // Track completion-specific metrics
  req.completionMetrics = {
    start,
    llmCallStart: null,
    llmCallDuration: null,
    streamingStart: null,
    streamingDuration: null
  };
  
  // Override res.write to track streaming
  const originalWrite = res.write;
  res.write = function(chunk, encoding) {
    if (!req.completionMetrics.streamingStart) {
      req.completionMetrics.streamingStart = Date.now();
    }
    return originalWrite.call(this, chunk, encoding);
  };
  
  res.on('finish', () => {
    const total = Date.now() - start;
    const metrics = req.completionMetrics;
    
    // Log completion performance
    if (total > 5000) {
      logger.warn(`🐌 SLOW COMPLETION: ${req.method} ${req.path} - ${total}ms`, {
        total,
        llmCallDuration: metrics.llmCallDuration,
        streamingDuration: metrics.streamingDuration,
        path: req.path
      });
    }
  });
  
  next();
};

// Middleware ready

// Helper function to track database operations
export const trackDatabaseOperation = async (operation, operationFn, req = null) => {
  const start = Date.now();
  try {
    const result = await operationFn();
    const duration = Date.now() - start;
    
    if (req && req.trackOperation) {
      req.trackOperation(`db_${operation}`, duration);
    }
    
    if (duration > 200) {
      logger.warn(`🐌 Slow database operation: ${operation} - ${duration}ms`);
      
      // Track slow database operations
      AnalyticsService.trackEvent(
        'performance_metric',
        'performance',
        {
          operation: `database_${operation}`,
          duration,
          type: 'slow_query'
        }
      );
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`❌ Database operation failed: ${operation} - ${duration}ms`, {
      error: error.message,
      operation
    });
    throw error;
  }
};

// Helper function to track task inference performance
export const trackTaskInference = (req, operationFn) => {
  const start = Date.now();
  try {
    const result = operationFn();
    const duration = Date.now() - start;
    
    if (req && req.trackOperation) {
      req.trackOperation('task_inference', duration);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`❌ Task inference failed - ${duration}ms`, {
      error: error.message
    });
    throw error;
  }
};

// Helper function to track emotion logging performance
export const trackEmotionLogging = (req, operationFn) => {
  const start = Date.now();
  try {
    const result = operationFn();
    const duration = Date.now() - start;
    
    if (req && req.trackOperation) {
      req.trackOperation('emotion_logging', duration);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`❌ Emotion logging failed - ${duration}ms`, {
      error: error.message
    });
    throw error;
  }
};

// Helper function to track string sanitization performance
export const trackStringSanitization = (req, operationFn) => {
  const start = Date.now();
  try {
    const result = operationFn();
    const duration = Date.now() - start;
    
    if (req && req.trackOperation) {
      req.trackOperation('string_sanitization', duration);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`❌ String sanitization failed - ${duration}ms`, {
      error: error.message
    });
    throw error;
  }
};