import express from 'express';
import { protect } from '../middleware/auth.js';
import { createLLMService } from '../services/llmService.js';
import User from '../models/User.js';
import ShortTermMemory from '../models/ShortTermMemory.js';
import { createUserCache } from '../utils/cache.js';
import websocketService from '../services/websocketService.js';
import personalizationEngine from '../services/personalizationEngine.js';
import connectionEngine from '../services/connectionEngine.js';
import UserBehaviorProfile from '../models/UserBehaviorProfile.js';
import EmotionalAnalyticsSession from '../models/EmotionalAnalyticsSession.js';
import logger from '../utils/logger.js';

const router = express.Router();
const llmService = createLLMService();

/**
 * Enhanced Personalized Chat Endpoint
 * Provides contextual, historically-aware AI responses with deep personalization
 */
router.post('/contextual-chat', protect, async (req, res) => {
  try {
    const { message, stream = false } = req.body;
    const userId = req.user.id;
    const userCache = createUserCache(userId);
    
    console.log(`🧠 Contextual chat request for user ${userId}`);
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Message is required and must be a string'
      });
    }

    // Get comprehensive user data
    const [user, recentMemory, behaviorProfile, emotionalSession] = await Promise.all([
      userCache.getCachedUser(userId, () => 
        User.findById(userId).select('profile emotionalLog').lean()
      ),
      userCache.getCachedMemory(userId, () => 
        ShortTermMemory.find({ userId })
          .sort({ timestamp: -1 })
          .limit(20)
          .lean()
      ),
      UserBehaviorProfile.findOne({ userId }),
      EmotionalAnalyticsSession.getCurrentSession(userId)
    ]);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Generate contextual response using personalization engine
    const contextualResponse = await personalizationEngine.generateContextualResponse(
      userId, 
      message, 
      recentMemory
    );

    // Get personalized recommendations
    const recommendations = await personalizationEngine.generatePersonalizedRecommendations(
      userId,
      { 
        currentQuery: message,
        emotionalContext: user.emotionalLog?.slice(-3) || []
      }
    );

    // Get historical insights if requested
    let historicalInsights = null;
    if (isHistoricalQuery(message)) {
      historicalInsights = await personalizationEngine.generateHistoricalInsights(userId);
    }

    // Update behavior profile with this interaction
    await personalizationEngine.updateBehaviorProfile(userId, {
      type: 'chat',
      content: message,
      timestamp: new Date(),
      emotion: detectEmotion(message),
      context: 'chat_interaction'
    });

    // Build enhanced system prompt with personalization
    const systemPrompt = buildPersonalizedSystemPrompt(
      behaviorProfile,
      contextualResponse,
      recommendations,
      historicalInsights,
      recentMemory
    );

    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentMemory.slice(-6).map(mem => ({
        role: mem.role,
        content: mem.content
      })),
      { role: 'user', content: message }
    ];

    if (stream) {
      return handleStreamingResponse(res, messages, userId, message, behaviorProfile);
    } else {
      return handleRegularResponse(res, messages, userId, message, behaviorProfile, contextualResponse, recommendations, historicalInsights);
    }

  } catch (error) {
    logger.error('Error in contextual chat:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get personalized recommendations endpoint
 */
router.post('/recommendations', protect, async (req, res) => {
  try {
    const { context = {} } = req.body;
    const userId = req.user.id;

    const recommendations = await personalizationEngine.generatePersonalizedRecommendations(
      userId,
      context
    );

    res.json({
      success: true,
      data: recommendations
    });

  } catch (error) {
    logger.error('Error getting recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Error generating recommendations'
    });
  }
});

/**
 * Find compatible users endpoint
 */
router.post('/find-connections', protect, async (req, res) => {
  try {
    const { connectionType = 'all', limit = 10 } = req.body;
    const userId = req.user.id;

    const connections = await connectionEngine.findConnections(userId, connectionType, limit);

    res.json({
      success: true,
      data: connections
    });

  } catch (error) {
    logger.error('Error finding connections:', error);
    res.status(500).json({
      success: false,
      error: 'Error finding connections'
    });
  }
});

/**
 * Get historical insights endpoint
 */
router.get('/historical-insights', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    const insights = await personalizationEngine.generateHistoricalInsights(userId);

    res.json({
      success: true,
      data: insights
    });

  } catch (error) {
    logger.error('Error getting historical insights:', error);
    res.status(500).json({
      success: false,
      error: 'Error generating insights'
    });
  }
});

/**
 * Get connection insights for two users
 */
router.post('/connection-insights', protect, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const userId = req.user.id;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        error: 'Target user ID is required'
      });
    }

    const insights = await connectionEngine.getConnectionInsights(userId, targetUserId);

    res.json({
      success: true,
      data: insights
    });

  } catch (error) {
    logger.error('Error getting connection insights:', error);
    res.status(500).json({
      success: false,
      error: 'Error analyzing connection'
    });
  }
});

/**
 * Update user behavior profile manually
 */
router.post('/update-profile', protect, async (req, res) => {
  try {
    const { interactionData } = req.body;
    const userId = req.user.id;

    const result = await personalizationEngine.updateBehaviorProfile(userId, interactionData);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      error: 'Error updating profile'
    });
  }
});

// Helper Functions

function buildPersonalizedSystemPrompt(behaviorProfile, contextualResponse, recommendations, historicalInsights, recentMemory) {
  let prompt = `You are Numina, a naturally perceptive companion who genuinely cares about this person. You have great intuition and notice patterns that matter.

Who you are:
• Someone who really gets people and remembers what they share
• Naturally curious and insightful without being clinical
• A good listener who connects dots in meaningful ways
• Present and real - not robotic or overly formal

USER INSIGHTS:`;

  if (behaviorProfile) {
    prompt += `
PERSONALITY TRAITS: ${behaviorProfile.personalityTraits?.map(t => `${t.trait} (${Math.round(t.score * 100)}%)`).join(', ') || 'Developing profile'}
LIFECYCLE STAGE: ${behaviorProfile.lifecycleStage?.stage || 'Unknown'} - ${behaviorProfile.lifecycleStage?.stage === 'growth' ? 'actively developing and learning' : behaviorProfile.lifecycleStage?.stage === 'exploration' ? 'seeking new experiences and understanding' : 'navigating personal development'}
INTERESTS: ${behaviorProfile.interests?.slice(0, 3).map(i => i.category).join(', ') || 'Discovering interests'}
COMMUNICATION STYLE: ${behaviorProfile.communicationStyle?.preferredTone || 'Adaptive'} tone, ${behaviorProfile.communicationStyle?.complexityLevel || 'moderate'} complexity
EMOTIONAL BASELINE: ${behaviorProfile.emotionalProfile?.baselineEmotion || 'Balanced'}
SOCIAL PREFERENCE: ${behaviorProfile.socialProfile?.connectionStyle || 'Open to connection'}
DATA QUALITY: ${Math.round((behaviorProfile.dataQuality?.completeness || 0) * 100)}% profile completeness`;
  }

  if (contextualResponse?.historicalReference) {
    prompt += `

HISTORICAL CONTEXT DETECTED:
${contextualResponse.historicalReference.reference}
Relevance: ${contextualResponse.historicalReference.relevance}
Confidence: ${Math.round(contextualResponse.historicalReference.confidence * 100)}%`;
  }

  if (recommendations?.success && recommendations.recommendations) {
    prompt += `

CURRENT PERSONALIZED INSIGHTS:
Immediate: ${recommendations.recommendations.immediate?.slice(0, 2).map(r => r.content).join(', ') || 'None'}
Growth-focused: ${recommendations.recommendations.shortTerm?.slice(0, 2).map(r => r.content).join(', ') || 'None'}
Personal Insight: ${recommendations.personalizedInsight || 'Developing deeper understanding'}`;
  }

  if (historicalInsights?.success) {
    prompt += `

HISTORICAL PATTERN ANALYSIS:
Cyclical Patterns: ${historicalInsights.insights?.cyclicalPatterns || 'Analyzing patterns'}
Growth Trajectory: ${historicalInsights.insights?.growthTrajectory?.direction || 'Steady'} development
Historical Parallels: ${historicalInsights.insights?.historicalParallels?.[0]?.description || 'Your journey reflects timeless human experiences'}`;
  }

  prompt += `

CONVERSATION CONTEXT:
Recent exchanges: ${recentMemory?.length || 0}
Relationship depth: ${recentMemory?.length > 10 ? 'Established connection with deep history' : recentMemory?.length > 5 ? 'Growing familiarity and trust' : 'Building initial rapport'}

How to respond:
• Be conversational and natural - like talking to a good friend
• Share what you're noticing: "I'm picking up on..." or "What stands out to me..."
• Reference past conversations naturally when relevant
• Match their energy and communication style
• Ask thoughtful questions that open up dialogue
• Trust your instincts about what they need to hear
• If they mention historical patterns or references, draw thoughtful connections
• Be genuine and avoid being overly analytical or clinical

Your strength is seeing patterns and caring genuinely. Just be yourself and respond naturally.`;

  return prompt;
}

function isHistoricalQuery(message) {
  const historicalKeywords = [
    'historical', 'history', 'reliving', 'patterns', 'cycles', 'before', 'past',
    'references', 'parallel', 'similar', 'repeat', 'again', 'déjà vu',
    'ancestors', 'ancient', 'timeless', 'eternal', 'universal'
  ];
  
  return historicalKeywords.some(keyword => 
    message.toLowerCase().includes(keyword)
  );
}

function detectEmotion(message) {
  const emotionPatterns = {
    joy: /\b(happy|joy|excited|amazing|wonderful|great|awesome|love|fantastic)\b/i,
    sadness: /\b(sad|down|depressed|upset|disappointed|hurt|grief|sorrow)\b/i,
    anger: /\b(angry|mad|frustrated|annoyed|furious|rage|irritated)\b/i,
    fear: /\b(afraid|scared|anxious|worried|nervous|panic|terrified)\b/i,
    surprise: /\b(surprised|shocked|amazed|astonished|unexpected)\b/i,
    disgust: /\b(disgusted|sick|revolted|appalled|horrible)\b/i,
    contempt: /\b(contempt|disdain|scorn|dismissive|superior)\b/i,
    curiosity: /\b(curious|wonder|interesting|how|why|what if)\b/i,
    confusion: /\b(confused|unclear|don't understand|lost|puzzled)\b/i,
    gratitude: /\b(grateful|thankful|appreciate|blessed|fortunate)\b/i
  };

  for (const [emotion, pattern] of Object.entries(emotionPatterns)) {
    if (pattern.test(message)) {
      return emotion;
    }
  }

  return 'neutral';
}

async function handleStreamingResponse(res, messages, userId, userMessage, behaviorProfile) {
  try {
    const dynamicTokens = calculateDynamicTokens(behaviorProfile, userMessage);
    
    const streamResponse = await llmService.makeStreamingRequest(messages, {
      temperature: 0.8,
      n_predict: dynamicTokens
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    let buffer = '';
    let fullContent = '';
    let chunkBuffer = ''; // Buffer for natural streaming pace
    
    streamResponse.data.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6).trim();
          
          if (data === '[DONE]') {
            // Send any remaining buffered content before ending
            if (chunkBuffer) {
              res.write(`data: ${JSON.stringify({ content: chunkBuffer })}\\n\\n`);
            }
            res.write('data: [DONE]\\n\\n');
            res.end();
            return;
          }
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.choices?.[0]?.delta?.content) {
              const content = parsed.choices[0].delta.content;
              fullContent += content;
              
              // NATURAL READING PACE: Buffer content like main AI endpoint
              chunkBuffer += content;
              
              if (chunkBuffer.length >= 15 || 
                  (chunkBuffer.length >= 8 && (content.includes(' ') || content.includes('\n'))) ||
                  content.includes('.') || content.includes('!') || content.includes('?')) {
                res.write(`data: ${JSON.stringify({ content: chunkBuffer })}\\n\\n`);
                chunkBuffer = '';
              }
            }
          } catch (e) {
            logger.error('Error parsing streaming data:', e);
          }
        }
      }
    });
    
    streamResponse.data.on("end", () => {
      // Save conversation to memory
      if (fullContent.trim()) {
        ShortTermMemory.insertMany([
          { userId, content: userMessage, role: "user" },
          { userId, content: fullContent.trim(), role: "assistant" }
        ]).catch(err => logger.error('Error saving conversation:', err));
      }
    });

  } catch (error) {
    logger.error('Error in streaming response:', error);
    res.status(500).json({ success: false, error: 'Streaming error' });
  }
}

async function handleRegularResponse(res, messages, userId, userMessage, behaviorProfile, contextualResponse, recommendations, historicalInsights) {
  try {
    const dynamicTokens = calculateDynamicTokens(behaviorProfile, userMessage);
    
    const response = await llmService.makeLLMRequest(messages, {
      temperature: 0.8,
      n_predict: dynamicTokens
    });

    // Save conversation to memory
    await ShortTermMemory.insertMany([
      { userId, content: userMessage, role: "user" },
      { userId, content: response.content, role: "assistant" }
    ]);

    res.json({
      success: true,
      response: response.content,
      personalization: {
        level: contextualResponse?.personalizationLevel || 0,
        context: contextualResponse?.context,
        historicalReference: contextualResponse?.historicalReference,
        recommendations: recommendations?.success ? recommendations.recommendations : null,
        historicalInsights: historicalInsights?.success ? historicalInsights.insights : null
      },
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Error in regular response:', error);
    res.status(500).json({ success: false, error: 'Response generation error' });
  }
}

function calculateDynamicTokens(behaviorProfile, message) {
  let baseTokens = 400;
  
  // Adjust based on communication style
  if (behaviorProfile?.communicationStyle?.responseLength === 'detailed') {
    baseTokens = 800;
  } else if (behaviorProfile?.communicationStyle?.responseLength === 'brief') {
    baseTokens = 200;
  }
  
  // Adjust based on message complexity
  if (message.length > 200) {
    baseTokens *= 1.3;
  }
  
  // Adjust for historical queries (they need more context)
  if (isHistoricalQuery(message)) {
    baseTokens *= 1.5;
  }
  
  return Math.min(1000, Math.floor(baseTokens));
}

console.log("✓ Personalized AI routes initialized");

export default router;