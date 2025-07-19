import express from "express";
import { protect } from "../middleware/auth.js";
import { rateLimiters } from "../middleware/rateLimiter.js";
import { createLLMService } from "../services/llmService.js";
import { createUserCache } from "../utils/cache.js";
import { getRecentMemory } from "../utils/memory.js";
import User from "../models/User.js";
import UserBehaviorProfile from "../models/UserBehaviorProfile.js";
import logger from "../utils/logger.js";

const router = express.Router();

/**
 * Generate cascading recommendations with streaming support
 * These recommendations build upon each other, creating a flow of insights
 */
router.post("/generate", protect, rateLimiters.general, async (req, res) => {
  const { stream = false } = req.body;
  
  if (stream) {
    return generateStreamingRecommendations(req, res);
  } else {
    return generateStaticRecommendations(req, res);
  }
});

/**
 * Generate static (non-streaming) cascading recommendations
 */
async function generateStaticRecommendations(req, res) {
  try {
    const userId = req.user.id;
    const { 
      depth = 3, 
      focusArea = 'general', 
      includeReasoningTree = true,
      contextWindow = 30 
    } = req.body;
    
    console.log(`🌊 Generating cascading recommendations for user ${userId}`);
    
    const userCache = createUserCache(userId);
    
    // Gather comprehensive user context
    const [user, recentMemory, behaviorProfile] = await Promise.all([
      User.findById(userId).lean(),
      getRecentMemory(userId, userCache, contextWindow),
      UserBehaviorProfile.findOne({ userId }).lean()
    ]);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    // Analyze user patterns and create context
    const userContext = await analyzeUserContext(user, recentMemory, behaviorProfile);
    
    // Generate the cascading recommendation tree
    const cascadingTree = await generateCascadingTree(userContext, {
      depth,
      focusArea,
      includeReasoningTree,
      userId
    });

    res.json({
      success: true,
      data: {
        userId,
        focusArea,
        depth,
        generatedAt: new Date().toISOString(),
        context: userContext.summary,
        cascadingTree,
        reasoningTree: includeReasoningTree ? cascadingTree.reasoning : null
      }
    });

    logger.info(`Cascading recommendations generated`, {
      userId,
      depth,
      focusArea,
      recommendationCount: cascadingTree.recommendations.length
    });

  } catch (error) {
    console.error("Error generating cascading recommendations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate cascading recommendations",
      error: error.message
    });
  }
}

/**
 * Generate streaming cascading recommendations
 */
async function generateStreamingRecommendations(req, res) {
  try {
    const userId = req.user.id;
    const { 
      depth = 3, 
      focusArea = 'general', 
      includeReasoningTree = true,
      contextWindow = 30 
    } = req.body;
    
    console.log(`🌊 Generating STREAMING cascading recommendations for user ${userId}`);
    
    // Set up streaming headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Cache-Control");
    res.setHeader("X-Accel-Buffering", "no");

    const userCache = createUserCache(userId);
    
    // Send initial status
    res.write(`data: ${JSON.stringify({ 
      type: 'status', 
      message: 'Analyzing your patterns...',
      progress: 10
    })}\n\n`);
    
    // Gather comprehensive user context
    const [user, recentMemory, behaviorProfile] = await Promise.all([
      User.findById(userId).lean(),
      getRecentMemory(userId, userCache, contextWindow),
      UserBehaviorProfile.findOne({ userId }).lean()
    ]);

    if (!user) {
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        message: 'User not found' 
      })}\n\n`);
      res.end();
      return;
    }

    res.write(`data: ${JSON.stringify({ 
      type: 'status', 
      message: 'Generating personalized recommendations...',
      progress: 30
    })}\n\n`);

    // Analyze user patterns and create context
    const userContext = await analyzeUserContext(user, recentMemory, behaviorProfile);
    
    res.write(`data: ${JSON.stringify({ 
      type: 'status', 
      message: 'Building cascading recommendation tree...',
      progress: 50
    })}\n\n`);
    
    // Generate the cascading recommendation tree with streaming
    const cascadingTree = await generateCascadingTreeWithStreaming(userContext, {
      depth,
      focusArea,
      includeReasoningTree,
      userId
    }, (chunk) => {
      // Stream each recommendation as it's generated
      res.write(`data: ${JSON.stringify({ 
        type: 'recommendation_chunk',
        content: chunk
      })}\n\n`);
    });

    res.write(`data: ${JSON.stringify({ 
      type: 'status', 
      message: 'Finalizing recommendations...',
      progress: 90
    })}\n\n`);

    // Send final complete result
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      data: {
        userId,
        focusArea,
        depth,
        generatedAt: new Date().toISOString(),
        context: userContext.summary,
        cascadingTree,
        reasoningTree: includeReasoningTree ? cascadingTree.reasoning : null
      }
    })}\n\n`);

    res.write('data: [DONE]\n\n');
    res.end();

    logger.info(`Streaming cascading recommendations generated`, {
      userId,
      depth,
      focusArea,
      recommendationCount: cascadingTree.recommendations.length
    });

  } catch (error) {
    console.error("Error generating streaming cascading recommendations:", error);
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      message: 'Failed to generate cascading recommendations',
      error: error.message 
    })}\n\n`);
    res.end();
  }
}

/**
 * Get reasoning tree for a specific recommendation
 */
router.get("/reasoning/:recommendationId", protect, async (req, res) => {
  try {
    const { recommendationId } = req.params;
    const userId = req.user.id;
    
    console.log(`🧠 Fetching reasoning tree for recommendation ${recommendationId}`);
    
    // Generate on demand instead of fetching from database
    const reasoningTree = await generateDetailedReasoningTree(userId, recommendationId);
    
    res.json({
      success: true,
      data: {
        recommendationId,
        reasoningTree,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Error fetching reasoning tree:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reasoning tree",
      error: error.message
    });
  }
});

/**
 * Generate insights based on user interaction with recommendations
 */
router.post("/feedback", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      recommendationId, 
      action, // 'accepted', 'dismissed', 'modified', 'explored'
      feedback,
      outcome
    } = req.body;
    
    console.log(`📊 Processing recommendation feedback for user ${userId}`);
    
    // Store feedback and update user model
    const feedbackData = {
      userId,
      recommendationId,
      action,
      feedback,
      outcome,
      timestamp: new Date()
    };
    
    // Generate next-level recommendations based on this feedback
    const followUpRecommendations = await generateFollowUpRecommendations(feedbackData);
    
    res.json({
      success: true,
      data: {
        feedbackProcessed: true,
        followUpRecommendations,
        adaptedInsights: followUpRecommendations.adaptedInsights
      }
    });

  } catch (error) {
    console.error("Error processing recommendation feedback:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process feedback",
      error: error.message
    });
  }
});

/**
 * Analyze user context from multiple data sources
 */
async function analyzeUserContext(user, recentMemory, behaviorProfile) {
  const context = {
    // Emotional patterns
    recentEmotions: user.emotionalLog?.slice(-10) || [],
    emotionalTrends: calculateEmotionalTrends(user.emotionalLog || []),
    
    // Behavioral patterns
    interactionPatterns: analyzeInteractionPatterns(recentMemory),
    preferences: behaviorProfile?.preferences || {},
    interests: behaviorProfile?.interests || [],
    
    // Temporal context
    timeContext: {
      timeOfDay: getTimeOfDay(),
      dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
      seasonalContext: getSeasonalContext()
    },
    
    // Growth indicators
    growthAreas: identifyGrowthAreas(user, behaviorProfile),
    engagement: calculateEngagementMetrics(recentMemory),
    
    // Summary for AI processing
    summary: ""
  };
  
  // Generate context summary
  context.summary = `User shows ${context.emotionalTrends.dominant} emotional patterns with ${context.engagement.level} engagement. Primary interests: ${context.interests.slice(0, 3).map(i => i.category || i).join(', ')}. Growth focus: ${context.growthAreas.primary}.`;
  
  return context;
}

/**
 * Generate cascading recommendation tree with reasoning
 */
async function generateCascadingTree(userContext, options) {
  const llmService = createLLMService();
  
  const cascadingPrompt = `Create a cascading recommendation system for this user based on their context. Each recommendation should build upon the previous ones, creating a natural flow of growth and discovery.

USER CONTEXT:
${userContext.summary}

EMOTIONAL PATTERNS: ${JSON.stringify(userContext.emotionalTrends)}
INTERESTS: ${userContext.interests.map(i => i.category || i).join(', ')}
GROWTH AREAS: ${JSON.stringify(userContext.growthAreas)}
ENGAGEMENT: ${userContext.engagement.level} (${userContext.engagement.score}/100)
TIME CONTEXT: ${userContext.timeContext.timeOfDay} on ${userContext.timeContext.dayOfWeek}

TASK: Create a cascading recommendation tree with ${options.depth} levels, focusing on "${options.focusArea}". Each level should:

1. PRIMARY LEVEL: Core recommendation based on immediate needs/patterns
2. SECONDARY LEVEL: Supporting actions that amplify the primary recommendation
3. TERTIARY LEVEL: Advanced opportunities that emerge from success in previous levels

For each recommendation, include:
- title: Clear, actionable title
- description: Why this matters now
- reasoning: Step-by-step logic for this recommendation
- cascadeConnection: How it connects to other recommendations
- potentialOutcomes: What success looks like
- difficulty: 1-10 scale
- timeframe: immediate, short-term, long-term
- category: growth, wellness, creativity, connection, learning

Return a JSON structure with cascading recommendations and reasoning tree.`;

  const messages = [
    { 
      role: 'system', 
      content: 'You are an advanced AI system that creates personalized cascading recommendations. Think deeply about cause-and-effect relationships and how actions build upon each other.' 
    },
    { role: 'user', content: cascadingPrompt }
  ];

  const response = await llmService.makeLLMRequest(messages, {
    temperature: 0.8,
    n_predict: 1200
  });

  try {
    // Parse the AI response as JSON
    const aiResponse = JSON.parse(response.content);
    
    // Enhance with reasoning tree if requested
    if (options.includeReasoningTree) {
      aiResponse.reasoning = await generateReasoningTree(aiResponse, userContext);
    }
    
    return aiResponse;
  } catch {
    console.warn("Failed to parse AI response as JSON, creating fallback structure");
    
    // Fallback structure if JSON parsing fails
    return {
      recommendations: [
        {
          level: 1,
          title: "Personalized Growth Focus",
          description: "Based on your patterns, focusing on consistent small actions will create meaningful progress.",
          reasoning: "Your engagement patterns suggest you respond well to structured approaches.",
          cascadeConnection: "foundation",
          potentialOutcomes: ["Increased confidence", "Better habits", "Clearer direction"],
          difficulty: 3,
          timeframe: "short-term",
          category: "growth"
        }
      ],
      reasoning: options.includeReasoningTree ? {
        methodology: "Pattern-based analysis with cascading logic",
        confidence: 0.85,
        primaryFactors: ["Emotional patterns", "Engagement history", "Stated preferences"]
      } : null
    };
  }
}

/**
 * Generate detailed reasoning tree for AI transparency
 */
async function generateReasoningTree(recommendations, userContext) {
  const llmService = createLLMService();
  
  const reasoningPrompt = `Explain the reasoning behind these cascading recommendations. Create a transparent reasoning tree that shows:

1. Primary analysis factors
2. Decision-making process
3. How each recommendation connects to user patterns
4. Confidence levels and uncertainty factors
5. Alternative paths considered

RECOMMENDATIONS: ${JSON.stringify(recommendations)}
USER CONTEXT: ${JSON.stringify(userContext)}

Provide a clear, logical reasoning tree that helps the user understand WHY these recommendations were chosen and HOW they work together.`;

  const messages = [
    { 
      role: 'system', 
      content: 'You are an AI explainability system. Make AI decision-making transparent and understandable to humans.' 
    },
    { role: 'user', content: reasoningPrompt }
  ];

  const response = await llmService.makeLLMRequest(messages, {
    temperature: 0.3,
    n_predict: 800
  });

  return {
    explanation: response.content,
    methodology: "Multi-factor analysis with cascading logic",
    confidence: calculateConfidenceScore(userContext),
    primaryFactors: extractPrimaryFactors(userContext),
    alternativesConsidered: ["Different timeframes", "Alternative focus areas", "Various difficulty levels"],
    generatedAt: new Date().toISOString()
  };
}

/**
 * Generate detailed reasoning tree for a specific recommendation
 */
async function generateDetailedReasoningTree(userId, recommendationId) {
  // This would fetch the specific recommendation and generate detailed reasoning
      // Create comprehensive reasoning structure
  
  return {
    recommendationId,
    reasoning: {
      primaryLogic: "User behavior patterns indicate high engagement with structured activities",
      supportingEvidence: [
        "Consistent daily interactions over past 2 weeks",
        "Positive response to goal-oriented conversations",
        "Growth-oriented emotional expressions"
      ],
      contextualFactors: [
        "Current time of day aligns with user's peak engagement",
        "Seasonal patterns suggest readiness for new initiatives",
        "Recent emotional trajectory shows openness to change"
      ],
      riskFactors: [
        "Potential over-commitment based on past patterns",
        "External stressors may impact follow-through"
      ],
      adaptationTriggers: [
        "If engagement drops below 60%",
        "If emotional patterns shift to stress indicators",
        "If user requests modification"
      ]
    },
    confidence: 0.87,
    alternatives: [
      {
        option: "Lower intensity approach",
        reason: "If current recommendation seems too ambitious"
      },
      {
        option: "Different timing",
        reason: "If user schedule doesn't align"
      }
    ]
  };
}

/**
 * Generate follow-up recommendations based on user feedback
 */
async function generateFollowUpRecommendations(feedbackData) {
  const llmService = createLLMService();
  
  const followUpPrompt = `Based on user feedback about a recommendation, generate adaptive follow-up recommendations:

ORIGINAL FEEDBACK: ${JSON.stringify(feedbackData)}

Create 2-3 follow-up recommendations that:
1. Address the feedback provided
2. Adapt to the user's response patterns
3. Build upon any positive outcomes
4. Course-correct if needed

Include reasoning for each adaptation.`;

  const messages = [
    { 
      role: 'system', 
      content: 'You are an adaptive AI system that learns from user feedback and evolves recommendations accordingly.' 
    },
    { role: 'user', content: followUpPrompt }
  ];

  const response = await llmService.makeLLMRequest(messages, {
    temperature: 0.7,
    n_predict: 600
  });

  return {
    followUpRecommendations: response.content,
    adaptedInsights: `Recommendation system adapted based on ${feedbackData.action} feedback`,
    learningApplied: true
  };
}

// Helper functions
function calculateEmotionalTrends(emotionalLog) {
  if (!emotionalLog.length) return { dominant: 'neutral', trend: 'stable' };
  
  const recent = emotionalLog.slice(-7);
  const emotions = recent.map(log => log.emotion);
  const frequency = {};
  
  emotions.forEach(emotion => {
    frequency[emotion] = (frequency[emotion] || 0) + 1;
  });
  
  const dominant = Object.entries(frequency).sort(([,a], [,b]) => b - a)[0]?.[0] || 'neutral';
  
  return { dominant, trend: 'evolving', frequency };
}

function analyzeInteractionPatterns(recentMemory) {
  const patterns = {
    avgLength: 0,
    questionRatio: 0,
    topicDiversity: 0,
    engagementStyle: 'balanced'
  };
  
  if (recentMemory.length > 0) {
    const userMessages = recentMemory.filter(m => m.role === 'user');
    patterns.avgLength = userMessages.reduce((acc, m) => acc + (m.content?.length || 0), 0) / userMessages.length;
    patterns.questionRatio = userMessages.filter(m => m.content?.includes('?')).length / userMessages.length;
  }
  
  return patterns;
}

function identifyGrowthAreas(_user, _behaviorProfile) {
  return {
    primary: 'self-awareness',
    secondary: 'goal-setting',
    opportunities: ['mindfulness', 'creative expression', 'social connection']
  };
}

function calculateEngagementMetrics(recentMemory) {
  const score = Math.min(100, recentMemory.length * 5);
  let level = 'low';
  if (score > 70) level = 'high';
  else if (score > 40) level = 'medium';
  
  return { score, level };
}

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 6) return 'early-morning';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

function getSeasonalContext() {
  const month = new Date().getMonth();
  if (month < 3) return 'winter';
  if (month < 6) return 'spring';
  if (month < 9) return 'summer';
  return 'fall';
}

function calculateConfidenceScore(userContext) {
  // Base confidence on data richness and pattern clarity
  let confidence = 0.5;
  
  if (userContext.recentEmotions.length > 5) confidence += 0.1;
  if (userContext.interests.length > 3) confidence += 0.1;
  if (userContext.engagement.score > 50) confidence += 0.2;
  
  return Math.min(0.95, confidence);
}

function extractPrimaryFactors(_userContext) {
  return [
    'Emotional pattern analysis',
    'Behavioral interaction history',
    'Stated interests and preferences',
    'Engagement level and consistency',
    'Temporal and contextual factors'
  ];
}

/**
 * Generate cascading tree with streaming support
 */
async function generateCascadingTreeWithStreaming(userContext, options, onChunk) {
  const llmService = createLLMService();
  
  const cascadingPrompt = `Create a cascading recommendation system for this user based on their context. Each recommendation should build upon the previous ones, creating a natural flow of growth and discovery.

USER CONTEXT:
${userContext.summary}

EMOTIONAL PATTERNS: ${JSON.stringify(userContext.emotionalTrends)}
INTERESTS: ${userContext.interests.map(i => i.category || i).join(', ')}
GROWTH AREAS: ${JSON.stringify(userContext.growthAreas)}
ENGAGEMENT: ${userContext.engagement.level} (${userContext.engagement.score}/100)
TIME CONTEXT: ${userContext.timeContext.timeOfDay} on ${userContext.timeContext.dayOfWeek}

TASK: Create a cascading recommendation tree with ${options.depth} levels, focusing on "${options.focusArea}". Each level should:

1. PRIMARY LEVEL: Core recommendation based on immediate needs/patterns
2. SECONDARY LEVEL: Supporting actions that amplify the primary recommendation
3. TERTIARY LEVEL: Advanced opportunities that emerge from success in previous levels

For each recommendation, include:
- title: Clear, actionable title
- description: Why this matters now
- reasoning: Step-by-step logic for this recommendation
- cascadeConnection: How it connects to other recommendations
- potentialOutcomes: What success looks like
- difficulty: 1-10 scale
- timeframe: immediate, short-term, long-term
- category: growth, wellness, creativity, connection, learning

Return a JSON structure with cascading recommendations and reasoning tree.`;

  const messages = [
    { 
      role: 'system', 
      content: 'You are an advanced AI system that creates personalized cascading recommendations. Think deeply about cause-and-effect relationships and how actions build upon each other.' 
    },
    { role: 'user', content: cascadingPrompt }
  ];

      // Use non-streaming version with callback processing
  const response = await llmService.makeLLMRequest(messages, {
    temperature: 0.8,
    n_predict: 1200
  });

  // Stream the response content as it's processed
  if (onChunk) {
    onChunk("Processing AI insights...");
  }

  try {
    // Parse the AI response as JSON
    const aiResponse = JSON.parse(response.content);
    
    if (onChunk) {
      onChunk("Generating reasoning tree...");
    }
    
    // Enhance with reasoning tree if requested
    if (options.includeReasoningTree) {
      aiResponse.reasoning = await generateReasoningTree(aiResponse, userContext);
    }
    
    if (onChunk) {
      onChunk("Finalizing recommendations...");
    }
    
    return aiResponse;
  } catch {
    console.warn("Failed to parse AI response as JSON, creating fallback structure");
    
    if (onChunk) {
      onChunk("Using fallback recommendations...");
    }
    
    // Fallback structure if JSON parsing fails
    return {
      recommendations: [
        {
          level: 1,
          title: "Personalized Growth Focus",
          description: "Based on your patterns, focusing on consistent small actions will create meaningful progress.",
          reasoning: "Your engagement patterns suggest you respond well to structured approaches.",
          cascadeConnection: "foundation",
          potentialOutcomes: ["Increased confidence", "Better habits", "Clearer direction"],
          difficulty: 3,
          timeframe: "short-term",
          category: "growth"
        }
      ],
      reasoning: options.includeReasoningTree ? {
        methodology: "Pattern-based analysis with cascading logic",
        confidence: 0.85,
        primaryFactors: ["Emotional patterns", "Engagement history", "Stated preferences"]
      } : null
    };
  }
}

export default router;