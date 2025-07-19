#!/usr/bin/env node
import mongoose from 'mongoose';
import '../src/config/environment.js';

/**
 * SAFE DATA WIPE SCRIPT
 * Removes all documents while preserving collection structure and indexes
 */

const collections = [
  'users',
  'shorttermmemories', 
  'tasks',
  'emotionalanalyticssessions',
  'userbehaviorprofiles',
  'events',
  'creditpools',
  'userconstants',
  'userevents',
  'analytics',
  'collectivedataconsents',
  'collectivesnapshots',
  'tools'
];

async function wipeDatabase(dbName) {
  console.log(`\n🗑️  Wiping data from ${dbName} database...`);
  
  const db = mongoose.connection.useDb(dbName);
  
  for (const collectionName of collections) {
    try {
      const collection = db.collection(collectionName);
      const result = await collection.deleteMany({});
      console.log(`✅ ${collectionName}: Deleted ${result.deletedCount} documents`);
    } catch (error) {
      console.log(`⚠️  ${collectionName}: ${error.message}`);
    }
  }
}

async function main() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Wipe both databases
    await wipeDatabase('numina');
    await wipeDatabase('test');
    
    console.log('\n🎉 Data wipe completed successfully!');
    console.log('📋 Collection structures and indexes preserved');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

main().catch(console.error);