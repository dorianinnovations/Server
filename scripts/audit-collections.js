/**
 * MongoDB Collections Audit Script
 * Checks current database state after cleanup
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function auditCollections() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // 1. List all existing collections
    console.log('\n📋 EXISTING COLLECTIONS:');
    const collections = await db.listCollections().toArray();
    collections.forEach(col => {
      console.log(`  - ${col.name} (type: ${col.type})`);
    });
    
    // 2. Check document counts in key collections
    console.log('\n📊 COLLECTION DOCUMENT COUNTS:');
    const expectedCollections = [
      'users',
      'shorttermmemorys', 
      'userbehaviorprofiles',
      'conversations',
      'events'
    ];
    
    for (const collectionName of expectedCollections) {
      try {
        const count = await db.collection(collectionName).countDocuments();
        console.log(`  - ${collectionName}: ${count} documents`);
      } catch (error) {
        console.log(`  - ${collectionName}: DOES NOT EXIST`);
      }
    }
    
    // 3. Check indexes on critical collections
    console.log('\n🔍 INDEXES ON CRITICAL COLLECTIONS:');
    for (const collectionName of ['shorttermmemorys', 'userbehaviorprofiles']) {
      try {
        const indexes = await db.collection(collectionName).indexes();
        console.log(`  - ${collectionName}:`);
        indexes.forEach(index => {
          console.log(`    * ${JSON.stringify(index.key)} (${index.name})`);
        });
      } catch (error) {
        console.log(`  - ${collectionName}: No indexes (collection missing)`);
      }
    }
    
    // 4. Sample document structure check
    console.log('\n📄 SAMPLE DOCUMENT STRUCTURES:');
    for (const collectionName of ['users', 'shorttermmemorys']) {
      try {
        const sample = await db.collection(collectionName).findOne();
        if (sample) {
          console.log(`  - ${collectionName} structure:`, Object.keys(sample));
        } else {
          console.log(`  - ${collectionName}: No documents to sample`);
        }
      } catch (error) {
        console.log(`  - ${collectionName}: Cannot sample (missing)`);
      }
    }
    
    console.log('\n✅ Audit complete');
    
  } catch (error) {
    console.error('❌ Audit failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  auditCollections();
}

export default auditCollections;