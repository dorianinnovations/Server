/**
 * Schema Scraper for 'numina' and 'test' collections
 * Analyzes collection structures for reference
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function scrapeCollectionSchemas() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  
  console.log('🔍 SCRAPING NUMINA & TEST COLLECTION SCHEMAS');
  console.log('==============================================');
  
  // Check if 'numina' and 'test' collections exist
  const allCollections = await db.listCollections().toArray();
  const collectionNames = allCollections.map(c => c.name);
  
  console.log('\n📋 ALL AVAILABLE COLLECTIONS:');
  collectionNames.forEach(name => console.log('  -', name));
  
  // Function to analyze collection schema
  async function analyzeCollection(collectionName) {
    try {
      console.log(`\n📊 ANALYZING COLLECTION: ${collectionName}`);
      console.log('='.repeat(50));
      
      const count = await db.collection(collectionName).countDocuments();
      console.log(`Documents: ${count}`);
      
      if (count > 0) {
        // Get sample documents to understand schema
        const samples = await db.collection(collectionName).find().limit(3).toArray();
        
        console.log('\nSample document structure:');
        if (samples[0]) {
          const keys = Object.keys(samples[0]);
          keys.forEach(key => {
            const value = samples[0][key];
            const type = Array.isArray(value) ? 'Array' : typeof value;
            console.log(`  - ${key}: ${type}`);
            
            // Show nested structure for objects
            if (type === 'object' && value && !Array.isArray(value) && value.constructor === Object) {
              Object.keys(value).forEach(subKey => {
                console.log(`    ↳ ${subKey}: ${typeof value[subKey]}`);
              });
            }
          });
        }
        
        // Show recent documents
        console.log('\nRecent documents (last 3):');
        samples.forEach((doc, i) => {
          console.log(`  [${i+1}] ID: ${doc._id}`);
          if (doc.userId) console.log(`      User: ${doc.userId}`);
          if (doc.content) console.log(`      Content: ${doc.content.substring(0, 60)}...`);
          if (doc.timestamp) console.log(`      Time: ${doc.timestamp}`);
          if (doc.role) console.log(`      Role: ${doc.role}`);
          if (doc.behaviorPatterns) console.log(`      Behavior Patterns: ${doc.behaviorPatterns.length} items`);
        });
      }
      
    } catch (error) {
      console.log(`❌ Error analyzing ${collectionName}:`, error.message);
    }
  }
  
  // Look for 'numina' and 'test' collections specifically
  const targetCollections = ['numina', 'test'];
  const foundCollections = targetCollections.filter(name => collectionNames.includes(name));
  
  if (foundCollections.length > 0) {
    for (const collectionName of foundCollections) {
      await analyzeCollection(collectionName);
    }
  } else {
    console.log('\n⚠️ Neither "numina" nor "test" collections found');
    console.log('\n🔍 Analyzing key existing collections for reference:');
    
    // Analyze key collections that do exist
    const keyCollections = ['shorttermmemories', 'userbehaviorprofiles', 'conversations']
      .filter(name => collectionNames.includes(name));
    
    for (const collectionName of keyCollections) {
      await analyzeCollection(collectionName);
    }
  }
  
  await mongoose.disconnect();
}

scrapeCollectionSchemas().catch(console.error);