import ShortTermMemory from "../models/ShortTermMemory.js";
import { prioritizeMemories } from "./memoryImportance.js";

/**
 * Get recent memory for a user with optional time limit
 * @param {string} userId - User ID
 * @param {object} userCache - User cache instance  
 * @param {number} limitMinutes - Time limit in minutes (default: 24 hours)
 * @returns {Array} Array of recent memory entries
 */
export const getRecentMemory = async (userId, userCache, limitMinutes = 24 * 60, options = {}) => {
  if (!userId) {
    return [];
  }

  const {
    maxMessages = 50,
    contextType = 'standard', // 'standard', 'focused', 'summary'
    includeImages = true,
    useImportanceScoring = true
  } = options;

  // Smart context window management based on conversation type
  const contextLimits = {
    standard: { messages: 50, timeWindow: 24 * 60 },
    focused: { messages: 20, timeWindow: 4 * 60 },  // 4 hours for focused sessions
    summary: { messages: 10, timeWindow: 1 * 60 }   // 1 hour for quick summaries
  };

  const limits = contextLimits[contextType] || contextLimits.standard;
  const effectiveLimit = Math.min(maxMessages, limits.messages);
  
  // DEFENSIVE CACHE FIX: Ensure effectiveTimeWindow is always a valid number
  const safeLimitMinutes = (typeof limitMinutes === 'number' && !isNaN(limitMinutes)) ? limitMinutes : limits.timeWindow;
  let effectiveTimeWindow = Math.min(safeLimitMinutes, limits.timeWindow);
  
  // Additional safety check
  if (isNaN(effectiveTimeWindow) || effectiveTimeWindow <= 0) {
    console.error(`[CACHE ERROR] Invalid effectiveTimeWindow: ${effectiveTimeWindow}, using default 24 hours`);
    effectiveTimeWindow = 24 * 60; // 24 hours in minutes
  }

  try {
    const projection = includeImages 
      ? { role: 1, content: 1, timestamp: 1, attachments: 1, _id: 0 }
      : { role: 1, content: 1, timestamp: 1, _id: 0 };

    // Fetch more than needed for importance scoring
    const fetchLimit = useImportanceScoring ? effectiveLimit * 2 : effectiveLimit;
    
    // Ensure we have a valid timestamp for queries
    let timeThreshold = new Date(Date.now() - effectiveTimeWindow * 60 * 1000);
    if (isNaN(timeThreshold.getTime())) {
      console.error('Invalid time threshold calculated, using default 24 hours');
      timeThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    let memory;
    // Use cache if available, otherwise fetch from database
    if (userCache && userCache.getCachedMemory) {
      const cacheKey = `${userId}_${contextType}_${includeImages}_${useImportanceScoring}`;
      memory = await userCache.getCachedMemory(cacheKey, () => 
        ShortTermMemory.find({ 
          userId,
          timestamp: { 
            $gte: timeThreshold,
            $type: "date" // Ensure timestamp is a valid date
          }
        }, projection)
          .sort({ timestamp: -1 })
          .limit(fetchLimit)
          .lean()
      );
    } else {
      // Direct database query if no cache
      memory = await ShortTermMemory.find({ 
        userId,
        timestamp: { 
          $gte: timeThreshold,
          $type: "date" // Ensure timestamp is a valid date
        }
      }, projection)
        .sort({ timestamp: -1 })
        .limit(fetchLimit)
        .lean();
    }

    // Apply importance scoring if enabled
    if (useImportanceScoring && memory.length > effectiveLimit) {
      const prioritized = prioritizeMemories(memory, {
        maxCount: effectiveLimit,
        minImportanceScore: contextType === 'focused' ? 30 : 20,
        preserveRecent: Math.min(5, Math.floor(effectiveLimit * 0.3)), // Keep 30% as recent
        currentTimestamp: Date.now(),
        conversationContext: memory.slice(0, 10) // Use top 10 for context
      });
      
      // Keep reverse chronological order (newest first) for context injection
      memory = prioritized.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    console.log(`🧠 CONTEXT WINDOW: Retrieved ${memory.length} messages (${contextType} mode, ${effectiveTimeWindow}min window${useImportanceScoring ? ', importance-scored' : ''})`);
    
    return memory;

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