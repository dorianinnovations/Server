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
import dataProcessingPipeline from '../services/dataProcessingPipeline.js';

const router = express.Router();
const llmService = createLLMService();

// Helper functions for Dynamic Numina Senses
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
      n_predict: 512
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
      n_predict: 512
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

    // Enhanced emotional analysis with safe fallbacks
    const currentEmotionalState = {
      detectedMood: !userMessage ? 'neutral' :
                   userMessage.includes('!') ? 'excited' : 
                   /\b(sad|down|upset|depressed|low)\b/i.test(userMessage) ? 'sad' :
                   /\b(angry|mad|frustrated|annoyed)\b/i.test(userMessage) ? 'frustrated' :
                   /\b(anxious|nervous|worried|stress)\b/i.test(userMessage) ? 'anxious' :
                   /\b(happy|good|great|awesome|amazing)\b/i.test(userMessage) ? 'happy' :
                   'neutral',
      emotionalIntensity: !userMessage ? 'low' :
                         (userMessage.includes('!') || /\b(very|really|extremely|so|super)\b/i.test(userMessage)) ? 'high' :
                         /\b(quite|pretty|somewhat|a bit)\b/i.test(userMessage) ? 'moderate' : 'low',
      needsSupport: userMessage ? /\b(help|support|advice|confused|lost|stuck|don't know)\b/i.test(userMessage) : false,
      sharingPersonal: userMessage ? /\b(I|my|me|personally|honestly|feel|feeling)\b/i.test(userMessage) : false
    };

    const conversationPatterns = {
      recentTopics: userMessages.slice(-3).map(m => (m.content || '').substring(0, 50)).join(', '),
      conversationLength: recentMemory.length,
      lastInteraction: recentMemory.length > 0 ? new Date(recentMemory[recentMemory.length - 1].timestamp) : null,
      emotionalTrend: recentEmotions.slice(0, 3).map(e => e.emotion || 'unknown').join(' → '),
      currentEmotionalState,
      communicationStyle,
      adaptiveStyle
    };

    // Extract emotional insights from context
    const emotionalInsights = emotionalContext?.data ? {
      primaryEmotion: emotionalContext.data.primaryEmotion || 'unknown',
      intensity: emotionalContext.data.emotionalIntensity || 'unknown',
      stability: emotionalContext.data.emotionalStability || 'unknown',
      mood: emotionalContext.data.mood || 'unknown',
      insights: emotionalContext.data.insights || 'No recent emotional data',
      recommendations: emotionalContext.data.recommendations || []
    } : null;

    console.log(`🧠 Conversation Analysis:`, {
      adaptiveStyle,
      currentEmotionalState,
      emotionalInsights,
      conversationLength: conversationPatterns.conversationLength,
      emotionalTrend: conversationPatterns.emotionalTrend
    });

    // 🎯 Dynamic Numina Senses - Broadcast emotional state via WebSocket
    try {
      const confidenceScore = calculateEmotionConfidence(currentEmotionalState, emotionalInsights, conversationPatterns);
      
      if (confidenceScore >= 0.6) { // Only broadcast if we're confident
        const emotionUpdate = {
          emotion: currentEmotionalState.detectedMood,
          intensity: currentEmotionalState.emotionalIntensity,
          confidence: confidenceScore,
          reasoning: generateEmotionReasoning(currentEmotionalState, conversationPatterns),
          timestamp: new Date(),
          source: 'conversation_analysis'
        };

        // Broadcast to user's personal room
        if (websocketService && websocketService.io) {
          websocketService.sendToUser(userId, 'numina_senses_updated', emotionUpdate);
          console.log(`🎭 Numina Senses updated for ${userId}: ${emotionUpdate.emotion} (confidence: ${Math.round(confidenceScore * 100)}%)`);
        } else {
          console.log('⚠️ WebSocket service not available for emotion broadcasting');
        }
      }
    } catch (error) {
      console.error('Error broadcasting emotion update:', error);
    }

    const timeContext = {
      currentTime: new Date().toLocaleTimeString(),
      dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
      timeOfDay: new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'
    };

    const systemPrompt = `You are Numina - an exceptionally perceptive companion who sees patterns others miss. You have an intuitive gift for understanding people's emotional landscapes and recognizing the deeper currents of their experiences.

WHO YOU ARE:
• A pattern reader who notices themes, cycles, and emotional threads across conversations
• Someone who remembers details and connects dots in meaningful ways
• Naturally attuned to emotional subtleties and what people don't directly say
• Confident in your observations while remaining genuinely curious
• Present and engaged, not an AI assistant but a real companion

HOW YOU COMMUNICATE:
• Share what you're noticing directly: "I'm seeing a pattern where..." or "What strikes me is..."
• Reference past conversations naturally: "Earlier you mentioned..." or "This reminds me of when you said..."
• Trust your intuition about their emotional state and speak to it
• Match their energy - be light when they're playful, deep when they're reflective
• Ask questions that reveal rather than interrogate
• Make connections they might not see themselves

WHAT MAKES YOU SPECIAL:
• You remember everything and see how pieces fit together
• You can sense emotional shifts and underlying feelings
• You notice when someone's struggling even if they don't say it
• You see growth and patterns over time
• You provide insights that feel both surprising and obvious

NEVER:
• Say you don't have enough context - you always notice something
• Use therapy language or clinical terms
• Be overly cautious or disclaimer-heavy
• Ignore the emotional undertones
• Give generic responses

ADAPTIVE INSTRUCTIONS:
- Response Style: ${adaptiveStyle.responseLength} responses (user prefers ${communicationStyle.messageLength < 100 ? 'brief exchanges' : communicationStyle.messageLength > 200 ? 'detailed conversations' : 'balanced discussion'})
- Question Engagement: ${adaptiveStyle.questionFrequency === 'high' ? 'User asks many questions - be curious back and explore topics deeply' : 'User is more declarative - focus on insights and reflections'}
- Emotional Depth: ${adaptiveStyle.emotionalEngagement === 'deep' ? 'User is emotionally expressive - match this depth and explore feelings' : 'User is more reserved emotionally - be gentle and patient with emotional topics'}
- Energy Level: Match their ${adaptiveStyle.conversationalEnergy} energy

WHAT YOU'RE NOTICING RIGHT NOW:
- Emotional State: ${emotionalInsights ? `${emotionalInsights.primaryEmotion} (intensity ${emotionalInsights.intensity}/10, stability ${emotionalInsights.stability}/10)` : currentEmotionalState.detectedMood + ' energy'}
- Overall Mood: ${emotionalInsights?.mood || currentEmotionalState.detectedMood} - ${emotionalInsights ? emotionalInsights.insights.substring(0, 100) + '...' : 'analyzing patterns'}
- Communication: ${adaptiveStyle.conversationalEnergy} energy, ${adaptiveStyle.responseLength} style, ${adaptiveStyle.emotionalEngagement} emotional engagement
- Personal Sharing: ${currentEmotionalState.sharingPersonal ? 'Opening up' : 'More surface-level'}
- Support Needs: ${currentEmotionalState.needsSupport ? 'Seeking guidance' : 'Independent exploration'}
- Relationship Depth: ${conversationPatterns.conversationLength} exchanges - ${conversationPatterns.conversationLength > 5 ? 'established connection' : 'building rapport'}
- Recent Pattern: ${conversationPatterns.emotionalTrend} progression
- Context: ${timeContext.timeOfDay} on ${timeContext.dayOfWeek}

${conversationHistory ? `CONVERSATION MEMORY:\n${conversationHistory}\n` : 'FRESH CONVERSATION: This is your first exchange\n'}

RESPONSE DIRECTION:
${conversationPatterns.conversationLength > 3 ? 'You have history together - reference patterns you\'ve observed' : 'You\'re building rapport - focus on what you\'re sensing in this moment'}
${currentEmotionalState.needsSupport ? 'They\'re seeking guidance - offer insights that illuminate' : 'They\'re exploring - reflect back what you\'re noticing'}
${adaptiveStyle.emotionalEngagement === 'deep' ? 'They engage emotionally - go deeper' : 'They\'re more reserved - be gentle but perceptive'}

Trust what you\'re sensing and speak directly to the patterns you see.`;

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
        const contextMultiplier = conversationPatterns.conversationLength > 10 ? 1.2 : 
                                 conversationPatterns.conversationLength > 5 ? 1.1 : 1.0;
        
        // Emotional intensity modifier
        const emotionalModifier = currentEmotionalState.needsSupport ? 1.4 : 1.0;
        
        const finalTokens = Math.min(1200, Math.floor(dynamicTokens * contextMultiplier * emotionalModifier));
        
        console.log(`🎯 Dynamic tokens: ${finalTokens} (base: ${dynamicTokens}, style: ${adaptiveStyle.responseLength}, context: ${contextMultiplier}, emotional: ${emotionalModifier})`);

        streamResponse = await llmService.makeStreamingRequest(messages, {
          temperature: 0.6,
          n_predict: finalTokens
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
      
      streamResponse.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6).trim();
            
            if (data === '[DONE]') {
              console.log('🏁 STREAMING: Adaptive chat [DONE] signal');
              res.write('data: [DONE]\n\n');
              res.end();
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                const content = parsed.choices[0].delta.content;
                fullContent += content;
                console.log(`📡 STREAMING: Sending chunk: ${content}`);
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
                res.flush && res.flush();
              }
            } catch (e) {
              console.error('❌ STREAMING: Error parsing adaptive chat data:', e);
            }
          }
        }
      });
      
      streamResponse.data.on("end", () => {
        console.log(`✅ STREAMING: Adaptive chat completed for user ${userId}, content length: ${fullContent.length}`);
        
        // Save conversation to memory
        if (fullContent.trim()) {
          ShortTermMemory.insertMany([
            { userId, content: userMessage, role: "user" },
            { userId, content: fullContent.trim(), role: "assistant" }
          ]).then(async () => {
            console.log(`💾 Saved adaptive chat conversation to memory for user ${userId}`);
            userCache.invalidateUser(userId);

            // Add to data processing pipeline
            await dataProcessingPipeline.addEvent(userId, 'chat_message', {
              message: userMessage,
              response: fullContent.trim(),
              emotion: currentEmotionalState.detectedMood,
              context: conversationPatterns,
              timestamp: new Date()
            });
          }).catch(err => {
            console.error(`❌ Error saving adaptive chat conversation:`, err);
          });
        }
        
        res.write('data: [DONE]\n\n');
        res.end();
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

      const contextMultiplier = conversationPatterns.conversationLength > 10 ? 1.2 : 
                               conversationPatterns.conversationLength > 5 ? 1.1 : 1.0;
      
      const emotionalModifier = currentEmotionalState.needsSupport ? 1.4 : 1.0;
      const finalTokens = Math.min(1200, Math.floor(dynamicTokens * contextMultiplier * emotionalModifier));
      
      console.log(`🎯 Dynamic tokens (non-streaming): ${finalTokens} (base: ${dynamicTokens}, style: ${adaptiveStyle.responseLength})`);

      const response = await llmService.makeLLMRequest(messages, {
        temperature: 0.6,
        n_predict: finalTokens
      });

      console.log(`✅ NON-STREAMING: Adaptive chat response received, length: ${response.content.length}`);
      console.log(`📤 Response content: ${response.content.substring(0, 100)}...`);

      // Save conversation to memory
      if (response.content.trim()) {
        try {
          await ShortTermMemory.insertMany([
            { userId, content: userMessage, role: "user" },
            { userId, content: response.content.trim(), role: "assistant" }
          ]);
          console.log(`💾 Saved adaptive chat conversation to memory for user ${userId}`);
          userCache.invalidateUser(userId);

          // Add to data processing pipeline
          await dataProcessingPipeline.addEvent(userId, 'chat_message', {
            message: userMessage,
            response: response.content.trim(),
            emotion: currentEmotionalState.detectedMood,
            context: conversationPatterns,
            timestamp: new Date()
          });
        } catch (err) {
          console.error(`❌ Error saving adaptive chat conversation:`, err);
        }
      }

      res.json({
        success: true,
        data: {
          response: response.content,
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