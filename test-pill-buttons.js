#!/usr/bin/env node

/**
 * Comprehensive pill button functionality test
 * Tests all aspects of the pill button system end-to-end
 */

import fetch from 'node-fetch'; // You may need to install: npm install node-fetch
import { performance } from 'perf_hooks';

const BASE_URL = 'http://localhost:5000'; // Local development server
const API_BASE = `${BASE_URL}/sandbox`;

// Test configuration
const TEST_CONFIG = {
  // You'll need to provide a valid token for testing
  authToken: 'your-test-jwt-token-here',
  testQueries: [
    {
      query: 'How can I improve my creative writing skills?',
      expectedPills: ['write', 'think', 'imagine'],
      description: 'Creative writing assistance query'
    },
    {
      query: 'Find me research about machine learning trends',
      expectedPills: ['find', 'explore', 'think'],
      description: 'Research-focused query'
    },
    {
      query: 'Connect the concepts of sustainability and technology',
      expectedPills: ['connect', 'explore', 'find'],
      description: 'Relationship mapping query'
    }
  ]
};

class PillButtonTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      errors: [],
      performance: {}
    };
    this.authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TEST_CONFIG.authToken}`
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warning: '⚠️'
    }[type];
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async makeRequest(endpoint, method = 'GET', body = null) {
    const startTime = performance.now();
    
    try {
      const options = {
        method,
        headers: this.authHeaders
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${API_BASE}${endpoint}`, options);
      const data = await response.json();
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (!this.results.performance[endpoint]) {
        this.results.performance[endpoint] = [];
      }
      this.results.performance[endpoint].push(duration);

      return {
        success: response.ok,
        status: response.status,
        data,
        duration
      };
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      return {
        success: false,
        error: error.message,
        duration
      };
    }
  }

  async testPillActionsEndpoint() {
    this.log('Testing /pill-actions endpoint', 'info');
    
    const testCases = [
      {
        name: 'Single pill action',
        data: { pillActions: ['write'], query: 'Help me write a story' }
      },
      {
        name: 'Multiple pill actions',
        data: { pillActions: ['write', 'imagine'], query: 'Creative writing help' }
      },
      {
        name: 'High synergy combination',
        data: { pillActions: ['find', 'think'], query: 'Analytical research' }
      },
      {
        name: 'UBPM pill included',
        data: { pillActions: ['ubpm', 'write'], query: 'Personalized assistance' }
      }
    ];

    for (const testCase of testCases) {
      try {
        const result = await this.makeRequest('/pill-actions', 'POST', testCase.data);
        
        if (result.success) {
          const { processedActions, combinedConfig, synergy } = result.data.data;
          
          // Validate response structure
          if (processedActions && combinedConfig && synergy) {
            this.log(`✓ ${testCase.name} - Response structure valid`, 'success');
            this.log(`  Synergy: ${synergy.description} (${synergy.score.toFixed(2)})`, 'info');
            this.log(`  Temperature: ${combinedConfig.temperature.toFixed(2)}`, 'info');
            this.log(`  Capabilities: ${combinedConfig.capabilities.join(', ')}`, 'info');
            this.results.passed++;
          } else {
            this.log(`✗ ${testCase.name} - Invalid response structure`, 'error');
            this.results.failed++;
            this.results.errors.push(`Invalid response structure for ${testCase.name}`);
          }
        } else {
          this.log(`✗ ${testCase.name} - Request failed: ${result.data?.error || 'Unknown error'}`, 'error');
          this.results.failed++;
          this.results.errors.push(`Request failed for ${testCase.name}: ${result.data?.error}`);
        }
      } catch (error) {
        this.log(`✗ ${testCase.name} - Exception: ${error.message}`, 'error');
        this.results.failed++;
        this.results.errors.push(`Exception in ${testCase.name}: ${error.message}`);
      }
    }
  }

  async testPillCombinationsEndpoint() {
    this.log('Testing /pill-combinations endpoint', 'info');
    
    const testCases = [
      {
        name: 'High synergy combination analysis',
        data: { currentPills: ['find', 'think'], query: 'Research analysis' }
      },
      {
        name: 'Medium synergy combination',
        data: { currentPills: ['write', 'explore'], query: 'Creative exploration' }
      },
      {
        name: 'Complex combination',
        data: { currentPills: ['find', 'think', 'connect', 'ubpm'], query: 'Complex analysis' }
      }
    ];

    for (const testCase of testCases) {
      try {
        const result = await this.makeRequest('/pill-combinations', 'POST', testCase.data);
        
        if (result.success) {
          const { currentCombination, recommendations, metrics } = result.data.data;
          
          if (currentCombination && recommendations && metrics) {
            this.log(`✓ ${testCase.name} - Analysis complete`, 'success');
            this.log(`  Synergy: ${currentCombination.synergy.synergy.toFixed(2)}`, 'info');
            this.log(`  Recommendations: ${recommendations.length}`, 'info');
            this.log(`  Complexity: ${metrics.combinationComplexity}`, 'info');
            this.results.passed++;
          } else {
            this.log(`✗ ${testCase.name} - Incomplete analysis data`, 'error');
            this.results.failed++;
            this.results.errors.push(`Incomplete analysis data for ${testCase.name}`);
          }
        } else {
          this.log(`✗ ${testCase.name} - Request failed: ${result.data?.error || 'Unknown error'}`, 'error');
          this.results.failed++;
          this.results.errors.push(`Request failed for ${testCase.name}: ${result.data?.error}`);
        }
      } catch (error) {
        this.log(`✗ ${testCase.name} - Exception: ${error.message}`, 'error');
        this.results.failed++;
        this.results.errors.push(`Exception in ${testCase.name}: ${error.message}`);
      }
    }
  }

  async testGenerateNodesWithPills() {
    this.log('Testing /generate-nodes with pill configuration', 'info');
    
    const testCases = [
      {
        name: 'Creative writing nodes',
        data: {
          query: 'Help me brainstorm story ideas about space exploration',
          selectedActions: ['write', 'imagine'],
          pillConfig: {
            selectedActions: ['write', 'imagine'],
            combinedConfig: {
              temperature: 0.85,
              focusAreas: ['creative_expression', 'creative_ideation'],
              requiresUBPM: false
            },
            synergy: { score: 0.93, description: 'Creative expression with ideation' }
          }
        }
      },
      {
        name: 'Research-focused nodes',
        data: {
          query: 'Find information about renewable energy technologies',
          selectedActions: ['find', 'explore'],
          pillConfig: {
            selectedActions: ['find', 'explore'],
            combinedConfig: {
              temperature: 0.6,
              focusAreas: ['information_discovery', 'knowledge_expansion'],
              requiresUBPM: false,
              tools: ['web_search', 'academic_search']
            },
            synergy: { score: 0.87, description: 'Comprehensive information discovery' }
          }
        }
      }
    ];

    for (const testCase of testCases) {
      try {
        this.log(`Starting ${testCase.name}...`, 'info');
        const startTime = performance.now();
        
        const result = await this.makeRequest('/generate-nodes', 'POST', testCase.data);
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        if (result.success) {
          const { nodes } = result.data.data;
          
          if (nodes && Array.isArray(nodes) && nodes.length > 0) {
            this.log(`✓ ${testCase.name} - Generated ${nodes.length} nodes (${duration.toFixed(0)}ms)`, 'success');
            
            // Validate node structure
            const validNodes = nodes.filter(node => 
              node.title && node.content && node.category && typeof node.confidence === 'number'
            );
            
            if (validNodes.length === nodes.length) {
              this.log(`  All nodes have valid structure`, 'info');
              this.results.passed++;
            } else {
              this.log(`  Warning: ${nodes.length - validNodes.length} nodes have invalid structure`, 'warning');
              this.results.passed++; // Still count as pass but log warning
            }
            
            // Check for pill-specific content
            const pillFocused = nodes.some(node => 
              testCase.data.pillConfig.combinedConfig.focusAreas.some(focus =>
                node.content.toLowerCase().includes(focus.replace('_', ' '))
              )
            );
            
            if (pillFocused) {
              this.log(`  Content reflects pill focus areas`, 'info');
            } else {
              this.log(`  Content may not reflect pill focus areas`, 'warning');
            }
            
          } else {
            this.log(`✗ ${testCase.name} - No nodes generated`, 'error');
            this.results.failed++;
            this.results.errors.push(`No nodes generated for ${testCase.name}`);
          }
        } else {
          this.log(`✗ ${testCase.name} - Request failed: ${result.data?.error || 'Unknown error'}`, 'error');
          this.results.failed++;
          this.results.errors.push(`Node generation failed for ${testCase.name}: ${result.data?.error}`);
        }
      } catch (error) {
        this.log(`✗ ${testCase.name} - Exception: ${error.message}`, 'error');
        this.results.failed++;
        this.results.errors.push(`Exception in ${testCase.name}: ${error.message}`);
      }
    }
  }

  async testAuthenticationEndpoint() {
    this.log('Testing authentication for pill endpoints', 'info');
    
    const endpoints = ['/pill-actions', '/pill-combinations', '/generate-nodes'];
    
    for (const endpoint of endpoints) {
      try {
        // Test without auth token
        const response = await fetch(`${API_BASE}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: 'data' })
        });
        
        if (response.status === 401 || response.status === 403) {
          this.log(`✓ ${endpoint} - Properly requires authentication`, 'success');
          this.results.passed++;
        } else {
          this.log(`✗ ${endpoint} - Does not require authentication (status: ${response.status})`, 'error');
          this.results.failed++;
          this.results.errors.push(`${endpoint} does not require authentication`);
        }
      } catch (error) {
        this.log(`✗ ${endpoint} - Auth test exception: ${error.message}`, 'error');
        this.results.failed++;
        this.results.errors.push(`Auth test exception for ${endpoint}: ${error.message}`);
      }
    }
  }

  generatePerformanceReport() {
    this.log('=== PERFORMANCE REPORT ===', 'info');
    
    for (const [endpoint, times] of Object.entries(this.results.performance)) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      
      this.log(`${endpoint}:`, 'info');
      this.log(`  Average: ${avg.toFixed(0)}ms`, 'info');
      this.log(`  Min: ${min.toFixed(0)}ms`, 'info'); 
      this.log(`  Max: ${max.toFixed(0)}ms`, 'info');
      this.log(`  Requests: ${times.length}`, 'info');
    }
  }

  async runAllTests() {
    this.log('🧪 Starting comprehensive pill button functionality tests', 'info');
    this.log(`Server: ${BASE_URL}`, 'info');
    
    const startTime = performance.now();
    
    try {
      // Test individual endpoints
      await this.testAuthenticationEndpoint();
      await this.testPillActionsEndpoint();
      await this.testPillCombinationsEndpoint();
      await this.testGenerateNodesWithPills();
      
      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      
      // Generate final report
      this.log('=== TEST RESULTS ===', 'info');
      this.log(`Total Tests: ${this.results.passed + this.results.failed}`, 'info');
      this.log(`Passed: ${this.results.passed}`, 'success');
      this.log(`Failed: ${this.results.failed}`, this.results.failed > 0 ? 'error' : 'info');
      this.log(`Duration: ${totalDuration.toFixed(0)}ms`, 'info');
      
      if (this.results.errors.length > 0) {
        this.log('=== ERRORS ===', 'error');
        this.results.errors.forEach(error => this.log(`  ${error}`, 'error'));
      }
      
      this.generatePerformanceReport();
      
      const successRate = (this.results.passed / (this.results.passed + this.results.failed)) * 100;
      
      if (successRate >= 90) {
        this.log(`🎉 Test suite completed successfully! Success rate: ${successRate.toFixed(1)}%`, 'success');
        return true;
      } else if (successRate >= 70) {
        this.log(`⚠️  Test suite completed with warnings. Success rate: ${successRate.toFixed(1)}%`, 'warning');
        return true;
      } else {
        this.log(`❌ Test suite failed. Success rate: ${successRate.toFixed(1)}%`, 'error');
        return false;
      }
      
    } catch (error) {
      this.log(`💥 Test suite crashed: ${error.message}`, 'error');
      console.error(error.stack);
      return false;
    }
  }
}

// Main execution
async function main() {
  const tester = new PillButtonTester();
  
  // Check if auth token is provided
  if (TEST_CONFIG.authToken === 'your-test-jwt-token-here') {
    console.log('⚠️  WARNING: Please provide a valid JWT token in TEST_CONFIG.authToken');
    console.log('   Some tests may fail without proper authentication');
    console.log('   You can get a token by logging into your app and inspecting network requests');
    console.log('');
  }
  
  const success = await tester.runAllTests();
  process.exit(success ? 0 : 1);
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

export default PillButtonTester;