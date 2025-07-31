import ShortTermMemory from '../models/ShortTermMemory.js';
import conversationService from './conversationService.js';

// Fast path detection
export function isSimpleMessage(message) {
  if (!message || typeof message !== 'string') return false;
  
  // Simple message criteria:
  // - Less than 100 characters
  // - No complex queries (how, why, what, when, where)
  // - No emotional keywords
  // - No data analysis requests
  const complexPatterns = [
    /^(how|why|what|when|where|analyze|explain|tell me about)/i,
    /(emotion|feeling|mood|stress|anxiety|happy|sad|angry)/i,
    /(data|metric|statistic|chart|graph|report|summary)/i,
    /(memory|remember|previously|last time|earlier)/i,
    /\?.*\?/  // Multiple questions
  ];
  
  return message.length < 100 && !complexPatterns.some(pattern => pattern.test(message));
}

// Check if user has complex context that requires full processing
export async function hasComplexContext(userId) {
  try {
    // Check recent conversation depth
    const recentMessages = await ShortTermMemory.find({ userId })
      .sort({ timestamp: -1 })
      .limit(5)
      .lean();
    
    // Complex context if:
    // - Recent emotional conversations
    // - Multiple topics in recent messages
    // - Long conversation history
    return recentMessages.length > 3 || 
           recentMessages.some(msg => msg.content && msg.content.length > 200);
  } catch (error) {
    console.error('Error checking complex context:', error);
    return false; // Default to simple if error
  }
}

// Lightweight chat handler for simple messages
export async function lightweightChat(message, userId, conversationId) {
  const simpleResponses = {
    greeting: [
      "Hey there! How's your day going?",
      "Hi! What's on your mind today?",
      "Hello! How can I help you?"
    ],
    acknowledgment: [
      "I understand. Tell me more.",
      "Got it. What else is happening?",
      "I see. How does that make you feel?"
    ],
    casual: [
      "That's interesting! Thanks for sharing.",
      "I appreciate you telling me that.",
      "That makes sense. Anything else?"
    ]
  };
  
  // Detect message type
  let responseType = 'casual';
  if (/^(hi|hello|hey|greetings)/i.test(message)) {
    responseType = 'greeting';
  } else if (/^(ok|okay|yes|no|sure|thanks|got it)/i.test(message)) {
    responseType = 'acknowledgment';
  }
  
  // Pick random response
  const responses = simpleResponses[responseType];
  const response = responses[Math.floor(Math.random() * responses.length)];
  
  // Save to conversation history asynchronously
  setImmediate(async () => {
    try {
      await Promise.all([
        conversationService.addMessage(userId, conversationId, 'user', message),
        conversationService.addMessage(userId, conversationId, 'assistant', response),
        ShortTermMemory.insertMany([
          { userId, content: message, role: "user", timestamp: new Date() },
          { userId, content: response, role: "assistant", timestamp: new Date() }
        ])
      ]);
    } catch (err) {
      console.error('Error saving lightweight chat:', err);
    }
  });
  
  return {
    response,
    tone: 'casual',
    suggestedFollowUps: [],
    emotionalSupport: '',
    adaptationReason: 'Simple message - fast response'
  };
}

// Background processing for non-essential tasks
export function processInBackground(tasks) {
  setImmediate(async () => {
    for (const task of tasks) {
      try {
        await task();
      } catch (error) {
        console.error('Background task error:', error);
      }
    }
  });
}

// Detect if cognitive architecture is needed
export function shouldAnalyzeCognitive(message, userHistory = []) {
  // Cognitive analysis needed for:
  // - Deep questions
  // - Philosophical topics
  // - Complex decision making
  // - Pattern analysis requests
  const cognitivePatterns = [
    /meaning|purpose|philosophy|consciousness/i,
    /decide|choice|option|alternative/i,
    /pattern|trend|analyze|insight/i,
    /strategy|plan|approach|method/i
  ];
  
  return cognitivePatterns.some(pattern => pattern.test(message)) ||
         userHistory.some(msg => msg.role === 'user' && 
                          cognitivePatterns.some(p => p.test(msg.content)));
}