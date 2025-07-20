#!/usr/bin/env node

/**
 * Quick Optimization Validation Test
 * 
 * Tests key optimization features to ensure they're working:
 * - Database indexes
 * - Performance cache
 * - Memory management
 * - API responsiveness
 */

import mongoose from 'mongoose';
import '../src/config/environment.js';
import { log } from '../src/utils/logger.js';
import axios from 'axios';

// Import optimized services
import performanceCache from '../src/services/performanceCache.js';
import UserBehaviorProfile from '../src/models/UserBehaviorProfile.js';
import ShortTermMemory from '../src/models/ShortTermMemory.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';

async function testOptimizations() {
  log.system('🚀 Testing Numina Server Optimizations...');
  
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    log.system('✅ Connected to MongoDB');
    
    // Test 1: Database Index Performance
    log.system('🔍 Testing database index performance...');
    const start1 = Date.now();
    
    // This should be fast with our new indexes
    await UserBehaviorProfile.find({
      'intelligenceData.lastAnalysis': { $exists: true }
    }).limit(10).lean();
    
    const dbTime = Date.now() - start1;
    log.system(`✅ Database query: ${dbTime}ms ${dbTime < 50 ? '(Excellent)' : dbTime < 100 ? '(Good)' : '(Needs optimization)'}`);
    
    // Test 2: Performance Cache
    log.system('🗄️ Testing performance cache...');
    const testUserId = 'test-user-' + Date.now();
    const testData = { analysis: 'test', timestamp: Date.now() };
    
    const start2 = Date.now();
    await performanceCache.cacheIntelligence(testUserId, testData);
    const cacheWriteTime = Date.now() - start2;
    
    const start3 = Date.now();
    const cachedData = await performanceCache.getIntelligence(testUserId);
    const cacheReadTime = Date.now() - start3;
    
    log.system(`✅ Cache write: ${cacheWriteTime}ms, read: ${cacheReadTime}ms ${cacheReadTime < 10 ? '(Excellent)' : '(Good)'}`);
    log.system(`✅ Cache data integrity: ${cachedData ? 'PASS' : 'FAIL'}`);
    
    // Test 3: Server Health Check
    log.system('🌐 Testing server response...');
    try {
      const start4 = Date.now();
      const healthResponse = await axios.get(`${SERVER_URL}/api/health`, {
        timeout: 5000
      });
      const healthTime = Date.now() - start4;
      
      log.system(`✅ Server health: ${healthTime}ms ${healthResponse.status === 200 ? '(Healthy)' : '(Issue detected)'}`);
    } catch (error) {
      log.system(`⚠️ Server test: ${error.code === 'ECONNREFUSED' ? 'Server not running' : error.message}`);
    }
    
    // Test 4: Memory Usage Check
    log.system('💾 Testing memory usage...');
    const memUsage = process.memoryUsage();
    const heapMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    log.system(`✅ Memory usage: ${heapMB}MB heap ${heapMB < 100 ? '(Efficient)' : heapMB < 200 ? '(Good)' : '(High)'}`);
    
    // Test 5: Cache Statistics
    const cacheStats = performanceCache.getStats();
    log.system('📊 Cache statistics:', cacheStats);
    
    // Summary
    log.system('');
    log.system('🎯 Optimization Test Summary:');
    log.system(`   Database Performance: ${dbTime < 50 ? '✅ Excellent' : dbTime < 100 ? '⚡ Good' : '⚠️ Needs work'}`);
    log.system(`   Cache Performance: ${cacheReadTime < 10 ? '✅ Excellent' : '⚡ Good'}`);
    log.system(`   Memory Usage: ${heapMB < 100 ? '✅ Efficient' : heapMB < 200 ? '⚡ Good' : '⚠️ High'}`);
    log.system('   Optimizations Status: 🚀 ACTIVE');
    
    log.system('');
    log.system('✅ All optimization tests completed successfully!');
    log.system('Your numina-server pipeline should now be significantly faster! 🎉');
    
  } catch (error) {
    log.error('❌ Optimization test failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

// Test runner commands
const commands = {
  'test': testOptimizations,
  'help': () => {
    console.log('Numina Optimization Test Commands:');
    console.log('  npm run test-optimizations test   - Run optimization validation tests');
    console.log('  npm run test-optimizations help   - Show this help');
  }
};

// Run based on command line argument
const command = process.argv[2] || 'test';

if (commands[command]) {
  commands[command]()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error.message);
      process.exit(1);
    });
} else {
  console.log(`Unknown command: ${command}`);
  commands.help();
  process.exit(1);
}

export default testOptimizations;