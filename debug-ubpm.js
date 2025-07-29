// Debug script to check ALL collections for numinaworks@gmail.com behavioral data
import mongoose from 'mongoose';
import UserBehaviorProfile from './src/models/UserBehaviorProfile.js';
import User from './src/models/User.js';
import ShortTermMemory from './src/models/ShortTermMemory.js';
import AnalyticsInsight from './src/models/AnalyticsInsight.js';
import UserConstants from './src/models/UserConstants.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkAllCollections() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find the user
    const user = await User.findOne({ email: 'numinaworks@gmail.com' });
    if (!user) {
      console.log('❌ User numinaworks@gmail.com not found');
      return;
    }
    
    console.log(`✅ Found user: ${user.email}, ID: ${user._id}`);
    console.log(`User Profile:`, {
      emotionalProfile: user.emotionalProfile,
      preferences: user.preferences,
      behaviorPatterns: user.behaviorPatterns
    });

    // 1. Check UserBehaviorProfile collection
    console.log('\n🧠 1. UserBehaviorProfile Collection:');
    console.log('=====================================');
    const profile = await UserBehaviorProfile.findOne({ userId: user._id });
    if (profile) {
      console.log(`✅ Found UserBehaviorProfile: ${profile.behaviorPatterns?.length || 0} patterns`);
      profile.behaviorPatterns?.forEach((pattern, index) => {
        console.log(`   ${index + 1}. ${pattern.type}: ${pattern.pattern} (conf: ${pattern.confidence})`);
      });
    } else {
      console.log('❌ No UserBehaviorProfile found');
    }

    // 2. Check ShortTermMemory collection
    console.log('\n💭 2. ShortTermMemory Collection:');
    console.log('=================================');
    const memories = await ShortTermMemory.find({ userId: user._id }).sort({ timestamp: -1 }).limit(5);
    console.log(`Found ${memories.length} short term memories`);
    memories.forEach((memory, index) => {
      console.log(`   ${index + 1}. ${memory.type}: ${memory.content?.substring(0, 100)}...`);
      if (memory.behaviorPatterns?.length > 0) {
        console.log(`      Behavior Patterns: ${memory.behaviorPatterns.length}`);
        memory.behaviorPatterns.forEach(bp => {
          console.log(`         - ${bp.type}: ${bp.pattern} (${bp.confidence})`);
        });
      }
    });

    // 3. Check AnalyticsInsight collection
    console.log('\n📊 3. AnalyticsInsight Collection:');
    console.log('==================================');
    const insights = await AnalyticsInsight.find({ userId: user._id }).sort({ timestamp: -1 }).limit(5);
    console.log(`Found ${insights.length} analytics insights`);
    insights.forEach((insight, index) => {
      console.log(`   ${index + 1}. ${insight.category}: ${insight.title}`);
      console.log(`      Description: ${insight.description?.substring(0, 100)}...`);
    });

    // 4. Check UserConstants collection  
    console.log('\n🔧 4. UserConstants Collection:');
    console.log('===============================');
    const constants = await UserConstants.findOne({ userId: user._id });
    if (constants) {
      console.log(`✅ Found UserConstants`);
      console.log(`   Data:`, Object.keys(constants.toObject()).filter(k => k !== '_id' && k !== 'userId'));
      if (constants.behaviorPatterns) {
        console.log(`   Behavior Patterns: ${constants.behaviorPatterns.length}`);
      }
    } else {
      console.log('❌ No UserConstants found');
    }

    // 5. Check direct database query
    console.log('\n🔍 5. Direct Database Collections:');
    console.log('==================================');
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));

    // Check userbehaviorprofiles collection directly
    const ubpCollection = db.collection('userbehaviorprofiles');
    const ubpDocs = await ubpCollection.find({ userId: user._id }).toArray();
    console.log(`Direct userbehaviorprofiles query: ${ubpDocs.length} documents`);
    
    // Check for any pattern with user ID as string or ObjectId
    const ubpById = await ubpCollection.find({ userId: user._id.toString() }).toArray();
    console.log(`By string ID: ${ubpById.length} documents`);

    const ubpByObjectId = await ubpCollection.find({ userId: new mongoose.Types.ObjectId(user._id) }).toArray();
    console.log(`By ObjectId: ${ubpByObjectId.length} documents`);

    // Find any document with behavioral patterns
    const anyPatterns = await ubpCollection.find({ behaviorPatterns: { $exists: true, $ne: [] } }).toArray();
    console.log(`\n🎯 ALL documents with behavioral patterns: ${anyPatterns.length}`);
    anyPatterns.forEach((doc, index) => {
      console.log(`   ${index + 1}. User: ${doc.userId}, Patterns: ${doc.behaviorPatterns?.length || 0}`);
      doc.behaviorPatterns?.slice(0, 3).forEach(p => {
        console.log(`      - ${p.type}: ${p.pattern} (${p.confidence})`);
      });
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
}

checkAllCollections();