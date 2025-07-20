#!/usr/bin/env node

/**
 * Database Optimization Script - Adds Critical Performance Indexes
 * 
 * This script adds composite indexes to improve query performance across
 * the most frequently accessed collections in the Numina server.
 */

import mongoose from 'mongoose';
import '../src/config/environment.js';
import { log } from '../src/utils/logger.js';

// Import models to ensure schemas are registered
import User from '../src/models/User.js';
import ShortTermMemory from '../src/models/ShortTermMemory.js';
import UserBehaviorProfile from '../src/models/UserBehaviorProfile.js';

async function optimizeDatabase() {
  try {
    log.system('Starting database optimization...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    log.system('Connected to MongoDB');

    // Helper function to safely create indexes
    const createIndexSafely = async (collection, indexSpec, options) => {
      try {
        await mongoose.connection.db.collection(collection).createIndex(indexSpec, options);
        log.system(`✅ Created index: ${options.name}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          log.system(`ℹ️  Index already exists: ${options.name}`);
        } else {
          log.error(`❌ Failed to create index ${options.name}:`, error.message);
        }
      }
    };

    // EmotionalAnalyticsSession removed - using AI-driven emotion detection
    log.system('EmotionalAnalyticsSession indexes skipped - model removed');

    // Add critical indexes for UserBehaviorProfile
    log.system('Adding indexes for UserBehaviorProfile...');
    await createIndexSafely('userbehaviorprofiles',
      { userId: 1, 'intelligenceData.lastAnalysis': -1 },
      { name: 'userId_intelligenceAnalysis_compound' }
    );
    
    await createIndexSafely('userbehaviorprofiles',
      { userId: 1, 'temporalPatterns.direction': 1 },
      { name: 'userId_temporalDirection_compound' }
    );

    // Optimize existing ShortTermMemory index
    log.system('Optimizing ShortTermMemory indexes...');
    await createIndexSafely('shorttermmemories',
      { userId: 1, timestamp: -1 },
      { name: 'userId_timestamp_simple' }
    );

    // Add index for User collection optimization
    log.system('Adding User collection indexes...');
    await createIndexSafely('users',
      { email: 1, isActive: 1 },
      { name: 'email_isActive_compound' }
    );

    // Display index statistics
    log.system('Gathering index statistics...');
    const collections = ['emotionalanalyticssessions', 'userbehaviorprofiles', 'shorttermmemories', 'users'];
    
    for (const collectionName of collections) {
      const indexes = await mongoose.connection.db.collection(collectionName).listIndexes().toArray();
      log.system(`${collectionName}: ${indexes.length} indexes`);
      indexes.forEach(index => {
        log.system(`  - ${index.name}: ${JSON.stringify(index.key)}`);
      });
    }

    log.system('Database optimization completed successfully!');
    
  } catch (error) {
    log.error('Database optimization failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    log.system('Disconnected from MongoDB');
  }
}

// Run optimization if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  optimizeDatabase();
}

export default optimizeDatabase;