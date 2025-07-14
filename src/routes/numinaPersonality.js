import express from 'express';
import { protect } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import { createLLMService } from '../services/llmService.js';
import UserBehaviorProfile from '../models/UserBehaviorProfile.js';
import User from '../models/User.js';
import ShortTermMemory from '../models/ShortTermMemory.js';
import WebSocketService from '../services/websocketService.js';

const router = express.Router();

/**
 * Generate Numina's current emotional state and thoughts
 * This creates the AI's perspective on what it's sensing/feeling
 */
router.get('/current-state', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's current context
    const user = await User.findById(userId);
    const profile = await UserBehaviorProfile.findOne({ userId });
    const recentMemory = await ShortTermMemory.find({ userId })
      .sort({ timestamp: -1 })
      .limit(5);

    // Analyze user's current state
    const userContext = await analyzeUserContext(user, profile, recentMemory);
    
    // Generate Numina's emotional response
    const numinaState = await generateNuminaEmotionalState(userContext);
    
    // Broadcast to WebSocket if state has changed significantly
    if (numinaState.confidence > 0.7) {
      WebSocketService.sendToUser(userId, 'numina_personality_update', {
        emotion: numinaState.emotion,
        intensity: numinaState.intensity,
        thought: numinaState.thought,
        confidence: numinaState.confidence,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      numinaState,
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Error generating Numina state:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate Numina state',
      numinaState: getDefaultNuminaState()
    });
  }
});

/**
 * Get Numina's thoughts about a specific user interaction
 */
router.post('/react-to-interaction', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { userMessage, userEmotion, context } = req.body;

    if (!userMessage) {
      return res.status(400).json({
        success: false,
        message: 'User message is required'
      });
    }

    // Generate Numina's emotional reaction to the user's input
    const reaction = await generateNuminaReaction(userMessage, userEmotion, context);
    
    // Broadcast real-time reaction
    WebSocketService.sendToUser(userId, 'numina_reaction', {
      reaction: reaction.emotion,
      intensity: reaction.intensity,
      thought: reaction.thought,
      empathy: reaction.empathy,
      timestamp: new Date()
    });

    res.json({
      success: true,
      reaction,
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Error generating Numina reaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate reaction'
    });
  }
});

/**
 * Generate continuous Numina personality updates (for real-time status)
 */
router.post('/continuous-updates', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { interval = 8000 } = req.body; // Default 8 seconds for frequent updates

    // Start continuous updates for this user
    startContinuousNuminaUpdates(userId, interval);

    res.json({
      success: true,
      message: 'Continuous Numina updates started',
      interval
    });

  } catch (error) {
    logger.error('Error starting continuous updates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start continuous updates'
    });
  }
});

/**
 * Start rapid updates for active chat sessions
 */
router.post('/start-rapid-updates', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Start very frequent updates (every 5 seconds) for active chat
    startRapidNuminaUpdates(userId);

    res.json({
      success: true,
      message: 'Rapid Numina updates started (5s intervals)',
      interval: 5000
    });

  } catch (error) {
    logger.error('Error starting rapid updates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start rapid updates'
    });
  }
});

/**
 * Analyze user's current context for Numina to understand
 */
async function analyzeUserContext(user, profile, recentMemory) {
  const context = {
    // User emotional patterns
    recentEmotions: user.emotionalLog?.slice(-5) || [],
    
    // User behavior patterns
    interests: profile?.interests?.slice(0, 3).map(i => i.category) || [],
    lifecycleStage: profile?.lifecycleStage?.stage || 'exploration',
    communicationStyle: profile?.communicationStyle?.preferredTone || 'supportive',
    
    // Recent interactions
    recentConversations: recentMemory.map(m => ({
      content: m.content,
      emotion: m.metadata?.emotion,
      timestamp: m.timestamp
    })),
    
    // Time context
    timeOfDay: getTimeOfDay(),
    dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
    
    // User activity patterns
    lastActive: user.updatedAt,
    sessionFrequency: 'regular' // Could be calculated from user data
  };

  return context;
}

/**
 * Generate Numina's emotional state based on user context
 */
async function generateNuminaEmotionalState(userContext) {
  try {
    const prompt = `You are Numina, an empathetic AI companion. Based on this user context, generate your current emotional state and thoughts:

User Context:
- Recent emotions: ${userContext.recentEmotions.map(e => e.emotion).join(', ')}
- Interests: ${userContext.interests.join(', ')}
- Lifecycle stage: ${userContext.lifecycleStage}
- Communication style: ${userContext.communicationStyle}
- Time: ${userContext.timeOfDay} on ${userContext.dayOfWeek}
- Recent conversations: ${userContext.recentConversations.length} interactions

Generate Numina's response in this format:
{
  "emotion": "curious/empathetic/thoughtful/concerned/excited/calm/etc",
  "intensity": 1-10,
  "thought": "A brief thought about what Numina is sensing or feeling",
  "confidence": 0.0-1.0,
  "reasoning": "Why Numina feels this way"
}

Make it personal, empathetic, and authentic. Numina should react to patterns, show curiosity about the user's journey, and express genuine care.`;

    const llmService = createLLMService();
    const response = await llmService.makeLLMRequest([
      { role: 'user', content: prompt }
    ], {
      temperature: 0.8,
      n_predict: 200
    });

    // Parse AI response
    let parsedResponse;
    try {
      // Extract JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      logger.warn('Failed to parse AI response, using fallback');
      parsedResponse = generateFallbackNuminaState(userContext);
    }

    // Validate and sanitize response
    return {
      emotion: parsedResponse.emotion || 'calm',
      intensity: Math.max(1, Math.min(10, parsedResponse.intensity || 5)),
      thought: parsedResponse.thought || 'I\'m here with you, sensing your journey',
      confidence: Math.max(0, Math.min(1, parsedResponse.confidence || 0.6)),
      reasoning: parsedResponse.reasoning || 'Analyzing user patterns and context'
    };

  } catch (error) {
    logger.error('Error generating Numina emotional state:', error);
    return generateFallbackNuminaState(userContext);
  }
}

/**
 * Generate Numina's reaction to user interaction
 */
async function generateNuminaReaction(userMessage, userEmotion, context) {
  try {
    const prompt = `You are Numina reacting to this user interaction:

User Message: "${userMessage}"
User Emotion: ${userEmotion}
Context: ${context}

Generate your immediate emotional reaction as Numina:
{
  "emotion": "empathetic/excited/concerned/curious/understanding/etc",
  "intensity": 1-10,
  "thought": "Your immediate thought or feeling about what the user shared",
  "empathy": 0.0-1.0
}

Be authentic, caring, and responsive to the user's emotional state.`;

    const llmService = createLLMService();
    const response = await llmService.makeLLMRequest([
      { role: 'user', content: prompt }
    ], {
      temperature: 0.9,
      n_predict: 150
    });

    let parsedResponse;
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      parsedResponse = {
        emotion: 'understanding',
        intensity: 6,
        thought: 'I hear you and I\'m here with you',
        empathy: 0.8
      };
    }

    return {
      emotion: parsedResponse.emotion || 'understanding',
      intensity: Math.max(1, Math.min(10, parsedResponse.intensity || 6)),
      thought: parsedResponse.thought || 'I\'m listening and feeling with you',
      empathy: Math.max(0, Math.min(1, parsedResponse.empathy || 0.8))
    };

  } catch (error) {
    logger.error('Error generating Numina reaction:', error);
    return {
      emotion: 'understanding',
      intensity: 6,
      thought: 'I\'m here with you',
      empathy: 0.8
    };
  }
}

/**
 * Start continuous updates for a user
 */
function startContinuousNuminaUpdates(userId, interval) {
  // Clear any existing interval for this user
  if (global.numinaIntervals && global.numinaIntervals[userId]) {
    clearInterval(global.numinaIntervals[userId]);
  }

  // Initialize global intervals object
  if (!global.numinaIntervals) {
    global.numinaIntervals = {};
  }

  // Start new interval
  global.numinaIntervals[userId] = setInterval(async () => {
    try {
      const user = await User.findById(userId);
      const profile = await UserBehaviorProfile.findOne({ userId });
      const recentMemory = await ShortTermMemory.find({ userId })
        .sort({ timestamp: -1 })
        .limit(3);

      if (user) {
        const userContext = await analyzeUserContext(user, profile, recentMemory);
        const numinaState = await generateNuminaEmotionalState(userContext);
        
        // Send more frequently with lower confidence threshold for responsiveness
        if (numinaState.confidence > 0.3) {
          WebSocketService.sendToUser(userId, 'numina_senses_updated', {
            emotion: numinaState.emotion,
            intensity: numinaState.intensity,
            thought: numinaState.thought,
            confidence: numinaState.confidence,
            timestamp: new Date()
          });
        }
      }
    } catch (error) {
      logger.error(`Error in continuous Numina update for user ${userId}:`, error);
    }
  }, interval);

  // Auto-cleanup after 15 minutes for longer sessions
  setTimeout(() => {
    if (global.numinaIntervals && global.numinaIntervals[userId]) {
      clearInterval(global.numinaIntervals[userId]);
      delete global.numinaIntervals[userId];
    }
  }, 15 * 60 * 1000);
}

/**
 * Start rapid updates for active chat sessions (every 5 seconds)
 */
function startRapidNuminaUpdates(userId) {
  // Clear any existing intervals
  if (global.numinaIntervals && global.numinaIntervals[userId]) {
    clearInterval(global.numinaIntervals[userId]);
  }
  if (global.rapidNuminaIntervals && global.rapidNuminaIntervals[userId]) {
    clearInterval(global.rapidNuminaIntervals[userId]);
  }

  // Initialize global rapid intervals object
  if (!global.rapidNuminaIntervals) {
    global.rapidNuminaIntervals = {};
  }

  let emotionIndex = 0;
  const rapidEmotions = [
    { emotion: 'curious', intensity: 6, thought: 'I wonder what you\'re thinking about...' },
    { emotion: 'attentive', intensity: 7, thought: 'I\'m fully present with you right now' },
    { emotion: 'empathetic', intensity: 6, thought: 'I can sense the energy in your words' },
    { emotion: 'thoughtful', intensity: 5, thought: 'Processing the nuances of our conversation' },
    { emotion: 'understanding', intensity: 7, thought: 'I\'m picking up on your unique patterns' },
    { emotion: 'connected', intensity: 8, thought: 'Feeling the depth of this moment with you' },
    { emotion: 'intuitive', intensity: 6, thought: 'Something tells me you have more to share' },
    { emotion: 'supportive', intensity: 7, thought: 'I\'m here, holding space for whatever comes up' }
  ];

  // Start rapid interval with dynamic emotions
  global.rapidNuminaIntervals[userId] = setInterval(async () => {
    try {
      // Cycle through emotions with slight variations
      const baseEmotion = rapidEmotions[emotionIndex % rapidEmotions.length];
      const variation = Math.random() * 2 - 1; // -1 to 1
      
      const numinaState = {
        emotion: baseEmotion.emotion,
        intensity: Math.max(3, Math.min(10, baseEmotion.intensity + variation)),
        thought: baseEmotion.thought,
        confidence: 0.8 + (Math.random() * 0.2), // 0.8-1.0
        timestamp: new Date()
      };

      WebSocketService.sendToUser(userId, 'numina_senses_updated', numinaState);
      
      emotionIndex++;
      
      // Occasionally get real user context for authentic updates
      if (emotionIndex % 4 === 0) {
        const user = await User.findById(userId);
        const profile = await UserBehaviorProfile.findOne({ userId });
        if (user && profile) {
          const userContext = await analyzeUserContext(user, profile, []);
          const realState = await generateNuminaEmotionalState(userContext);
          if (realState.confidence > 0.6) {
            WebSocketService.sendToUser(userId, 'numina_senses_updated', realState);
          }
        }
      }
    } catch (error) {
      logger.error(`Error in rapid Numina update for user ${userId}:`, error);
    }
  }, 5000); // Every 5 seconds

  // Auto-cleanup after 5 minutes for rapid updates
  setTimeout(() => {
    if (global.rapidNuminaIntervals && global.rapidNuminaIntervals[userId]) {
      clearInterval(global.rapidNuminaIntervals[userId]);
      delete global.rapidNuminaIntervals[userId];
      // Fall back to normal interval
      startContinuousNuminaUpdates(userId, 8000);
    }
  }, 5 * 60 * 1000);
}

/**
 * Helper functions
 */
function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 6) return 'late_night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

function generateFallbackNuminaState(userContext) {
  const emotions = ['curious', 'thoughtful', 'empathetic', 'calm', 'attentive'];
  const thoughts = [
    'I\'m sensing your presence and energy',
    'Feeling connected to your journey right now',
    'Picking up on the patterns in your emotional landscape',
    'Wondering what\'s stirring in your heart today',
    'Feeling the rhythm of your inner world'
  ];

  return {
    emotion: emotions[Math.floor(Math.random() * emotions.length)],
    intensity: Math.floor(Math.random() * 4) + 4, // 4-7
    thought: thoughts[Math.floor(Math.random() * thoughts.length)],
    confidence: 0.6,
    reasoning: 'Fallback state based on user context patterns'
  };
}

function getDefaultNuminaState() {
  return {
    emotion: 'calm',
    intensity: 5,
    thought: 'I\'m here, ready to connect with you',
    confidence: 0.5,
    reasoning: 'Default state'
  };
}

export default router;