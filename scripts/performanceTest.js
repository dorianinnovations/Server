#!/usr/bin/env node

/**
 * COMPREHENSIVE PERFORMANCE TESTING SUITE
 * Tests GPT-4o with tools for extreme lifelike behavior and exceptional speed
 * Analyzes sequential tool execution, caching, and optimization effectiveness
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';
import dotenv from 'dotenv';
import axios from 'axios';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const API_BASE = process.env.TEST_API_BASE || 'http://localhost:5001';
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN;

// Test configuration
const TEST_CONFIG = {
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TEST_USER_TOKEN}`
  }
};

// Performance metrics tracker
class PerformanceTracker {
  constructor() {
    this.metrics = [];
    this.totalTests = 0;
    this.passedTests = 0;
    this.startTime = performance.now();
  }

  recordTest(testName, duration, success, details = {}) {
    this.totalTests++;
    if (success) this.passedTests++;
    
    this.metrics.push({
      testName,
      duration: Math.round(duration),
      success,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  getReport() {
    const endTime = performance.now();
    const totalDuration = Math.round(endTime - this.startTime);
    
    return {
      summary: {
        totalTests: this.totalTests,
        passedTests: this.passedTests,
        failedTests: this.totalTests - this.passedTests,
        successRate: Math.round((this.passedTests / this.totalTests) * 100),
        totalDuration: `${totalDuration}ms`,
        averageDuration: Math.round(this.metrics.reduce((sum, m) => sum + m.duration, 0) / this.metrics.length)
      },
      metrics: this.metrics,
      recommendations: this.generateRecommendations()
    };
  }

  generateRecommendations() {
    const avgDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0) / this.metrics.length;
    const toolTests = this.metrics.filter(m => m.testName.includes('Tool'));
    const avgToolDuration = toolTests.length > 0 ? 
      toolTests.reduce((sum, m) => sum + m.duration, 0) / toolTests.length : 0;
    
    const recommendations = [];
    
    if (avgDuration > 3000) {
      recommendations.push('⚠️ Average response time > 3s - consider further optimization');
    }
    
    if (avgToolDuration > 2000) {
      recommendations.push('🔧 Tool execution time > 2s - optimize tool performance');
    }
    
    const failureRate = (this.totalTests - this.passedTests) / this.totalTests;
    if (failureRate > 0.1) {
      recommendations.push('❌ High failure rate (>10%) - investigate reliability issues');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('✅ All performance metrics within acceptable ranges');
    }
    
    return recommendations;
  }
}

// Test cases for GPT-4o performance
const TEST_CASES = {
  // Basic response speed tests
  basicResponse: {
    name: 'Basic Response Speed',
    message: 'Hello! How are you today?',
    expectedMaxDuration: 1500,
    endpoint: '/adaptive-chat'
  },
  
  // Single tool execution tests
  webSearch: {
    name: 'Web Search Tool',
    message: 'Search for the latest news about artificial intelligence',
    expectedMaxDuration: 3000,
    endpoint: '/adaptive-chat',
    expectsTools: true
  },
  
  calculator: {
    name: 'Calculator Tool',
    message: 'Calculate 15% tip on $45.67',
    expectedMaxDuration: 1500,
    endpoint: '/adaptive-chat',
    expectsTools: true
  },
  
  weather: {
    name: 'Weather Tool',
    message: 'What\'s the weather like in San Francisco?',
    expectedMaxDuration: 2000,
    endpoint: '/adaptive-chat',
    expectsTools: true
  },
  
  // Sequential tool execution tests
  multiTool: {
    name: 'Sequential Multi-Tool',
    message: 'Search for the weather in Tokyo and calculate the time difference from EST',
    expectedMaxDuration: 5000,
    endpoint: '/adaptive-chat',
    expectsTools: true,
    expectsMultipleTools: true
  },
  
  // Caching performance tests
  cacheTest: {
    name: 'Cache Performance',
    message: 'What is the capital of France?',
    expectedMaxDuration: 1000, // Should be cached after first request
    endpoint: '/adaptive-chat',
    repeatCount: 3
  },
  
  // Lifelike behavior tests
  personalResponse: {
    name: 'Personal Context Recognition',
    message: 'I\'m feeling a bit overwhelmed with work today',
    expectedMaxDuration: 2000,
    endpoint: '/adaptive-chat',
    expectsPersonalization: true
  },
  
  // Streaming performance
  streamingResponse: {
    name: 'Streaming Response Speed',
    message: 'Tell me a creative short story about space exploration',
    expectedMaxDuration: 4000,
    endpoint: '/adaptive-chat',
    streaming: true
  },
  
  // Complex reasoning
  complexReasoning: {
    name: 'Complex Reasoning',
    message: 'Analyze the pros and cons of renewable energy adoption and suggest implementation strategies',
    expectedMaxDuration: 6000,
    endpoint: '/adaptive-chat'
  }
};

// Test runner functions
async function runSingleTest(testCase, tracker) {
  console.log(`\n🧪 Running: ${testCase.name}`);
  
  try {
    const startTime = performance.now();
    
    // Prepare request
    const requestData = {
      message: testCase.message,
      stream: testCase.streaming || false
    };
    
    let response;
    let duration;
    
    if (testCase.streaming) {
      response = await testStreamingRequest(testCase, requestData);
      duration = performance.now() - startTime;
    } else {
      response = await axios.post(
        `${API_BASE}/ai${testCase.endpoint}`,
        requestData,
        TEST_CONFIG
      );
      duration = performance.now() - startTime;
    }
    
    // Validate response
    const validation = validateResponse(response, testCase);
    const success = validation.success && duration <= testCase.expectedMaxDuration;
    
    // Record metrics
    tracker.recordTest(testCase.name, duration, success, {
      responseLength: response.data?.data?.response?.length || 0,
      hasTools: validation.hasTools,
      toolCount: validation.toolCount,
      cacheHit: validation.cacheHit,
      validation: validation.details
    });
    
    // Log results
    const status = success ? '✅' : '❌';
    const durationColor = duration > testCase.expectedMaxDuration ? '🔴' : '🟢';
    console.log(`${status} ${testCase.name}: ${Math.round(duration)}ms ${durationColor}`);
    
    if (validation.hasTools) {
      console.log(`   🔧 Tools executed: ${validation.toolCount}`);
    }
    
    if (validation.cacheHit) {
      console.log(`   ⚡ Cache hit detected`);
    }
    
    if (!success) {
      console.log(`   ⚠️ Expected max: ${testCase.expectedMaxDuration}ms`);
      if (!validation.success) {
        console.log(`   ❌ Validation failed: ${validation.details}`);
      }
    }
    
    return { success, duration, validation };
    
  } catch (error) {
    const duration = performance.now() - startTime;
    tracker.recordTest(testCase.name, duration, false, {
      error: error.message,
      status: error.response?.status
    });
    
    console.log(`❌ ${testCase.name}: Failed - ${error.message}`);
    return { success: false, duration, error: error.message };
  }
}

async function testStreamingRequest(testCase, requestData) {
  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    let responseData = '';
    let chunks = 0;
    
    axios.post(
      `${API_BASE}/ai${testCase.endpoint}`,
      requestData,
      {
        ...TEST_CONFIG,
        responseType: 'stream'
      }
    ).then(response => {
      response.data.on('data', (chunk) => {
        chunks++;
        const chunkStr = chunk.toString();
        
        // Parse streaming data
        const lines = chunkStr.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6).trim();
            if (data === '[DONE]') {
              resolve({
                data: {
                  data: {
                    response: responseData
                  }
                },
                streaming: true,
                chunks,
                duration: performance.now() - startTime
              });
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                responseData += parsed.content;
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        }
      });
      
      response.data.on('error', reject);
    }).catch(reject);
  });
}

function validateResponse(response, testCase) {
  const data = response.data?.data;
  const content = data?.response || '';
  
  let validation = {
    success: true,
    details: [],
    hasTools: false,
    toolCount: 0,
    cacheHit: false
  };
  
  // Basic response validation
  if (!content || content.length < 10) {
    validation.success = false;
    validation.details.push('Response too short or empty');
  }
  
  // Tool execution validation
  if (testCase.expectsTools) {
    const toolIndicators = [
      '🔍', '📰', '🧮', '🌤️', '💱', '🎵', '📈', '₿', '🌐', '🔧'
    ];
    
    validation.hasTools = toolIndicators.some(indicator => content.includes(indicator));
    
    if (!validation.hasTools) {
      validation.success = false;
      validation.details.push('Expected tool execution but no tools detected');
    } else {
      // Count tool indicators
      validation.toolCount = toolIndicators.filter(indicator => 
        content.includes(indicator)
      ).length;
      
      if (testCase.expectsMultipleTools && validation.toolCount < 2) {
        validation.success = false;
        validation.details.push('Expected multiple tools but only found one');
      }
    }
  }
  
  // Cache hit detection
  if (data?.adaptationReason && data.adaptationReason.includes('Cached')) {
    validation.cacheHit = true;
  }
  
  // Personalization validation
  if (testCase.expectsPersonalization) {
    const personalIndicators = [
      'understand', 'feel', 'sounds like', 'seems like', 'notice'
    ];
    
    const hasPersonalization = personalIndicators.some(indicator => 
      content.toLowerCase().includes(indicator)
    );
    
    if (!hasPersonalization) {
      validation.details.push('Expected personalized response but seems generic');
    }
  }
  
  return validation;
}

// Cache warming test
async function testCacheWarming(tracker) {
  console.log('\n🔥 Testing Cache Performance...');
  
  const cacheTestMessage = 'What is the capital of Japan?';
  const iterations = 3;
  
  for (let i = 1; i <= iterations; i++) {
    const startTime = performance.now();
    
    try {
      const response = await axios.post(
        `${API_BASE}/ai/adaptive-chat`,
        { message: cacheTestMessage },
        TEST_CONFIG
      );
      
      const duration = performance.now() - startTime;
      const isCacheHit = response.data?.data?.adaptationReason?.includes('Cached');
      
      tracker.recordTest(
        `Cache Test ${i}`,
        duration,
        true,
        { 
          cacheHit: isCacheHit,
          iteration: i,
          responseLength: response.data?.data?.response?.length || 0
        }
      );
      
      const cacheStatus = isCacheHit ? '⚡ CACHE HIT' : '🔄 FRESH';
      console.log(`   Iteration ${i}: ${Math.round(duration)}ms - ${cacheStatus}`);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      tracker.recordTest(`Cache Test ${i}`, 0, false, { error: error.message });
      console.log(`   Iteration ${i}: Failed - ${error.message}`);
    }
  }
}

// Health check test
async function testHealthCheck(tracker) {
  console.log('\n❤️ Testing Service Health...');
  
  const startTime = performance.now();
  
  try {
    const response = await axios.get(
      `${API_BASE}/testGPT4o/gpt4o-health`,
      { headers: TEST_CONFIG.headers, timeout: 5000 }
    );
    
    const duration = performance.now() - startTime;
    const success = response.data?.success && response.data?.health?.status === 'accessible';
    
    tracker.recordTest('Health Check', duration, success, {
      serviceStatus: response.data?.health?.status,
      service: response.data?.health?.service
    });
    
    const status = success ? '✅' : '❌';
    console.log(`${status} Health Check: ${Math.round(duration)}ms`);
    console.log(`   Service: ${response.data?.health?.service}`);
    console.log(`   Status: ${response.data?.health?.status}`);
    
  } catch (error) {
    tracker.recordTest('Health Check', 0, false, { error: error.message });
    console.log(`❌ Health Check: Failed - ${error.message}`);
  }
}

// Main test execution
async function runPerformanceTests() {
  console.log('🚀 NUMINA GPT-4o PERFORMANCE TESTING SUITE');
  console.log('===========================================');
  console.log(`Target API: ${API_BASE}`);
  console.log(`Test Cases: ${Object.keys(TEST_CASES).length}`);
  console.log(`Started: ${new Date().toISOString()}\n`);
  
  const tracker = new PerformanceTracker();
  
  // Run health check first
  await testHealthCheck(tracker);
  
  // Run cache warming test
  await testCacheWarming(tracker);
  
  // Run all test cases
  for (const [key, testCase] of Object.entries(TEST_CASES)) {
    if (testCase.repeatCount) {
      // Run repeated tests for cache testing
      for (let i = 1; i <= testCase.repeatCount; i++) {
        const repeatedCase = {
          ...testCase,
          name: `${testCase.name} (${i})`
        };
        await runSingleTest(repeatedCase, tracker);
        
        // Small delay between repeated tests
        if (i < testCase.repeatCount) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    } else {
      await runSingleTest(testCase, tracker);
    }
    
    // Small delay between different test types
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  // Generate and display report
  console.log('\n📊 PERFORMANCE REPORT');
  console.log('====================');
  
  const report = tracker.getReport();
  
  console.log(`\n📈 SUMMARY:`);
  console.log(`   Total Tests: ${report.summary.totalTests}`);
  console.log(`   Passed: ${report.summary.passedTests}`);
  console.log(`   Failed: ${report.summary.failedTests}`);
  console.log(`   Success Rate: ${report.summary.successRate}%`);
  console.log(`   Total Duration: ${report.summary.totalDuration}`);
  console.log(`   Average Response: ${report.summary.averageDuration}ms`);
  
  console.log(`\n🎯 RECOMMENDATIONS:`);
  report.recommendations.forEach(rec => console.log(`   ${rec}`));
  
  // Detailed metrics
  console.log(`\n📋 DETAILED METRICS:`);
  const toolTests = report.metrics.filter(m => m.hasTools);
  const cacheHits = report.metrics.filter(m => m.cacheHit);
  const streamingTests = report.metrics.filter(m => m.testName.includes('Streaming'));
  
  if (toolTests.length > 0) {
    const avgToolTime = Math.round(
      toolTests.reduce((sum, m) => sum + m.duration, 0) / toolTests.length
    );
    console.log(`   🔧 Tool Execution Average: ${avgToolTime}ms`);
  }
  
  if (cacheHits.length > 0) {
    const avgCacheTime = Math.round(
      cacheHits.reduce((sum, m) => sum + m.duration, 0) / cacheHits.length
    );
    console.log(`   ⚡ Cache Hit Average: ${avgCacheTime}ms`);
  }
  
  if (streamingTests.length > 0) {
    const avgStreamTime = Math.round(
      streamingTests.reduce((sum, m) => sum + m.duration, 0) / streamingTests.length
    );
    console.log(`   🌊 Streaming Average: ${avgStreamTime}ms`);
  }
  
  // Performance grades
  console.log(`\n🏆 PERFORMANCE GRADES:`);
  const avgDuration = report.summary.averageDuration;
  
  let speedGrade = 'F';
  if (avgDuration < 1000) speedGrade = 'A+';
  else if (avgDuration < 1500) speedGrade = 'A';
  else if (avgDuration < 2000) speedGrade = 'B';
  else if (avgDuration < 3000) speedGrade = 'C';
  else if (avgDuration < 4000) speedGrade = 'D';
  
  let reliabilityGrade = 'F';
  if (report.summary.successRate >= 95) reliabilityGrade = 'A+';
  else if (report.summary.successRate >= 90) reliabilityGrade = 'A';
  else if (report.summary.successRate >= 85) reliabilityGrade = 'B';
  else if (report.summary.successRate >= 80) reliabilityGrade = 'C';
  else if (report.summary.successRate >= 70) reliabilityGrade = 'D';
  
  console.log(`   Speed: ${speedGrade} (${avgDuration}ms avg)`);
  console.log(`   Reliability: ${reliabilityGrade} (${report.summary.successRate}% success)`);
  
  // Save detailed report
  const reportPath = join(__dirname, '..', 'performance-report.json');
  await import('fs').then(fs => {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Detailed report saved to: ${reportPath}`);
  });
  
  console.log('\n✅ Performance testing complete!');
  
  return report;
}

// Export for programmatic use
export { runPerformanceTests, TEST_CASES, PerformanceTracker };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceTests().catch(error => {
    console.error('❌ Performance testing failed:', error);
    process.exit(1);
  });
}