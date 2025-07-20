import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/numina');
    console.log('✅ Connected to database');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

async function safeCreateIndex(collection, indexSpec, options = {}) {
  try {
    await collection.createIndex(indexSpec, { ...options, background: true });
    console.log(`   ✅ Created index: ${JSON.stringify(indexSpec)}`);
  } catch (error) {
    if (error.code === 85) { // IndexOptionsConflict
      console.log(`   ⚠️ Index already exists: ${JSON.stringify(indexSpec)}`);
    } else {
      console.log(`   ❌ Failed to create index: ${error.message}`);
    }
  }
}

async function addMissingIndexes() {
  console.log('🔧 Adding missing performance indexes...');
  
  try {
    const db = mongoose.connection.db;
    
    // Only add indexes that are likely missing
    console.log('🤖 Adding AI insight indexes...');
    await safeCreateIndex(
      db.collection('analyticsinsights'),
      { "userId": 1, "category": 1, "generatedAt": -1 },
      { name: "user_category_insights" }
    );
    
    await safeCreateIndex(
      db.collection('analyticsinsights'),
      { "isActive": 1, "generatedAt": -1 },
      { name: "active_insights_timeline" }
    );
    
    console.log('⏱️ Adding cooldown indexes...');
    await safeCreateIndex(
      db.collection('insightcooldowns'),
      { "cooldownUntil": 1 },
      { name: "cooldown_expiry_check" }
    );
    
    console.log('📊 Adding analytics session indexes...');
    await safeCreateIndex(
      db.collection('emotionalanalyticssessions'),
      { "userId": 1, "weekStartDate": -1 },
      { name: "user_weekly_sessions" }
    );
    
    console.log('🌤️ Adding cloud event indexes...');
    await safeCreateIndex(
      db.collection('events'),
      { "date": 1, "isActive": 1 },
      { name: "active_events_by_date" }
    );
    
    console.log('✅ Index optimization completed!');
    
  } catch (error) {
    console.error('❌ Error in index optimization:', error);
  }
}

async function runSafeIndexing() {
  console.log('🚀 Safe Database Index Optimization\n');
  
  try {
    await connectToDatabase();
    await addMissingIndexes();
    
    console.log('\n🎉 Optimization completed successfully!');
    
  } catch (error) {
    console.error('❌ Optimization failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

runSafeIndexing();