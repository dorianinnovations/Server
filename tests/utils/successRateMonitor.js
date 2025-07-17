/**
 * Success Rate Monitoring Utility
 * Tracks and analyzes test success rates across different categories
 */

import fs from 'fs/promises';
import path from 'path';

class SuccessRateMonitor {
  constructor() {
    this.metrics = {
      sessions: [],
      currentSession: null,
      aggregatedStats: {
        totalTests: 0,
        totalPassed: 0,
        totalFailed: 0,
        overallSuccessRate: 0,
        averageTestDuration: 0,
        categoryStats: {},
        criticalFailures: [],
        performanceMetrics: {
          slowestTests: [],
          fastestTests: [],
          timeoutTests: []
        }
      }
    };
    this.metricsFile = path.join(process.cwd(), 'tests', 'metrics', 'success-rates.json');
  }

  // Start a new test session
  startSession(sessionName, metadata = {}) {
    this.currentSession = {
      id: `session-${Date.now()}`,
      name: sessionName,
      startTime: Date.now(),
      endTime: null,
      metadata,
      testResults: [],
      stats: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        successRate: 0,
        totalDuration: 0,
        averageDuration: 0
      },
      categories: {},
      criticalFailures: [],
      warnings: []
    };

    console.log(`🎯 Started monitoring session: ${sessionName}`);
    return this.currentSession.id;
  }

  // End current test session
  async endSession() {
    if (!this.currentSession) {
      throw new Error('No active session to end');
    }

    this.currentSession.endTime = Date.now();
    this.currentSession.stats.totalDuration =
      this.currentSession.endTime - this.currentSession.startTime;

    // Calculate session statistics
    this.calculateSessionStats();

    // Add to sessions history
    this.metrics.sessions.push(this.currentSession);

    // Update aggregated statistics
    this.updateAggregatedStats();

    // Save metrics to file
    await this.saveMetrics();

    // Generate session report
    const report = this.generateSessionReport();
    console.log(report);

    const sessionId = this.currentSession.id;
    this.currentSession = null;

    return sessionId;
  }

  // Record a test result
  recordTest(testName, category, success, duration, metadata = {}) {
    if (!this.currentSession) {
      throw new Error('No active session for recording test');
    }

    const testResult = {
      name: testName,
      category: category || 'uncategorized',
      success,
      duration,
      timestamp: Date.now(),
      metadata
    };

    this.currentSession.testResults.push(testResult);
    this.currentSession.stats.total++;

    if (success) {
      this.currentSession.stats.passed++;
    } else {
      this.currentSession.stats.failed++;

      // Check for critical failures
      if (this.isCriticalFailure(testName, category, metadata)) {
        this.currentSession.criticalFailures.push(testResult);
      }
    }

    // Track by category
    if (!this.currentSession.categories[testResult.category]) {
      this.currentSession.categories[testResult.category] = {
        total: 0,
        passed: 0,
        failed: 0,
        successRate: 0,
        totalDuration: 0,
        averageDuration: 0
      };
    }

    const catStats = this.currentSession.categories[testResult.category];
    catStats.total++;
    catStats.totalDuration += duration;

    if (success) {
      catStats.passed++;
    } else {
      catStats.failed++;
    }

    // Update real-time success rate
    this.currentSession.stats.successRate =
      (this.currentSession.stats.passed / this.currentSession.stats.total) * 100;
    catStats.successRate = (catStats.passed / catStats.total) * 100;
    catStats.averageDuration = catStats.totalDuration / catStats.total;

    // Check for performance issues
    this.checkPerformanceThresholds(testResult);
  }

  // Calculate session statistics
  calculateSessionStats() {
    const stats = this.currentSession.stats;

    if (stats.total > 0) {
      stats.successRate = (stats.passed / stats.total) * 100;
      stats.averageDuration =
        this.currentSession.testResults.reduce((sum, test) => sum + test.duration, 0) / stats.total;
    }

    // Calculate category averages
    Object.values(this.currentSession.categories).forEach(catStats => {
      if (catStats.total > 0) {
        catStats.successRate = (catStats.passed / catStats.total) * 100;
        catStats.averageDuration = catStats.totalDuration / catStats.total;
      }
    });
  }

  // Update aggregated statistics across all sessions
  updateAggregatedStats() {
    const agg = this.metrics.aggregatedStats;

    // Reset aggregated stats
    agg.totalTests = 0;
    agg.totalPassed = 0;
    agg.totalFailed = 0;
    agg.categoryStats = {};
    agg.criticalFailures = [];
    agg.performanceMetrics = {
      slowestTests: [],
      fastestTests: [],
      timeoutTests: []
    };

    // Aggregate across all sessions
    this.metrics.sessions.forEach(session => {
      agg.totalTests += session.stats.total;
      agg.totalPassed += session.stats.passed;
      agg.totalFailed += session.stats.failed;

      // Aggregate critical failures
      agg.criticalFailures.push(...session.criticalFailures);

      // Aggregate by category
      Object.entries(session.categories).forEach(([category, stats]) => {
        if (!agg.categoryStats[category]) {
          agg.categoryStats[category] = {
            total: 0,
            passed: 0,
            failed: 0,
            successRate: 0,
            totalDuration: 0,
            sessions: 0
          };
        }

        const aggCat = agg.categoryStats[category];
        aggCat.total += stats.total;
        aggCat.passed += stats.passed;
        aggCat.failed += stats.failed;
        aggCat.totalDuration += stats.totalDuration;
        aggCat.sessions++;
      });

      // Collect performance data
      session.testResults.forEach(test => {
        agg.performanceMetrics.slowestTests.push(test);
        agg.performanceMetrics.fastestTests.push(test);
      });
    });

    // Calculate final aggregated metrics
    if (agg.totalTests > 0) {
      agg.overallSuccessRate = (agg.totalPassed / agg.totalTests) * 100;
      agg.averageTestDuration =
        this.metrics.sessions.reduce((sum, session) => sum + session.stats.averageDuration, 0) /
        this.metrics.sessions.length;
    }

    // Calculate category success rates
    Object.values(agg.categoryStats).forEach(catStats => {
      if (catStats.total > 0) {
        catStats.successRate = (catStats.passed / catStats.total) * 100;
      }
    });

    // Sort performance metrics
    agg.performanceMetrics.slowestTests.sort((a, b) => b.duration - a.duration).splice(10);
    agg.performanceMetrics.fastestTests.sort((a, b) => a.duration - b.duration).splice(10);
  }

  // Check if a failure is critical
  isCriticalFailure(testName, category, metadata) {
    const criticalCategories = ['authentication', 'core-chat', 'user-registration'];
    const criticalTests = [
      'User Registration',
      'User Login',
      'Chat Completion',
      'Adaptive Chat',
      'Mobile Data Sync'
    ];

    return (
      criticalCategories.includes(category) ||
      criticalTests.includes(testName) ||
      metadata.critical === true
    );
  }

  // Check performance thresholds
  checkPerformanceThresholds(testResult) {
    const thresholds = {
      slow: 5000, // 5 seconds
      timeout: 30000, // 30 seconds
      fast: 100 // 100ms
    };

    if (testResult.duration > thresholds.timeout) {
      this.currentSession.warnings.push({
        type: 'timeout',
        test: testResult.name,
        duration: testResult.duration,
        threshold: thresholds.timeout
      });
    } else if (testResult.duration > thresholds.slow) {
      this.currentSession.warnings.push({
        type: 'slow',
        test: testResult.name,
        duration: testResult.duration,
        threshold: thresholds.slow
      });
    }
  }

  // Generate session report
  generateSessionReport() {
    if (!this.currentSession) {
      return 'No active session';
    }

    const session = this.currentSession;
    const stats = session.stats;

    let report = '\n' + '='.repeat(80) + '\n';
    report += `🎯 SUCCESS RATE REPORT: ${session.name}\n`;
    report += '='.repeat(80) + '\n';

    // Overall metrics
    report += `📊 Overall Success Rate: ${stats.successRate.toFixed(2)}%\n`;
    report += `✅ Passed: ${stats.passed}/${stats.total}\n`;
    report += `❌ Failed: ${stats.failed}\n`;
    report += `⏱️ Total Duration: ${stats.totalDuration}ms\n`;
    report += `📈 Average Duration: ${stats.averageDuration.toFixed(2)}ms\n\n`;

    // Category breakdown
    if (Object.keys(session.categories).length > 0) {
      report += '📋 Category Breakdown:\n';
      Object.entries(session.categories).forEach(([category, catStats]) => {
        const status = catStats.successRate >= 95 ? '🟢' : catStats.successRate >= 80 ? '🟡' : '🔴';
        report += `  ${status} ${category}: ${catStats.successRate.toFixed(1)}% (${catStats.passed}/${catStats.total})\n`;
      });
      report += '\n';
    }

    // Critical failures
    if (session.criticalFailures.length > 0) {
      report += '🚨 Critical Failures:\n';
      session.criticalFailures.forEach(failure => {
        report += `  ❌ ${failure.name} (${failure.category})\n`;
        if (failure.metadata.error) {
          report += `     Error: ${failure.metadata.error}\n`;
        }
      });
      report += '\n';
    }

    // Performance warnings
    if (session.warnings.length > 0) {
      report += '⚠️ Performance Warnings:\n';
      session.warnings.forEach(warning => {
        report += `  ${warning.type.toUpperCase()}: ${warning.test} (${warning.duration}ms)\n`;
      });
      report += '\n';
    }

    // Success criteria
    const successCriteria = this.evaluateSuccessCriteria(stats);
    report += '🎯 Success Criteria:\n';
    Object.entries(successCriteria).forEach(([criterion, result]) => {
      const status = result.passed ? '✅' : '❌';
      report += `  ${status} ${criterion}: ${result.message}\n`;
    });

    report += '='.repeat(80) + '\n';
    return report;
  }

  // Evaluate success criteria
  evaluateSuccessCriteria(stats) {
    return {
      'Overall Success Rate': {
        passed: stats.successRate >= 95,
        message: `${stats.successRate.toFixed(2)}% (target: ≥95%)`
      },
      'Critical Tests': {
        passed: this.currentSession.criticalFailures.length === 0,
        message: `${this.currentSession.criticalFailures.length} critical failures (target: 0)`
      },
      'Average Performance': {
        passed: stats.averageDuration <= 3000,
        message: `${stats.averageDuration.toFixed(2)}ms (target: ≤3000ms)`
      },
      'Zero Failures': {
        passed: stats.failed === 0,
        message: `${stats.failed} failures (target: 0)`
      }
    };
  }

  // Save metrics to file
  async saveMetrics() {
    try {
      // Ensure metrics directory exists
      const metricsDir = path.dirname(this.metricsFile);
      await fs.mkdir(metricsDir, { recursive: true });

      // Save metrics with timestamp
      const metricsWithTimestamp = {
        ...this.metrics,
        lastUpdated: new Date().toISOString(),
        version: '1.0.0'
      };

      await fs.writeFile(this.metricsFile, JSON.stringify(metricsWithTimestamp, null, 2));
      console.log(`📊 Metrics saved to: ${this.metricsFile}`);
    } catch (error) {
      console.error('Failed to save metrics:', error);
    }
  }

  // Load existing metrics
  async loadMetrics() {
    try {
      const data = await fs.readFile(this.metricsFile, 'utf8');
      this.metrics = JSON.parse(data);
      console.log('📊 Loaded existing metrics');
    } catch (error) {
      console.log('📊 No existing metrics found, starting fresh');
    }
  }

  // Get current metrics
  getMetrics() {
    return {
      currentSession: this.currentSession,
      aggregatedStats: this.metrics.aggregatedStats,
      sessions: this.metrics.sessions
    };
  }

  // Generate comprehensive report
  generateComprehensiveReport() {
    const agg = this.metrics.aggregatedStats;

    let report = '\n' + '='.repeat(100) + '\n';
    report += '🎯 COMPREHENSIVE SUCCESS RATE ANALYSIS\n';
    report += '='.repeat(100) + '\n';

    // Overall statistics
    report += '📊 OVERALL STATISTICS:\n';
    report += `   Success Rate: ${agg.overallSuccessRate.toFixed(2)}%\n`;
    report += `   Total Tests: ${agg.totalTests}\n`;
    report += `   Passed: ${agg.totalPassed}\n`;
    report += `   Failed: ${agg.totalFailed}\n`;
    report += `   Average Duration: ${agg.averageTestDuration.toFixed(2)}ms\n`;
    report += `   Total Sessions: ${this.metrics.sessions.length}\n\n`;

    // Category analysis
    if (Object.keys(agg.categoryStats).length > 0) {
      report += '📋 CATEGORY ANALYSIS:\n';
      Object.entries(agg.categoryStats)
        .sort(([, a], [, b]) => b.successRate - a.successRate)
        .forEach(([category, stats]) => {
          const status = stats.successRate >= 95 ? '🟢' : stats.successRate >= 80 ? '🟡' : '🔴';
          report += `   ${status} ${category.padEnd(20)} | ${stats.successRate.toFixed(1)}% | ${stats.passed}/${stats.total} | ${stats.sessions} sessions\n`;
        });
      report += '\n';
    }

    // Performance analysis
    if (agg.performanceMetrics.slowestTests.length > 0) {
      report += '🐌 SLOWEST TESTS:\n';
      agg.performanceMetrics.slowestTests.slice(0, 5).forEach((test, i) => {
        report += `   ${i + 1}. ${test.name} (${test.duration}ms)\n`;
      });
      report += '\n';
    }

    // Critical failures summary
    if (agg.criticalFailures.length > 0) {
      report += '🚨 CRITICAL FAILURES SUMMARY:\n';
      const failureGroups = {};
      agg.criticalFailures.forEach(failure => {
        const key = `${failure.name}-${failure.category}`;
        failureGroups[key] = (failureGroups[key] || 0) + 1;
      });

      Object.entries(failureGroups)
        .sort(([, a], [, b]) => b - a)
        .forEach(([key, count]) => {
          report += `   ❌ ${key}: ${count} occurrences\n`;
        });
      report += '\n';
    }

    // Trends
    if (this.metrics.sessions.length >= 2) {
      report += '📈 TRENDS:\n';
      const recentSessions = this.metrics.sessions.slice(-5);
      const trendData = recentSessions.map(session => ({
        name: session.name,
        successRate: session.stats.successRate,
        duration: session.stats.averageDuration
      }));

      const successRateTrend = this.calculateTrend(trendData.map(d => d.successRate));
      const durationTrend = this.calculateTrend(trendData.map(d => d.duration));

      report += `   Success Rate Trend: ${successRateTrend > 0 ? '📈 Improving' : successRateTrend < 0 ? '📉 Declining' : '➡️ Stable'}\n`;
      report += `   Performance Trend: ${durationTrend < 0 ? '📈 Improving' : durationTrend > 0 ? '📉 Declining' : '➡️ Stable'}\n\n`;
    }

    report += '='.repeat(100) + '\n';
    return report;
  }

  // Calculate trend direction
  calculateTrend(values) {
    if (values.length < 2) return 0;

    const first = values[0];
    const last = values[values.length - 1];
    return last - first;
  }
}

export default SuccessRateMonitor;
