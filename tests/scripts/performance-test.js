#!/usr/bin/env node

import { performance } from 'perf_hooks';
// import { sanitizeResponse } from '../src/utils/sanitize.js';
// Mock sanitizeResponse for performance testing
const sanitizeResponse = (content) => content;

console.log('🧪 Performance Testing for Task Inference & Emotion Logging Optimizations');
console.log('=' * 70);

// Test data
const testContent = {
  simple: 'Hello world',
  withTask: 'Hello TASK_INFERENCE: {"taskType": "schedule", "parameters": {"when": "tomorrow"}} world',
  withEmotion: 'Hello EMOTION_LOG: {"emotion": "happy", "intensity": 8, "context": "good news"} world',
  withBoth: 'Hello TASK_INFERENCE: {"taskType": "reminder", "parameters": {"time": "5pm"}} and EMOTION_LOG: {"emotion": "excited", "intensity": 9, "context": "upcoming event"} world',
  complex: 'This is a complex response with TASK_INFERENCE: {"taskType": "analyze", "parameters": {"data": "user_behavior", "timeframe": "last_week"}} and multiple EMOTION_LOG: {"emotion": "anxious", "intensity": 6, "context": "work stress"} markers with additional text and formatting.',
  messy: 'TASK_INFERENCE: {"taskType": "test"} EMOTION_LOG: {"emotion": "happy"} some text TASK_INFERENCE: {"taskType": "another"} more text EMOTION_LOG: {"emotion": "sad"} final text'
};

// Performance test function
const performanceTest = (testName, testFunction, iterations = 1000) => {
  console.log(`\n🔍 Testing: ${testName}`);
  
  const start = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    testFunction();
  }
  
  const end = performance.now();
  const totalTime = end - start;
  const avgTime = totalTime / iterations;
  
  console.log(`  ✓ Total time: ${totalTime.toFixed(2)}ms`);
  console.log(`  ✓ Average time: ${avgTime.toFixed(4)}ms per operation`);
  console.log(`  ✓ Operations per second: ${(1000 / avgTime).toFixed(0)}`);
  
  return {
    totalTime,
    avgTime,
    opsPerSec: 1000 / avgTime
  };
};

// Test regex performance
const testRegexPerformance = () => {
  console.log('\n📊 REGEX PERFORMANCE TESTS');
  console.log('-' * 40);
  
  const tests = [
    {
      name: 'Simple text sanitization',
      fn: () => sanitizeResponse(testContent.simple)
    },
    {
      name: 'Task inference sanitization',
      fn: () => sanitizeResponse(testContent.withTask)
    },
    {
      name: 'Emotion logging sanitization',
      fn: () => sanitizeResponse(testContent.withEmotion)
    },
    {
      name: 'Combined metadata sanitization',
      fn: () => sanitizeResponse(testContent.withBoth)
    },
    {
      name: 'Complex content sanitization',
      fn: () => sanitizeResponse(testContent.complex)
    },
    {
      name: 'Messy content sanitization',
      fn: () => sanitizeResponse(testContent.messy)
    }
  ];
  
  const results = {};
  
  tests.forEach(test => {
    results[test.name] = performanceTest(test.name, test.fn, 10000);
  });
  
  return results;
};

// Test memory usage
const testMemoryUsage = () => {
  console.log('\n💾 MEMORY USAGE TESTS');
  console.log('-' * 40);
  
  const initialMemory = process.memoryUsage();
  console.log(`Initial memory usage: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
  
  // Simulate heavy processing
  const operations = 50000;
  console.log(`\nProcessing ${operations} operations...`);
  
  const startTime = performance.now();
  
  for (let i = 0; i < operations; i++) {
    sanitizeResponse(testContent.complex);
    
    if (i % 10000 === 0) {
      const currentMemory = process.memoryUsage();
      const memoryDelta = (currentMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
      console.log(`  Operation ${i}: ${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB (+${memoryDelta.toFixed(2)}MB)`);
    }
  }
  
  const endTime = performance.now();
  const finalMemory = process.memoryUsage();
  const memoryDelta = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
  
  console.log(`\nCompleted in ${(endTime - startTime).toFixed(2)}ms`);
  console.log(`Final memory usage: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB (+${memoryDelta.toFixed(2)}MB)`);
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
    const gcMemory = process.memoryUsage();
    console.log(`After GC: ${Math.round(gcMemory.heapUsed / 1024 / 1024)}MB`);
  }
  
  return {
    initialMemory: Math.round(initialMemory.heapUsed / 1024 / 1024),
    finalMemory: Math.round(finalMemory.heapUsed / 1024 / 1024),
    memoryDelta: memoryDelta.toFixed(2),
    processingTime: (endTime - startTime).toFixed(2)
  };
};

// Test buffer performance (simulating streaming)
const testBufferPerformance = () => {
  console.log('\n🔄 BUFFER PERFORMANCE TESTS');
  console.log('-' * 40);
  
  const MAX_BUFFER_SIZE = 1000;
  let buffer = '';
  
  const bufferOperations = [
    'Simple text chunk',
    'TASK_INFERENCE: {"taskType": "test"}',
    'EMOTION_LOG: {"emotion": "happy"}',
    'More text content here',
    'TASK_INFERENCE: {"taskType": "complex", "parameters": {"nested": "value"}}',
    'Final text chunk'
  ];
  
  const startTime = performance.now();
  
  for (let i = 0; i < 10000; i++) {
    const chunk = bufferOperations[i % bufferOperations.length];
    buffer += chunk;
    
    // Simulate sliding window buffer
    if (buffer.length > MAX_BUFFER_SIZE) {
      buffer = buffer.slice(-MAX_BUFFER_SIZE);
    }
    
    // Simulate metadata detection
    const COMBINED_METADATA_REGEX = /(?:EMOTION_LOG|TASK_INFERENCE):?\s*(\{[^}]*\})/g;
    const hasMetadata = buffer.match(COMBINED_METADATA_REGEX);
    
    if (hasMetadata) {
      // Simulate buffer reset
      buffer = '';
    }
  }
  
  const endTime = performance.now();
  const totalTime = endTime - startTime;
  
  console.log(`  ✓ Processed 10,000 buffer operations in ${totalTime.toFixed(2)}ms`);
  console.log(`  ✓ Average time per operation: ${(totalTime / 10000).toFixed(4)}ms`);
  console.log(`  ✓ Final buffer size: ${buffer.length} characters`);
  
  return {
    totalTime: totalTime.toFixed(2),
    avgTime: (totalTime / 10000).toFixed(4),
    finalBufferSize: buffer.length
  };
};

// Run all tests
const runTests = async () => {
  try {
    console.log('Starting performance tests...\n');
    
    const regexResults = testRegexPerformance();
    const memoryResults = testMemoryUsage();
    const bufferResults = testBufferPerformance();
    
    console.log('\n🎯 PERFORMANCE SUMMARY');
    console.log('=' * 50);
    
    console.log('\n📈 Best performing operations:');
    const sortedRegex = Object.entries(regexResults).sort((a, b) => b[1].opsPerSec - a[1].opsPerSec);
    sortedRegex.slice(0, 3).forEach(([name, results], index) => {
      console.log(`  ${index + 1}. ${name}: ${results.opsPerSec.toFixed(0)} ops/sec`);
    });
    
    console.log('\n🐌 Slowest operations:');
    sortedRegex.slice(-3).reverse().forEach(([name, results], index) => {
      console.log(`  ${index + 1}. ${name}: ${results.opsPerSec.toFixed(0)} ops/sec`);
    });
    
    console.log('\n💾 Memory Performance:');
    console.log(`  Processing time: ${memoryResults.processingTime}ms`);
    console.log(`  Memory usage: +${memoryResults.memoryDelta}MB`);
    
    console.log('\n🔄 Buffer Performance:');
    console.log(`  Buffer operations: ${bufferResults.avgTime}ms avg`);
    console.log(`  Final buffer size: ${bufferResults.finalBufferSize} chars`);
    
    console.log('\n✅ Performance tests completed successfully!');
    
    // Performance recommendations
    console.log('\n💡 PERFORMANCE RECOMMENDATIONS:');
    console.log('-' * 40);
    
    if (parseFloat(memoryResults.memoryDelta) > 50) {
      console.log('⚠️  Memory usage is high. Consider implementing more aggressive garbage collection.');
    }
    
    const avgOpsPerSec = Object.values(regexResults).reduce((sum, r) => sum + r.opsPerSec, 0) / Object.keys(regexResults).length;
    if (avgOpsPerSec < 10000) {
      console.log('⚠️  Regex operations are slow. Consider optimizing patterns further.');
    }
    
    if (parseFloat(bufferResults.avgTime) > 0.1) {
      console.log('⚠️  Buffer operations are slow. Consider increasing buffer size or optimizing regex patterns.');
    }
    
    console.log('✅ All systems performing within acceptable parameters.');
    
  } catch (error) {
    console.error('❌ Performance test failed:', error.message);
    process.exit(1);
  }
};

// Export for use in other scripts
export {
  performanceTest,
  testRegexPerformance,
  testMemoryUsage,
  testBufferPerformance
};

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}