/**
 * Memory importance scoring system
 * Prioritizes what memories to keep for optimal context window usage
 */

/**
 * Calculate importance score for a memory entry
 * @param {object} memory - Memory entry from database
 * @param {object} options - Scoring options
 * @returns {number} Importance score (0-100)
 */
export const calculateMemoryImportance = (memory, options = {}) => {
  const {
    currentTimestamp = Date.now(),
    userProfile = null,
    conversationContext = []
  } = options;

  let score = 0;
  const content = memory.content || '';
  const role = memory.role;
  const hasAttachments = memory.attachments && memory.attachments.length > 0;
  const timestamp = new Date(memory.timestamp).getTime();
  const ageHours = (currentTimestamp - timestamp) / (1000 * 60 * 60);

  // Base scoring factors
  const factors = {
    // Recency (40% weight) - exponential decay
    recency: Math.max(0, 40 * Math.exp(-ageHours / 12)), // Half-life of 12 hours
    
    // Content richness (25% weight)
    richness: calculateContentRichness(content, hasAttachments) * 25,
    
    // Emotional significance (20% weight)
    emotional: calculateEmotionalSignificance(content) * 20,
    
    // User engagement (10% weight)
    engagement: calculateEngagementLevel(content, role) * 10,
    
    // Context relevance (5% weight)
    relevance: calculateContextRelevance(memory, conversationContext) * 5
  };

  score = Object.values(factors).reduce((sum, value) => sum + value, 0);

  // Boost for critical content types
  if (hasAttachments) score += 15; // Images are usually important
  if (role === 'user') score += 5; // User messages slightly more important
  if (content.length > 200) score += 5; // Longer messages often more detailed

  // Penalize for repetitive content
  if (isRepetitiveContent(memory, conversationContext)) {
    score *= 0.7;
  }

  return Math.min(100, Math.max(0, score));
};

/**
 * Calculate content richness score
 * @param {string} content - Message content
 * @param {boolean} hasAttachments - Whether message has attachments
 * @returns {number} Richness score (0-1)
 */
const calculateContentRichness = (content, hasAttachments) => {
  let score = 0;
  
  // Length factor
  const lengthScore = Math.min(1, content.length / 300); // Max at 300 chars
  score += lengthScore * 0.3;
  
  // Question factor
  const questionCount = (content.match(/\?/g) || []).length;
  score += Math.min(0.2, questionCount * 0.1);
  
  // Technical/specific terms
  const technicalTerms = /\b(code|bug|error|feature|implement|analyze|solution|problem)\b/gi;
  const technicalMatches = (content.match(technicalTerms) || []).length;
  score += Math.min(0.2, technicalMatches * 0.05);
  
  // Attachment bonus
  if (hasAttachments) score += 0.3;
  
  return Math.min(1, score);
};

/**
 * Calculate emotional significance
 * @param {string} content - Message content
 * @returns {number} Emotional score (0-1)
 */
const calculateEmotionalSignificance = (content) => {
  const emotionalKeywords = {
    high: ['love', 'hate', 'excited', 'frustrated', 'amazing', 'terrible', 'perfect', 'disaster'],
    medium: ['like', 'dislike', 'good', 'bad', 'nice', 'okay', 'fine', 'interesting'],
    positive: ['thanks', 'grateful', 'appreciate', 'wonderful', 'excellent', 'great'],
    negative: ['sorry', 'apologize', 'mistake', 'wrong', 'problem', 'issue', 'concern']
  };

  let score = 0;
  const lowerContent = content.toLowerCase();

  // High emotional impact
  score += emotionalKeywords.high.filter(word => lowerContent.includes(word)).length * 0.3;
  
  // Medium emotional impact
  score += emotionalKeywords.medium.filter(word => lowerContent.includes(word)).length * 0.15;
  
  // Positive sentiment
  score += emotionalKeywords.positive.filter(word => lowerContent.includes(word)).length * 0.1;
  
  // Negative sentiment (important for context)
  score += emotionalKeywords.negative.filter(word => lowerContent.includes(word)).length * 0.2;

  // Exclamation marks and caps (emotional indicators)
  const exclamations = (content.match(/!/g) || []).length;
  const capsWords = (content.match(/\b[A-Z]{2,}\b/g) || []).length;
  score += Math.min(0.2, (exclamations + capsWords) * 0.05);

  return Math.min(1, score);
};

/**
 * Calculate user engagement level
 * @param {string} content - Message content
 * @param {string} role - Message role (user/assistant)
 * @returns {number} Engagement score (0-1)
 */
const calculateEngagementLevel = (content, role) => {
  let score = 0;

  // Question asking shows engagement
  const questionCount = (content.match(/\?/g) || []).length;
  score += Math.min(0.4, questionCount * 0.2);

  // Follow-up indicators
  const followUpTerms = ['also', 'additionally', 'furthermore', 'by the way', 'speaking of'];
  score += followUpTerms.filter(term => content.toLowerCase().includes(term)).length * 0.1;

  // Detail requests
  const detailRequests = ['explain', 'how', 'why', 'what', 'when', 'where', 'tell me more'];
  score += detailRequests.filter(req => content.toLowerCase().includes(req)).length * 0.1;

  // User messages get slight boost for engagement
  if (role === 'user') score += 0.1;

  return Math.min(1, score);
};

/**
 * Calculate context relevance
 * @param {object} memory - Current memory entry
 * @param {Array} conversationContext - Recent conversation
 * @returns {number} Relevance score (0-1)
 */
const calculateContextRelevance = (memory, conversationContext) => {
  if (!conversationContext.length) return 0.5; // Default relevance

  let score = 0;
  const memoryWords = extractKeywords(memory.content);
  
  // Check keyword overlap with recent messages
  const recentKeywords = conversationContext
    .slice(0, 5) // Last 5 messages
    .flatMap(msg => extractKeywords(msg.content || ''));

  const overlap = memoryWords.filter(word => recentKeywords.includes(word)).length;
  const maxOverlap = Math.max(memoryWords.length, recentKeywords.length);
  
  if (maxOverlap > 0) {
    score = overlap / maxOverlap;
  }

  return score;
};

/**
 * Check if content is repetitive
 * @param {object} memory - Memory entry to check
 * @param {Array} conversationContext - Recent conversation
 * @returns {boolean} Whether content is repetitive
 */
const isRepetitiveContent = (memory, conversationContext) => {
  const content = memory.content;
  const threshold = 0.8; // 80% similarity threshold

  return conversationContext.some(msg => {
    if (msg.timestamp === memory.timestamp) return false; // Skip same message
    return calculateSimilarity(content, msg.content || '') > threshold;
  });
};

/**
 * Extract keywords from content
 * @param {string} content - Text content
 * @returns {Array} Array of keywords
 */
const extractKeywords = (content) => {
  if (!content) return [];
  
  // Remove common words and extract meaningful terms
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'must', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);
  
  return content
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 10); // Top 10 keywords
};

/**
 * Calculate text similarity using simple word overlap
 * @param {string} text1 - First text
 * @param {string} text2 - Second text
 * @returns {number} Similarity score (0-1)
 */
const calculateSimilarity = (text1, text2) => {
  const words1 = new Set(extractKeywords(text1));
  const words2 = new Set(extractKeywords(text2));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
};

/**
 * Prioritize memories for context window
 * @param {Array} memories - Array of memory entries
 * @param {object} options - Prioritization options
 * @returns {Array} Sorted array of memories with importance scores
 */
export const prioritizeMemories = (memories, options = {}) => {
  const {
    maxCount = 20,
    minImportanceScore = 20,
    preserveRecent = 5 // Always keep N most recent messages
  } = options;

  if (!memories || !memories.length) return [];

  // Calculate importance scores
  const scoredMemories = memories.map(memory => ({
    ...memory,
    importanceScore: calculateMemoryImportance(memory, options)
  }));

  // Sort by importance (desc) and timestamp (desc for ties)
  scoredMemories.sort((a, b) => {
    if (Math.abs(a.importanceScore - b.importanceScore) < 1) {
      return new Date(b.timestamp) - new Date(a.timestamp); // Newer first for ties
    }
    return b.importanceScore - a.importanceScore;
  });

  // Ensure we keep the most recent messages regardless of score
  const recent = scoredMemories.slice(0, preserveRecent);
  const remaining = scoredMemories.slice(preserveRecent);
  
  // Filter remaining by importance threshold
  const important = remaining.filter(memory => 
    memory.importanceScore >= minImportanceScore
  );

  // Combine and limit total count
  const prioritized = [...recent, ...important].slice(0, maxCount);

  console.log(`🎯 MEMORY PRIORITIZATION: ${prioritized.length}/${memories.length} memories selected (avg score: ${
    (prioritized.reduce((sum, m) => sum + m.importanceScore, 0) / prioritized.length).toFixed(1)
  })`);

  return prioritized;
};