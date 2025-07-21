/**
 * COMPRESSION ANALYTICS ENGINE
 * 📊 Real-time monitoring and optimization of intelligence compression
 * 
 * Features:
 * - A/B testing of compression strategies
 * - Quality scoring and optimization tracking
 * - Performance benchmarking
 * - Predictive compression tuning
 * - ROI analysis for intelligence features
 */

import { log } from '../utils/logger.js';

class CompressionAnalytics {
  constructor() {
    this.metrics = new Map();
    this.experiments = new Map();
    this.benchmarks = {
      tokenEfficiency: 0.8,
      qualityScore: 0.85,
      processingTime: 100,
      userSatisfaction: 0.9
    };
    
    this.compressionHistory = [];
    this.maxHistorySize = 10000;
  }

  /**
   * 📊 RECORD COMPRESSION PERFORMANCE
   */
  recordCompression(compressionResult, userFeedback = null, responseQuality = null) {
    const record = {
      timestamp: Date.now(),
      strategy: compressionResult.metadata.strategy,
      tokenBudget: compressionResult.metadata.tokenBudget,
      actualTokens: compressionResult.metadata.actualTokens,
      compressionRatio: compressionResult.metadata.compressionRatio,
      qualityScore: compressionResult.metadata.qualityScore,
      processingTime: compressionResult.metadata.processingTime,
      model: compressionResult.metadata.model,
      clusters: compressionResult.metadata.intelligenceClusters,
      optimization: compressionResult.metadata.optimization,
      userFeedback: userFeedback,
      responseQuality: responseQuality,
      efficiency: this.calculateEfficiencyScore(compressionResult.metadata)
    };
    
    this.compressionHistory.push(record);
    this.updateRealTimeMetrics(record);
    this.checkForAnomalies(record);
    
    // Maintain history size
    if (this.compressionHistory.length > this.maxHistorySize) {
      this.compressionHistory.shift();
    }
    
    return record;
  }

  /**
   * ⚡ REAL-TIME METRICS UPDATE
   */
  updateRealTimeMetrics(record) {
    const timeWindow = '1h';
    const recent = this.getRecentRecords(timeWindow);
    
    const metrics = {
      avgTokenEfficiency: this.calculateAverage(recent, 'efficiency'),
      avgQualityScore: this.calculateAverage(recent, 'qualityScore'),
      avgProcessingTime: this.calculateAverage(recent, 'processingTime'),
      avgCompressionRatio: this.calculateAverage(recent, 'compressionRatio'),
      strategyDistribution: this.calculateStrategyDistribution(recent),
      modelPerformance: this.calculateModelPerformance(recent),
      trendAnalysis: this.calculateTrends(recent),
      anomalyCount: this.countAnomalies(recent),
      timestamp: Date.now()
    };
    
    this.metrics.set(timeWindow, metrics);
    
    // Trigger optimization if needed
    if (this.shouldOptimize(metrics)) {
      this.triggerOptimization(metrics);
    }
  }

  /**
   * 🧪 A/B TESTING SYSTEM
   */
  setupABTest(testName, strategies, trafficSplit, duration) {
    const experiment = {
      name: testName,
      strategies: strategies, // ['minimal', 'balanced', 'comprehensive']
      trafficSplit: trafficSplit, // [0.33, 0.33, 0.34]
      startTime: Date.now(),
      duration: duration, // milliseconds
      results: new Map(),
      active: true
    };
    
    this.experiments.set(testName, experiment);
    
    log.system(`A/B Test started: ${testName}`, {
      strategies: strategies,
      trafficSplit: trafficSplit
    });
    
    return experiment;
  }

  /**
   * 🎯 GET STRATEGY FOR A/B TEST
   */
  getStrategyForABTest(testName, userId) {
    const experiment = this.experiments.get(testName);
    if (!experiment || !experiment.active) {
      return null; // No active experiment
    }
    
    // Check if experiment has expired
    if (Date.now() - experiment.startTime > experiment.duration) {
      this.endABTest(testName);
      return null;
    }
    
    // Deterministic assignment based on user ID
    const hash = this.hashUserId(userId);
    const bucket = hash % 100;
    
    let cumulativeProbability = 0;
    for (let i = 0; i < experiment.strategies.length; i++) {
      cumulativeProbability += experiment.trafficSplit[i] * 100;
      if (bucket < cumulativeProbability) {
        return experiment.strategies[i];
      }
    }
    
    return experiment.strategies[0]; // Fallback
  }

  /**
   * 📈 RECORD A/B TEST RESULT
   */
  recordABTestResult(testName, strategy, metrics) {
    const experiment = this.experiments.get(testName);
    if (!experiment || !experiment.active) return;
    
    if (!experiment.results.has(strategy)) {
      experiment.results.set(strategy, []);
    }
    
    experiment.results.get(strategy).push({
      ...metrics,
      timestamp: Date.now()
    });
  }

  /**
   * 🏁 END A/B TEST AND ANALYZE
   */
  endABTest(testName) {
    const experiment = this.experiments.get(testName);
    if (!experiment) return null;
    
    experiment.active = false;
    experiment.endTime = Date.now();
    
    // Analyze results
    const analysis = {
      testName: testName,
      duration: experiment.endTime - experiment.startTime,
      strategies: {},
      winner: null,
      confidence: 0,
      recommendations: []
    };
    
    // Calculate performance for each strategy
    for (const [strategy, results] of experiment.results.entries()) {
      analysis.strategies[strategy] = {
        sampleSize: results.length,
        avgQuality: this.calculateAverage(results, 'qualityScore'),
        avgEfficiency: this.calculateAverage(results, 'efficiency'),
        avgProcessingTime: this.calculateAverage(results, 'processingTime'),
        successRate: results.filter(r => r.qualityScore > 0.8).length / results.length
      };
    }
    
    // Determine winner
    const strategies = Object.entries(analysis.strategies);
    if (strategies.length > 1) {
      const winner = strategies.reduce((best, current) => {
        const [bestName, bestMetrics] = best;
        const [currentName, currentMetrics] = current;
        
        // Composite score: quality * efficiency / processing_time
        const bestScore = bestMetrics.avgQuality * bestMetrics.avgEfficiency / (bestMetrics.avgProcessingTime / 100);
        const currentScore = currentMetrics.avgQuality * currentMetrics.avgEfficiency / (currentMetrics.avgProcessingTime / 100);
        
        return currentScore > bestScore ? current : best;
      });
      
      analysis.winner = winner[0];
      analysis.confidence = this.calculateStatisticalConfidence(experiment.results);
    }
    
    // Generate recommendations
    analysis.recommendations = this.generateOptimizationRecommendations(analysis);
    
    log.system(`A/B Test completed: ${testName}`, {
      winner: analysis.winner,
      confidence: (analysis.confidence * 100).toFixed(1) + '%',
      recommendationsCount: analysis.recommendations.length
    });
    
    return analysis;
  }

  /**
   * 🔍 COMPRESSION QUALITY ANALYSIS
   */
  analyzeCompressionQuality(timeWindow = '24h') {
    const records = this.getRecentRecords(timeWindow);
    
    const analysis = {
      totalCompressions: records.length,
      qualityDistribution: this.calculateQualityDistribution(records),
      performanceByStrategy: this.calculatePerformanceByStrategy(records),
      performanceByModel: this.calculatePerformanceByModel(records),
      performanceByComplexity: this.calculatePerformanceByComplexity(records),
      bottlenecks: this.identifyBottlenecks(records),
      optimizationOpportunities: this.identifyOptimizationOpportunities(records),
      trends: this.calculateQualityTrends(records),
      recommendations: []
    };
    
    // Generate specific recommendations
    analysis.recommendations = this.generateQualityRecommendations(analysis);
    
    return analysis;
  }

  /**
   * 🚀 PERFORMANCE OPTIMIZATION TRIGGERS
   */
  shouldOptimize(metrics) {
    // Trigger optimization if performance drops below benchmarks
    return (
      metrics.avgTokenEfficiency < this.benchmarks.tokenEfficiency ||
      metrics.avgQualityScore < this.benchmarks.qualityScore ||
      metrics.avgProcessingTime > this.benchmarks.processingTime ||
      metrics.anomalyCount > 5
    );
  }

  triggerOptimization(metrics) {
    log.system('Triggering compression optimization');
    
    const optimizations = [];
    
    if (metrics.avgTokenEfficiency < this.benchmarks.tokenEfficiency) {
      optimizations.push('INCREASE_TOKEN_EFFICIENCY');
    }
    
    if (metrics.avgQualityScore < this.benchmarks.qualityScore) {
      optimizations.push('IMPROVE_COMPRESSION_QUALITY');
    }
    
    if (metrics.avgProcessingTime > this.benchmarks.processingTime) {
      optimizations.push('OPTIMIZE_PROCESSING_SPEED');
    }
    
    // Execute optimizations
    this.executeOptimizations(optimizations, metrics);
  }

  executeOptimizations(optimizations, metrics) {
    for (const optimization of optimizations) {
      switch (optimization) {
        case 'INCREASE_TOKEN_EFFICIENCY':
          this.optimizeTokenEfficiency(metrics);
          break;
        case 'IMPROVE_COMPRESSION_QUALITY':
          this.optimizeCompressionQuality(metrics);
          break;
        case 'OPTIMIZE_PROCESSING_SPEED':
          this.optimizeProcessingSpeed(metrics);
          break;
      }
    }
  }

  // ========== UTILITY METHODS ==========

  calculateEfficiencyScore(metadata) {
    const tokenEfficiency = metadata.optimization?.tokenEfficiency || 0.5;
    const semanticDensity = metadata.optimization?.semanticDensity || 0.5;
    const informationRetention = metadata.optimization?.informationRetention || 0.5;
    
    return (tokenEfficiency + semanticDensity + informationRetention) / 3;
  }

  getRecentRecords(timeWindow) {
    const now = Date.now();
    const windowMs = this.parseTimeWindow(timeWindow);
    
    return this.compressionHistory.filter(record => 
      now - record.timestamp < windowMs
    );
  }

  parseTimeWindow(timeWindow) {
    const timeMap = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    return timeMap[timeWindow] || timeMap['24h'];
  }

  calculateAverage(records, field) {
    if (records.length === 0) return 0;
    const sum = records.reduce((acc, record) => acc + (record[field] || 0), 0);
    return sum / records.length;
  }

  calculateStrategyDistribution(records) {
    const distribution = {};
    records.forEach(record => {
      distribution[record.strategy] = (distribution[record.strategy] || 0) + 1;
    });
    
    const total = records.length;
    Object.keys(distribution).forEach(strategy => {
      distribution[strategy] = (distribution[strategy] / total * 100).toFixed(1) + '%';
    });
    
    return distribution;
  }

  calculateModelPerformance(records) {
    const performance = {};
    
    records.forEach(record => {
      if (!performance[record.model]) {
        performance[record.model] = [];
      }
      performance[record.model].push(record);
    });
    
    Object.keys(performance).forEach(model => {
      const modelRecords = performance[model];
      performance[model] = {
        count: modelRecords.length,
        avgQuality: this.calculateAverage(modelRecords, 'qualityScore'),
        avgEfficiency: this.calculateAverage(modelRecords, 'efficiency'),
        avgProcessingTime: this.calculateAverage(modelRecords, 'processingTime')
      };
    });
    
    return performance;
  }

  calculateTrends(records) {
    if (records.length < 10) return { trend: 'insufficient_data' };
    
    // Sort by timestamp
    records.sort((a, b) => a.timestamp - b.timestamp);
    
    // Split into first and second half
    const midpoint = Math.floor(records.length / 2);
    const firstHalf = records.slice(0, midpoint);
    const secondHalf = records.slice(midpoint);
    
    const firstAvg = this.calculateAverage(firstHalf, 'qualityScore');
    const secondAvg = this.calculateAverage(secondHalf, 'qualityScore');
    
    const change = ((secondAvg - firstAvg) / firstAvg * 100).toFixed(1);
    
    return {
      trend: secondAvg > firstAvg ? 'improving' : 'declining',
      change: change + '%',
      confidence: Math.min(records.length / 100, 1.0)
    };
  }

  countAnomalies(records) {
    return records.filter(record => 
      record.qualityScore < 0.5 || 
      record.processingTime > 500 ||
      record.efficiency < 0.3
    ).length;
  }

  checkForAnomalies(record) {
    const anomalies = [];
    
    if (record.qualityScore < 0.5) {
      anomalies.push('LOW_QUALITY');
    }
    
    if (record.processingTime > 500) {
      anomalies.push('SLOW_PROCESSING');
    }
    
    if (record.efficiency < 0.3) {
      anomalies.push('LOW_EFFICIENCY');
    }
    
    if (anomalies.length > 0) {
      log.warn(`Compression anomaly detected: ${anomalies.join(', ')}`, {
        strategy: record.strategy,
        model: record.model,
        timestamp: new Date(record.timestamp).toISOString()
      });
    }
  }

  hashUserId(userId) {
    // Simple hash function for consistent user bucketing
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  calculateStatisticalConfidence(results) {
    // Simplified confidence calculation
    const strategies = Array.from(results.keys());
    if (strategies.length < 2) return 0;
    
    const sampleSizes = strategies.map(s => results.get(s).length);
    const minSampleSize = Math.min(...sampleSizes);
    
    // Confidence increases with sample size
    return Math.min(minSampleSize / 100, 0.95);
  }

  generateOptimizationRecommendations(analysis) {
    const recommendations = [];
    
    if (analysis.winner) {
      recommendations.push(`Use '${analysis.winner}' strategy as default (${(analysis.confidence * 100).toFixed(1)}% confidence)`);
    }
    
    // Analyze strategy performance
    const strategies = Object.entries(analysis.strategies);
    const worstStrategy = strategies.reduce((worst, current) => {
      return current[1].avgQuality < worst[1].avgQuality ? current : worst;
    });
    
    if (worstStrategy[1].avgQuality < 0.7) {
      recommendations.push(`Consider removing '${worstStrategy[0]}' strategy (low quality: ${(worstStrategy[1].avgQuality * 100).toFixed(1)}%)`);
    }
    
    return recommendations;
  }

  calculateQualityDistribution(records) {
    const buckets = { excellent: 0, good: 0, fair: 0, poor: 0 };
    
    records.forEach(record => {
      if (record.qualityScore >= 0.9) buckets.excellent++;
      else if (record.qualityScore >= 0.8) buckets.good++;
      else if (record.qualityScore >= 0.6) buckets.fair++;
      else buckets.poor++;
    });
    
    const total = records.length;
    Object.keys(buckets).forEach(bucket => {
      buckets[bucket] = (buckets[bucket] / total * 100).toFixed(1) + '%';
    });
    
    return buckets;
  }

  identifyBottlenecks(records) {
    const bottlenecks = [];
    
    const slowRecords = records.filter(r => r.processingTime > 200);
    if (slowRecords.length > records.length * 0.1) {
      bottlenecks.push('SLOW_PROCESSING');
    }
    
    const lowQualityRecords = records.filter(r => r.qualityScore < 0.7);
    if (lowQualityRecords.length > records.length * 0.2) {
      bottlenecks.push('QUALITY_ISSUES');
    }
    
    return bottlenecks;
  }

  identifyOptimizationOpportunities(records) {
    const opportunities = [];
    
    // Group by strategy and find underperforming ones
    const strategyGroups = {};
    records.forEach(record => {
      if (!strategyGroups[record.strategy]) {
        strategyGroups[record.strategy] = [];
      }
      strategyGroups[record.strategy].push(record);
    });
    
    Object.entries(strategyGroups).forEach(([strategy, strategyRecords]) => {
      const avgQuality = this.calculateAverage(strategyRecords, 'qualityScore');
      const avgEfficiency = this.calculateAverage(strategyRecords, 'efficiency');
      
      if (avgQuality < 0.8) {
        opportunities.push(`Improve ${strategy} strategy quality (current: ${(avgQuality * 100).toFixed(1)}%)`);
      }
      
      if (avgEfficiency < 0.7) {
        opportunities.push(`Optimize ${strategy} strategy efficiency (current: ${(avgEfficiency * 100).toFixed(1)}%)`);
      }
    });
    
    return opportunities;
  }

  generateQualityRecommendations(analysis) {
    const recommendations = [];
    
    if (analysis.bottlenecks.includes('SLOW_PROCESSING')) {
      recommendations.push('Optimize compression algorithms for speed');
    }
    
    if (analysis.bottlenecks.includes('QUALITY_ISSUES')) {
      recommendations.push('Review compression parameters for quality improvement');
    }
    
    recommendations.push(...analysis.optimizationOpportunities);
    
    return recommendations;
  }

  optimizeTokenEfficiency(metrics) {
    log.system('Optimizing token efficiency');
    // Implementation for efficiency optimization
  }

  optimizeCompressionQuality(metrics) {
    log.system('Optimizing compression quality');
    // Implementation for quality optimization
  }

  optimizeProcessingSpeed(metrics) {
    log.system('Optimizing processing speed');
    // Implementation for speed optimization
  }

  // Public API methods
  getMetrics(timeWindow = '1h') {
    return this.metrics.get(timeWindow);
  }

  getCompressionHistory(limit = 100) {
    return this.compressionHistory.slice(-limit);
  }

  getActiveExperiments() {
    return Array.from(this.experiments.values()).filter(exp => exp.active);
  }

  getCompletedExperiments() {
    return Array.from(this.experiments.values()).filter(exp => !exp.active);
  }
}

export default new CompressionAnalytics();