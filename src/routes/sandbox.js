import express from 'express';
import { protect } from '../middleware/auth.js';
import { createLLMService } from '../services/llmService.js';
import User from '../models/User.js';
import UserBehaviorProfile from '../models/UserBehaviorProfile.js';
import SandboxSession from '../models/SandboxSession.js';
import LockedNode from '../models/LockedNode.js';
import ShortTermMemory from '../models/ShortTermMemory.js';
import { checkTierLimits, requireFeature } from '../middleware/tierLimiter.js';
import logger from '../utils/logger.js';
import chainOfThoughtEngine from '../services/chainOfThoughtEngine.js';
import aiActivityMonitor from '../services/aiActivityMonitor.js';
import processingObserver from '../services/processingObserver.js';
import toolRegistry from '../services/toolRegistry.js';
import toolExecutor from '../services/toolExecutor.js';
import enhancedMemoryService from '../services/enhancedMemoryService.js';
import ubpmService from '../services/ubpmService.js';

const router = express.Router();
const llmService = createLLMService();

// Simple test route to verify sandbox routes are loading
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Sandbox routes are working!' });
});

// Test pill actions without authentication (for development only)
router.post('/test-pill-actions', async (req, res) => {
  try {
    const { pillActions, query, context } = req.body;

    if (!pillActions || !Array.isArray(pillActions) || pillActions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Pill actions array is required'
      });
    }

    // Process each pill action and return appropriate configuration
    const actionConfigurations = {
      write: {
        modelPreference: 'creative',
        temperature: 0.8,
        maxTokens: 1500,
        focusAreas: ['creative_expression', 'narrative_flow', 'personal_voice'],
        systemPrompt: 'You are a creative writing assistant focused on helping users express their thoughts clearly and engagingly.'
      },
      think: {
        modelPreference: 'analytical', 
        temperature: 0.3,
        maxTokens: 2000,
        focusAreas: ['logical_analysis', 'problem_solving', 'critical_thinking'],
        systemPrompt: 'You are an analytical thinking partner focused on deep reasoning and structured problem-solving.'
      },
      find: {
        modelPreference: 'research',
        temperature: 0.5,
        maxTokens: 1200,
        focusAreas: ['information_discovery', 'source_verification', 'data_synthesis'],
        systemPrompt: 'You are a research assistant focused on finding accurate, relevant information from multiple sources.',
        tools: ['web_search', 'academic_search']
      },
      imagine: {
        modelPreference: 'creative',
        temperature: 0.9,
        maxTokens: 1800,
        focusAreas: ['creative_ideation', 'innovative_thinking', 'possibility_exploration'],
        systemPrompt: 'You are a creative ideation partner focused on exploring possibilities and generating innovative ideas.'
      },
      connect: {
        modelPreference: 'synthesis',
        temperature: 0.6,
        maxTokens: 1600,
        focusAreas: ['relationship_mapping', 'pattern_recognition', 'interdisciplinary_links'],
        systemPrompt: 'You are a connection specialist focused on finding relationships and patterns between ideas, concepts, and domains.'
      },
      explore: {
        modelPreference: 'balanced',
        temperature: 0.7,
        maxTokens: 1400,
        focusAreas: ['knowledge_expansion', 'curiosity_driven_research', 'broad_discovery'],
        systemPrompt: 'You are an exploration guide focused on broadening understanding and discovering new knowledge territories.',
        tools: ['web_search', 'news_search']
      },
      ubpm: {
        modelPreference: 'personalized',
        temperature: 0.4,
        maxTokens: 1300,
        focusAreas: ['behavioral_analysis', 'personalized_insights', 'user_pattern_recognition'],
        systemPrompt: 'You are a personalization expert focused on tailoring responses based on user behavioral patterns and preferences.',
        requiresUBPM: true
      }
    };

    const processedActions = [];
    const combinedConfig = {
      temperature: 0.6,
      maxTokens: 1500,
      focusAreas: new Set(),
      tools: new Set(),
      systemPrompts: [],
      requiresUBPM: false
    };

    for (const actionId of pillActions) {
      const config = actionConfigurations[actionId];
      if (config) {
        processedActions.push({
          actionId,
          ...config
        });

        combinedConfig.focusAreas = new Set([...combinedConfig.focusAreas, ...config.focusAreas]);
        if (config.tools) {
          combinedConfig.tools = new Set([...combinedConfig.tools, ...config.tools]);
        }
        combinedConfig.systemPrompts.push(config.systemPrompt);
        if (config.requiresUBPM) {
          combinedConfig.requiresUBPM = true;
        }

        combinedConfig.temperature = (combinedConfig.temperature + config.temperature) / 2;
        combinedConfig.maxTokens = Math.max(combinedConfig.maxTokens, config.maxTokens);
      }
    }

    res.json({
      success: true,
      data: {
        processedActions,
        combinedConfig: {
          ...combinedConfig,
          focusAreas: Array.from(combinedConfig.focusAreas),
          tools: Array.from(combinedConfig.tools)
        },
        synergy: { score: 0.85, description: 'Test combination' },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to process pill actions'
    });
  }
});

// Test pill combinations without authentication (for development only)
router.post('/test-pill-combinations', async (req, res) => {
  try {
    const { currentPills, query } = req.body;

    if (!currentPills || !Array.isArray(currentPills)) {
      return res.status(400).json({
        success: false,
        error: 'Current pills array is required'
      });
    }

    const pillSynergies = {
      'find+think': { synergy: 0.95, description: 'Research with analytical depth' },
      'write+imagine': { synergy: 0.93, description: 'Creative expression with ideation' },
      'connect+explore': { synergy: 0.90, description: 'Relationship discovery through exploration' }
    };

    const combinationKey = currentPills.sort().join('+');
    const currentSynergy = pillSynergies[combinationKey] || {
      synergy: 0.75,
      description: 'Custom combination',
      recommendedApproach: 'Multi-faceted approach',
      additionalPills: []
    };

    const recommendations = [];
    if (query && query.toLowerCase().includes('creative') && !currentPills.includes('imagine')) {
      recommendations.push({
        pill: 'imagine',
        reason: 'Query indicates creative ideation needed',
        confidence: 0.88
      });
    }

    res.json({
      success: true,
      data: {
        currentCombination: {
          pills: currentPills,
          synergy: currentSynergy,
          key: combinationKey
        },
        recommendations,
        metrics: {
          currentSynergyScore: currentSynergy.synergy,
          combinationComplexity: currentPills.length > 3 ? 'high' : 'medium',
          recommendedOptimization: 'available',
          focusCoherence: 'high'
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to analyze pill combinations'
    });
  }
});

// Test route with auth to debug the auth issue
router.get('/auth-test', protect, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Sandbox auth working!',
    user: { id: req.user?.id || req.user?._id }
  });
});

/**
 * POST /sandbox/pill-actions
 * Process pill button actions and return tailored responses
 */
router.post('/pill-actions', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { pillActions, query, context } = req.body;

    logger.debug('Pill actions request', { 
      userId, 
      pillActions,
      query: query?.substring(0, 100)
    });

    if (!pillActions || !Array.isArray(pillActions) || pillActions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Pill actions array is required'
      });
    }

    // Process each pill action and return appropriate configuration
    const actionConfigurations = {
      write: {
        modelPreference: 'creative',
        temperature: 0.8,
        maxTokens: 1500,
        focusAreas: ['creative_expression', 'narrative_flow', 'personal_voice'],
        systemPrompt: 'You are a creative writing assistant focused on helping users express their thoughts clearly and engagingly.'
      },
      think: {
        modelPreference: 'analytical', 
        temperature: 0.3,
        maxTokens: 2000,
        focusAreas: ['logical_analysis', 'problem_solving', 'critical_thinking'],
        systemPrompt: 'You are an analytical thinking partner focused on deep reasoning and structured problem-solving.'
      },
      find: {
        modelPreference: 'research',
        temperature: 0.5,
        maxTokens: 1200,
        focusAreas: ['information_discovery', 'source_verification', 'data_synthesis'],
        systemPrompt: 'You are a research assistant focused on finding accurate, relevant information from multiple sources.',
        tools: ['web_search', 'academic_search']
      },
      imagine: {
        modelPreference: 'creative',
        temperature: 0.9,
        maxTokens: 1800,
        focusAreas: ['creative_ideation', 'innovative_thinking', 'possibility_exploration'],
        systemPrompt: 'You are a creative ideation partner focused on exploring possibilities and generating innovative ideas.'
      },
      connect: {
        modelPreference: 'synthesis',
        temperature: 0.6,
        maxTokens: 1600,
        focusAreas: ['relationship_mapping', 'pattern_recognition', 'interdisciplinary_links'],
        systemPrompt: 'You are a connection specialist focused on finding relationships and patterns between ideas, concepts, and domains.'
      },
      explore: {
        modelPreference: 'balanced',
        temperature: 0.7,
        maxTokens: 1400,
        focusAreas: ['knowledge_expansion', 'curiosity_driven_research', 'broad_discovery'],
        systemPrompt: 'You are an exploration guide focused on broadening understanding and discovering new knowledge territories.',
        tools: ['web_search', 'news_search']
      },
      ubpm: {
        modelPreference: 'personalized',
        temperature: 0.4,
        maxTokens: 1300,
        focusAreas: ['behavioral_analysis', 'personalized_insights', 'user_pattern_recognition'],
        systemPrompt: 'You are a personalization expert focused on tailoring responses based on user behavioral patterns and preferences.',
        requiresUBPM: true
      }
    };

    const processedActions = [];
    const combinedConfig = {
      temperature: 0.6,
      maxTokens: 1500,
      focusAreas: new Set(),
      tools: new Set(),
      systemPrompts: [],
      requiresUBPM: false
    };

    // Process each selected pill action
    for (const actionId of pillActions) {
      const config = actionConfigurations[actionId];
      if (config) {
        processedActions.push({
          actionId,
          ...config
        });

        // Combine configurations
        combinedConfig.focusAreas = new Set([...combinedConfig.focusAreas, ...config.focusAreas]);
        if (config.tools) {
          combinedConfig.tools = new Set([...combinedConfig.tools, ...config.tools]);
        }
        combinedConfig.systemPrompts.push(config.systemPrompt);
        if (config.requiresUBPM) {
          combinedConfig.requiresUBPM = true;
        }

        // Average temperature based on selected actions
        combinedConfig.temperature = (combinedConfig.temperature + config.temperature) / 2;
        combinedConfig.maxTokens = Math.max(combinedConfig.maxTokens, config.maxTokens);
      }
    }

    logger.info('Pill actions processed successfully', { 
      userId,
      actionsCount: processedActions.length,
      combinedFocusAreas: Array.from(combinedConfig.focusAreas),
      requiresUBPM: combinedConfig.requiresUBPM
    });

    res.json({
      success: true,
      data: {
        processedActions,
        combinedConfig: {
          ...combinedConfig,
          focusAreas: Array.from(combinedConfig.focusAreas),
          tools: Array.from(combinedConfig.tools)
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error in pill actions processing', { 
      userId: req.user?._id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to process pill actions'
    });
  }
});

/**
 * POST /sandbox/generate-nodes
 * Generate AI-powered discovery nodes based on user query and context
 */
router.post('/generate-nodes', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { query, selectedActions, lockedContext, useUBPM, userData, pillConfig } = req.body;

    logger.debug('Sandbox generate-nodes request', { 
      userId, 
      query: query?.substring(0, 100),
      actionsCount: selectedActions?.length,
      lockedNodesCount: lockedContext?.length,
      useUBPM 
    });


    // Validate required fields
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a string'
      });
    }

    if (!selectedActions || !Array.isArray(selectedActions) || selectedActions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Selected actions are required'
      });
    }

    // ========================================
    // 💼 SUBSCRIPTION TIER LOGIC
    // ========================================
    // CORE: 3 dives, AETHER: infinite recursive sifts
    
    let userTier = 'CORE'; // Default tier
    let remainingDives = 3; // CORE limit
    let canUseRecursiveFuse = false;
    
    // Process locked context first
    let processedLockedContext = lockedContext;
    
    // Check user's subscription status
    try {
      const user = await User.findById(userId).select('subscription profile');
      if (user?.subscription?.tier === 'AETHER' && user?.subscription?.status === 'active') {
        userTier = 'AETHER';
        remainingDives = Infinity;
        canUseRecursiveFuse = true;
      } else {
        // For CORE users, check dive count (simplified - could track in DB)
        // This is a taste of the power to drive upgrades
        const todaysDives = user?.profile?.dailyDives || 0;
        remainingDives = Math.max(0, 3 - todaysDives);
        canUseRecursiveFuse = lockedContext && lockedContext.length > 0 && remainingDives > 0;
        
        // Limit recursive fuse for CORE users as a taste of power
        if (lockedContext && lockedContext.length > 0) {
          processedLockedContext = lockedContext.slice(0, 2); // Limit locked context for CORE
          logger.info('🎯 CORE Tier Limitation: Restricted locked context to 2 nodes as upgrade incentive');
        }
      }
      
      logger.info('🎯 Tier-based Access Control', { 
        userId, 
        tier: userTier, 
        remainingDives, 
        canUseRecursiveFuse 
      });
      
    } catch (error) {
      logger.warn('Failed to check subscription tier, defaulting to CORE', { userId, error: error.message });
    }
    
    // If no dives remaining for CORE users, return upgrade prompt
    if (userTier === 'CORE' && remainingDives <= 0) {
      return res.status(402).json({
        success: false,
        error: 'DIVE_LIMIT_REACHED',
        message: 'You\'ve reached your 3 daily discovery dives limit.',
        upgrade: {
          tier: 'AETHER',
          benefits: [
            'Unlimited recursive knowledge sifts',
            'Enhanced predictive context fusion',
            'Advanced UBPM personalization',
            'Priority tool access'
          ],
          cta: 'Upgrade to AETHER for infinite exploration'
        }
      });
    }

    // ========================================
    // 👁️ OBSERVER BRIDGE - Watch real GPT-4o work
    // ========================================
    const observerSessionId = `obs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Register observer to watch all LLM calls and tool executions
    processingObserver.registerObserver(observerSessionId, {
      onActivity: (message) => {
        logger.info('🔍 Observer Bridge:', { userId, message });
        // TODO: Stream this to frontend via WebSocket or SSE
      }
    });

    logger.info('🎯 Observer bridge registered for real-time transparency', { 
      userId, 
      observerSessionId 
    });

    // Get comprehensive user context for personalization
    const user = await User.findById(userId);
    let userBehaviorProfile = null;
    let compressedUserContext = null;
    
    if (useUBPM) {
      try {
        // Get the user's complete behavioral profile
        userBehaviorProfile = await UserBehaviorProfile.findOne({ userId });
        
        // Get compressed, contextual user intelligence
        compressedUserContext = await enhancedMemoryService.getUserContext(userId, 8);
        
        // Trigger UBPM analysis to ensure fresh insights
        await ubpmService.analyzeUserBehaviorPatterns(userId, 'sandbox_generation');
        
        // ENHANCED DEBUGGING: Log detailed UBPM data
        logger.info('🔍 UBPM DATA VERIFICATION', { 
          userId, 
          hasProfile: !!userBehaviorProfile,
          hasContext: !!compressedUserContext,
          profileDetails: userBehaviorProfile ? {
            patternCount: userBehaviorProfile.behaviorPatterns?.length || 0,
            patterns: userBehaviorProfile.behaviorPatterns?.map(p => ({
              type: p.type,
              pattern: p.pattern,
              confidence: p.confidence,
              description: p.description?.substring(0, 50)
            })) || [],
            personalityTraits: userBehaviorProfile.personalityTraits?.length || 0,
            lastAnalysis: userBehaviorProfile.lastAnalysisDate
          } : 'No profile found',
          contextDetails: compressedUserContext ? {
            hasConversation: !!compressedUserContext.conversation,
            messageCount: compressedUserContext.conversation?.messageCount || 0,
            hasUserConstants: !!compressedUserContext.userConstants,
            recentEmotionsCount: compressedUserContext.recentEmotions?.length || 0
          } : 'No context found'
        });

      } catch (error) {
        logger.error('Failed to fetch comprehensive user context', { userId, error: error.message, stack: error.stack });
      }
    }

    // Build context for AI with pill configuration
    let contextPrompt = `User is exploring: "${query}"\n\nSelected actions: ${selectedActions.join(', ')}\n\n`;
    
    // Enhanced pill configuration integration
    if (pillConfig && pillConfig.focusAreas) {
      contextPrompt += `Focus Areas: ${pillConfig.focusAreas.join(', ')}\n`;
      contextPrompt += `Processing Approach: ${pillConfig.systemPrompts ? pillConfig.systemPrompts[0] : 'General assistance'}\n\n`;
    }
    
    // ========================================
    // 🔥 THE FUSE: EXPONENTIAL PREDICTIVE CONTEXT
    // ========================================
    // Locked Nodes + UBPM = Exponentially more powerful than sum of parts
    
    if (processedLockedContext && processedLockedContext.length > 0) {
      contextPrompt += `=== THE FUSE: PREDICTIVE KNOWLEDGE SYNTHESIS ===\n`;
      
      // Analyze locked context patterns for predictive insights
      const lockedThemes = processedLockedContext.map(node => node.category).filter(Boolean);
      const lockedTopics = processedLockedContext.map(node => 
        node.title.split(' ').slice(0, 3).join(' ')
      );
      
      // Generate UBPM-powered predictive bridges
      let predictiveContext = '';
      if (userBehaviorProfile?.behaviorPatterns) {
        const userPatterns = userBehaviorProfile.behaviorPatterns;
        const dominantPattern = userPatterns.sort((a, b) => b.confidence - a.confidence)[0];
        
        if (dominantPattern) {
          predictiveContext = `Given your ${dominantPattern.pattern} behavioral pattern (${Math.round(dominantPattern.confidence * 100)}% confidence), you're likely to be interested in: `;
          
          // Predict next logical questions based on locked content + UBPM
          if (dominantPattern.pattern.includes('analytical') || dominantPattern.pattern.includes('detail')) {
            predictiveContext += `deeper data analysis, methodological approaches, quantitative insights, and systematic frameworks related to ${lockedTopics.join(' and ')}.`;
          } else if (dominantPattern.pattern.includes('creative') || dominantPattern.pattern.includes('exploratory')) {
            predictiveContext += `innovative applications, creative synthesis, interdisciplinary connections, and novel perspectives bridging ${lockedTopics.join(' with ')}.`;
          } else if (dominantPattern.pattern.includes('collaborative') || dominantPattern.pattern.includes('social')) {
            predictiveContext += `community applications, collaborative approaches, social impact, and human-centered implementations of ${lockedTopics.join(' and ')}.`;
          } else {
            predictiveContext += `practical applications, implementation strategies, and actionable insights connecting ${lockedTopics.join(' with ')}.`;
          }
        }
      }
      
      contextPrompt += `🧠 PREDICTIVE INTELLIGENCE: ${predictiveContext}\n\n`;
      contextPrompt += `The user has locked ${processedLockedContext.length} nodes from previous explorations. Use THE FUSE to anticipate their next logical questions:\n\n`;
      
      processedLockedContext.forEach((node, index) => {
        contextPrompt += `🔒 Node ${index + 1}: "${node.title}"\n`;
        contextPrompt += `   Content: ${(node.content || '').substring(0, 200)}${node.content?.length > 200 ? '...' : ''}\n`;
        contextPrompt += `   Category: ${node.category || 'Unknown'}\n`;
        
        // Enhanced personal relevance with predictive power
        if (node.personalHook) {
          contextPrompt += `   Personal Relevance: ${node.personalHook}\n`;
        }
        
        // Deep insights integration
        if (node.deepInsights?.personalizedContext) {
          contextPrompt += `   User Insights: ${node.deepInsights.personalizedContext}\n`;
        }
        
        contextPrompt += '\n';
      });
      
      contextPrompt += `⚡ THE FUSE MANDATE: Don't just connect to locked knowledge - ANTICIPATE the user's next logical question. Create nodes that feel like natural extensions of their thinking process. This is the prescient knowledge engine.\n\n`;
      
      // ========================================
      // 🔮 FEATURE 2: PREDICTIVE INSIGHT - Quantified Prediction for Context Fusion
      // ========================================
      // Generate explicit prediction about user's intellectual trajectory
      
      if (userBehaviorProfile?.behaviorPatterns && processedLockedContext.length >= 2) {
        let predictiveInsight = '';
        let baseConfidence = 49; // Default from CEO directive
        
        // Analyze locked content themes for prediction
        const lockedCategories = processedLockedContext.map(node => node.category).filter(Boolean);
        const categoryFrequency = lockedCategories.reduce((acc, cat) => {
          acc[cat] = (acc[cat] || 0) + 1;
          return acc;
        }, {});
        
        const dominantCategory = Object.entries(categoryFrequency)
          .sort(([,a], [,b]) => b - a)[0]?.[0];
        
        // Enhance prediction confidence based on UBPM patterns
        const analyticalPatterns = userBehaviorProfile.behaviorPatterns.filter(p => 
          p.pattern?.includes('detailed_communicator') || 
          p.pattern?.includes('inquisitive_learner') ||
          p.pattern?.includes('analytical')
        );
        
        const creativePatterns = userBehaviorProfile.behaviorPatterns.filter(p => 
          p.pattern?.includes('emotionally_expressive') ||
          p.pattern?.includes('creative') || 
          p.pattern?.includes('exploratory')
        );
        
        logger.info('🔮 PREDICTIVE INSIGHT ANALYSIS', {
          userId,
          lockedNodeCount: processedLockedContext.length,
          analyticalPatternsFound: analyticalPatterns.length,
          creativePatternsFound: creativePatterns.length,
          totalPatterns: userBehaviorProfile.behaviorPatterns.length,
          dominantCategory
        });
        
        // Calculate enhanced confidence based on pattern strength
        if (analyticalPatterns.length > 0) {
          const avgAnalyticalConfidence = analyticalPatterns.reduce((sum, p) => sum + p.confidence, 0) / analyticalPatterns.length;
          baseConfidence += Math.round(avgAnalyticalConfidence * 15); // Up to +15% boost
        }
        
        if (creativePatterns.length > 0) {
          const avgCreativeConfidence = creativePatterns.reduce((sum, p) => sum + p.confidence, 0) / creativePatterns.length;
          baseConfidence += Math.round(avgCreativeConfidence * 10); // Up to +10% boost  
        }
        
        // Generate specific prediction based on patterns and locked content
        if (dominantCategory && analyticalPatterns.length > 0) {
          predictiveInsight = `probabilistic modeling and quantitative analysis within ${dominantCategory.toLowerCase()}`;
        } else if (dominantCategory && creativePatterns.length > 0) {
          predictiveInsight = `innovative applications and creative synthesis opportunities in ${dominantCategory.toLowerCase()}`;
        } else if (lockedTopics.length >= 2) {
          predictiveInsight = `interdisciplinary connections between ${lockedTopics[0]} and ${lockedTopics[1]}`;
        } else {
          predictiveInsight = `advanced applications and deeper theoretical frameworks`;
        }
        
        // Cap confidence at reasonable maximum
        baseConfidence = Math.min(baseConfidence, 73);
        
        contextPrompt += `🔮 PREDICTIVE INSIGHT GENERATION: The combination of your last ${processedLockedContext.length} locked nodes and your UBPM analysis allows me to predict with ${baseConfidence}% base confidence that your next area of inquiry will be related to ${predictiveInsight}.\n\n`;
        contextPrompt += `MANDATORY PREDICTIVE INSIGHT: Include this EXACT text in the "predictiveInsight" field for ALL nodes: "The combination of your last ${processedLockedContext.length} sifts and your UBPM allows me to predict with ${baseConfidence}% base confidence that your next area of inquiry will be related to ${predictiveInsight}."\n\n`;
      }
    }

    // Add comprehensive UBPM intelligence for surgical personalization
    if (compressedUserContext && userBehaviorProfile) {
      contextPrompt += `=== PERSONALIZATION INTELLIGENCE ===\n`;
      
      // Core behavioral patterns
      if (userBehaviorProfile.behaviorMetrics?.communicationStyle) {
        contextPrompt += `Communication Style: ${userBehaviorProfile.behaviorMetrics.communicationStyle}\n`;
      }
      
      if (userBehaviorProfile.behaviorMetrics?.learningStyle) {
        contextPrompt += `Learning Preference: ${userBehaviorProfile.behaviorMetrics.learningStyle}\n`;
      }
      
      // User interests and preferences
      const userConstants = compressedUserContext.userConstants;
      if (userConstants?.preferences?.interests) {
        contextPrompt += `Core Interests: ${userConstants.preferences.interests.join(', ')}\n`;
      }
      
      // Recent behavioral insights
      if (userConstants?.insights && userConstants.insights.length > 0) {
        const recentInsights = userConstants.insights.slice(0, 3);
        contextPrompt += `Recent Patterns: ${recentInsights.map(i => i.pattern || i.content || i).join('; ')}\n`;
      }
      
      // Emotional context for tone matching
      if (compressedUserContext.recentEmotions && compressedUserContext.recentEmotions.length > 0) {
        const primaryEmotion = compressedUserContext.recentEmotions[0];
        contextPrompt += `Current Emotional Context: ${primaryEmotion.emotion || primaryEmotion.type || 'neutral'}\n`;
      }
      
      // Conversation context for continuity
      if (compressedUserContext.conversation?.hasHistory) {
        contextPrompt += `Conversation Context: User has ${compressedUserContext.conversation.messageCount} recent interactions\n`;
      }
      
      contextPrompt += `\n⚡ CRITICAL: Use this intelligence to craft personalHook insights that are surgically precise to this user's actual patterns, interests, and communication style. Avoid generic personalization.\n\n`;
    }

    // Fallback: Add basic UBPM data from mobile if no compressed context available
    else if (userData && !compressedUserContext) {
      contextPrompt += `Basic User Context:\n`;
      
      if (userData.interests && userData.interests.length > 0) {
        contextPrompt += `- Interests: ${userData.interests.join(', ')}\n`;
      }
      
      if (userData.learningStyle) {
        contextPrompt += `- Learning Style: ${userData.learningStyle}\n`;
      }
      
      if (userData.behavioralMetrics?.communicationStyle) {
        contextPrompt += `- Communication Style: ${userData.behavioralMetrics.communicationStyle}\n`;
      }
      
      contextPrompt += '\n';
    }

    // ========================================
    // 🧠 THE PLAN: UBPM-INFLUENCED RESEARCH PLANNING
    // ========================================
    // The UBPM guides every Synthesizer decision from the first moment
    
    let researchApproach = 'balanced';
    let toolPriority = [];
    let explorationDepth = 'standard';
    
    // Analyze user's behavioral patterns to shape research plan
    if (userBehaviorProfile?.behaviorPatterns) {
      const patterns = userBehaviorProfile.behaviorPatterns;
      
      // ENHANCED PATTERN MATCHING: Match actual UBPM service patterns
      const analyticalPatterns = patterns.filter(p => 
        p.pattern?.includes('detailed_communicator') || 
        p.pattern?.includes('inquisitive_learner') ||
        p.pattern?.includes('analytical') ||
        p.pattern?.includes('systematic') || 
        p.pattern?.includes('data')
      );
      
      const creativePatterns = patterns.filter(p => 
        p.pattern?.includes('emotionally_expressive') ||
        p.pattern?.includes('exploratory') || 
        p.pattern?.includes('creative') ||
        p.pattern?.includes('innovative')
      );
      
      // Determine research approach based on behavioral dominance
      if (analyticalPatterns.length > creativePatterns.length) {
        researchApproach = 'data_driven';
        toolPriority = ['academic_search', 'web_search', 'news_search'];
        explorationDepth = 'deep_analysis';
      } else if (creativePatterns.length > analyticalPatterns.length) {
        researchApproach = 'exploratory';
        toolPriority = ['web_search', 'news_search', 'academic_search'];
        explorationDepth = 'broad_synthesis';
      } else {
        researchApproach = 'hybrid';
        toolPriority = ['web_search', 'academic_search', 'news_search'];
        explorationDepth = 'balanced_depth';
      }
      
      logger.info('🧠 UBPM Research Plan Generated', { 
        userId, 
        approach: researchApproach, 
        depth: explorationDepth,
        analyticalScore: analyticalPatterns.length,
        creativeScore: creativePatterns.length,
        totalPatterns: patterns.length,
        patternDetails: patterns.map(p => `${p.pattern}(${Math.round(p.confidence * 100)}%)`)
      });
    }

    // Determine optimal node count based on query complexity and actions (extended range)
    const baseNodeCount = 3;
    const actionBonus = Math.min(selectedActions.length, 3); // Max +3 for multiple actions
    const queryComplexityBonus = query.split(' ').length > 5 ? 2 : 0; // +2 for complex queries
    const lockedContextBonus = processedLockedContext && processedLockedContext.length > 0 ? 1 : 0; // +1 for recursive building
    const optimalNodeCount = Math.min(baseNodeCount + actionBonus + queryComplexityBonus + lockedContextBonus, 8); // Extended cap at 8
    
    // ========================================
    // 🎨 THE CURATION: UBPM-GUIDED SYNTHESIS
    // ========================================
    // Final nodes synthesized through the behavioral lens
    
    // Build approach-specific instructions with UBPM-powered personalHook guidance
    let curationInstructions = '';
    let contentStyle = '';
    let personalHookGuidance = '';
    
    // ========================================
    // 🧠 FEATURE 1: UBPM LINK - Explicit Connection Statement
    // ========================================
    // Generate surgical precision personalHook based on actual UBPM patterns
    
    let ubpmLinkGuidance = '';
    if (userBehaviorProfile?.behaviorPatterns && userBehaviorProfile.behaviorPatterns.length > 0) {
      // Extract the most confident behavioral pattern
      const dominantPattern = userBehaviorProfile.behaviorPatterns
        .sort((a, b) => b.confidence - a.confidence)[0];
      
      if (dominantPattern && dominantPattern.confidence > 0.7) {
        // Generate specific UBPM link statement
        const patternType = dominantPattern.pattern;
        const confidencePercent = Math.round(dominantPattern.confidence * 100);
        const description = dominantPattern.description;
        
        ubpmLinkGuidance = `CRITICAL UBPM LINK MANDATE: Every personalHook must begin with "Your UBPM shows ${description.toLowerCase()}" and then explain why this specific node is relevant. Use the exact pattern "${patternType}" (${confidencePercent}% confidence) to create surgically precise connections. This is NOT generic personalization - this is explicit behavioral analysis application.`;
      } else {
        ubpmLinkGuidance = `UBPM LINK: Every personalHook must begin with "Your UBPM shows [behavioral pattern]" based on their documented interaction style, then explain the connection.`;
      }
    } else {
      // Even for new users, enforce the "Your UBPM shows" format as per CEO directive
      ubpmLinkGuidance = `CRITICAL UBPM LINK MANDATE: Every personalHook must begin with "Your UBPM shows a developing pattern of [observed behavior]" since we are actively building their behavioral profile. Then explain why this node connects to their emerging interaction style. This demonstrates transparent intelligence in action.`;
    }
    
    switch (researchApproach) {
      case 'data_driven':
        curationInstructions = 'Prioritize factual accuracy, statistical evidence, and systematic analysis. Include quantitative insights where possible.';
        contentStyle = 'structured, evidence-based content with clear methodologies and data points';
        personalHookGuidance = `${ubpmLinkGuidance} Focus on analytical frameworks and data-driven connections.`;
        break;
      case 'exploratory':
        curationInstructions = 'Emphasize creative connections, innovative perspectives, and interdisciplinary synthesis. Inspire curiosity and discovery.';
        contentStyle = 'narrative-rich content with creative examples and novel connections';
        personalHookGuidance = `${ubpmLinkGuidance} Emphasize creative exploration and innovative thinking patterns.`;
        break;
      case 'hybrid':
        curationInstructions = 'Balance analytical rigor with creative insights. Combine data-driven evidence with innovative perspectives.';
        contentStyle = 'balanced content mixing factual grounding with creative applications';
        personalHookGuidance = `${ubpmLinkGuidance} Balance analytical and creative elements in the connection.`;
        break;
      default:
        curationInstructions = 'Provide comprehensive, balanced insights that serve multiple learning styles.';
        contentStyle = 'well-rounded content with practical applications';
        personalHookGuidance = `${ubpmLinkGuidance} Create relevant connections to their documented patterns.`;
    }
    
    // Build exploration depth guidance
    let depthGuidance = '';
    switch (explorationDepth) {
      case 'deep_analysis':
        depthGuidance = 'Provide comprehensive analysis with detailed explanations, multiple perspectives, and thorough context.';
        break;
      case 'broad_synthesis':
        depthGuidance = 'Create expansive connections across domains, emphasizing interdisciplinary links and creative applications.';
        break;
      case 'balanced_depth':
        depthGuidance = 'Balance depth and breadth, providing sufficient detail while maintaining accessibility and connection to broader themes.';
        break;
      default:
        depthGuidance = 'Maintain appropriate depth for the topic while ensuring practical applicability.';
    }

    const aiPrompt = `${contextPrompt}🧠 UBPM-GUIDED SYNTHESIS MANDATE:
Research Approach: ${researchApproach.toUpperCase()}
Exploration Depth: ${explorationDepth.replace('_', ' ').toUpperCase()}

${curationInstructions}
${depthGuidance}

Generate exactly ${optimalNodeCount} discovery nodes that help the user explore "${query}" in meaningful and interconnected ways. Focus on ${selectedActions.join(' and ')} aspects. Each node should offer a unique perspective that builds toward deeper understanding.

REQUIREMENTS:
- Title: Compelling, specific, max 60 chars
- Content: Rich markdown-formatted ${contentStyle} (2-3 paragraphs) with actionable insights, bullet points, and web search findings
- Category: Relevant domain (Technology, Science, Philosophy, Art, etc.)
- Confidence: 0.7-0.95 based on factual accuracy
- PersonalHook: ${personalHookGuidance} - make it surgically precise to their behavioral patterns

FOCUS ON:
- Practical applications and real-world impact
- Emerging trends and cutting-edge developments  
- Interdisciplinary connections and synthesis
- Actionable insights and learning opportunities

Return ONLY valid JSON array:
[
  {
    "title": "Specific, Compelling Title",
    "content": "Rich, informative content with concrete examples and actionable insights that inspire further exploration.",
    "category": "Relevant Category", 
    "confidence": 0.85,
    "personalHook": "Your UBPM shows [specific behavioral pattern] - explain precise connection",
    "predictiveInsight": "REQUIRED for context fusion: Use exact text provided above when locked nodes present, null otherwise"
  }
]

Ensure JSON is valid - no trailing commas, proper escaping.`;

    // Map frontend actions to backend tools (UBPM-influenced)
    const actionToToolMap = {
      'research': researchApproach === 'data_driven' ? ['academic_search', 'web_search'] : ['web_search', 'academic_search'],
      'search': ['web_search', 'news_search'],
      'explore': researchApproach === 'exploratory' ? ['web_search', 'news_search'] : ['web_search'],
      'analyze': ['academic_search', 'web_search', 'news_search'],
      'find': ['web_search'],
      'investigate': ['web_search', 'academic_search'],
      'discover': researchApproach === 'exploratory' ? ['web_search', 'news_search'] : ['web_search'],
      'lookup': ['web_search']
    };
    
    let tools = [];
    const requiredTools = new Set();
    
    // Determine tools based on UBPM-guided plan and selected actions
    selectedActions.forEach(action => {
      const actionLower = action.toLowerCase();
      if (actionToToolMap[actionLower]) {
        actionToToolMap[actionLower].forEach(tool => requiredTools.add(tool));
      }
    });
    
    // Apply UBPM-influenced tool priority ordering
    toolPriority.forEach(tool => {
      if (requiredTools.has(tool)) {
        requiredTools.delete(tool);
        requiredTools.add(tool); // Re-add to maintain priority order
      }
    });
    
    // Always ensure web_search for factual grounding
    requiredTools.add('web_search');
    
    // Additional tools based on selected actions
    if (selectedActions.some(action => 
      ['research', 'search', 'explore', 'analyze', 'find', 'investigate', 'discover', 'lookup'].includes(action.toLowerCase())
    )) {
      // Already added web_search above, but could add other research tools here
    }
    
    if (requiredTools.size > 0) {
      try {
        const allTools = await toolRegistry.getToolsForOpenAI();
        tools = allTools.filter(tool => 
          requiredTools.has(tool.function?.name)
        ).slice(0, 3); // Limit to 3 tools max for performance
        
        logger.debug('Added tools based on selected actions', { 
          toolCount: tools.length, 
          selectedActions,
          toolNames: tools.map(t => t.function.name)
        });
      } catch (error) {
        logger.warn('Failed to load tools for sandbox', { error: error.message });
      }
    }


    // ========================================
    // 🎯 THE PLANNER: Research Strategy & Tool Coordination
    // ========================================
    // Specialized model outlines research approach and coordinates tools
    
    const plannerPrompt = `You are the Planner - a specialized AI that creates research strategies and coordinates tool execution.

TASK: Create a research plan for "${query}" using ${selectedActions.join(' and ')} approaches.

UBPM CONTEXT:
- Research Approach: ${researchApproach.toUpperCase()}
- Exploration Depth: ${explorationDepth.replace('_', ' ').toUpperCase()}
- Target Nodes: ${optimalNodeCount}

${processedLockedContext && processedLockedContext.length > 0 ? 
  `LOCKED CONTEXT: Build upon ${processedLockedContext.length} locked nodes: ${processedLockedContext.map(n => n.title).join(', ')}`
  : ''}

OUTPUT: Return ONLY a JSON object with your research plan:
{
  "strategy": "Brief strategy description",
  "toolSequence": ["tool1", "tool2", "tool3"],
  "researchFoci": ["focus1", "focus2", "focus3"],
  "expectedInsights": ["insight1", "insight2"],
  "contextualHappenings": [
    {"phase": "planning", "action": "strategy_formulated", "details": "..."},
    {"phase": "tool_coordination", "action": "tools_prioritized", "details": "..."}
  ]
}`;

    logger.info('🎯 Invoking THE PLANNER for research strategy', { userId, researchApproach });
    
    const plannerResponse = await llmService.makeLLMRequest([
      { role: 'system', content: 'You are the Planner - create research strategies and coordinate tool execution. Respond with ONLY valid JSON.' },
      { role: 'user', content: plannerPrompt }
    ], {
      model: 'openai/gpt-4o-mini', // Fast, cost-effective for planning
      max_tokens: 800,
      temperature: 0.3, // More focused planning
      response_format: { type: "json_object" },
      observerSessionId,
      observerPurpose: 'planning'
    });
    
    // ========================================
    // 🛠️ JSON SANITIZATION UTILITY
    // ========================================
    /**
     * Extracts clean JSON from LLM response that might contain Markdown fences
     * @param {string} text - Raw response from LLM
     * @returns {string} - Clean JSON string
     */
    const extractJsonFromResponse = (text) => {
      if (!text || typeof text !== 'string') return text;
      
      // Remove markdown code fences (```json ... ```)
      const jsonFenceMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonFenceMatch && jsonFenceMatch[1]) {
        return jsonFenceMatch[1].trim();
      }
      
      // Remove any remaining code fences (``` ... ```)
      const codeFenceMatch = text.match(/```\s*([\s\S]*?)\s*```/);
      if (codeFenceMatch && codeFenceMatch[1]) {
        return codeFenceMatch[1].trim();
      }
      
      // Return as-is if no fences found
      return text.trim();
    };

    let researchPlan;
    try {
      const cleanPlannerContent = extractJsonFromResponse(plannerResponse.content);
      researchPlan = JSON.parse(cleanPlannerContent);
      logger.info('🎯 THE PLANNER strategy generated', { 
        userId, 
        strategy: researchPlan.strategy?.substring(0, 100),
        toolCount: researchPlan.toolSequence?.length 
      });
    } catch (error) {
      logger.warn('Planner response parsing failed, using fallback', { 
        error: error.message,
        rawContent: plannerResponse.content?.substring(0, 200)
      });
      researchPlan = {
        strategy: `${researchApproach} research approach for ${query}`,
        toolSequence: tools.map(t => t.function?.name).filter(Boolean),
        researchFoci: selectedActions,
        expectedInsights: ['comprehensive coverage', 'actionable insights'],
        contextualHappenings: [
          {"phase": "planning", "action": "fallback_strategy", "details": "Using default research plan"}
        ]
      };
    }

    // ========================================
    // 🔧 TOOL EXECUTION: Coordinated Research
    // ========================================
    // Execute tools based on Planner's strategy
    
    // Generate nodes using LLM with Planner-coordinated tools (OPTIMIZED FOR PREDICTIVE INSIGHT)
    let response = await llmService.makeLLMRequest([
      { role: 'system', content: 'You are an expert knowledge discovery assistant. Generate discovery nodes as a JSON array. Each node must have: title (string), content (concise markdown-formatted string), category (string), confidence (number 0-1), personalHook (string), and predictiveInsight (string or null). Keep content concise but informative. Your response must be ONLY a valid JSON array, no other text.' },
      { role: 'user', content: aiPrompt }
    ], {
      n_predict: 2000, // Increased for predictive insights
      temperature: 0.7,
      stop: ['\n\n\n', '```', 'Human:', 'Assistant:'],
      max_tokens: 2000, // Increased to prevent truncation
      presence_penalty: 0.1,
      frequency_penalty: 0.1,
      tools: tools.length > 0 ? tools : undefined,
      observerSessionId,
      observerPurpose: 'generation',
      tool_choice: tools.length > 0 ? 'auto' : undefined,
      response_format: { type: "json_object" } // Force JSON response
    });
    
    // Handle tool calls if present (similar to completion endpoint)
    if (response.stop_reason === 'tool_calls' && response.tool_calls) {
      logger.debug('Sandbox executing tool calls', { toolCallCount: response.tool_calls.length });
      
      
      try {
        const toolResults = [];
        
        // Execute each tool call
        for (const toolCall of response.tool_calls) {
          const toolName = toolCall.function?.name;
          const toolArgs = JSON.parse(toolCall.function?.arguments || '{}');
          
          logger.debug('Sandbox executing tool', { toolName, toolArgs });
          
          const toolResult = await toolExecutor.executeToolCall(toolCall, { 
            userId, 
            observerSessionId 
          });
          
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            content: JSON.stringify(toolResult)
          });
        }
        
        // Get final response with tool results
        const messagesWithTools = [
          { role: 'system', content: 'You must respond with ONLY a JSON array of discovery nodes. Format: [{"title":"string","content":"markdown-formatted string with search findings","category":"string","confidence":0.0-1.0,"personalHook":"string or null"}]. Use web search results to create rich, factual content formatted as markdown with headings, bullet points, and links. No other text allowed.' },
          { role: 'user', content: aiPrompt },
          { 
            role: 'assistant', 
            content: '', 
            tool_calls: response.tool_calls 
          }, // Assistant's tool call message
          ...toolResults // Tool results
        ];
        
        logger.debug('Making follow-up request with tool results', { 
          messageCount: messagesWithTools.length,
          toolResultCount: toolResults.length 
        });
        
        logger.debug('Getting final sandbox response after tool execution');
        
        
        response = await llmService.makeLLMRequest(messagesWithTools, {
          n_predict: 2000, // Increased for predictive insights
          temperature: 0.7,
          stop: ['\n\n\n', '```', 'Human:', 'Assistant:'],
          max_tokens: 2000, // Increased to prevent truncation
          presence_penalty: 0.1,
          frequency_penalty: 0.1,
          observerSessionId,
          observerPurpose: 'tool_analysis',
          tools: [], // No tools in follow-up to avoid loops
          response_format: { type: "json_object" } // Force JSON response
        });
        
      } catch (toolError) {
        logger.error('Error executing tools in sandbox', { error: toolError.message });
        // Create a new response object with default content
        response = {
          ...response,
          content: JSON.stringify([
          {
            title: `${query} Overview`,
            content: `An overview of ${query} and its key aspects.`,
            category: "Research",
            confidence: 0.8
          },
          {
            title: `Current Trends in ${query}`,
            content: `Latest developments and trends in the field of ${query}.`,
            category: "Trends",
            confidence: 0.75
          },
          {
            title: `Future of ${query}`,
            content: `Potential future directions and implications of ${query}.`,
            category: "Future",
            confidence: 0.7
          }
        ])
        };
      }
    }
    
    const aiResponse = response.content || '';
    
    logger.debug('Sandbox AI response', { 
      hasContent: !!response.content,
      contentLength: response.content?.length || 0,
      contentPreview: response.content?.substring(0, 100)
    });

    // ========================================
    // 🎨 THE CURATOR: Final Synthesis & Enhancement
    // ========================================
    // Specialized model handles final node synthesis and quality enhancement
    
    let curatedNodes;
    try {
      // First parse the raw nodes
      let rawNodes;
      let cleanResponse = aiResponse.trim().replace(/```json\n?|\n?```/g, '').trim();
      const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        rawNodes = JSON.parse(jsonMatch[0]);
      } else {
        rawNodes = JSON.parse(cleanResponse);
      }
      
      if (!Array.isArray(rawNodes)) {
        throw new Error('Raw nodes not an array');
      }
      
      logger.info('🎨 Invoking THE CURATOR for final synthesis', { 
        userId, 
        rawNodeCount: rawNodes.length,
        plannerStrategy: researchPlan.strategy?.substring(0, 50)
      });
      
      // Enhanced curation with Planner's strategy context and new transparency features
      const curatorPrompt = `You are the Curator - enhance research findings into polished discovery nodes with transparent intelligence.

PLANNER'S STRATEGY: ${researchPlan.strategy}  
RESEARCH APPROACH: ${researchApproach} with ${explorationDepth.replace('_', ' ')} depth

RAW FINDINGS: ${JSON.stringify(rawNodes)}

ENHANCEMENT MANDATE:
1. Refine titles for maximum impact
2. Enrich content with factual depth
3. Perfect personalHook with UBPM transparency - start with "Your UBPM shows..." when behavioral data exists
4. Include predictiveInsight field for context fusion scenarios (when multiple locked nodes are present)

CRITICAL: Maintain all fields including personalHook and predictiveInsight. The response must demonstrate transparent intelligence.

Return enhanced JSON array:`;

      const curatorResponse = await llmService.makeLLMRequest([
        { role: 'system', content: 'You are the Curator. Enhance nodes and respond with ONLY a valid JSON array. Keep content concise to prevent truncation.' },
        { role: 'user', content: curatorPrompt }
      ], {
        model: 'openai/gpt-4o-mini', // Cost-effective for enhancement  
        max_tokens: 2000, // Increased to prevent truncation
        temperature: 0.4,
        observerSessionId,
        observerPurpose: 'curation',
        response_format: { type: "json_object" }
      });
      
      // Parse curator response with sanitization
      const cleanCuratorContent = extractJsonFromResponse(curatorResponse.content);
      const curatorJsonMatch = cleanCuratorContent.match(/\[[\s\S]*\]/);
      
      if (curatorJsonMatch) {
        curatedNodes = JSON.parse(curatorJsonMatch[0]);
        
        // Add contextual happenings from Planner
        curatedNodes = curatedNodes.map(node => ({
          ...node,
          contextualHappenings: [
            ...(researchPlan.contextualHappenings || []),
            {"phase": "curation", "action": "enhanced_synthesis", "details": `Curated via ${researchApproach} approach`}
          ]
        }));
        
        logger.info('🎨 THE CURATOR enhancement complete', { 
          userId, 
          curatedNodeCount: curatedNodes.length 
        });
      } else {
        throw new Error('Could not parse curator response');
      }
      
    } catch (curatorError) {
      logger.warn('Curator process failed, using standard parsing', { 
        userId, 
        error: curatorError.message 
      });
      curatedNodes = null; // Will use standard parsing
    }

    let generatedNodes;
    try {
      // Use curated nodes if available, otherwise fall back to standard parsing
      if (curatedNodes && Array.isArray(curatedNodes)) {
        generatedNodes = curatedNodes;
        logger.info('Using Curator-enhanced nodes', { nodeCount: generatedNodes.length });
      } else {
        // Standard parsing fallback
        let cleanResponse = aiResponse.trim();
        
        if (!cleanResponse) {
          throw new Error('Empty response from AI');
        }
        
        // Remove code blocks if present
        cleanResponse = cleanResponse.replace(/```json\n?|\n?```/g, '').trim();
        
        // Try to extract JSON array if wrapped in other text
        const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          cleanResponse = jsonMatch[0];
        }
        
        generatedNodes = JSON.parse(cleanResponse);
        
        // Validate it's an array
        if (!Array.isArray(generatedNodes)) {
          throw new Error('Response is not an array');
        }
        
        logger.debug('Using standard parsed nodes', { nodeCount: generatedNodes.length });
      }
      
    } catch (parseError) {
      logger.warn('Failed to parse AI response as JSON', { 
        response: aiResponse.substring(0, 300),
        error: parseError.message 
      });
      
      // Intelligent fallback: extract key information from text response
      const sentences = aiResponse.split('.').filter(s => s.trim().length > 10);
      generatedNodes = sentences.slice(0, 3).map((sentence, index) => ({
        title: `${query} - Aspect ${index + 1}`,
        content: sentence.trim() + (sentence.endsWith('.') ? '' : '.'),
        category: 'Discovery',
        confidence: 0.75,
        personalHook: index === 0 ? 'This foundational concept connects to your exploration journey.' : null
      }));
    }

    // Validate and sanitize generated nodes with dynamic limits including new predictiveInsight field
    const maxNodes = Math.min(optimalNodeCount + 2, 10); // Allow up to +2 extra, hard cap at 10
    const validNodes = (Array.isArray(generatedNodes) ? generatedNodes : [generatedNodes])
      .filter(node => node && typeof node.title === 'string' && typeof node.content === 'string')
      .slice(0, maxNodes) // Dynamic limit with hard cap
      .map(node => ({
        title: String(node.title).substring(0, 100),
        content: String(node.content).substring(0, 1500), // Increased for rich markdown content
        category: String(node.category || 'Discovery').substring(0, 50),
        confidence: Math.min(1.0, Math.max(0.0, parseFloat(node.confidence) || 0.7)),
        personalHook: node.personalHook ? String(node.personalHook).substring(0, 200) : null,
        predictiveInsight: node.predictiveInsight ? String(node.predictiveInsight).substring(0, 300) : null
      }));

    if (validNodes.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Failed to generate valid nodes'
      });
    }

    logger.info('Successfully generated sandbox nodes', { 
      userId, 
      nodeCount: validNodes.length,
      query: query.substring(0, 50)
    });


    // Unregister observer before response
    processingObserver.unregisterObserver(observerSessionId);

    res.json({
      success: true,
      data: {
        nodes: validNodes
      }
    });

  } catch (error) {
    // Cleanup observer on error
    processingObserver.unregisterObserver(observerSessionId);

    logger.error('Error in sandbox generate-nodes', { 
      userId: req.user?._id,
      error: error.message,
      stack: error.stack
    });

    // More detailed error for debugging
    console.error('SANDBOX DEBUG - Full error:', error);
    console.error('SANDBOX DEBUG - Error name:', error.name);
    console.error('SANDBOX DEBUG - Error message:', error.message);

    res.status(500).json({
      success: false,
      error: 'Failed to generate nodes',
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /sandbox/pill-combinations
 * Get insights and recommendations for pill button combinations
 */
router.post('/pill-combinations', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { currentPills, query, context } = req.body;

    logger.debug('Pill combinations request', { 
      userId, 
      currentPills,
      query: query?.substring(0, 100)
    });

    if (!currentPills || !Array.isArray(currentPills)) {
      return res.status(400).json({
        success: false,
        error: 'Current pills array is required'
      });
    }

    // Define pill synergies and recommendations
    const pillSynergies = {
      'write+think': {
        synergy: 0.95,
        description: 'Analytical writing with structured reasoning',
        recommendedApproach: 'Combine creative expression with logical analysis',
        additionalPills: ['connect', 'explore']
      },
      'find+explore': {
        synergy: 0.92,
        description: 'Comprehensive research and discovery',
        recommendedApproach: 'Deep information gathering with broad exploration',
        additionalPills: ['think', 'connect']
      },
      'imagine+connect': {
        synergy: 0.88,
        description: 'Creative ideation with relationship mapping',
        recommendedApproach: 'Generate innovative ideas while finding connections',
        additionalPills: ['explore', 'write']
      },
      'think+connect': {
        synergy: 0.90,
        description: 'Analytical pattern recognition',
        recommendedApproach: 'Structured thinking with relationship analysis',
        additionalPills: ['find', 'ubpm']
      },
      'ubpm+write': {
        synergy: 0.93,
        description: 'Personalized creative expression',
        recommendedApproach: 'Tailored writing based on behavioral patterns',
        additionalPills: ['think', 'imagine']
      },
      'ubpm+think': {
        synergy: 0.91,
        description: 'Personalized analytical processing',
        recommendedApproach: 'Analytical thinking adapted to user patterns',
        additionalPills: ['connect', 'find']
      }
    };

    // Analyze current combination
    const combinationKey = currentPills.sort().join('+');
    const currentSynergy = pillSynergies[combinationKey] || {
      synergy: 0.75,
      description: 'Custom combination',
      recommendedApproach: 'Multi-faceted approach combining selected capabilities',
      additionalPills: []
    };

    // Generate recommendations based on query and current pills
    const recommendations = [];
    const availablePills = ['write', 'think', 'find', 'imagine', 'connect', 'explore', 'ubpm'];
    const unusedPills = availablePills.filter(pill => !currentPills.includes(pill));

    // Smart recommendations based on query content
    if (query) {
      const queryLower = query.toLowerCase();
      
      if (queryLower.includes('how') || queryLower.includes('why') || queryLower.includes('explain')) {
        if (!currentPills.includes('think')) recommendations.push({
          pill: 'think',
          reason: 'Query suggests analytical processing needed',
          confidence: 0.85
        });
      }
      
      if (queryLower.includes('creative') || queryLower.includes('idea') || queryLower.includes('imagine')) {
        if (!currentPills.includes('imagine')) recommendations.push({
          pill: 'imagine',
          reason: 'Query indicates creative ideation focus',
          confidence: 0.88
        });
      }
      
      if (queryLower.includes('research') || queryLower.includes('find') || queryLower.includes('search')) {
        if (!currentPills.includes('find')) recommendations.push({
          pill: 'find',
          reason: 'Query requires information discovery',
          confidence: 0.90
        });
      }
      
      if (queryLower.includes('connect') || queryLower.includes('relate') || queryLower.includes('between')) {
        if (!currentPills.includes('connect')) recommendations.push({
          pill: 'connect',
          reason: 'Query involves relationship analysis',
          confidence: 0.87
        });
      }
    }

    // Add synergy-based recommendations
    if (currentSynergy.additionalPills) {
      currentSynergy.additionalPills.forEach(pill => {
        if (!currentPills.includes(pill)) {
          recommendations.push({
            pill,
            reason: `Enhances synergy with current combination`,
            confidence: 0.82
          });
        }
      });
    }

    // Calculate effectiveness metrics
    const effectivenessMetrics = {
      currentSynergyScore: currentSynergy.synergy,
      combinationComplexity: currentPills.length > 3 ? 'high' : currentPills.length > 1 ? 'medium' : 'low',
      recommendedOptimization: recommendations.length > 0 ? 'available' : 'optimized',
      focusCoherence: currentPills.length <= 3 ? 'high' : 'medium'
    };

    logger.info('Pill combinations analyzed', { 
      userId,
      currentPills,
      synergyScore: currentSynergy.synergy,
      recommendationsCount: recommendations.length
    });

    res.json({
      success: true,
      data: {
        currentCombination: {
          pills: currentPills,
          synergy: currentSynergy,
          key: combinationKey
        },
        recommendations: recommendations.slice(0, 3), // Limit to top 3
        metrics: effectivenessMetrics,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error in pill combinations analysis', { 
      userId: req.user?._id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to analyze pill combinations'
    });
  }
});

/**
 * POST /sandbox/enhance-node
 * Enhance a node with user context and personalized insights
 */
router.post('/enhance-node', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { node, userContext } = req.body;

    logger.debug('Sandbox enhance-node request', { 
      userId,
      nodeTitle: node?.title?.substring(0, 50)
    });

    // Validate required fields
    if (!node || !node.title || !node.content) {
      return res.status(400).json({
        success: false,
        error: 'Node with title and content is required'
      });
    }

    // Get user data for enhancement
    const user = await User.findById(userId);
    const userBehaviorProfile = await UserBehaviorProfile.findOne({ userId });

    // Build enhancement context
    let enhancementData = {
      relevantUserData: {},
      personalizedContext: '',
      dataConnections: [],
      suggestedConnections: []
    };

    // Add user behavior data if available
    if (userBehaviorProfile) {
      enhancementData.relevantUserData = {
        preferences: userBehaviorProfile.preferences,
        learningStyle: userBehaviorProfile.behaviorMetrics?.learningStyle,
        interests: userBehaviorProfile.preferences?.interests || []
      };

      // Generate personalized context
      const contextPrompt = `Given this discovery node:
Title: ${node.title}
Content: ${node.content}
Category: ${node.category}

And this user profile:
Interests: ${userBehaviorProfile.preferences?.interests?.join(', ') || 'None'}
Learning Style: ${userBehaviorProfile.behaviorMetrics?.learningStyle || 'Not determined'}

Provide a 1-2 sentence personalized insight about how this node connects to the user's profile.`;

      try {
        const personalizedResponse = await llmService.makeLLMRequest([
          { role: 'system', content: 'You are a personalization expert. Generate concise, insightful connections between concepts and user profiles.' },
          { role: 'user', content: contextPrompt }
        ], {
          n_predict: 200,
          temperature: 0.5,
          observerSessionId,
          observerPurpose: 'synthesis'
        });
        
        enhancementData.personalizedContext = personalizedResponse.content.trim();
      } catch (error) {
        logger.warn('Failed to generate personalized context', { userId, error: error.message });
        enhancementData.personalizedContext = 'This discovery connects to your exploration patterns.';
      }

      // Create data connections
      enhancementData.dataConnections = [
        {
          type: 'personality',
          value: userBehaviorProfile.behaviorMetrics || {},
          source: 'UBPM',
          relevanceScore: 0.8
        }
      ];

      // Generate suggested connections based on user interests
      if (userBehaviorProfile.preferences?.interests) {
        enhancementData.suggestedConnections = userBehaviorProfile.preferences.interests
          .slice(0, 3)
          .map(interest => interest.toLowerCase());
      }
    } else {
      enhancementData.personalizedContext = 'This discovery offers new insights for your exploration.';
      enhancementData.suggestedConnections = ['exploration', 'learning', 'discovery'];
    }

    logger.info('Successfully enhanced sandbox node', { 
      userId,
      nodeTitle: node.title.substring(0, 50)
    });

    res.json({
      success: true,
      data: enhancementData
    });

  } catch (error) {
    logger.error('Error in sandbox enhance-node', { 
      userId: req.user?._id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to enhance node'
    });
  }
});

/**
 * POST /sandbox/analyze-connections
 * Analyze connections between nodes for relationship insights
 */
router.post('/analyze-connections', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { nodes, connections } = req.body;

    logger.debug('Sandbox analyze-connections request', { 
      userId,
      nodeCount: nodes?.length,
      connectionCount: connections?.length
    });

    if (!nodes || !Array.isArray(nodes)) {
      return res.status(400).json({
        success: false,
        error: 'Nodes array is required for connection analysis'
      });
    }
    
    if (nodes.length < 2) {
      // Return a helpful response instead of error for single node
      return res.json({
        success: true,
        data: {
          connections: [],
          insights: ['Add more nodes to discover meaningful connections between ideas.'],
          message: 'Need at least 2 nodes for connection analysis'
        }
      });
    }

    // Analyze connections using AI
    const connectionPrompt = `Analyze the relationships between these discovery nodes:

${nodes.map((node, index) => `${index + 1}. ${node.title}: ${node.content}`).join('\n')}

Identify:
1. Thematic connections between nodes
2. Conceptual relationships
3. Potential synthesis opportunities

Return insights about how these concepts connect and build upon each other.`;

    const analysisResponse = await llmService.makeLLMRequest([
      { role: 'user', content: connectionPrompt }
    ], {
      n_predict: 400,
      temperature: 0.6,
      observerSessionId,
      observerPurpose: 'synthesis'
    });

    // Generate connection strength scores
    const connectionAnalysis = {
      insights: analysisResponse.content.trim(),
      connectionStrengths: [],
      synthesisOpportunities: []
    };

    // Calculate connection strengths between all node pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const strength = Math.random() * 0.4 + 0.6; // Mock scoring 0.6-1.0
        connectionAnalysis.connectionStrengths.push({
          nodeA: nodes[i].title,
          nodeB: nodes[j].title,
          strength: parseFloat(strength.toFixed(2))
        });
      }
    }

    // Generate synthesis opportunities
    connectionAnalysis.synthesisOpportunities = [
      'Explore the intersection of these concepts',
      'Consider practical applications across domains',
      'Investigate historical connections'
    ];

    logger.info('Successfully analyzed sandbox connections', { 
      userId,
      nodeCount: nodes.length
    });

    res.json({
      success: true,
      data: connectionAnalysis
    });

  } catch (error) {
    logger.error('Error in sandbox analyze-connections', { 
      userId: req.user?._id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to analyze connections'
    });
  }
});

/**
 * POST /sandbox/save-session
 * Save a sandbox session with nodes and connections
 */
router.post('/save-session', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { sessionId, nodes, connections, userQuery, metadata } = req.body;

    logger.debug('Sandbox save-session request', { userId, sessionId, nodeCount: nodes?.length });

    if (!sessionId || !nodes || !Array.isArray(nodes)) {
      return res.status(400).json({
        success: false,
        error: 'Session ID and nodes array are required'
      });
    }

    // Create session data structure
    const sessionData = {
      userId,
      sessionId,
      nodes: nodes.map(node => ({
        id: node.id,
        title: String(node.title || '').substring(0, 100),
        content: String(node.content || '').substring(0, 1000),
        position: node.position || { x: 0, y: 0 },
        connections: Array.isArray(node.connections) ? node.connections : [],
        category: String(node.category || 'Discovery').substring(0, 50),
        confidence: Math.min(1.0, Math.max(0.0, parseFloat(node.confidence) || 0.7)),
        isLocked: Boolean(node.isLocked),
        lockTimestamp: node.lockTimestamp || null,
        personalHook: node.personalHook ? String(node.personalHook).substring(0, 200) : null
      })),
      connections: Array.isArray(connections) ? connections : [],
      userQuery: String(userQuery || '').substring(0, 500),
      timestamp: new Date(),
      metadata: {
        completenessScore: metadata?.completenessScore || 0.5,
        dataQuality: metadata?.dataQuality || 'basic',
        nodeCount: nodes.length,
        ...metadata
      }
    };

    // Save to MongoDB
    const existingSession = await SandboxSession.findOne({ sessionId, userId });
    
    if (existingSession) {
      // Update existing session
      existingSession.nodes = sessionData.nodes;
      existingSession.connections = sessionData.connections;
      existingSession.userQuery = sessionData.userQuery;
      existingSession.metadata = sessionData.metadata;
      existingSession.lastAccessed = new Date();
      await existingSession.save();
      
      logger.info('Updated existing sandbox session', { 
        userId, 
        sessionId,
        nodeCount: sessionData.nodes.length 
      });
    } else {
      // Create new session
      const newSession = new SandboxSession(sessionData);
      await newSession.save();
      
      logger.info('Created new sandbox session', { 
        userId, 
        sessionId,
        nodeCount: sessionData.nodes.length 
      });
    }

    res.json({
      success: true,
      data: {
        sessionId: sessionData.sessionId,
        timestamp: sessionData.timestamp,
        nodeCount: sessionData.nodes.length,
        metadata: sessionData.metadata
      }
    });

  } catch (error) {
    logger.error('Error in sandbox save-session', {
      userId: req.user?._id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to save session'
    });
  }
});

/**
 * GET /sandbox/sessions
 * Get user's saved sandbox sessions
 */
router.get('/sessions', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const offset = parseInt(req.query.offset) || 0;

    logger.debug('Sandbox sessions request', { userId, limit, offset });

    // Fetch real sessions from MongoDB
    const totalSessions = await SandboxSession.countDocuments({ userId, isActive: true });
    
    const sessions = await SandboxSession.find({ 
      userId, 
      isActive: true 
    })
    .select('sessionId userQuery createdAt updatedAt metadata nodes connections')
    .sort({ lastAccessed: -1, createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();
    
    // Format sessions for response
    const formattedSessions = sessions.map(session => ({
      sessionId: session.sessionId,
      userQuery: session.userQuery,
      timestamp: session.updatedAt || session.createdAt,
      nodeCount: session.nodes?.length || 0,
      connectionCount: session.connections?.length || 0,
      metadata: session.metadata || { completenessScore: 0.5, dataQuality: 'basic' },
      lastAccessed: session.lastAccessed || session.updatedAt
    }));

    logger.info('Successfully retrieved sandbox sessions', { 
      userId,
      sessionCount: formattedSessions.length,
      totalSessions
    });

    res.json({
      success: true,
      data: {
        sessions: formattedSessions,
        total: totalSessions,
        limit,
        offset
      }
    });

  } catch (error) {
    logger.error('Error in sandbox sessions', {
      userId: req.user?._id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve sessions'
    });
  }
});

/**
 * POST /sandbox/contextual-search  
 * Perform contextual search within sandbox nodes
 */
router.post('/contextual-search', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { searchQuery, context, nodes } = req.body;

    logger.debug('Sandbox contextual-search request', { 
      userId,
      query: searchQuery?.substring(0, 50),
      nodeCount: nodes?.length 
    });

    if (!searchQuery || typeof searchQuery !== 'string' || searchQuery.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required and must be a non-empty string'
      });
    }

    // Perform semantic search across user's sandbox data
    let searchResults = [];
    
    if (nodes && nodes.length > 0) {
      // Search within provided nodes
      searchResults = nodes
        .map(node => {
          let relevanceScore = 0;
          const queryLower = (searchQuery || '').toLowerCase();
          
          // Title match (highest weight)
          if (node.title?.toLowerCase().includes(queryLower)) {
            relevanceScore += 0.4;
          }
          
          // Content match
          if (node.content?.toLowerCase().includes(queryLower)) {
            relevanceScore += 0.3;
          }
          
          // Category match
          if (node.category?.toLowerCase().includes(queryLower)) {
            relevanceScore += 0.2;
          }
          
          // Personal hook match
          if (node.personalHook?.toLowerCase().includes(queryLower)) {
            relevanceScore += 0.1;
          }
          
          return {
            ...node,
            relevanceScore: Math.min(relevanceScore, 1.0)
          };
        })
        .filter(node => node.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 10);
    } else {
      // Search across user's saved sessions
      const searchRegex = new RegExp(searchQuery, 'i');
      const matchingSessions = await SandboxSession.find({
        userId,
        isActive: true,
        $or: [
          { userQuery: searchRegex },
          { 'nodes.title': searchRegex },
          { 'nodes.content': searchRegex },
          { 'nodes.category': searchRegex }
        ]
      })
      .select('sessionId userQuery nodes')
      .limit(5)
      .lean();
      
      // Extract matching nodes from sessions
      for (const session of matchingSessions) {
        const matchingNodes = session.nodes.filter(node => {
          const queryLower = (searchQuery || '').toLowerCase();
          return node.title?.toLowerCase().includes(queryLower) ||
                 node.content?.toLowerCase().includes(queryLower) ||
                 node.category?.toLowerCase().includes(queryLower);
        });
        
        searchResults.push(...matchingNodes.map(node => ({
          ...node,
          sessionId: session.sessionId,
          sessionQuery: session.userQuery,
          relevanceScore: 0.8 // Base score for saved nodes
        })));
      }
      
      searchResults = searchResults
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 10);
    }

    logger.info('Successfully performed contextual search', { 
      userId,
      searchQuery: searchQuery.substring(0, 50),
      resultCount: searchResults.length 
    });

    res.json({
      success: true,
      data: {
        searchQuery,
        results: searchResults,
        resultCount: searchResults.length
      }
    });

  } catch (error) {
    logger.error('Error in sandbox contextual-search', {
      userId: req.user?._id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to perform contextual search'
    });
  }
});

/**
 * POST /sandbox/lock-node
 * Lock a node for persistent use across sessions
 */
router.post('/lock-node', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { node, reason, priority, tags } = req.body;

    logger.debug('Sandbox lock-node request', { userId, nodeTitle: node?.title });

    if (!node || !node.title || !node.content) {
      return res.status(400).json({
        success: false,
        error: 'Node with title and content is required'
      });
    }

    // Generate unique node ID if not provided
    const nodeId = node.id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check if node is already locked
    const existingLocked = await LockedNode.findOne({ userId, nodeId });
    
    if (existingLocked) {
      // Update existing locked node
      existingLocked.title = node.title;
      existingLocked.content = node.content;
      existingLocked.category = node.category || 'Discovery';
      existingLocked.personalHook = node.personalHook;
      existingLocked.confidence = node.confidence || 0.7;
      existingLocked.lockData.reason = reason;
      existingLocked.lockData.priority = priority || 'medium';
      existingLocked.lockData.tags = Array.isArray(tags) ? tags : [];
      await existingLocked.updateUsage();
      
      logger.info('Updated existing locked node', { userId, nodeId });
    } else {
      // Create new locked node
      const lockedNode = new LockedNode({
        userId,
        nodeId,
        title: node.title,
        content: node.content,
        category: node.category || 'Discovery',
        personalHook: node.personalHook,
        confidence: node.confidence || 0.7,
        lockData: {
          reason: reason || 'User locked for future use',
          priority: priority || 'medium',
          tags: Array.isArray(tags) ? tags : [],
          relatedSessions: []
        },
        contextualData: {
          originalQuery: node.originalQuery,
          relatedNodes: [],
          userContext: {},
          enhancementData: {
            personalizedContext: '',
            dataConnections: [],
            suggestedConnections: []
          }
        }
      });
      
      await lockedNode.save();
      logger.info('Created new locked node', { userId, nodeId });
    }

    // PATTERN ENGINE ACTIVATION: Check for pattern analysis triggers
    try {
      const { default: triggerSystem } = await import('../services/triggerSystem.js');
      
      // Trigger 1: Check for category clustering (3+ nodes in same category)
      await triggerSystem.checkNodeLockingPattern(userId, {
        title: node.title,
        content: node.content,
        category: node.category || 'Discovery'
      });
      
      logger.debug('Pattern engine triggers checked', { userId, nodeId });
    } catch (triggerError) {
      logger.warn('Pattern trigger check failed (non-critical)', { 
        userId, 
        nodeId, 
        error: triggerError.message 
      });
    }

    res.json({
      success: true,
      data: {
        nodeId,
        message: 'Node successfully locked'
      }
    });

  } catch (error) {
    logger.error('Error in sandbox lock-node', {
      userId: req.user?._id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to lock node'
    });
  }
});

/**
 * GET /sandbox/locked-nodes
 * Get user's locked nodes
 */
router.get('/locked-nodes', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const priority = req.query.priority;
    const tags = req.query.tags ? req.query.tags.split(',') : null;

    logger.debug('Sandbox locked-nodes request', { userId, limit, priority, tags });

    // Build query
    const query = { userId, isActive: true };
    if (priority) query['lockData.priority'] = priority;
    if (tags) query['lockData.tags'] = { $in: tags };

    const lockedNodes = await LockedNode.find(query)
      .select('-__v')
      .sort({ 'usageStats.lastUsed': -1, createdAt: -1 })
      .limit(limit)
      .lean();

    logger.info('Successfully retrieved locked nodes', { 
      userId,
      nodeCount: lockedNodes.length 
    });

    res.json({
      success: true,
      data: {
        lockedNodes,
        count: lockedNodes.length
      }
    });

  } catch (error) {
    logger.error('Error in sandbox locked-nodes', {
      userId: req.user?._id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve locked nodes'
    });
  }
});

/**
 * POST /sandbox/node/:nodeId/window-query
 * Node Windows - Collaborative Research Environment
 * Performs deep AI-assisted research within a node's context
 */
router.post('/node/:nodeId/window-query', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { nodeId } = req.params;
    const { userQuery, nodeContext } = req.body;

    logger.debug('Node Window query request', { 
      userId, 
      nodeId,
      query: userQuery?.substring(0, 100)
    });

    // Validate required fields
    if (!userQuery || typeof userQuery !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'User query is required and must be a string'
      });
    }

    if (!nodeContext || !nodeContext.title) {
      return res.status(400).json({
        success: false,
        error: 'Node context with title is required'
      });
    }

    // Import the LLM service
    const { createLLMService } = await import('../services/llmService.js');
    const llmService = createLLMService();

    // Execute the Window Query research workflow
    logger.info('Starting Window Query research workflow', { 
      userId, 
      nodeId,
      nodeTitle: nodeContext.title.substring(0, 50),
      query: userQuery.substring(0, 100)
    });

    const researchResults = await llmService.handleWindowQuery(nodeContext, userQuery);

    if (!researchResults.success) {
      return res.status(500).json({
        success: false,
        error: 'Research workflow failed',
        details: researchResults.error
      });
    }

    // TODO: Implement memory scoping for Window sessions
    // This will be handled in enhancedMemoryService.js
    
    logger.info('Window Query research completed successfully', { 
      userId, 
      nodeId,
      tidBitsCount: researchResults.data.tidBits.length,
      hasWebResults: researchResults.data.webSearchResults?.success,
      hasAcademicResults: researchResults.data.academicSearchResults?.success
    });

    res.json({
      success: true,
      data: {
        nodeId,
        research: {
          userQuery: researchResults.data.userQuery,
          synthesis: researchResults.data.synthesis,
          tidBits: researchResults.data.tidBits,
          webSearchCount: researchResults.data.webSearchResults?.results?.length || 0,
          academicSearchCount: researchResults.data.academicSearchResults?.data?.papers?.length || 0,
          timestamp: researchResults.data.timestamp
        }
      }
    });

  } catch (error) {
    logger.error('Error in sandbox window-query', { 
      userId: req.user?._id,
      nodeId: req.params.nodeId,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to perform window research'
    });
  }
});

/**
 * POST /sandbox/chain-of-thought
 * Execute chain-of-thought reasoning with real-time streaming updates
 */
router.post('/chain-of-thought', protect, checkTierLimits, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { query, options = {}, sessionId, stream = true } = req.body;

    logger.info('Chain of thought request received', { 
      userId, 
      query: query?.substring(0, 100),
      sessionId,
      hasOptions: !!options,
      stream 
    });

    // Validate required fields
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a string'
      });
    }

    if (!stream) {
      return res.status(400).json({
        success: false,
        error: 'Only streaming mode is supported for chain of thought'
      });
    }

    // Configure Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({
      type: 'connection',
      message: 'Chain of thought process starting...',
      sessionId: sessionId || `cot_${Date.now()}`
    })}\n\n`);
    res.flush(); // FORCE IMMEDIATE TRANSMISSION

    // Set up streaming callbacks
    const streamCallbacks = {
      onStepUpdate: (step, message) => {
        try {
          const updateData = {
            type: 'step_update',
            currentStep: step.id,
            steps: step.allSteps,
            message: message || '',
            timestamp: new Date().toISOString()
          };

          res.write(`data: ${JSON.stringify(updateData)}\n\n`);
          
          logger.debug('Step update sent', { 
            userId, 
            stepId: step.id,
            hasMessage: !!message 
          });
        } catch (writeError) {
          logger.error('Error writing step update', { 
            userId, 
            error: writeError.message 
          });
        }
      },

      onComplete: (result) => {
        try {
          const completionData = {
            type: 'final_result',
            data: result,
            timestamp: new Date().toISOString()
          };

          res.write(`data: ${JSON.stringify(completionData)}\n\n`);
          res.write('data: [DONE]\n\n');
          
          logger.info('Chain of thought completed successfully', { 
            userId, 
            nodesCount: result.nodes?.length || 0,
            sessionId: result.sessionId 
          });
          
          res.end();
        } catch (writeError) {
          logger.error('Error writing completion data', { 
            userId, 
            error: writeError.message 
          });
          res.end();
        }
      },

      onError: (error) => {
        try {
          const errorData = {
            type: 'error',
            message: error.message || 'An unexpected error occurred',
            timestamp: new Date().toISOString()
          };

          res.write(`data: ${JSON.stringify(errorData)}\n\n`);
          
          logger.error('Chain of thought error sent to client', { 
            userId, 
            error: error.message 
          });
          
          res.end();
        } catch (writeError) {
          logger.error('Error writing error data', { 
            userId, 
            error: writeError.message 
          });
          res.end();
        }
      }
    };

    // Handle client disconnect
    req.on('close', () => {
      logger.info('Chain of thought client disconnected', { userId, sessionId });
    });

    req.on('aborted', () => {
      logger.info('Chain of thought request aborted', { userId, sessionId });
    });

    // Start AI activity monitoring for transparency
    const processId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    aiActivityMonitor.startProcess(userId.toString(), processId, query);

    // Enhanced callbacks that integrate monitoring with real AI processing
    const enhancedCallbacks = {
      onStepUpdate: (stepData, progressMessage) => {
        try {
          // Convert chainOfThoughtEngine format to frontend expected format
          const frontendFormat = {
            type: 'step_update',
            currentStep: stepData.id,
            steps: stepData.allSteps || [],
            message: progressMessage || '',
            timestamp: new Date().toISOString()
          };

          res.write(`data: ${JSON.stringify(frontendFormat)}\n\n`);
          res.flush(); // FORCE IMMEDIATE TRANSMISSION TO CLIENT
          
          logger.debug('Enhanced step update sent and flushed', { 
            userId, 
            stepId: stepData.id,
            hasMessage: !!progressMessage,
            stepsCount: stepData.allSteps?.length || 0
          });
        } catch (writeError) {
          logger.error('Error writing step update', { 
            userId, 
            error: writeError.message 
          });
        }
      },

      onComplete: (result) => {
        try {
          aiActivityMonitor.completeProcess(userId.toString());
          
          // Handle the new simplified narration result format
          const completionData = {
            type: 'narration_complete',
            data: {
              narrationComplete: result.narrationComplete || true,
              message: result.message || 'LLAMA narration finished',
              sessionId: result.sessionId,
              originalQuery: result.originalQuery,
              timestamp: new Date().toISOString()
            }
          };

          res.write(`data: ${JSON.stringify(completionData)}\n\n`);
          res.flush(); // FORCE IMMEDIATE TRANSMISSION
          res.write('data: [DONE]\n\n');
          res.flush(); // FORCE IMMEDIATE TRANSMISSION
          
          logger.info('Chain of thought narration completed', { 
            userId, 
            sessionId: result.sessionId,
            message: result.message 
          });
          
          res.end();
        } catch (writeError) {
          logger.error('Error writing narration completion data', { 
            userId, 
            error: writeError.message 
          });
          res.end();
        }
      },

      onError: (error) => {
        try {
          aiActivityMonitor.handleProcessError(userId.toString(), error);
          
          const errorData = {
            type: 'error',
            message: error.message || 'An unexpected error occurred',
            timestamp: new Date().toISOString()
          };

          res.write(`data: ${JSON.stringify(errorData)}\n\n`);
          
          logger.error('Chain of thought error with monitoring cleanup', { 
            userId, 
            error: error.message 
          });
          
          res.end();
        } catch (writeError) {
          logger.error('Error writing error data', { 
            userId, 
            error: writeError.message 
          });
          res.end();
        }
      }
    };

    // Start the REAL chain of thought process with AI transparency
    await chainOfThoughtEngine.processQuery(
      userId.toString(),
      query,
      {
        ...options,
        fastModel: 'meta-llama/llama-3.1-8b-instruct', // Llama for intelligent narration
        mainModel: 'openai/gpt-4o', // GPT-4o for heavy reasoning
        context: {
          actions: options.actions || [],
          useUBPM: options.useUBPM || false,
          includeUserData: options.includeUserData || true,
          sessionId: sessionId || `cot_${Date.now()}`,
          enableTransparency: true, // Enable AI transparency features
          aiActivityMonitor // Pass monitor for integration
        }
      },
      enhancedCallbacks
    );

  } catch (error) {
    logger.error('Chain of thought endpoint error', { 
      userId: req.user?.id || req.user?._id,
      error: error.message,
      stack: error.stack
    });

    // If response hasn't been sent yet, send error response
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to process chain of thought request'
      });
    } else {
      // If streaming has started, send error through stream
      try {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          message: 'Internal server error during processing'
        })}\n\n`);
        res.end();
      } catch (writeError) {
        logger.error('Failed to send streaming error', { 
          userId: req.user?.id || req.user?._id,
          error: writeError.message 
        });
      }
    }
  }
});


export default router;