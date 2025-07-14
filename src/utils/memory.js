import ShortTermMemory from "../models/ShortTermMemory.js";

/**
 * Get recent memory for a user with optional time limit
 * @param {string} userId - User ID
 * @param {object} userCache - User cache instance  
 * @param {number} limitMinutes - Time limit in minutes (default: 24 hours)
 * @returns {Array} Array of recent memory entries
 */
export const getRecentMemory = async (userId, userCache, limitMinutes = 24 * 60) => {
  if (!userId) {
    return [];
  }

  try {
    // Use cache if available, otherwise fetch from database
    if (userCache && userCache.getCachedMemory) {
      return await userCache.getCachedMemory(userId, () => 
        ShortTermMemory.find({ 
          userId,
          timestamp: { 
            $gte: new Date(Date.now() - limitMinutes * 60 * 1000) 
          }
        }, { role: 1, content: 1, timestamp: 1, _id: 0 })
          .sort({ timestamp: -1 })
          .limit(50)
          .lean()
      );
    }

    // Direct database query if no cache
    return await ShortTermMemory.find({ 
      userId,
      timestamp: { 
        $gte: new Date(Date.now() - limitMinutes * 60 * 1000) 
      }
    }, { role: 1, content: 1, timestamp: 1, _id: 0 })
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

  } catch (error) {
    console.error(`Error fetching recent memory for user ${userId}:`, error);
    return [];
  }
};

/**
 * Save a new memory entry
 * @param {string} userId - User ID
 * @param {string} role - Role (user or assistant)
 * @param {string} content - Message content
 * @param {string} conversationId - Optional conversation ID
 * @returns {object} Saved memory entry
 */
export const saveMemory = async (userId, role, content, conversationId = null) => {
  try {
    const memoryEntry = new ShortTermMemory({
      userId,
      role,
      content,
      conversationId,
      timestamp: new Date()
    });

    return await memoryEntry.save();
  } catch (error) {
    console.error(`Error saving memory for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Clear old memory entries (called by cleanup jobs)
 * @param {number} olderThanHours - Remove entries older than this many hours
 * @returns {object} Deletion result
 */
export const clearOldMemory = async (olderThanHours = 48) => {
  try {
    const cutoffDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    const result = await ShortTermMemory.deleteMany({
      timestamp: { $lt: cutoffDate }
    });

    console.log(`🗑️ Cleared ${result.deletedCount} old memory entries older than ${olderThanHours} hours`);
    return result;
  } catch (error) {
    console.error('Error clearing old memory:', error);
    throw error;
  }
};

/**
 * Get conversation history for a specific conversation ID
 * @param {string} conversationId - Conversation ID
 * @param {number} limit - Maximum number of entries to return
 * @returns {Array} Array of conversation entries
 */
export const getConversationHistory = async (conversationId, limit = 20) => {
  try {
    return await ShortTermMemory.find({ 
      conversationId 
    }, { role: 1, content: 1, timestamp: 1, _id: 0 })
      .sort({ timestamp: 1 }) // Ascending for conversation order
      .limit(limit)
      .lean();
  } catch (error) {
    console.error(`Error fetching conversation ${conversationId}:`, error);
    return [];
  }
};