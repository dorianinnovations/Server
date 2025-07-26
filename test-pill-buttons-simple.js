#!/usr/bin/env node

/**
 * Simple pill button functionality test for localhost:5000
 * Tests core pill button endpoints without authentication
 */

import http from 'http';
import { URL } from 'url';

const BASE_URL = 'http://localhost:5000';
const API_BASE = `${BASE_URL}/sandbox`;

class SimplePillTester {
  constructor() {
    this.results = { passed: 0, failed: 0, errors: [] };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
    console.log(`${icons[type]} [${timestamp}] ${message}`);
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    return new Promise((resolve) => {
      const url = new URL(`${API_BASE}${endpoint}`);
      
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'PillButtonTester/1.0'
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const responseData = body ? JSON.parse(body) : {};
            resolve({
              success: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              data: responseData,
              headers: res.headers
            });
          } catch (error) {
            resolve({
              success: false,
              status: res.statusCode,
              error: 'Invalid JSON response',
              body: body
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          error: error.message
        });
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  async testServerConnection() {
    this.log('Testing server connection...', 'info');
    
    try {
      const result = await this.makeRequest('/test', 'GET');
      
      if (result.success) {
        this.log('✓ Server connection successful', 'success');
        this.results.passed++;
        return true;
      } else {
        this.log(`✗ Server connection failed (${result.status})`, 'error');
        this.results.failed++;
        return false;
      }
    } catch (error) {
      this.log(`✗ Server connection error: ${error.message}`, 'error');
      this.results.failed++;
      return false;
    }
  }

  async testPillActionsEndpoint() {
    this.log('Testing /test-pill-actions endpoint...', 'info');
    
    const testData = {
      pillActions: ['write', 'think'],
      query: 'Help me write a technical article',
      context: { test: true }
    };

    try {
      const result = await this.makeRequest('/test-pill-actions', 'POST', testData);
      
      if (result.success && result.data.success) {
        const { processedActions, combinedConfig, synergy } = result.data.data;
        
        if (processedActions && combinedConfig && synergy) {
          this.log('✓ Pill actions processed successfully', 'success');
          this.log(`  Actions: ${processedActions.length}`, 'info');
          this.log(`  Temperature: ${combinedConfig.temperature}`, 'info'); 
          this.log(`  Synergy: ${synergy.description} (${synergy.score})`, 'info');
          this.results.passed++;
        } else {
          this.log('✗ Invalid response structure', 'error');
          this.results.failed++;
        }
      } else {
        this.log(`✗ Request failed: ${result.data?.error || 'Unknown error'}`, 'error');
        this.log(`  Status: ${result.status}`, 'error');
        this.results.failed++;
      }
    } catch (error) {
      this.log(`✗ Exception: ${error.message}`, 'error');
      this.results.failed++;
    }
  }

  async testPillCombinationsEndpoint() {
    this.log('Testing /test-pill-combinations endpoint...', 'info');
    
    const testData = {
      currentPills: ['find', 'think'],
      query: 'Research machine learning applications',
      context: { test: true }
    };

    try {
      const result = await this.makeRequest('/test-pill-combinations', 'POST', testData);
      
      if (result.success && result.data.success) {
        const { currentCombination, recommendations, metrics } = result.data.data;
        
        if (currentCombination && recommendations !== undefined && metrics) {
          this.log('✓ Pill combinations analyzed successfully', 'success');
          this.log(`  Synergy: ${currentCombination.synergy.synergy}`, 'info');
          this.log(`  Recommendations: ${recommendations.length}`, 'info');
          this.log(`  Complexity: ${metrics.combinationComplexity}`, 'info');
          this.results.passed++;
        } else {
          this.log('✗ Invalid response structure', 'error');
          this.results.failed++;
        }
      } else {
        this.log(`✗ Request failed: ${result.data?.error || 'Unknown error'}`, 'error');
        this.results.failed++;
      }
    } catch (error) {
      this.log(`✗ Exception: ${error.message}`, 'error');
      this.results.failed++;
    }
  }

  async testErrorHandling() {
    this.log('Testing error handling...', 'info');
    
    // Test with invalid data
    const invalidTests = [
      {
        name: 'Empty pill actions',
        endpoint: '/test-pill-actions', 
        data: { pillActions: [] }
      },
      {
        name: 'Missing pill actions',
        endpoint: '/test-pill-actions',
        data: { query: 'test' }
      },
      {
        name: 'Invalid pill combinations',
        endpoint: '/test-pill-combinations',
        data: { currentPills: 'not-an-array' }
      }
    ];

    for (const test of invalidTests) {
      try {
        const result = await this.makeRequest(test.endpoint, 'POST', test.data);
        
        if (result.status === 400 && result.data.error) {
          this.log(`✓ ${test.name} - Proper error handling`, 'success');
          this.results.passed++;
        } else {
          this.log(`✗ ${test.name} - Missing error handling`, 'error');
          this.results.failed++;
        }
      } catch (error) {
        this.log(`✗ ${test.name} - Exception: ${error.message}`, 'error');
        this.results.failed++;
      }
    }
  }

  async runAllTests() {
    this.log('🧪 Starting pill button functionality tests', 'info');
    this.log(`Target: ${BASE_URL}`, 'info');
    console.log('');

    const startTime = Date.now();

    // Run tests in sequence
    const serverOk = await this.testServerConnection();
    
    if (serverOk) {
      await this.testPillActionsEndpoint();
      await this.testPillCombinationsEndpoint();
      await this.testErrorHandling();
    } else {
      this.log('Skipping remaining tests due to server connection failure', 'warning');
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Generate report
    console.log('');
    this.log('=== TEST RESULTS ===', 'info');
    this.log(`Total Tests: ${this.results.passed + this.results.failed}`, 'info');
    this.log(`Passed: ${this.results.passed}`, 'success');
    this.log(`Failed: ${this.results.failed}`, this.results.failed > 0 ? 'error' : 'info');
    this.log(`Duration: ${duration}ms`, 'info');

    if (this.results.errors.length > 0) {
      console.log('');
      this.log('=== ERRORS ===', 'error');
      this.results.errors.forEach(error => this.log(`  ${error}`, 'error'));
    }

    const successRate = this.results.passed / (this.results.passed + this.results.failed) * 100;
    
    console.log('');
    if (successRate === 100) {
      this.log(`🎉 All tests passed! (${successRate.toFixed(0)}%)`, 'success');
    } else if (successRate >= 80) {
      this.log(`✅ Most tests passed (${successRate.toFixed(0)}%)`, 'success');
    } else {
      this.log(`❌ Many tests failed (${successRate.toFixed(0)}%)`, 'error');
    }

    return successRate >= 80;
  }
}

// Quick connection test function
async function quickTest() {
  console.log('🔍 Quick connectivity test...');
  
  const tester = new SimplePillTester();
  const result = await tester.makeRequest('/test', 'GET');
  
  if (result.success) {
    console.log('✅ Server is responsive!');
    console.log(`📡 Response: ${JSON.stringify(result.data)}`);
    return true;
  } else {
    console.log('❌ Server not responding');
    console.log(`📡 Error: ${result.error || `Status ${result.status}`}`);
    return false;
  }
}

// Main execution
async function main() {
  console.log('🚀 Pill Button Test Suite');
  console.log('========================');
  
  // Quick test first
  const quickOk = await quickTest();
  console.log('');
  
  if (!quickOk) {
    console.log('💡 Make sure your server is running on localhost:5000');
    console.log('   Try: npm start or node server.js');
    process.exit(1);
  }
  
  // Full test suite
  const tester = new SimplePillTester();
  const success = await tester.runAllTests();
  
  console.log('');
  console.log('🏁 Testing complete!');
  
  process.exit(success ? 0 : 1);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  });
}

export { SimplePillTester, quickTest };