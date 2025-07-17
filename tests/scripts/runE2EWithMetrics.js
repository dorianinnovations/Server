#!/usr/bin/env node

/**
 * Enhanced E2E Test Runner with Success Rate Monitoring
 * Runs comprehensive end-to-end tests and generates detailed success metrics
 */

import { spawn } from 'child_process';
import path from 'path';
import SuccessRateMonitor from '../utils/successRateMonitor.js';

class E2ETestRunner {
  constructor() {
    this.monitor = new SuccessRateMonitor();
    this.testSuites = [
      {
        name: 'Core User Journey',
        file: 'tests/e2e/complete-user-journey.test.js',
        timeout: 300000, // 5 minutes
        critical: true
      },
      {
        name: 'Authentication & Security',
        file: 'tests/routes/auth.test.js',
        timeout: 60000,
        critical: true
      },
      {
        name: 'API Integration',
        file: 'tests/integration/test_endpoints.js',
        timeout: 180000,
        critical: true
      },
      {
        name: 'Tool Execution',
        file: 'tests/integration/test_tools.js',
        timeout: 120000,
        critical: false
      },
      {
        name: 'WebSocket Connectivity',
        file: 'tests/scripts/testWebSocket.js',
        timeout: 60000,
        critical: false
      },
      {
        name: 'Performance & Load',
        file: 'tests/scripts/performance-test.js',
        timeout: 240000,
        critical: false
      }
    ];
  }

  async runAllTests() {
    console.log('🚀 Starting Comprehensive E2E Test Suite with Success Rate Monitoring\n');
    
    // Load existing metrics
    await this.monitor.loadMetrics();
    
    // Start monitoring session
    const sessionId = this.monitor.startSession('Comprehensive E2E Tests', {
      environment: process.env.NODE_ENV || 'test',
      timestamp: new Date().toISOString(),
      testSuites: this.testSuites.length
    });

    let overallSuccess = true;
    const results = [];

    for (const suite of this.testSuites) {
      console.log(`\n🧪 Running: ${suite.name}`);
      console.log(`📁 File: ${suite.file}`);
      console.log(`⏱️ Timeout: ${suite.timeout}ms`);
      console.log('─'.repeat(60));

      const result = await this.runTestSuite(suite);
      results.push(result);

      // Record in monitoring system
      this.monitor.recordTest(
        suite.name,
        this.categorizeTest(suite.name),
        result.success,
        result.duration,
        {
          file: suite.file,
          critical: suite.critical,
          exitCode: result.exitCode,
          error: result.error,
          output: result.output?.substring(0, 500) // Truncate output
        }
      );

      if (!result.success && suite.critical) {
        overallSuccess = false;
        console.log(`❌ CRITICAL TEST FAILED: ${suite.name}`);
      }

      // Short delay between tests
      await this.delay(1000);
    }

    // End monitoring session
    await this.monitor.endSession();

    // Generate final report
    this.generateFinalReport(results, overallSuccess);

    // Generate comprehensive analytics
    console.log(this.monitor.generateComprehensiveReport());

    return overallSuccess;
  }

  async runTestSuite(suite) {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const isJest = suite.file.endsWith('.test.js');
      const command = isJest ? 'npm' : 'node';
      const args = isJest ? ['test', suite.file] : [suite.file];

      const child = spawn(command, args, {
        stdio: ['inherit', 'pipe', 'pipe'],
        timeout: suite.timeout,
        cwd: process.cwd()
      });

      let output = '';
      let errorOutput = '';

      child.stdout?.on('data', (data) => {
        const text = data.toString();
        output += text;
        process.stdout.write(text);
      });

      child.stderr?.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        process.stderr.write(text);
      });

      child.on('close', (code) => {
        const duration = Date.now() - startTime;
        const success = code === 0;

        resolve({
          name: suite.name,
          success,
          duration,
          exitCode: code,
          output: output,
          error: errorOutput || null
        });
      });

      child.on('error', (error) => {
        const duration = Date.now() - startTime;
        resolve({
          name: suite.name,
          success: false,
          duration,
          exitCode: -1,
          output: output,
          error: error.message
        });
      });

      // Handle timeout
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGTERM');
          console.log(`⏰ Test suite timed out: ${suite.name}`);
        }
      }, suite.timeout);
    });
  }

  categorizeTest(testName) {
    const categories = {
      'Core User Journey': 'core-functionality',
      'Authentication & Security': 'authentication',
      'API Integration': 'api-integration', 
      'Tool Execution': 'tools',
      'WebSocket Connectivity': 'real-time',
      'Performance & Load': 'performance'
    };

    return categories[testName] || 'other';
  }

  generateFinalReport(results, overallSuccess) {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 FINAL E2E TEST RESULTS');
    console.log('='.repeat(80));

    const totalTests = results.length;
    const passedTests = results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const successRate = (passedTests / totalTests) * 100;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`📊 Overall Success Rate: ${successRate.toFixed(2)}%`);
    console.log(`✅ Passed: ${passedTests}/${totalTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`⏱️ Total Duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
    console.log(`🎯 Overall Result: ${overallSuccess ? '✅ SUCCESS' : '❌ FAILURE'}`);

    console.log('\n📋 Detailed Results:');
    results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const duration = `${result.duration}ms`;
      console.log(`  ${index + 1}. ${status} ${result.name.padEnd(30)} | ${duration.padStart(8)} | Exit: ${result.exitCode}`);
      
      if (!result.success && result.error) {
        console.log(`     Error: ${result.error.substring(0, 100)}...`);
      }
    });

    // Success criteria evaluation
    console.log('\n🎯 Success Criteria Evaluation:');
    const criteria = [
      { name: 'Overall Success Rate ≥95%', passed: successRate >= 95, value: `${successRate.toFixed(2)}%` },
      { name: 'No Critical Test Failures', passed: !results.find(r => !r.success && this.isCriticalTest(r.name)), value: 'N/A' },
      { name: 'Average Test Duration ≤60s', passed: (totalDuration / totalTests) <= 60000, value: `${((totalDuration / totalTests) / 1000).toFixed(2)}s` },
      { name: 'Zero Test Failures', passed: failedTests === 0, value: `${failedTests} failures` }
    ];

    criteria.forEach(criterion => {
      const status = criterion.passed ? '✅' : '❌';
      console.log(`  ${status} ${criterion.name}: ${criterion.value}`);
    });

    console.log('='.repeat(80));

    // Recommendations
    if (!overallSuccess) {
      console.log('\n🔧 RECOMMENDATIONS:');
      const failedCritical = results.filter(r => !r.success && this.isCriticalTest(r.name));
      
      if (failedCritical.length > 0) {
        console.log('  🚨 Critical Issues:');
        failedCritical.forEach(test => {
          console.log(`     - Fix ${test.name} (critical for user experience)`);
        });
      }

      if (successRate < 95) {
        console.log('  📊 Success Rate Issues:');
        console.log('     - Investigate and fix failing tests');
        console.log('     - Review test stability and flakiness');
      }

      if ((totalDuration / totalTests) > 60000) {
        console.log('  ⚡ Performance Issues:');
        console.log('     - Optimize slow tests');
        console.log('     - Review test timeouts');
        console.log('     - Consider parallel test execution');
      }
    }
  }

  isCriticalTest(testName) {
    const criticalTests = [
      'Core User Journey',
      'Authentication & Security',
      'API Integration'
    ];
    return criticalTests.includes(testName);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI execution
async function main() {
  const runner = new E2ETestRunner();
  
  try {
    const success = await runner.runAllTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ E2E Test Runner Error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default E2ETestRunner;