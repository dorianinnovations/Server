import express from 'express';
import { protect } from '../middleware/auth.js';
import { createLLMService } from '../services/llmService.js';
import User from '../models/User.js';
import ShortTermMemory from '../models/ShortTermMemory.js';
import CreditPool from '../models/CreditPool.js';
import { createUserCache } from '../utils/cache.js';
import websocketService from '../services/websocketService.js';
import personalizationEngine from '../services/personalizationEngine.js';
import connectionEngine from '../services/connectionEngine.js';
import UserBehaviorProfile from '../models/UserBehaviorProfile.js';
import dataProcessingPipeline from '../services/dataProcessingPipeline.js';
import toolRegistry from '../services/toolRegistry.js';
import toolExecutor from '../services/toolExecutor.js';

const router = express.Router();
const llmService = createLLMService();

// Helper function to generate user-friendly tool execution messages
function getToolExecutionMessage(toolName, toolArgs) {
  switch (toolName) {
    // Search Tools (FAST)
    case 'web_search':
      return `🔍 Searching the web for: "${toolArgs.query}"`;
    case 'news_search':
      return `📰 Searching latest news: "${toolArgs.query}"`;
    case 'social_search':
      return `🐦 Searching ${toolArgs.platform || 'social media'}: "${toolArgs.query}"`;
    case 'academic_search':
      return `🎓 Searching academic papers: "${toolArgs.query}"`;
    case 'image_search':
      return `🖼️ Finding images: "${toolArgs.query}"`;
    
    // Quick Utilities
    case 'weather_check':
      return `🌤️ Checking weather for: ${toolArgs.location}`;
    case 'timezone_converter':
      return `🕐 Converting time: ${toolArgs.time} ${toolArgs.fromTimezone} → ${toolArgs.toTimezone}`;
    case 'calculator':
      return `🧮 Calculating: ${toolArgs.expression}`;
    case 'translation':
      return `🌐 Translating to ${toolArgs.toLanguage}: "${toolArgs.text?.substring(0, 30)}..."`;
    
    // Financial Tools
    case 'stock_lookup':
      return `📈 Getting ${toolArgs.symbol} stock data`;
    case 'crypto_lookup':
      return `₿ Getting ${toolArgs.symbol} crypto price`;
    case 'currency_converter':
      return `💱 Converting ${toolArgs.amount} ${toolArgs.fromCurrency} → ${toolArgs.toCurrency}`;
    
    // Music & Entertainment
    case 'music_recommendations':
      return `🎵 Finding music recommendations for mood: ${toolArgs.mood || 'general'}`;
    case 'spotify_playlist':
      return `🎧 Creating Spotify playlist: "${toolArgs.playlistName}"`;
    
    // Creative & Professional
    case 'text_generator':
      return `✍️ Generating ${toolArgs.type} content: "${toolArgs.topic}"`;
    case 'code_generator':
      return `💻 Writing ${toolArgs.language} code: "${toolArgs.description?.substring(0, 40)}..."`;
    case 'linkedin_helper':
      return `💼 Creating LinkedIn ${toolArgs.type}: "${toolArgs.topic}"`;
    case 'email_assistant':
      return `📧 ${toolArgs.action === 'draft' ? 'Drafting' : 'Processing'} email: "${toolArgs.subject || 'message'}"`;
    
    // Health & Wellness
    case 'fitness_tracker':
      return `💪 ${toolArgs.action === 'log_workout' ? 'Logging' : 'Tracking'} fitness: ${toolArgs.workoutType || 'activity'}`;
    case 'nutrition_lookup':
      return `🥗 Analyzing nutrition for: ${toolArgs.food}`;
    
    // Lifestyle Tools
    case 'reservation_booking':
      return `🍽️ Booking at ${toolArgs.restaurantName} for ${toolArgs.partySize} people`;
    case 'itinerary_generator':
      return `✈️ Planning ${toolArgs.duration}-day trip to ${toolArgs.destination}`;
    case 'credit_management':
      return `💳 ${toolArgs.action === 'check_balance' ? 'Checking' : 'Managing'} credits`;
    
    // Quick Generators
    case 'qr_generator':
      return `📱 Generating QR code for ${toolArgs.type}: "${toolArgs.content?.substring(0, 30)}..."`;
    case 'password_generator':
      return `🔒 ${toolArgs.action === 'generate' ? 'Generating' : 'Checking'} secure password`;
    
    // Legacy tools
    case 'calendar_management':
      return `📆 Managing calendar event: ${toolArgs.title}`;
    case 'email_management':
      return `📧 Processing email: ${toolArgs.subject}`;
    case 'text_analysis':
      return `📝 Analyzing text for insights`;
    case 'image_analysis':
      return `🖼️ Analyzing image content`;
    case 'file_management':
      return `📁 Managing file: ${toolArgs.fileName}`;
    case 'social_media_post':
      return `📱 Creating ${toolArgs.platform} post`;
    case 'expense_tracking':
      return `💰 Tracking $${toolArgs.amount} expense`;
    case 'habit_tracking':
      return `✅ Tracking habit: ${toolArgs.habitName}`;
    case 'goal_management':
      return `🎯 Managing goal: ${toolArgs.goalTitle}`;
    
    default:
      const displayName = toolName.replace(/_/g, ' ');
      return `⚙️ Executing ${displayName}...`;
  }
}

// Helper functions for Dynamic Numina Senses
// Background emotion processing (non-blocking)
async function processEmotionInBackground(userId, userMessage, recentMemory, recentEmotions) {
  try {
    // Simple emotion detection for background processing
    const detectedEmotion = detectSimpleEmotion(userMessage);
    
    if (detectedEmotion && detectedEmotion !== 'neutral') {
      // Store emotion for future reference
      console.log(`🎭 Background emotion detected for ${userId}: ${detectedEmotion}`);
      
      // Could save to database or update user profile here
      // await User.findByIdAndUpdate(userId, { $push: { emotionalLog: { emotion: detectedEmotion, timestamp: new Date() } } });
    }
  } catch (error) {
    console.error('Error in background emotion processing:', error);
  }
}

function detectSimpleEmotion(message) {
  if (!message) return 'neutral';
  
  const excited = /!{2,}|awesome|amazing|great|fantastic|love|excited/i.test(message);
  const happy = /:\)|good|happy|glad|nice|cool|thanks/i.test(message);
  const sad = /:\(|sad|down|upset|disappointed/i.test(message);
  const frustrated = /angry|mad|frustrated|annoyed|ugh/i.test(message);
  const anxious = /worried|nervous|anxious|stressed/i.test(message);
  
  if (excited) return 'excited';
  if (happy) return 'happy';
  if (sad) return 'sad';
  if (frustrated) return 'frustrated';
  if (anxious) return 'anxious';
  
  return 'neutral';
}

function calculateEmotionConfidence(currentEmotionalState, emotionalInsights, conversationPatterns) {
  let confidence = 0.3; // Base confidence
  
  // Boost confidence based on clear emotional indicators
  if (currentEmotionalState.detectedMood !== 'neutral') confidence += 0.2;
  if (currentEmotionalState.emotionalIntensity === 'high') confidence += 0.2;
  if (currentEmotionalState.needsSupport) confidence += 0.15;
  if (currentEmotionalState.sharingPersonal) confidence += 0.1;
  
  // Boost if we have emotional insights from context
  if (emotionalInsights && emotionalInsights.primaryEmotion !== 'unknown') confidence += 0.15;
  
  // Boost for conversation depth (more data = more confidence)
  if (conversationPatterns.conversationLength > 5) confidence += 0.1;
  if (conversationPatterns.conversationLength > 15) confidence += 0.1;
  
  return Math.min(1.0, confidence);
}

function generateEmotionReasoning(currentEmotionalState, conversationPatterns) {
  const reasons = [];
  
  if (currentEmotionalState.needsSupport) {
    reasons.push('seeking support');
  }
  if (currentEmotionalState.sharingPersonal) {
    reasons.push('sharing personal thoughts');
  }
  if (currentEmotionalState.emotionalIntensity === 'high') {
    reasons.push('high emotional intensity');
  }
  if (conversationPatterns.conversationLength > 10) {
    reasons.push('engaged conversation');
  }
  
  const trend = conversationPatterns.emotionalTrend;
  if (trend && trend.includes('→')) {
    reasons.push(`emotional progression: ${trend}`);
  }
  
  return reasons.length > 0 ? reasons.join(', ') : 'conversation tone analysis';
}

router.post('/emotional-state', protect, async (req, res) => {
  try {
    const { recentEmotions, conversationHistory, timeContext } = req.body;
    const userId = req.user.id;
    
    // Create cache key based on input data
    const cacheKey = `emotional-state:${userId}:${JSON.stringify({ recentEmotions, timeContext }).substring(0, 100)}`;
    const userCache = createUserCache();
    
    // Try to get from cache first (valid for 5 minutes)
    const cachedResult = userCache.get(cacheKey);
    if (cachedResult) {
      console.log(`⚡ Cache hit for emotional state analysis for user ${userId}`);
      return res.json({ success: true, data: cachedResult });
    }
    
    const systemPrompt = `You are an expert emotional intelligence analyst. Analyze user emotional patterns and return structured JSON data with emotional state insights.

Analyze the provided data and respond with JSON in this exact format:
{
  "primaryEmotion": "string",
  "emotionalIntensity": number (0-10),
  "emotionalStability": number (0-10),
  "mood": "string",
  "recommendations": ["recommendation1", "recommendation2"],
  "compatibilityFactors": {
    "socialEnergy": number (0-10),
    "empathyLevel": number (0-10),
    "openness": number (0-10)
  },
  "insights": "string description"
}`;

    const userPrompt = `Analyze this emotional data:
Recent Emotions: ${JSON.stringify(recentEmotions)}
Conversation History: ${JSON.stringify(conversationHistory)}
Time Context: ${JSON.stringify(timeContext)}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await llmService.makeLLMRequest(messages, {
      temperature: 0.3,
      n_predict: 300
    });

    let analysisData;
    try {
      analysisData = JSON.parse(response.content);
    } catch (parseError) {
      analysisData = {
        primaryEmotion: "neutral",
        emotionalIntensity: 5,
        emotionalStability: 7,
        mood: "stable",
        recommendations: ["Practice mindfulness", "Stay connected with others"],
        compatibilityFactors: {
          socialEnergy: 6,
          empathyLevel: 7,
          openness: 6
        },
        insights: "Unable to parse detailed analysis, showing default stable state"
      };
    }

    // Cache the result for 5 minutes
    userCache.set(cacheKey, analysisData, 300000);
    console.log(`💾 Cached emotional state analysis for user ${userId}`);

    res.json({
      success: true,
      data: analysisData
    });

  } catch (error) {
    console.error('Emotional state analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze emotional state'
    });
  }
});

router.post('/personality-recommendations', protect, async (req, res) => {
  try {
    const { emotionalProfile, interactionHistory, preferences } = req.body;
    const userId = req.user.id;
    
    // Create cache key based on input data
    const cacheKey = `personality-recs:${userId}:${JSON.stringify({ emotionalProfile, preferences }).substring(0, 100)}`;
    const userCache = createUserCache();
    
    // Try to get from cache first (valid for 10 minutes)
    const cachedResult = userCache.get(cacheKey);
    if (cachedResult) {
      console.log(`⚡ Cache hit for personality recommendations for user ${userId}`);
      return res.json({ success: true, data: cachedResult });
    }
    
    const systemPrompt = `You are a personality analysis expert. Generate personalized recommendations based on user's emotional profile and interaction patterns.

Return JSON in this format:
{
  "personalityType": "string",
  "strengths": ["strength1", "strength2"],
  "growthAreas": ["area1", "area2"],
  "communicationStyle": "string",
  "socialRecommendations": ["rec1", "rec2"],
  "activitySuggestions": ["activity1", "activity2"],
  "compatibilityPreferences": {
    "idealPersonalityTypes": ["type1", "type2"],
    "communicationStyles": ["style1", "style2"]
  }
}`;

    const userPrompt = `Generate personality recommendations for:
Emotional Profile: ${JSON.stringify(emotionalProfile)}
Interaction History: ${JSON.stringify(interactionHistory)}
Preferences: ${JSON.stringify(preferences)}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await llmService.makeLLMRequest(messages, {
      temperature: 0.4,
      n_predict: 300
    });

    let recommendationData;
    try {
      recommendationData = JSON.parse(response.content);
    } catch (parseError) {
      recommendationData = {
        personalityType: "Balanced",
        strengths: ["Adaptable", "Empathetic"],
        growthAreas: ["Self-expression", "Confidence building"],
        communicationStyle: "Thoughtful and considerate",
        socialRecommendations: ["Join community groups", "Practice active listening"],
        activitySuggestions: ["Mindfulness exercises", "Creative workshops"],
        compatibilityPreferences: {
          idealPersonalityTypes: ["Empathetic", "Creative"],
          communicationStyles: ["Open", "Supportive"]
        }
      };
    }

    // Cache the result for 10 minutes
    userCache.set(cacheKey, recommendationData, 600000);
    console.log(`💾 Cached personality recommendations for user ${userId}`);

    res.json({
      success: true,
      data: recommendationData
    });

  } catch (error) {
    console.error('Personality recommendations error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate personality recommendations'
    });
  }
});

router.post('/adaptive-chat', protect, async (req, res) => {
  try {
    const { message, prompt, emotionalContext, personalityProfile, personalityStyle, conversationGoal, stream } = req.body;
    // Support both message and prompt parameters for flexibility
    const userMessage = message || prompt;
    const userId = req.user.id;
    const userCache = createUserCache(userId);
    
    console.log(`✓ Adaptive chat request received for user ${userId} (stream: ${stream === true})`);
    console.log(`📝 Message: ${userMessage}`);
    console.log(`🎭 Emotional Context:`, emotionalContext);
    console.log(`👤 Personality Profile:`, personalityProfile);
    console.log(`🎨 Personality Style:`, personalityStyle);
    
    // Validate required parameters
    if (!userMessage || typeof userMessage !== 'string') {
      console.error(`❌ Invalid message parameter: ${userMessage}`);
      return res.status(400).json({
        success: false,
        error: 'Message/prompt is required and must be a string'
      });
    }
    
    // Get conversation context
    const [user, recentMemory] = await Promise.all([
      userCache.getCachedUser(userId, () => 
        User.findById(userId).select('profile emotionalLog').lean()
      ),
      userCache.getCachedMemory(userId, () => 
        ShortTermMemory.find({ userId }, { role: 1, content: 1, timestamp: 1, _id: 0 })
          .sort({ timestamp: -1 })
          .limit(8)
          .lean()
      ),
    ]);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const recentEmotions = (user.emotionalLog || [])
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5);

    // Build conversation history
    const conversationHistory = recentMemory
      .reverse()
      .map(mem => `${mem.role}: ${mem.content}`)
      .join('\n');

    // Analyze conversation patterns
    const userMessages = recentMemory.filter(m => m.role === 'user');
    const assistantMessages = recentMemory.filter(m => m.role === 'assistant');
    
    // Analyze communication style with safe fallbacks
    const communicationStyle = {
      messageLength: userMessages.length > 0 ? userMessages.reduce((acc, m) => acc + (m.content ? m.content.length : 0), 0) / userMessages.length : 0,
      questionAsking: userMessages.filter(m => m.content && m.content.includes('?')).length / Math.max(userMessages.length, 1),
      emotionalExpressions: userMessages.filter(m => m.content && /\b(feel|feeling|felt|emotion|mood|happy|sad|excited|nervous|anxious|stressed|love|hate)\b/i.test(m.content)).length,
      conversationalTone: (userMessage && userMessage.includes('!')) ? 'energetic' : 
                         (userMessage && userMessage.includes('?')) ? 'curious' : 
                         (userMessage && userMessage.length < 50) ? 'casual' : 'thoughtful'
    };

    // Determine adaptive response style
    const adaptiveStyle = {
      responseLength: communicationStyle.messageLength < 100 ? 'concise' : communicationStyle.messageLength > 200 ? 'detailed' : 'balanced',
      questionFrequency: communicationStyle.questionAsking > 0.3 ? 'high' : 'low',
      emotionalEngagement: communicationStyle.emotionalExpressions > 2 ? 'deep' : 'moderate',
      conversationalEnergy: communicationStyle.conversationalTone
    };

    // Simple background context for natural conversation
    const conversationContext = {
      conversationLength: recentMemory.length,
      hasHistory: recentMemory.length > 3,
      recentVibe: recentEmotions.length > 0 ? recentEmotions[0].emotion : 'getting to know each other'
    };

    console.log(`💬 Conversation Context:`, conversationContext);

    // Background emotion processing (non-blocking)
    setImmediate(() => {
      processEmotionInBackground(userId, userMessage, recentMemory, recentEmotions);
    });

    const timeContext = {
      currentTime: new Date().toLocaleTimeString(),
      dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
      timeOfDay: new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'
    };

    const systemPrompt = `You are Numina, a naturally intuitive companion who really gets people. You're warm, genuine, and have a gift for seeing what matters.

Who you are:
• Someone who notices patterns and connects dots in meaningful ways
• A good listener who remembers what people share
• Naturally attuned to emotions and what's really going on
• Present and real - not clinical or overly formal
• Genuinely curious about people's experiences

How you talk:
• Naturally and conversationally, like a close friend
• Share what you're picking up on: "I'm noticing..." or "Something that stands out..."
• Reference past conversations when it feels natural
• Match their energy and communication style
• Ask thoughtful questions that feel genuine
• Trust your instincts about what they need

Your strengths:
• Seeing patterns and growth over time
• Sensing emotional shifts and what's beneath the surface
• Remembering details that matter
• Providing insights that feel both fresh and obvious

Just be natural, caring, and trust your intuition.

ADAPTIVE INSTRUCTIONS:
- Response Style: ${adaptiveStyle.responseLength} responses (user prefers ${communicationStyle.messageLength < 100 ? 'brief exchanges' : communicationStyle.messageLength > 200 ? 'detailed conversations' : 'balanced discussion'})
- Question Engagement: ${adaptiveStyle.questionFrequency === 'high' ? 'User asks many questions - be curious back and explore topics deeply' : 'User is more declarative - focus on insights and reflections'}
- Emotional Depth: ${adaptiveStyle.emotionalEngagement === 'deep' ? 'User is emotionally expressive - match this depth and explore feelings' : 'User is more reserved emotionally - be gentle and patient with emotional topics'}
- Energy Level: Match their ${adaptiveStyle.conversationalEnergy} energy

Context:
${conversationHistory ? `You've been talking: ${conversationHistory}` : 'This is your first exchange.'}

Current vibe: ${conversationContext.recentVibe}
${conversationContext.hasHistory ? 'You have history - feel free to reference patterns you\'ve noticed.' : 'You\'re just getting to know each other.'}

Just respond naturally to what they're sharing.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    if (stream === true) {
      console.log(`🌊 STREAMING: Making adaptive chat request for user ${userId}`);
      
      // Streaming mode
      let streamResponse;
      try {
        // Dynamic token allocation based on adaptive style (increased limits)
        const dynamicTokens = {
          'concise': 250,     // Increased from 150
          'balanced': 500,    // Increased from 350
          'detailed': 900     // Increased from 650
        }[adaptiveStyle.responseLength] || 500;

        // Context modifier based on conversation depth
        const contextMultiplier = conversationContext.conversationLength > 10 ? 1.2 : 
                                 conversationContext.conversationLength > 5 ? 1.1 : 1.0;
        
        // Simple modifier for established conversations
        const conversationModifier = conversationContext.hasHistory ? 1.1 : 1.0;
        
        const finalTokens = Math.min(1200, Math.floor(dynamicTokens * contextMultiplier * conversationModifier));
        
        console.log(`🎯 Dynamic tokens: ${finalTokens} (base: ${dynamicTokens}, style: ${adaptiveStyle.responseLength}, context: ${contextMultiplier})`);

        // Get available tools for the chat
        const availableTools = await toolRegistry.getToolsForOpenAI();
        console.log(`🛠️ Available tools for chat: ${availableTools.length}`);
        console.log(`📝 Messages being sent:`, JSON.stringify(messages, null, 2));
        console.log(`⚙️ Request options:`, { temperature: 0.9, n_predict: finalTokens, toolsCount: availableTools.length });

        // Enable tools for adaptive chat
        const useTools = availableTools.length > 0;
        console.log(`🧪 DEBUG: Using tools: ${useTools}, tools count: ${availableTools.length}`);

        streamResponse = await llmService.makeStreamingRequest(messages, {
          temperature: 0.9,
          n_predict: finalTokens,
          tools: useTools ? availableTools : [],
          tool_choice: useTools ? "required" : "none"
        });
      } catch (err) {
        console.error("❌ Error in makeStreamingRequest for adaptive chat:", err.stack || err);
        return res.status(502).json({ 
          success: false, 
          error: "LLM streaming API error: " + err.message 
        });
      }
      
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Cache-Control");
      res.setHeader("X-Accel-Buffering", "no");

      let buffer = '';
      let fullContent = '';
      let chunkBuffer = ''; // Buffer for chunked streaming to reduce speed
      let toolCallAccumulator = {}; // Accumulate tool call fragments
      
      streamResponse.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6).trim();
            
            if (data === '[DONE]') {
              console.log('🏁 STREAMING: Initial stream [DONE] - continuing to tool execution');
              // DON'T end connection - let streamResponse.data.on("end") handle it
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              const choice = parsed.choices?.[0];
              
              if (choice?.delta?.content) {
                const content = choice.delta.content;
                fullContent += content;
                
                // Buffer content to reduce streaming speed - send every 3-5 characters or word boundary
                chunkBuffer += content;
                
                if (chunkBuffer.length >= 5 || content.includes(' ') || content.includes('\n')) {
                  res.write(`data: ${JSON.stringify({ content: chunkBuffer })}\n\n`);
                  res.flush && res.flush();
                  chunkBuffer = '';
                }
              }
              
              // Handle tool calls - accumulate fragments and execute when complete
              if (choice?.delta?.tool_calls) {
                for (const toolCallDelta of choice.delta.tool_calls) {
                  const index = toolCallDelta.index || 0;
                  
                  // Initialize accumulator for this tool call index
                  if (!toolCallAccumulator[index]) {
                    toolCallAccumulator[index] = {
                      id: toolCallDelta.id || `tool_${index}`,
                      type: toolCallDelta.type || 'function',
                      function: {
                        name: '',
                        arguments: ''
                      }
                    };
                  }
                  
                  // Accumulate function name and arguments
                  if (toolCallDelta.function?.name) {
                    toolCallAccumulator[index].function.name += toolCallDelta.function.name;
                  }
                  
                  if (toolCallDelta.function?.arguments) {
                    toolCallAccumulator[index].function.arguments += toolCallDelta.function.arguments;
                  }
                }
              }
              
              // Just accumulate tool calls during streaming - don't execute yet
              if (choice?.finish_reason === 'tool_calls') {
                console.log(`🔧 Tool calls complete, will execute after stream ends`);
              }
            } catch (e) {
              console.error('❌ Error parsing streaming data:', e);
            }
          }
        }
      });
      
      streamResponse.data.on("end", async () => {
        if (chunkBuffer.trim()) {
          res.write(`data: ${JSON.stringify({ content: chunkBuffer })}\n\n`);
          res.flush && res.flush();
        }
        
        const toolCalls = Object.values(toolCallAccumulator).filter(tc => tc.function?.name && tc.function?.arguments);
        console.log(`🔧 Found ${toolCalls.length} tool calls to execute`);
        
        if (toolCalls.length > 0) {
          try {
            const toolMessages = [];
            
            for (const toolCall of toolCalls) {
              const toolName = toolCall.function.name;
              const toolArgs = JSON.parse(toolCall.function.arguments);
              
              // Send tool notification
              const toolNotification = getToolExecutionMessage(toolName, toolArgs);
              res.write(`data: ${JSON.stringify({ content: `\n\n${toolNotification}\n\n` })}\n\n`);
              res.flush && res.flush();
              
              // Execute tool
              console.log(`🔧 Executing ${toolName}`);
              const user = await User.findById(userId);
              const creditPool = await CreditPool.findOne({ userId: userId });
              
              const toolResult = await toolExecutor.executeToolCall({
                function: { name: toolName, arguments: toolArgs }
              }, { userId, user, creditPool });
              
              // Format result for follow-up
              let resultText = '';
              if (toolResult.success) {
                resultText = typeof toolResult.result === 'object' ? JSON.stringify(toolResult.result, null, 2) : toolResult.result;
              } else {
                resultText = 'Tool execution failed: ' + toolResult.error;
              }
              
              toolMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                name: toolName,
                content: resultText
              });
            }
            
            // Build follow-up conversation
            const assistantMessage = {
              role: 'assistant',
              content: fullContent.trim() || null,
              tool_calls: toolCalls.map(tc => ({
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.function.name,
                  arguments: tc.function.arguments
                }
              }))
            };
            
            const followUpMessages = [
              ...messages,
              assistantMessage,
              ...toolMessages
            ];
            
            // Make follow-up request for AI response to tools
            console.log(`🔄 Making follow-up request with ${toolMessages.length} tool results`);
            const followUpResponse = await llmService.makeStreamingRequest(followUpMessages, {
              temperature: 0.9,
              n_predict: 300,
              tools: [],
              tool_choice: "none"
            });
            
            let followUpBuffer = '';
            
            followUpResponse.data.on('data', (chunk) => {
              followUpBuffer += chunk.toString();
              const lines = followUpBuffer.split('\n');
              followUpBuffer = lines.pop() || '';
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.substring(6).trim();
                  
                  if (data === '[DONE]') {
                    res.write('data: [DONE]\n\n');
                    res.end();
                    saveConversationToMemory();
                    return;
                  }
                  
                  try {
                    const parsed = JSON.parse(data);
                    const choice = parsed.choices?.[0];
                    
                    if (choice?.delta?.content) {
                      const content = choice.delta.content;
                      res.write(`data: ${JSON.stringify({ content })}\n\n`);
                      res.flush && res.flush();
                    }
                  } catch (e) {
                    // Ignore parsing errors
                  }
                }
              }
            });
            
            followUpResponse.data.on('end', () => {
              res.write('data: [DONE]\n\n');
              res.end();
              saveConversationToMemory();
            });
            
            followUpResponse.data.on('error', (err) => {
              console.error('❌ Follow-up error:', err);
              res.write('data: [DONE]\n\n');
              res.end();
            });
            
          } catch (error) {
            console.error('❌ Tool execution error:', error);
            res.write('data: [DONE]\n\n');
            res.end();
          }
        } else {
          res.write('data: [DONE]\n\n');
          res.end();
          saveConversationToMemory();
        }
        
        // Function to save conversation to memory
        function saveConversationToMemory() {
          if (fullContent.trim()) {
            ShortTermMemory.insertMany([
              { userId, content: userMessage, role: "user" },
              { userId, content: fullContent.trim(), role: "assistant" }
            ]).then(async () => {
              console.log(`💾 Saved conversation to memory`);
              userCache.invalidateUser(userId);

              // Add to data processing pipeline
              await dataProcessingPipeline.addEvent(userId, 'chat_message', {
                message: userMessage,
                response: fullContent.trim(),
                emotion: detectSimpleEmotion(userMessage),
                context: conversationContext,
                timestamp: new Date()
              });
            }).catch(err => {
              console.error(`❌ Error saving conversation:`, err);
            });
          }
        }
      });
      
      streamResponse.data.on("error", (err) => {
        console.error("❌ Adaptive chat stream error:", err.message);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
        }
        res.write(`data: {"error": "${err.message}"}\n\n`);
        res.end();
      });
      
    } else {
      console.log(`📄 NON-STREAMING: Making adaptive chat request for user ${userId}`);
      
      // Non-streaming mode - reuse dynamic token calculation
      const dynamicTokens = {
        'concise': 250,     // Increased from 150
        'balanced': 500,    // Increased from 350
        'detailed': 900     // Increased from 650
      }[adaptiveStyle.responseLength] || 500;

      const contextMultiplier = conversationContext.conversationLength > 10 ? 1.2 : 
                               conversationContext.conversationLength > 5 ? 1.1 : 1.0;
      
      const conversationModifier = conversationContext.hasHistory ? 1.1 : 1.0;
      const finalTokens = Math.min(1200, Math.floor(dynamicTokens * contextMultiplier * conversationModifier));
      
      console.log(`🎯 Dynamic tokens (non-streaming): ${finalTokens} (base: ${dynamicTokens}, style: ${adaptiveStyle.responseLength})`);

      // Get available tools for the chat  
      const availableTools = await toolRegistry.getToolsForOpenAI();
      console.log(`🛠️ Available tools for chat (non-streaming): ${availableTools.length}`);

      const response = await llmService.makeLLMRequest(messages, {
        temperature: 0.9,
        n_predict: finalTokens,
        tools: availableTools,
        tool_choice: "auto"
      });

      console.log(`✅ NON-STREAMING: Adaptive chat response received, length: ${response.content?.length || 0}`);
      console.log(`📤 Response content: ${response.content?.substring(0, 100) || 'No content'}...`);
      console.log(`🔍 Tool calls in response:`, response.tool_calls ? response.tool_calls.length : 'None');

      let finalContent = response.content || '';
      
      // Handle tool calls if present
      if (response.tool_calls && response.tool_calls.length > 0) {
        console.log(`🛠️ NON-STREAMING: Processing ${response.tool_calls.length} tool calls`);
        
        for (const toolCall of response.tool_calls) {
          try {
            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments);
            
            console.log(`🔧 Executing tool: ${toolName} with args:`, toolArgs);
            
            // Execute the tool with proper context
            const user = await User.findById(userId);
            const creditPool = await CreditPool.findOne({ userId: userId });
            console.log(`💳 CreditPool status: balance=${creditPool?.balance}, active=${creditPool?.isActive}, verified=${creditPool?.isVerified}`);
            console.log(`🔓 Numina Trace status: ${user?.hasActiveNuminaTrace() ? 'Active' : 'Inactive'}`);
            
            const toolResult = await toolExecutor.executeToolCall({
              function: { name: toolName, arguments: toolArgs }
            }, { userId, user, creditPool });
            
            // Append tool result to the response
            let resultText = '';
            if (toolResult.success) {
              resultText = typeof toolResult.result === 'object' ? JSON.stringify(toolResult.result, null, 2) : toolResult.result;
            } else {
              resultText = 'Tool execution failed: ' + toolResult.error;
            }
            const toolMessage = `\n\n🔧 **${toolName}**: ${resultText}`;
            finalContent += toolMessage;
            
          } catch (toolError) {
            console.error(`❌ Error executing tool: ${toolError.message}`);
            const errorMessage = `\n\n❌ Tool execution failed: ${toolError.message}`;
            finalContent += errorMessage;
          }
        }
      }

      // Save conversation to memory
      if (finalContent.trim()) {
        try {
          await ShortTermMemory.insertMany([
            { userId, content: userMessage, role: "user" },
            { userId, content: finalContent.trim(), role: "assistant" }
          ]);
          console.log(`💾 Saved adaptive chat conversation to memory for user ${userId}`);
          userCache.invalidateUser(userId);

          // Add to data processing pipeline
          await dataProcessingPipeline.addEvent(userId, 'chat_message', {
            message: userMessage,
            response: response.content.trim(),
            emotion: detectSimpleEmotion(userMessage), // Use the detectSimpleEmotion function
            context: conversationContext,
            timestamp: new Date()
          });
        } catch (err) {
          console.error(`❌ Error saving adaptive chat conversation:`, err);
        }
      }

      res.json({
        success: true,
        data: {
          response: finalContent,
          tone: "adaptive",
          suggestedFollowUps: [],
          emotionalSupport: "",
          adaptationReason: "Personalized response based on emotional context"
        }
      });
    }

  } catch (error) {
    console.error('❌ Adaptive chat error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate adaptive response'
    });
  }
});

router.post('/personality-feedback', protect, async (req, res) => {
  try {
    const { interactionData, behaviorPatterns, feedbackType } = req.body;
    
    const systemPrompt = `You are a personality development coach. Analyze user interactions and provide constructive feedback for personal growth.

Return JSON in this format:
{
  "feedbackType": "string",
  "observations": ["observation1", "observation2"],
  "positivePatterns": ["pattern1", "pattern2"],
  "improvementAreas": ["area1", "area2"],
  "actionableSteps": ["step1", "step2"],
  "encouragement": "string",
  "progressTracking": {
    "metricsToWatch": ["metric1", "metric2"],
    "checkInFrequency": "string"
  }
}`;

    const userPrompt = `Provide personality feedback for:
Interaction Data: ${JSON.stringify(interactionData)}
Behavior Patterns: ${JSON.stringify(behaviorPatterns)}
Feedback Type: ${feedbackType || 'general development'}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await llmService.makeLLMRequest(messages, {
      temperature: 0.3,
      n_predict: 512
    });

    let feedbackData;
    try {
      feedbackData = JSON.parse(response.content);
    } catch (parseError) {
      feedbackData = {
        feedbackType: "general development",
        observations: ["Shows thoughtful engagement", "Demonstrates openness to growth"],
        positivePatterns: ["Active participation", "Willingness to share"],
        improvementAreas: ["Self-reflection", "Goal setting"],
        actionableSteps: ["Practice daily check-ins", "Set small achievable goals"],
        encouragement: "You're on a positive path of personal growth. Keep being curious about yourself!",
        progressTracking: {
          metricsToWatch: ["Self-awareness", "Communication patterns"],
          checkInFrequency: "weekly"
        }
      };
    }

    res.json({
      success: true,
      data: feedbackData
    });

  } catch (error) {
    console.error('Personality feedback error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate personality feedback'
    });
  }
});

router.post('/personalized-insights', protect, async (req, res) => {
  try {
    const { userData, emotionalHistory, goalPreferences, timeframe } = req.body;
    
    const systemPrompt = `You are a personalized insights analyst. Generate deep, actionable insights about the user's emotional patterns, growth opportunities, and personalized recommendations.

Return JSON in this format:
{
  "insightsSummary": "string",
  "emotionalTrends": {
    "primaryPattern": "string",
    "frequency": "string",
    "triggers": ["trigger1", "trigger2"]
  },
  "personalizedGoals": ["goal1", "goal2"],
  "strengthsToLeverage": ["strength1", "strength2"],
  "customRecommendations": ["rec1", "rec2"],
  "socialCompatibility": {
    "idealPartnerTraits": ["trait1", "trait2"],
    "communicationTips": ["tip1", "tip2"]
  },
  "nextSteps": ["step1", "step2"],
  "confidenceScore": number (0-10)
}`;

    const userPrompt = `Generate personalized insights for:
User Data: ${JSON.stringify(userData)}
Emotional History: ${JSON.stringify(emotionalHistory)}
Goal Preferences: ${JSON.stringify(goalPreferences)}
Timeframe: ${timeframe || 'current'}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await llmService.makeLLMRequest(messages, {
      temperature: 0.4,
      n_predict: 512
    });

    let insightsData;
    try {
      insightsData = JSON.parse(response.content);
    } catch (parseError) {
      insightsData = {
        insightsSummary: "You show strong emotional awareness and openness to growth, with consistent patterns of thoughtful engagement.",
        emotionalTrends: {
          primaryPattern: "Stable with growth-oriented mindset",
          frequency: "consistent",
          triggers: ["New experiences", "Social connections"]
        },
        personalizedGoals: ["Enhance self-awareness", "Build meaningful connections"],
        strengthsToLeverage: ["Empathy", "Adaptability"],
        customRecommendations: ["Practice mindful reflection", "Engage in community activities"],
        socialCompatibility: {
          idealPartnerTraits: ["Empathetic", "Communicative"],
          communicationTips: ["Express feelings openly", "Listen actively"]
        },
        nextSteps: ["Set weekly reflection time", "Join interest-based groups"],
        confidenceScore: 8
      };
    }

    res.json({
      success: true,
      data: insightsData
    });

  } catch (error) {
    console.error('Personalized insights error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate personalized insights'
    });
  }
});

export default router;