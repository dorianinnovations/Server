// Debug script to check ALL databases and find numinaworks data
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function checkAllDatabases() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const connection = mongoose.connection;
    const db = connection.db;
    
    // Get current database name
    console.log(`🔍 Current Database: ${db.databaseName}`);
    
    // List all collections in current database
    const collections = await db.listCollections().toArray();
    console.log('\n📂 Collections in current database:');
    collections.forEach(col => console.log(`   - ${col.name}`));
    
    // Check each userbehaviorprofiles collection variant
    const ubpCollections = collections.filter(c => c.name.includes('userbehaviorprofile'));
    console.log(`\n🧠 Found ${ubpCollections.length} UserBehaviorProfile collections:`);
    
    for (const col of ubpCollections) {
      console.log(`\n📊 Checking collection: ${col.name}`);
      const collection = db.collection(col.name);
      
      // Find numinaworks by multiple possible user IDs
      const possibleUserIds = [
        '68854f56daac2491888de03c', // String format
        new mongoose.Types.ObjectId('68854f56daac2491888de03c'), // ObjectId format
      ];
      
      for (const userId of possibleUserIds) {
        const profile = await collection.findOne({ userId });
        if (profile) {
          console.log(`   ✅ FOUND numinaworks profile in ${col.name}!`);
          console.log(`   User ID: ${profile.userId}`);
          console.log(`   Patterns: ${profile.behaviorPatterns?.length || 0}`);
          console.log(`   Created: ${profile.createdAt}`);
          console.log(`   Updated: ${profile.updatedAt}`);
          
          if (profile.behaviorPatterns?.length > 0) {
            console.log(`   📋 Behavior Patterns:`);
            profile.behaviorPatterns.slice(0, 3).forEach((p, i) => {
              console.log(`      ${i+1}. ${p.type}: ${p.pattern} (${p.confidence})`);
            });
          }
          
          if (profile.personalityTraits?.length > 0) {
            console.log(`   🧠 Personality Traits:`);
            profile.personalityTraits.slice(0, 3).forEach((t, i) => {
              console.log(`      ${i+1}. ${t.trait}: ${t.score} (${t.confidence})`);
            });
          }
        }
      }
    }
    
    // Check if there are other databases
    const admin = db.admin();
    try {
      const dbs = await admin.listDatabases();
      console.log(`\n🗄️ All Databases on server:`);
      dbs.databases.forEach(database => {
        console.log(`   - ${database.name} (${Math.round(database.sizeOnDisk / 1024 / 1024)}MB)`);
      });
    } catch (err) {
      console.log('   ⚠️ Cannot list databases (permissions)');
    }
    
    // Also check regular users collection to verify user exists
    console.log(`\n👤 Checking users collection:`);
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ 
      $or: [
        { email: 'numinaworks@gmail.com' },
        { email: 'Numinaworks@gmail.com' }
      ]
    });
    
    if (user) {
      console.log(`   ✅ Found user: ${user.email}`);
      console.log(`   ID: ${user._id}`);
      console.log(`   Created: ${user.createdAt}`);
    } else {
      console.log(`   ❌ User numinaworks@gmail.com not found`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
}

checkAllDatabases();