import logger from "./logger.js";

console.log("📊 Initializing analytics helper utilities...");

// Analytics helper function - now uses AI-driven emotion detection
export async function updateAnalyticsForUser(userId) {
  try {
    // Analytics are now handled by AI-driven emotion detection from conversations
    // No manual emotion logging sessions needed
    
    logger.info("Analytics processing handled by AI-driven system", { userId });
    
  } catch (error) {
    logger.error("Error updating analytics for user", { 
      userId, 
      error: error.message 
    });
    throw error;
  }
}

console.log("✓Analytics helper function configured");
// Component ready