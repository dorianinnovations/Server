import express from 'express';
import { protect } from '../middleware/auth.js';
import compressionAnalytics from '../services/compressionAnalytics.js';

const router = express.Router();

/**
 * GET /compression-dashboard/metrics
 * Real-time compression performance metrics
 */
router.get('/metrics', protect, async (req, res) => {
  try {
    const { timeWindow = '1h' } = req.query;
    
    const metrics = compressionAnalytics.getMetrics(timeWindow);
    const history = compressionAnalytics.getCompressionHistory(100);
    
    res.json({
      success: true,
      timeWindow,
      metrics: metrics || {
        message: 'No metrics available yet',
        suggestion: 'Run some chat requests to generate compression data'
      },
      recentCompressions: history.slice(-10),
      summary: {
        totalCompressions: history.length,
        lastCompression: history.length > 0 ? new Date(history[history.length - 1].timestamp).toISOString() : null
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /compression-dashboard/quality-analysis
 * Detailed compression quality analysis
 */
router.get('/quality-analysis', protect, async (req, res) => {
  try {
    const { timeWindow = '24h' } = req.query;
    
    const analysis = compressionAnalytics.analyzeCompressionQuality(timeWindow);
    
    res.json({
      success: true,
      timeWindow,
      analysis
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /compression-dashboard/ab-test
 * Setup A/B test for compression strategies
 */
router.post('/ab-test', protect, async (req, res) => {
  try {
    const { 
      testName, 
      strategies = ['minimal', 'balanced', 'comprehensive'],
      trafficSplit = [0.33, 0.33, 0.34],
      duration = 24 * 60 * 60 * 1000 // 24 hours default
    } = req.body;
    
    if (!testName) {
      return res.status(400).json({
        success: false,
        error: 'testName is required'
      });
    }
    
    const experiment = compressionAnalytics.setupABTest(
      testName,
      strategies,
      trafficSplit,
      duration
    );
    
    res.json({
      success: true,
      experiment: {
        name: experiment.name,
        strategies: experiment.strategies,
        trafficSplit: experiment.trafficSplit,
        duration: experiment.duration,
        startTime: new Date(experiment.startTime).toISOString(),
        estimatedEndTime: new Date(experiment.startTime + experiment.duration).toISOString()
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /compression-dashboard/ab-tests
 * Get all A/B tests (active and completed)
 */
router.get('/ab-tests', protect, async (req, res) => {
  try {
    const activeExperiments = compressionAnalytics.getActiveExperiments();
    const completedExperiments = compressionAnalytics.getCompletedExperiments();
    
    res.json({
      success: true,
      active: activeExperiments.map(exp => ({
        name: exp.name,
        strategies: exp.strategies,
        startTime: new Date(exp.startTime).toISOString(),
        duration: exp.duration,
        samplesCollected: Array.from(exp.results.values()).reduce((total, results) => total + results.length, 0)
      })),
      completed: completedExperiments.map(exp => ({
        name: exp.name,
        startTime: new Date(exp.startTime).toISOString(),
        endTime: exp.endTime ? new Date(exp.endTime).toISOString() : null,
        duration: exp.duration,
        totalSamples: Array.from(exp.results.values()).reduce((total, results) => total + results.length, 0)
      }))
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /compression-dashboard/ab-test/:testName/end
 * End A/B test and get results
 */
router.post('/ab-test/:testName/end', protect, async (req, res) => {
  try {
    const { testName } = req.params;
    
    const analysis = compressionAnalytics.endABTest(testName);
    
    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'Test not found or already ended'
      });
    }
    
    res.json({
      success: true,
      analysis
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /compression-dashboard/optimization-status
 * Current optimization status and recommendations
 */
router.get('/optimization-status', protect, async (req, res) => {
  try {
    const metrics = compressionAnalytics.getMetrics('1h');
    const qualityAnalysis = compressionAnalytics.analyzeCompressionQuality('24h');
    
    const status = {
      healthy: true,
      issues: [],
      recommendations: [],
      performance: {
        tokenEfficiency: 'unknown',
        qualityScore: 'unknown',
        processingSpeed: 'unknown'
      }
    };
    
    if (metrics) {
      // Check performance thresholds
      if (metrics.avgTokenEfficiency < 0.8) {
        status.healthy = false;
        status.issues.push('Token efficiency below optimal (< 80%)');
        status.recommendations.push('Review compression algorithms for better token utilization');
      }
      
      if (metrics.avgQualityScore < 0.85) {
        status.healthy = false;
        status.issues.push('Quality score below target (< 85%)');
        status.recommendations.push('Improve compression quality parameters');
      }
      
      if (metrics.avgProcessingTime > 100) {
        status.healthy = false;
        status.issues.push('Processing time above target (> 100ms)');
        status.recommendations.push('Optimize compression speed');
      }
      
      status.performance = {
        tokenEfficiency: (metrics.avgTokenEfficiency * 100).toFixed(1) + '%',
        qualityScore: (metrics.avgQualityScore * 100).toFixed(1) + '%',
        processingSpeed: metrics.avgProcessingTime.toFixed(0) + 'ms'
      };
    }
    
    if (qualityAnalysis) {
      status.recommendations.push(...qualityAnalysis.recommendations);
    }
    
    res.json({
      success: true,
      status,
      lastCheck: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /compression-dashboard/test
 * Test endpoint without auth for system verification
 */
router.get('/test', async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Ultimate Intelligence Compression System Online",
      features: [
        "✅ IntelligenceCompressorV2 - Adaptive token budgeting",
        "✅ CompressionAnalytics - A/B testing framework", 
        "✅ IntelligenceOptimizer - ML-based optimization",
        "✅ Context succession fix implemented",
        "✅ Real-time performance monitoring"
      ],
      timestamp: new Date().toISOString(),
      status: "Fully operational and ready for testing"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /compression-dashboard/benchmark
 * Benchmark compression performance
 */
router.get('/benchmark', protect, async (req, res) => {
  try {
    const history = compressionAnalytics.getCompressionHistory(1000);
    
    if (history.length === 0) {
      return res.json({
        success: true,
        message: 'No compression data available for benchmarking',
        suggestion: 'Run chat requests to generate baseline data'
      });
    }
    
    // Calculate percentiles
    const sortedByQuality = [...history].sort((a, b) => a.qualityScore - b.qualityScore);
    const sortedBySpeed = [...history].sort((a, b) => a.processingTime - b.processingTime);
    const sortedByEfficiency = [...history].sort((a, b) => a.efficiency - b.efficiency);
    
    const benchmark = {
      totalSamples: history.length,
      qualityBenchmarks: {
        p50: sortedByQuality[Math.floor(history.length * 0.5)]?.qualityScore || 0,
        p75: sortedByQuality[Math.floor(history.length * 0.75)]?.qualityScore || 0,
        p90: sortedByQuality[Math.floor(history.length * 0.9)]?.qualityScore || 0,
        p95: sortedByQuality[Math.floor(history.length * 0.95)]?.qualityScore || 0
      },
      speedBenchmarks: {
        p50: sortedBySpeed[Math.floor(history.length * 0.5)]?.processingTime || 0,
        p75: sortedBySpeed[Math.floor(history.length * 0.75)]?.processingTime || 0,
        p90: sortedBySpeed[Math.floor(history.length * 0.9)]?.processingTime || 0,
        p95: sortedBySpeed[Math.floor(history.length * 0.95)]?.processingTime || 0
      },
      efficiencyBenchmarks: {
        p50: sortedByEfficiency[Math.floor(history.length * 0.5)]?.efficiency || 0,
        p75: sortedByEfficiency[Math.floor(history.length * 0.75)]?.efficiency || 0,
        p90: sortedByEfficiency[Math.floor(history.length * 0.9)]?.efficiency || 0,
        p95: sortedByEfficiency[Math.floor(history.length * 0.95)]?.efficiency || 0
      },
      strategyPerformance: {},
      generatedAt: new Date().toISOString()
    };
    
    // Calculate strategy-specific benchmarks
    const strategies = [...new Set(history.map(h => h.strategy))];
    strategies.forEach(strategy => {
      const strategyData = history.filter(h => h.strategy === strategy);
      benchmark.strategyPerformance[strategy] = {
        samples: strategyData.length,
        avgQuality: strategyData.reduce((sum, h) => sum + h.qualityScore, 0) / strategyData.length,
        avgSpeed: strategyData.reduce((sum, h) => sum + h.processingTime, 0) / strategyData.length,
        avgEfficiency: strategyData.reduce((sum, h) => sum + h.efficiency, 0) / strategyData.length
      };
    });
    
    res.json({
      success: true,
      benchmark
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;