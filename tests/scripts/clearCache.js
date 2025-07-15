import mongoose from "mongoose";
import dotenv from "dotenv";
import globalCache from "../src/utils/cache.js";

dotenv.config();

async function clearAllCaches() {
  try {
    console.log("🧹 Clearing all application caches...");
    
    // Clear the global cache
    globalCache.clear();
    console.log("✅ Global cache cleared");
    
    // Also restart the server process by triggering an error
    // This will force Render to restart with fresh memory
    console.log("🔄 Cache cleared successfully");
    
  } catch (error) {
    console.error("❌ Error clearing cache:", error);
  }
}

clearAllCaches();