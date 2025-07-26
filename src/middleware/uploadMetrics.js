import logger from '../utils/logger.js';

// Upload metrics tracking
class UploadMetrics {
  constructor() {
    this.metrics = {
      totalUploads: 0,
      visionUploads: 0,
      failedUploads: 0,
      totalProcessingTime: 0,
      totalDataProcessed: 0,
      compressionSavings: 0,
      errorsByType: {},
      uploadsByHour: {},
      processingTimesBySize: []
    };
    
    // Reset daily metrics at midnight
    this.startDailyReset();
  }
  
  trackUploadStart(type, userId, fileSize) {
    this.metrics.totalUploads++;
    if (type === 'vision') {
      this.metrics.visionUploads++;
    }
    
    this.metrics.totalDataProcessed += fileSize;
    
    const hour = new Date().getHours();
    this.metrics.uploadsByHour[hour] = (this.metrics.uploadsByHour[hour] || 0) + 1;
    
    logger.info('Upload metrics updated', {
      type,
      userId,
      fileSize,
      totalUploads: this.metrics.totalUploads,
      visionUploads: this.metrics.visionUploads
    });
  }
  
  trackUploadComplete(processingTime, originalSize, compressedSize) {
    this.metrics.totalProcessingTime += processingTime;
    
    if (compressedSize && originalSize > compressedSize) {
      this.metrics.compressionSavings += (originalSize - compressedSize);
    }
    
    this.metrics.processingTimesBySize.push({
      size: originalSize,
      time: processingTime,
      timestamp: Date.now()
    });
    
    // Keep only last 1000 entries for performance
    if (this.metrics.processingTimesBySize.length > 1000) {
      this.metrics.processingTimesBySize = this.metrics.processingTimesBySize.slice(-1000);
    }
  }
  
  trackUploadError(errorType, userId) {
    this.metrics.failedUploads++;
    this.metrics.errorsByType[errorType] = (this.metrics.errorsByType[errorType] || 0) + 1;
    
    logger.warn('Upload error tracked', {
      errorType,
      userId,
      totalFailed: this.metrics.failedUploads,
      errorCount: this.metrics.errorsByType[errorType]
    });
  }
  
  getMetrics() {
    const avgProcessingTime = this.metrics.totalUploads > 0 
      ? this.metrics.totalProcessingTime / this.metrics.totalUploads 
      : 0;
      
    const successRate = this.metrics.totalUploads > 0
      ? ((this.metrics.totalUploads - this.metrics.failedUploads) / this.metrics.totalUploads * 100).toFixed(2)
      : 100;
      
    const totalSavingsMB = (this.metrics.compressionSavings / (1024 * 1024)).toFixed(2);
    
    return {
      ...this.metrics,
      avgProcessingTime: Math.round(avgProcessingTime),
      successRate: parseFloat(successRate),
      totalDataProcessedMB: (this.metrics.totalDataProcessed / (1024 * 1024)).toFixed(2),
      compressionSavingsMB: totalSavingsMB,
      peakHour: this.getPeakUploadHour()
    };
  }
  
  getPeakUploadHour() {
    let maxUploads = 0;
    let peakHour = 0;
    
    Object.entries(this.metrics.uploadsByHour).forEach(([hour, uploads]) => {
      if (uploads > maxUploads) {
        maxUploads = uploads;
        peakHour = parseInt(hour);
      }
    });
    
    return { hour: peakHour, uploads: maxUploads };
  }
  
  startDailyReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      this.resetDailyMetrics();
      // Set up daily reset
      setInterval(() => this.resetDailyMetrics(), 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }
  
  resetDailyMetrics() {
    const previousMetrics = { ...this.metrics };
    
    this.metrics = {
      totalUploads: 0,
      visionUploads: 0,
      failedUploads: 0,
      totalProcessingTime: 0,
      totalDataProcessed: 0,
      compressionSavings: 0,
      errorsByType: {},
      uploadsByHour: {},
      processingTimesBySize: []
    };
    
    logger.info('Daily upload metrics reset', {
      previousDay: {
        totalUploads: previousMetrics.totalUploads,
        successRate: previousMetrics.totalUploads > 0 
          ? ((previousMetrics.totalUploads - previousMetrics.failedUploads) / previousMetrics.totalUploads * 100).toFixed(2)
          : 100,
        avgProcessingTime: previousMetrics.totalUploads > 0 
          ? Math.round(previousMetrics.totalProcessingTime / previousMetrics.totalUploads)
          : 0
      }
    });
  }
}

// Singleton instance
const uploadMetrics = new UploadMetrics();

// Middleware to track upload metrics
export const trackUploadMetrics = (req, res, next) => {
  // Track upload start
  const originalSend = res.send;
  const startTime = Date.now();
  
  res.send = function(data) {
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    try {
      const responseData = typeof data === 'string' ? JSON.parse(data) : data;
      
      if (responseData.success) {
        uploadMetrics.trackUploadComplete(
          processingTime,
          req.file?.size || req.body?.imageData?.length || 0,
          responseData.fileInfo?.size || 0
        );
      } else {
        uploadMetrics.trackUploadError(
          responseData.error || 'unknown',
          req.user?.userId
        );
      }
    } catch (error) {
      // If we can't parse response, assume error
      uploadMetrics.trackUploadError('parse_error', req.user?.userId);
    }
    
    originalSend.call(this, data);
  };
  
  // Track upload start
  const fileSize = req.file?.size || req.body?.imageData?.length || 0;
  const uploadType = req.path.includes('vision') ? 'vision' : 'standard';
  
  uploadMetrics.trackUploadStart(uploadType, req.user?.userId, fileSize);
  
  next();
};

export { uploadMetrics };
export default { trackUploadMetrics, uploadMetrics };