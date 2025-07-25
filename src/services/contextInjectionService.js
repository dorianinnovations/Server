/**
 * Context Injection Service
 * 
 * Intelligent pre-processor that detects ambiguous, context-dependent queries
 * and injects necessary information to resolve pronouns and references.
 * 
 * Solves the critical gap where direct data queries lose conversational context
 * for follow-up questions like "what does that mean?"
 */

// Ambiguity detection patterns
const ambiguityTriggers = [
  'what does that mean',
  'what does it mean', 
  'why is that',
  'can you explain that',
  'tell me more about it',
  'what is that',
  'how does that work',
  'what about that',
  'expand on that',
  'elaborate on that',
  'more details about that',
  'what do you mean by that',
  'clarify that',
  'break that down',
  'explain it',
  'what\'s that about',
  'tell me about that',
  'how so',
  'why',
  'explain',
  'elaborate',
  'more info',
  'details'
];

const pronouns = ['it', 'that', 'this', 'those', 'there', 'them'];

/**
 * Detects if a message contains ambiguous references that need context injection
 */
function isAmbiguousQuery(message) {
  const lowerMessage = message.toLowerCase().trim();
  
  // Check for direct ambiguity triggers
  const hasAmbiguityTrigger = ambiguityTriggers.some(trigger => 
    lowerMessage.includes(trigger)
  );
  
  if (hasAmbiguityTrigger) return true;
  
  // Check for standalone pronouns that likely reference previous context
  const words = lowerMessage.split(/\s+/);
  const hasStandalonePronoun = pronouns.some(pronoun => {
    const pronounIndex = words.indexOf(pronoun);
    if (pronounIndex === -1) return false;
    
    // More likely to need context if pronoun is at start or after question words
    return pronounIndex <= 2 || 
           words[pronounIndex - 1]?.match(/what|how|why|when|where|is|does|can/);
  });
  
  if (hasStandalonePronoun) return true;
  
  // Check for very short queries that likely reference context
  if (words.length <= 3 && words.some(word => 
    ['why', 'how', 'what', 'explain', 'more', 'details'].includes(word)
  )) {
    return true;
  }
  
  return false;
}

/**
 * Extracts the most relevant context from recent conversation history
 */
function extractRelevantContext(conversationHistory) {
  if (!conversationHistory || conversationHistory.length === 0) {
    return null;
  }
  
  // Find the last assistant message that contains substantial content
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const message = conversationHistory[i];
    
    if (message.role === 'assistant' && message.content) {
      const content = message.content.trim();
      
      // Skip very short responses or system messages
      if (content.length < 20) continue;
      
      // Prioritize messages with data or specific information
      if (content.includes('complexity') || 
          content.includes('topic') || 
          content.includes('metric') ||
          content.includes('analysis') ||
          content.match(/\d+(\.\d+)?/) || // Contains numbers
          content.includes(':') // Contains structured data
      ) {
        return content;
      }
      
      // Fall back to any substantial assistant message
      if (content.length >= 50) {
        return content;
      }
    }
  }
  
  return null;
}

/**
 * Creates a context-enriched message for the LLM
 */
function createContextEnrichedMessage(originalMessage, contextualResponse) {
  // Clean up the contextual response to focus on key information
  let cleanContext = contextualResponse;
  
  // Remove excessive formatting but keep essential structure
  cleanContext = cleanContext.replace(/\*\*(.*?)\*\*/g, '$1'); // Remove bold
  cleanContext = cleanContext.replace(/#{1,6}\s*/g, ''); // Remove headers
  
  // Truncate if too long (keep under 200 chars for context)
  if (cleanContext.length > 200) {
    cleanContext = cleanContext.substring(0, 200) + '...';
  }
  
  return `Based on my previous response: "${cleanContext}", the user is now asking: "${originalMessage}". Please provide a clear, contextual answer that directly addresses their follow-up question.`;
}

/**
 * Main context injection processor
 * 
 * @param {string} userMessage - Original user message
 * @param {Array} conversationHistory - Recent conversation history
 * @returns {Object} - { isProcessed: boolean, enrichedMessage?: string, forceGPT?: boolean }
 */
function processContextInjection(userMessage, conversationHistory = []) {
  try {
    // Skip processing if message is clearly unambiguous
    if (!userMessage || userMessage.length > 100) {
      return { isProcessed: false };
    }
    
    // Check for ambiguity
    if (!isAmbiguousQuery(userMessage)) {
      return { isProcessed: false };
    }
    
    // Extract relevant context
    const relevantContext = extractRelevantContext(conversationHistory);
    
    if (!relevantContext) {
      // Ambiguous but no context available - let it proceed normally
      return { isProcessed: false };
    }
    
    // Create enriched message
    const enrichedMessage = createContextEnrichedMessage(userMessage, relevantContext);
    
    console.log(`🔄 CONTEXT INJECTION: Detected ambiguous query "${userMessage}" - enriching with context`);
    
    return {
      isProcessed: true,
      enrichedMessage,
      forceGPT: true, // Force through GPT instead of direct data queries
      originalMessage: userMessage,
      injectedContext: relevantContext
    };
    
  } catch (error) {
    console.error('Context injection error:', error);
    return { isProcessed: false };
  }
}

/**
 * Utility to log context injection for debugging
 */
function logContextInjection(originalMessage, enrichedMessage, context) {
  console.log('🔄 CONTEXT INJECTION DETAILS:');
  console.log(`  Original: "${originalMessage}"`);
  console.log(`  Context: "${context?.substring(0, 100)}..."`);
  console.log(`  Enriched: "${enrichedMessage?.substring(0, 150)}..."`);
}

export {
  processContextInjection,
  isAmbiguousQuery,
  extractRelevantContext,
  createContextEnrichedMessage,
  logContextInjection
};