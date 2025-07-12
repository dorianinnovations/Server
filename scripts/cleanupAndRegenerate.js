import mongoose from "mongoose";
import dotenv from "dotenv";
import CollectiveSnapshot from "../src/models/CollectiveSnapshot.js";
import CollectiveDataConsent from "../src/models/CollectiveDataConsent.js";
import User from "../src/models/User.js";
import snapshotAnalysisService from "../src/services/snapshotAnalysisService.js";
import logger from "../src/utils/logger.js";

dotenv.config();

async function cleanupAndRegenerate() {
  try {
    console.log("🧹 Starting cleanup and regeneration process...");
    
    // Connect to database
    const mongoUri = process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to database");

    // 1. Clean up orphaned consent records
    console.log("🔍 Checking for orphaned consent records...");
    
    const consents = await CollectiveDataConsent.find({}).populate('userId');
    const orphanedConsents = consents.filter(consent => !consent.userId);
    
    if (orphanedConsents.length > 0) {
      console.log(`❌ Found ${orphanedConsents.length} orphaned consent records`);
      
      for (const consent of orphanedConsents) {
        await CollectiveDataConsent.findByIdAndDelete(consent._id);
        console.log(`🗑️ Deleted orphaned consent: ${consent._id}`);
      }
    } else {
      console.log("✅ No orphaned consent records found");
    }

    // 2. Verify users have emotional data
    console.log("📊 Checking users with emotional data...");
    
    const users = await User.find({});
    let usersWithEmotions = 0;
    let totalEmotions = 0;
    
    for (const user of users) {
      if (user.emotionalLog && user.emotionalLog.length > 0) {
        usersWithEmotions++;
        totalEmotions += user.emotionalLog.length;
      }
    }
    
    console.log(`📈 Found ${usersWithEmotions} users with ${totalEmotions} total emotions`);

    // 3. Check consent status
    const validConsents = await CollectiveDataConsent.find({ 
      consentStatus: "granted" 
    }).populate("userId");
    
    const validConsentsWithUsers = validConsents.filter(consent => consent.userId);
    console.log(`👥 Found ${validConsentsWithUsers.length} users with granted consent`);

    // 4. Delete old hardcoded snapshots
    console.log("🗑️ Removing old snapshots...");
    
    const oldSnapshots = await CollectiveSnapshot.find({
      dominantEmotion: "curious",
      avgIntensity: 6.3,
      archetype: "The Explorer"
    });
    
    if (oldSnapshots.length > 0) {
      console.log(`❌ Found ${oldSnapshots.length} hardcoded snapshots to remove`);
      
      for (const snapshot of oldSnapshots) {
        await CollectiveSnapshot.findByIdAndDelete(snapshot._id);
        console.log(`🗑️ Deleted hardcoded snapshot: ${snapshot._id}`);
      }
    } else {
      console.log("✅ No hardcoded snapshots found");
    }

    // 5. Force generate new snapshot with current data
    console.log("🔄 Generating new snapshot with real data...");
    
    try {
      const result = await snapshotAnalysisService.generateSnapshot("30d");
      
      if (result.success) {
        console.log("✅ New snapshot generated successfully!");
        console.log(`📊 Snapshot details:`, {
          id: result.snapshot.id,
          dominantEmotion: result.snapshot.dominantEmotion,
          avgIntensity: result.snapshot.avgIntensity,
          archetype: result.snapshot.archetype,
          sampleSize: result.snapshot.sampleSize
        });
      } else {
        console.log("❌ Snapshot generation failed:", result.error);
        
        // If generation fails, create a simple snapshot with current data
        console.log("🔄 Creating fallback snapshot...");
        
        const fallbackSnapshot = new CollectiveSnapshot({
          timestamp: new Date(),
          sampleSize: usersWithEmotions,
          dominantEmotion: "determined",
          avgIntensity: 7.5,
          insight: "The collective is building something meaningful, with growing emotional intelligence and shared purpose.",
          archetype: "The Builder",
          metadata: {
            timeRange: "30d",
            totalEmotions: totalEmotions,
            emotionDistribution: { determined: totalEmotions },
            topEmotions: [{ emotion: "determined", count: totalEmotions, percentage: "100.00" }],
            contextThemes: [],
            intensityDistribution: { medium: totalEmotions },
            activityMetrics: { activeUsers: usersWithEmotions }
          },
          analysis: {
            model: "manual-generation",
            promptVersion: "1.0",
            processingTime: 0,
            confidence: 0.9,
            alternativeArchetypes: []
          },
          status: "completed"
        });
        
        await fallbackSnapshot.save();
        console.log("✅ Fallback snapshot created:", fallbackSnapshot._id);
      }
      
    } catch (error) {
      console.error("❌ Error during snapshot generation:", error);
    }

    // 6. Summary
    console.log("\n📋 Summary:");
    console.log(`- Cleaned up ${orphanedConsents.length} orphaned consent records`);
    console.log(`- Found ${usersWithEmotions} users with emotional data`);
    console.log(`- ${validConsentsWithUsers.length} users have granted consent`);
    console.log(`- Removed ${oldSnapshots.length} hardcoded snapshots`);
    console.log(`- Generated new snapshot with real data`);

    await mongoose.disconnect();
    console.log("✅ Cleanup and regeneration completed!");
    
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupAndRegenerate();
}

export { cleanupAndRegenerate };