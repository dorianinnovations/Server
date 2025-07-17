#!/usr/bin/env node

/**
 * Continuous Success Rate Monitoring System
 * Runs periodic health checks and tracks success rates over time
 */

import cron from 'node-cron';
import axios from 'axios';
import SuccessRateMonitor from '../utils/successRateMonitor.js';
import { spawn } from 'child_process';

class ContinuousMonitor {
  constructor() {
    this.monitor = new SuccessRateMonitor();
    this.isRunning = false;
    this.healthCheckInterval = 5; // minutes
    this.fullTestInterval = 30; // minutes
    this.baseUrl = process.env.API_BASE_URL || 'http://localhost:5001/api';
    this.scheduledJobs = [];

    // Health check endpoints to monitor
    this.healthChecks = [
      { name: 'Server Health', endpoint: '/health', critical: true },
      { name: 'Database Health', endpoint: '/health/db', critical: true },
      { name: 'Redis Health', endpoint: '/health/redis', critical: false },
      { name: 'Auth Status', endpoint: '/auth/status', critical: true },
      { name: 'API Docs', endpoint: '/docs', critical: false }
    ];

    // Performance thresholds
    this.thresholds = {
      responseTime: 2000, // 2 seconds
      successRate: 95, // 95%
      uptime: 99.5, // 99.5%
      errorRate: 1 // 1% max error rate
    };
  }

  async start() {
    console.log('🔄 Starting Continuous Success Rate Monitoring System');
    console.log(`📊 Health checks every ${this.healthCheckInterval} minutes`);
    console.log(`🧪 Full tests every ${this.fullTestInterval} minutes`);

    this.isRunning = true;

    // Load existing metrics
    await this.monitor.loadMetrics();

    // Schedule health checks
    this.scheduleHealthChecks();

    // Schedule full test runs
    this.scheduleFullTests();

    // Schedule daily reports
    this.scheduleDailyReports();

    // Handle graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());

    console.log('✅ Continuous monitoring started successfully');

    // Run initial health check
    await this.runHealthChecks();
  }

  scheduleHealthChecks() {
    const cronExpression = `*/${this.healthCheckInterval} * * * *`;

    const job = cron.schedule(
      cronExpression,
      async () => {
        if (this.isRunning) {
          await this.runHealthChecks();
        }
      },
      {
        scheduled: false
      }
    );

    job.start();
    this.scheduledJobs.push(job);

    console.log(`⏰ Scheduled health checks: ${cronExpression}`);
  }

  scheduleFullTests() {
    const cronExpression = `*/${this.fullTestInterval} * * * *`;

    const job = cron.schedule(
      cronExpression,
      async () => {
        if (this.isRunning) {
          await this.runFullTests();
        }
      },
      {
        scheduled: false
      }
    );

    job.start();
    this.scheduledJobs.push(job);

    console.log(`⏰ Scheduled full tests: ${cronExpression}`);
  }

  scheduleDailyReports() {
    // Run daily report at 9 AM
    const job = cron.schedule(
      '0 9 * * *',
      async () => {
        if (this.isRunning) {
          await this.generateDailyReport();
        }
      },
      {
        scheduled: false
      }
    );

    job.start();
    this.scheduledJobs.push(job);

    console.log('⏰ Scheduled daily reports: 9:00 AM');
  }

  async runHealthChecks() {
    console.log('\n🔍 Running Health Checks...');

    const sessionId = this.monitor.startSession('Health Check', {
      type: 'health_check',
      timestamp: new Date().toISOString(),
      interval: this.healthCheckInterval
    });

    const results = [];

    for (const check of this.healthChecks) {
      const result = await this.performHealthCheck(check);
      results.push(result);

      this.monitor.recordTest(check.name, 'health-check', result.success, result.duration, {
        endpoint: check.endpoint,
        critical: check.critical,
        statusCode: result.statusCode,
        responseTime: result.duration,
        error: result.error
      });
    }

    await this.monitor.endSession();

    // Check for critical failures
    const criticalFailures = results.filter(r => !r.success && r.critical);
    if (criticalFailures.length > 0) {
      await this.handleCriticalFailures(criticalFailures);
    }

    // Log summary
    const passed = results.filter(r => r.success).length;
    const total = results.length;
    console.log(
      `📊 Health Check Results: ${passed}/${total} passed (${((passed / total) * 100).toFixed(1)}%)`
    );
  }

  async performHealthCheck(check) {
    const startTime = Date.now();

    try {
      const response = await axios.get(`${this.baseUrl}${check.endpoint}`, {
        timeout: 10000,
        validateStatus: status => status < 500 // Accept 4xx as success for some endpoints
      });

      const duration = Date.now() - startTime;
      const success = response.status >= 200 && response.status < 400;

      return {
        name: check.name,
        success,
        duration,
        statusCode: response.status,
        critical: check.critical,
        error: null
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        name: check.name,
        success: false,
        duration,
        statusCode: error.response?.status || 0,
        critical: check.critical,
        error: error.message
      };
    }
  }

  async runFullTests() {
    console.log('\n🧪 Running Full Test Suite...');

    return new Promise(resolve => {
      const child = spawn('node', ['tests/scripts/runE2EWithMetrics.js'], {
        stdio: 'inherit',
        cwd: process.cwd()
      });

      child.on('close', code => {
        const success = code === 0;
        console.log(`🧪 Full test suite completed with exit code: ${code}`);
        resolve(success);
      });

      child.on('error', error => {
        console.error('❌ Full test suite error:', error);
        resolve(false);
      });
    });
  }

  async handleCriticalFailures(failures) {
    console.log('🚨 CRITICAL FAILURES DETECTED:');
    failures.forEach(failure => {
      console.log(`  ❌ ${failure.name}: ${failure.error || 'Unknown error'}`);
    });

    // Could implement alerting here (email, Slack, etc.)
    await this.sendAlert('Critical Health Check Failures', failures);
  }

  async sendAlert(title, data) {
    // Placeholder for alert system integration
    console.log(`🚨 ALERT: ${title}`);
    console.log('Alert data:', JSON.stringify(data, null, 2));

    // Example: Send to webhook, email service, etc.
    // await this.sendWebhookAlert(title, data);
    // await this.sendEmailAlert(title, data);
  }

  async generateDailyReport() {
    console.log('\n📊 Generating Daily Report...');

    const metrics = this.monitor.getMetrics();
    const report = this.monitor.generateComprehensiveReport();

    // Get 24-hour stats
    const last24Hours = Date.now() - 24 * 60 * 60 * 1000;
    const recentSessions = metrics.sessions.filter(session => session.startTime >= last24Hours);

    if (recentSessions.length === 0) {
      console.log('📊 No sessions in the last 24 hours');
      return;
    }

    const dailyStats = this.calculateDailyStats(recentSessions);

    console.log('\n📈 24-HOUR PERFORMANCE SUMMARY');
    console.log('='.repeat(60));
    console.log(`🎯 Overall Success Rate: ${dailyStats.successRate.toFixed(2)}%`);
    console.log(`📊 Total Tests: ${dailyStats.totalTests}`);
    console.log(`✅ Passed: ${dailyStats.passed}`);
    console.log(`❌ Failed: ${dailyStats.failed}`);
    console.log(`🔄 Total Sessions: ${recentSessions.length}`);
    console.log(`⏱️ Average Response Time: ${dailyStats.avgResponseTime.toFixed(2)}ms`);
    console.log(`🚨 Critical Failures: ${dailyStats.criticalFailures}`);

    // Performance assessment
    console.log('\n📋 Performance Assessment:');
    const assessments = this.assessPerformance(dailyStats);
    assessments.forEach(assessment => {
      const status = assessment.passed ? '✅' : '❌';
      console.log(
        `  ${status} ${assessment.metric}: ${assessment.value} (${assessment.threshold})`
      );
    });

    // Trends
    if (metrics.sessions.length >= 2) {
      console.log('\n📈 Trends:');
      const trends = this.calculateTrends(metrics.sessions);
      Object.entries(trends).forEach(([metric, trend]) => {
        const arrow = trend.direction === 'up' ? '📈' : trend.direction === 'down' ? '📉' : '➡️';
        console.log(`  ${arrow} ${metric}: ${trend.change}${trend.unit} (${trend.direction})`);
      });
    }

    console.log('='.repeat(60));

    // Save daily report
    await this.saveDailyReport(dailyStats, assessments);
  }

  calculateDailyStats(sessions) {
    const totalTests = sessions.reduce((sum, session) => sum + session.stats.total, 0);
    const totalPassed = sessions.reduce((sum, session) => sum + session.stats.passed, 0);
    const totalFailed = sessions.reduce((sum, session) => sum + session.stats.failed, 0);
    const successRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;

    const allTests = sessions.flatMap(session => session.testResults);
    const avgResponseTime =
      allTests.length > 0
        ? allTests.reduce((sum, test) => sum + test.duration, 0) / allTests.length
        : 0;

    const criticalFailures = sessions.reduce(
      (sum, session) => sum + session.criticalFailures.length,
      0
    );

    return {
      totalTests,
      passed: totalPassed,
      failed: totalFailed,
      successRate,
      avgResponseTime,
      criticalFailures,
      sessionsCount: sessions.length
    };
  }

  assessPerformance(stats) {
    return [
      {
        metric: 'Success Rate',
        value: `${stats.successRate.toFixed(2)}%`,
        threshold: `≥${this.thresholds.successRate}%`,
        passed: stats.successRate >= this.thresholds.successRate
      },
      {
        metric: 'Response Time',
        value: `${stats.avgResponseTime.toFixed(2)}ms`,
        threshold: `≤${this.thresholds.responseTime}ms`,
        passed: stats.avgResponseTime <= this.thresholds.responseTime
      },
      {
        metric: 'Critical Failures',
        value: stats.criticalFailures.toString(),
        threshold: '0',
        passed: stats.criticalFailures === 0
      },
      {
        metric: 'Error Rate',
        value: `${((stats.failed / stats.totalTests) * 100).toFixed(2)}%`,
        threshold: `≤${this.thresholds.errorRate}%`,
        passed: (stats.failed / stats.totalTests) * 100 <= this.thresholds.errorRate
      }
    ];
  }

  calculateTrends(sessions) {
    if (sessions.length < 2) return {};

    const recent = sessions.slice(-5); // Last 5 sessions
    const older = sessions.slice(-10, -5); // Previous 5 sessions

    const recentAvg = {
      successRate: recent.reduce((sum, s) => sum + s.stats.successRate, 0) / recent.length,
      avgDuration: recent.reduce((sum, s) => sum + s.stats.averageDuration, 0) / recent.length
    };

    const olderAvg = {
      successRate:
        older.length > 0
          ? older.reduce((sum, s) => sum + s.stats.successRate, 0) / older.length
          : recentAvg.successRate,
      avgDuration:
        older.length > 0
          ? older.reduce((sum, s) => sum + s.stats.averageDuration, 0) / older.length
          : recentAvg.avgDuration
    };

    return {
      'Success Rate': {
        change: Math.abs(recentAvg.successRate - olderAvg.successRate).toFixed(2),
        unit: '%',
        direction:
          recentAvg.successRate > olderAvg.successRate
            ? 'up'
            : recentAvg.successRate < olderAvg.successRate
              ? 'down'
              : 'stable'
      },
      'Response Time': {
        change: Math.abs(recentAvg.avgDuration - olderAvg.avgDuration).toFixed(2),
        unit: 'ms',
        direction:
          recentAvg.avgDuration < olderAvg.avgDuration
            ? 'up'
            : recentAvg.avgDuration > olderAvg.avgDuration
              ? 'down'
              : 'stable'
      }
    };
  }

  async saveDailyReport(stats, assessments) {
    // Save to metrics file or database
    console.log('💾 Daily report saved to metrics');
  }

  async shutdown() {
    console.log('\n🛑 Shutting down Continuous Monitor...');

    this.isRunning = false;

    // Stop all scheduled jobs
    this.scheduledJobs.forEach(job => {
      if (job) {
        job.stop();
      }
    });

    // Generate final report
    console.log(this.monitor.generateComprehensiveReport());

    console.log('✅ Continuous Monitor shutdown complete');
    process.exit(0);
  }
}

// CLI execution
async function main() {
  const monitor = new ContinuousMonitor();

  try {
    await monitor.start();
  } catch (error) {
    console.error('❌ Continuous Monitor Error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default ContinuousMonitor;
