import mongoose from "mongoose";
import dotenv from "dotenv";
import CollectiveSnapshot from "../src/models/CollectiveSnapshot.js";

dotenv.config();

async function checkSnapshots() {
  try {
    const mongoUri = process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    
    console.log("📊 Current snapshots in database:");
    
    const snapshots = await CollectiveSnapshot.find({})
      .sort({ timestamp: -1 })
      .limit(5);
    
    for (const snapshot of snapshots) {
      console.log({
        id: snapshot._id,
        timestamp: snapshot.timestamp,
        dominantEmotion: snapshot.dominantEmotion,
        avgIntensity: snapshot.avgIntensity,
        archetype: snapshot.archetype,
        sampleSize: snapshot.sampleSize,
        status: snapshot.status,
        timeRange: snapshot.metadata?.timeRange
      });
    }
    
    console.log("\n🔍 Testing CollectiveSnapshot.getLatest():");
    
    const latest = await CollectiveSnapshot.getLatest("30d");
    if (latest) {
      console.log("Latest snapshot found:", {
        id: latest._id,
        dominantEmotion: latest.dominantEmotion,
        avgIntensity: latest.avgIntensity,
        archetype: latest.archetype,
        sampleSize: latest.sampleSize,
        timestamp: latest.timestamp
      });
    } else {
      console.log("No latest snapshot found");
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error("Error:", error);
  }
}

checkSnapshots();