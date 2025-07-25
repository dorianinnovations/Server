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
 * THE FINAL FIX: Bulletproof context extraction using direct .find() method
 * This function should replace any current context/history retrieval logic.
 * It assumes 'sortedConversationHistory' is an array of message objects,
 * sorted with the most recent message at index 0.
 */
function extractRelevantContext(sortedConversationHistory) {
  if (!sortedConversationHistory || sortedConversationHistory.length === 0) {
    return null;
  }
  
  console.log(`[CONTEXT DEBUG] Total messages retrieved: ${sortedConversationHistory.length}`);

  // --- START FINAL ROBUST LOGIC ---

  let lastBotMessageContent = null;

  // Use .find() to get the first message from the top of the sorted array
  // that has the role of 'assistant'. This is guaranteed to be the most recent one.
  const lastBotMessage = sortedConversationHistory.find(message => message.role === 'assistant');

  // Check if we actually found a message
  if (lastBotMessage && lastBotMessage.content) {
    // We found the correct message.
    lastBotMessageContent = lastBotMessage.content;
    console.log(`[CONTEXT DEBUG] SUCCESS: Correctly selected most recent assistant message: "${lastBotMessageContent.substring(0, 100)}..."`);
  } else {
    // This is a fallback in case there are no assistant messages in the history.
    console.error('[CONTEXT ERROR] No assistant message found in the recent history.');
    return null; // Return null to prevent the system from using bad context.
  }

  // Now, you can confidently pass this guaranteed-to-be-correct content
  // to your subject extraction logic.
  return lastBotMessageContent;

  // --- END FINAL ROBUST LOGIC ---
}

/**
 * V3: Prioritized Subject Extraction Cascade
 * Uses a strict priority order to find the most specific and relevant subject
 */
function extractSubject(botMessage) {
  const content = botMessage.trim();
  const lowerContent = content.toLowerCase();
  let subject = null;
  
  // DEBUG: Log what we're analyzing
  console.log(`🔍 SUBJECT DEBUG: Analyzing message: "${content.substring(0, 100)}..."`);
  console.log(`🔍 SUBJECT DEBUG: Looking for numbers...`);
  
  // PRIORITY 1: Numbers associated with specific metrics (HIGHEST PRIORITY)
  const numberMatch = content.match(/(\d+\.?\d*)/);
  if (numberMatch && !subject) {
    const number = numberMatch[1];
    console.log(`🔍 SUBJECT DEBUG: Found number: ${number}`);
    console.log(`🔍 SUBJECT DEBUG: Checking complexity patterns...`);
    console.log(`🔍 SUBJECT DEBUG: message complexity? ${lowerContent.includes('message complexity')}`);
    console.log(`🔍 SUBJECT DEBUG: complexity + current? ${lowerContent.includes('complexity') && lowerContent.includes('current')}`);
    
    // Check for specific metrics in order of importance - make sure we match the exact pattern
    if (lowerContent.includes('message complexity') || (lowerContent.includes('complexity') && lowerContent.includes('current'))) {
      subject = `the message complexity score of ${number}`;
      console.log(`🔍 SUBJECT DEBUG: ✅ MATCHED COMPLEXITY: "${subject}"`);
    } else if (lowerContent.includes('sentiment')) {
      subject = `the sentiment score of ${number}`;
    } else if (lowerContent.includes('confidence')) {
      subject = `the confidence score of ${number}`;
    } else if (lowerContent.includes('intensity')) {
      subject = `the intensity level of ${number}`;
    } else if (lowerContent.includes('score')) {
      subject = `the score of ${number}`;
    } else if (lowerContent.includes('level')) {
      subject = `the level of ${number}`;
    } else if (lowerContent.includes('rating')) {
      subject = `the rating of ${number}`;
    } else if (content.includes('%') || lowerContent.includes('percent')) {
      subject = `the percentage ${number}`;
    } else {
      // Generic number with context clues
      const beforeNumber = content.substring(0, numberMatch.index).toLowerCase();
      const afterNumber = content.substring(numberMatch.index + number.length).toLowerCase();
      
      // Look for metric keywords around the number
      const contextWords = (beforeNumber + ' ' + afterNumber).match(/\b(metric|value|measure|data|result|outcome)\b/);
      if (contextWords) {
        subject = `the ${contextWords[1]} ${number}`;
      } else {
        subject = `the number ${number}`;
      }
    }
  }
  
  // PRIORITY 2: Quoted terms (only if no specific metric found)
  if (!subject) {
    const quotedMatch = content.match(/"([^"]+)"/);
    if (quotedMatch) {
      subject = `the term "${quotedMatch[1]}"`;
    }
  }
  
  // PRIORITY 3: Named entities and specific concepts
  if (!subject) {
    // Look for dominant topic mentions
    const topicMatch = content.match(/dominant topic.*?(?:is|:)\s*([a-zA-Z]+)/i);
    if (topicMatch) {
      subject = `your dominant topic "${topicMatch[1]}"`;
    }
  }
  
  // PRIORITY 4: Emotional states
  if (!subject) {
    const emotionMatch = content.match(/(?:emotion|feeling|mood).*?(?:is|appears to be|:)\s*([a-zA-Z]+)/i);
    if (emotionMatch) {
      subject = `your emotional state "${emotionMatch[1]}"`;
    }
  }
  
  // PRIORITY 5: Key concepts from first sentence
  if (!subject) {
    const firstSentence = content.split('.')[0];
    if (firstSentence.length < 100) {
      const keyWords = firstSentence.match(/\b(?:complexity|topic|emotion|score|level|metric|analysis|pattern|data|result)\b/gi);
      if (keyWords && keyWords.length > 0) {
        subject = `the ${keyWords[0].toLowerCase()} mentioned`;
      }
    }
  }
  
  // PRIORITY 6: Fallback to concise message summary
  if (!subject) {
    if (content.length > 150) {
      subject = content.substring(0, 147) + '...';
    } else {
      subject = content;
    }
  }
  
  return subject;
}

/**
 * Creates a context-enriched message for the LLM with intelligent subject extraction
 */
function createContextEnrichedMessage(originalMessage, contextualResponse) {
  // Extract the most likely subject the user is referring to
  const subject = extractSubject(contextualResponse);
  
  // Create a precise, unambiguous prompt for the LLM
  return `The user is asking for more information about ${subject}. Their exact question is: "${originalMessage}". Please provide a detailed explanation that directly addresses what they're asking about.`;
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
    
    // Extract subject and create enriched message
    const extractedSubject = extractSubject(relevantContext);
    const enrichedMessage = createContextEnrichedMessage(userMessage, relevantContext);
    
    console.log(`🔄 CONTEXT INJECTION V3: Detected ambiguous query "${userMessage}" - subject: "${extractedSubject}"`);
    
    return {
      isProcessed: true,
      enrichedMessage,
      forceGPT: true, // Force through GPT instead of direct data queries
      originalMessage: userMessage,
      injectedContext: relevantContext,
      extractedSubject
    };
    
  } catch (error) {
    console.error('Context injection error:', error);
    return { isProcessed: false };
  }
}

/**
 * Utility to log context injection for debugging
 */
function logContextInjection(originalMessage, enrichedMessage, context, extractedSubject) {
  console.log('🔄 CONTEXT INJECTION V3 DETAILS:');
  console.log(`  Original: "${originalMessage}"`);
  console.log(`  Extracted Subject: "${extractedSubject}"`);
  console.log(`  Full Context: "${context?.substring(0, 100)}..."`);
  console.log(`  Enriched: "${enrichedMessage?.substring(0, 150)}..."`);
}

export {
  processContextInjection,
  isAmbiguousQuery,
  extractRelevantContext,
  extractSubject,
  createContextEnrichedMessage,
  logContextInjection
};