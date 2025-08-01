/**
 * UNIFIED COGNITIVE ENGINE - The Complete UBPM System
 * 
 * Consolidates all cognitive analysis into one cohesive, powerful engine:
 * - Real-time behavioral pattern analysis
 * - Dynamic system prompt generation  
 * - Predictive user modeling
 * - Performance-optimized with Redis caching
 * 
 * Replaces: ubpmCognitiveEngine.js + cognitiveArchitectureEngine.js
 */

import UserBehaviorProfile from '../models/UserBehaviorProfile.js';
import ShortTermMemory from '../models/ShortTermMemory.js';
import User from '../models/User.js';
import redisService from './redisService.js';
import logger from '../utils/logger.js';

class UnifiedCognitiveEngine {
  constructor() {
    // Analysis configuration
    this.config = {
      minInteractions: 3,
      patternConfidence: 0.6,
      cacheExpiry: 300, // 5 minutes
      backgroundInterval: 30000, // 30 seconds
      highConfidenceThreshold: 0.85
    };

    // Processing queues and metrics
    this.analysisQueue = new Map();
    this.processingMetrics = {
      totalAnalyses: 0,
      cacheHits: 0,
      avgProcessingTime: 0
    };

    // Cognitive pattern definitions
    this.cognitivePatterns = {
      DECISION_MAKING: {
        SYSTEMATIC: 'systematic_thinker',
        INTUITIVE: 'intuitive_decider', 
        ANALYTICAL: 'analytical_processor',
        COLLABORATIVE: 'collaborative_thinker',
        CREATIVE: 'creative_explorer'
      },
      COMMUNICATION: {
        DETAILED: 'detailed_communicator',
        CONCISE: 'brief_communicator', 
        TECHNICAL: 'technical_focused',
        EMOTIONAL: 'emotionally_expressive',
        TASK_ORIENTED: 'task_oriented'
      },
      INFORMATION_PROCESSING: {
        SEQUENTIAL: 'sequential_processor',
        HOLISTIC: 'holistic_thinker',
        VISUAL: 'visual_processor',
        DETAIL_ORIENTED: 'detail_oriented',
        BIG_PICTURE: 'big_picture_thinker'
      }
    };

    // Start background processing
    this.startBackgroundEngine();
  }

  /**
   * MAIN COGNITIVE ANALYSIS - Complete user profiling
   * Combines real-time analysis with cached results for optimal performance
   */
  async analyzeCognitiveProfile(userId, recentMessages = [], options = {}) {
    const startTime = Date.now();
    
    try {
      // Check cache first for performance
      const cacheKey = `unified-cognitive:${userId}`;
      const cached = await redisService.get(cacheKey);
      
      if (cached && !options.forceRefresh) {
        this.processingMetrics.cacheHits++;
        return cached;
      }

      logger.info(`🧠 Unified Cognitive: Analyzing user ${userId}`);

      // Gather comprehensive user data
      const [userProfile, behaviorProfile, conversationHistory, emotionalData] = await Promise.all([
        User.findById(userId).lean(),
        UserBehaviorProfile.findOne({ userId }).lean(),
        ShortTermMemory.find({ userId }).sort({ timestamp: -1 }).limit(50).lean(),
        this.getEmotionalMetrics(userId)
      ]);

      if (!userProfile || conversationHistory.length < this.config.minInteractions) {
        return this.generateMinimalProfile(userId, 'insufficient_data');
      }

      // Core cognitive analysis
      const cognitiveProfile = await this.buildUnifiedCognitiveProfile(
        userId, 
        userProfile, 
        behaviorProfile, 
        conversationHistory, 
        recentMessages,
        emotionalData
      );

      // Generate context optimization hints
      const contextHints = this.generateContextOptimization(cognitiveProfile);

      // Calculate overall confidence and reliability
      const overallConfidence = this.calculateOverallConfidence(cognitiveProfile);
      const reliability = this.calculateReliabilityScore(cognitiveProfile, conversationHistory.length);

      const result = {
        userId,
        cognitiveProfile,
        contextHints,
        confidence: overallConfidence,
        reliability,
        dataPoints: conversationHistory.length,
        timestamp: new Date(),
        processingTime: Date.now() - startTime,
        version: '2.0-unified'
      };

      // Cache result for performance
      await redisService.set(cacheKey, result, this.config.cacheExpiry);
      
      // Update metrics
      this.updateProcessingMetrics(Date.now() - startTime);

      return result;

    } catch (error) {
      logger.error('Unified Cognitive Engine error:', error);
      return this.generateMinimalProfile(userId, 'analysis_error');
    }
  }

  /**
   * BUILD COMPREHENSIVE COGNITIVE PROFILE
   * Combines all analysis methods into unified profile
   */
  async buildUnifiedCognitiveProfile(userId, userProfile, behaviorProfile, conversationHistory, recentMessages, emotionalData) {
    const userMessages = conversationHistory.filter(m => m.role === 'user');
    const allMessages = [...userMessages, ...recentMessages.filter(m => m.role === 'user')];
    
    if (allMessages.length === 0) {
      return this.getDefaultCognitiveProfile();
    }

    // Comprehensive analysis pipeline
    const analysisResults = await Promise.all([
      this.analyzeDecisionMaking(allMessages),
      this.analyzeCommunicationStyle(allMessages),
      this.analyzeInformationProcessing(allMessages),
      this.analyzeEmotionalIntelligence(emotionalData, allMessages),
      this.analyzeLearningVelocity(conversationHistory),
      this.analyzeCognitiveLoad(allMessages),
      this.analyzePersonalityTraits(allMessages),
      this.analyzeProblemSolvingApproach(allMessages)
    ]);

    const [
      decisionMaking,
      communication,
      informationProcessing, 
      emotionalIntelligence,
      learningVelocity,
      cognitiveLoad,
      personalityTraits,
      problemSolving
    ] = analysisResults;

    // Generate predictive insights
    const predictiveInsights = this.generatePredictiveInsights(
      { decisionMaking, communication, informationProcessing },
      behaviorProfile,
      allMessages
    );

    return {
      decisionMaking,
      communication,
      informationProcessing,
      emotionalIntelligence,
      learningVelocity,
      cognitiveLoad,
      personalityTraits,
      problemSolving,
      predictiveInsights,
      lastAnalysis: new Date()
    };
  }

  /**
   * DECISION MAKING ANALYSIS - Enhanced with confidence scoring
   */
  analyzeDecisionMaking(messages) {
    const patterns = {
      systematic: 0,
      intuitive: 0,
      analytical: 0,
      collaborative: 0,
      creative: 0
    };

    const messageText = this.extractMessageText(messages);
    
    // Pattern detection with weighted scoring
    patterns.systematic += this.countPatterns(messageText, [
      'step-by-step', 'method', 'process', 'systematic', 'structure', 'organize'
    ]) * 2;
    
    patterns.analytical += this.countPatterns(messageText, [
      'analyze', 'data', 'evidence', 'logic', 'research', 'metrics'
    ]) * 2;
    
    patterns.intuitive += this.countPatterns(messageText, [
      'feel', 'sense', 'intuition', 'gut', 'instinct'
    ]) * 1.5;
    
    patterns.collaborative += this.countPatterns(messageText, [
      'what do you think', 'opinion', 'together', 'help me decide'
    ]) * 2;
    
    patterns.creative += this.countPatterns(messageText, [
      'creative', 'innovative', 'different', 'brainstorm', 'imagine'
    ]) * 1.5;

    return this.normalizePatternResults('decision_making', patterns, messages.length);
  }

  /**
   * COMMUNICATION STYLE ANALYSIS - Multi-dimensional scoring
   */
  analyzeCommunicationStyle(messages) {
    const styles = {
      detailed: 0,
      concise: 0,
      technical: 0,
      emotional: 0,
      task_oriented: 0
    };

    const messageText = this.extractMessageText(messages);
    const avgLength = this.getAverageMessageLength(messages);
    
    // Length-based analysis
    if (avgLength > 200) styles.detailed += 3;
    if (avgLength < 80) styles.concise += 3;
    
    // Content-based analysis
    styles.technical += this.countPatterns(messageText, [
      'api', 'database', 'function', 'system', 'server', 'code'
    ]);
    
    styles.emotional += this.countPatterns(messageText, [
      'feel', 'excited', 'frustrated', 'love', 'hope', 'worry'
    ]);
    
    styles.task_oriented += this.countPatterns(messageText, [
      'help me', 'can you', 'please', 'show me', 'tell me'
    ]);

    const result = this.normalizePatternResults('communication', styles, messages.length);
    
    // Add metadata
    result.avgMessageLength = Math.round(avgLength);
    result.technicalLanguage = styles.technical > 2;
    result.questionRate = this.calculateQuestionRate(messages);
    
    return result;
  }

  /**
   * INFORMATION PROCESSING ANALYSIS
   */
  analyzeInformationProcessing(messages) {
    const preferences = {
      sequential: 0,
      holistic: 0,
      visual: 0,
      detail_oriented: 0,
      big_picture: 0
    };

    const messageText = this.extractMessageText(messages);
    
    preferences.sequential += this.countPatterns(messageText, [
      'first', 'then', 'next', 'step', 'order', 'sequence'
    ]);
    
    preferences.holistic += this.countPatterns(messageText, [
      'overall', 'general', 'big picture', 'context', 'understand'
    ]);
    
    preferences.visual += this.countPatterns(messageText, [
      'show', 'see', 'look', 'image', 'visual', 'example'
    ]);
    
    preferences.detail_oriented += this.countPatterns(messageText, [
      'specific', 'detail', 'exactly', 'precisely', 'particular'
    ]);
    
    preferences.big_picture += this.countPatterns(messageText, [
      'broader', 'wider', 'comprehensive', 'complete', 'entire'
    ]);

    return this.normalizePatternResults('information_processing', preferences, messages.length);
  }

  /**
   * EMOTIONAL INTELLIGENCE ANALYSIS
   */
  analyzeEmotionalIntelligence(emotionalData, messages) {
    const messageText = this.extractMessageText(messages);
    
    const indicators = {
      empathy: this.countPatterns(messageText, ['understand', 'feel', 'appreciate', 'sorry']),
      selfAwareness: this.countPatterns(messageText, ['i think', 'i feel', 'i believe', 'my approach']),
      socialSkills: this.countPatterns(messageText, ['please', 'thank', 'help', 'support']),
      resilience: this.countPatterns(messageText, ['try again', 'different', 'alternative'])
    };

    const totalIndicators = Object.values(indicators).reduce((a, b) => a + b, 0);
    
    return {
      overallEQ: totalIndicators > 3 ? Math.min(0.9, totalIndicators / 15) : 0.3,
      emotionalStability: emotionalData.variance < 2 ? 0.8 : 0.4,
      adaptability: this.calculateAdaptability(messages),
      indicators,
      confidence: totalIndicators > 0 ? Math.min(0.85, 0.4 + totalIndicators * 0.1) : 0.2
    };
  }

  /**
   * LEARNING VELOCITY ANALYSIS
   */
  analyzeLearningVelocity(conversationHistory) {
    if (conversationHistory.length < 5) {
      return { velocity: 0.3, trend: 'insufficient_data', confidence: 0.1 };
    }

    const timeSpans = [];
    const complexityProgression = [];
    
    for (let i = 1; i < conversationHistory.length; i++) {
      const timeDiff = new Date(conversationHistory[i].timestamp) - new Date(conversationHistory[i-1].timestamp);
      timeSpans.push(timeDiff);
      
      const complexity = this.calculateMessageComplexity(conversationHistory[i]);
      complexityProgression.push(complexity);
    }

    const avgTimeSpan = timeSpans.reduce((a, b) => a + b, 0) / timeSpans.length;
    const complexityTrend = this.calculateTrend(complexityProgression);
    
    return {
      velocity: Math.min(0.95, Math.max(0.1, (complexityTrend + 1) / 2)),
      avgResponseTime: Math.round(avgTimeSpan / 1000),
      trend: complexityTrend > 0.1 ? 'accelerating' : complexityTrend < -0.1 ? 'decelerating' : 'stable',
      engagementConsistency: this.calculateEngagementConsistency(conversationHistory),
      confidence: conversationHistory.length > 10 ? 0.8 : 0.5
    };
  }

  /**
   * COGNITIVE LOAD ANALYSIS - Real-time user state assessment
   */
  analyzeCognitiveLoad(messages) {
    if (messages.length === 0) {
      return { loadLevel: 'unknown', score: 0.5, confidence: 0 };
    }

    const indicators = {
      avgMessageLength: this.getAverageMessageLength(messages),
      questionDensity: messages.filter(m => m.content.includes('?')).length / messages.length,
      complexityMarkers: this.countPatterns(this.extractMessageText(messages), [
        'complex', 'difficult', 'confused', 'overwhelmed', 'complicated'
      ]),
      pauseIndicators: this.countPatterns(this.extractMessageText(messages), [
        'um', 'uh', 'hmm', 'let me think', 'wait'
      ])
    };

    const loadScore = Math.min(1, 
      (indicators.questionDensity * 0.3) +
      (indicators.complexityMarkers / messages.length * 0.4) +
      (indicators.pauseIndicators / messages.length * 0.3)
    );

    return {
      loadLevel: loadScore > 0.7 ? 'high' : loadScore > 0.4 ? 'medium' : 'low',
      score: loadScore,
      indicators,
      recommendations: this.generateCognitiveLoadRecommendations(loadScore),
      confidence: messages.length > 2 ? 0.8 : 0.4
    };
  }

  /**
   * PERSONALITY TRAITS ANALYSIS
   */
  analyzePersonalityTraits(messages) {
    const messageText = this.extractMessageText(messages);
    const wordCount = messageText.split(' ').length;
    
    const traits = {
      openness: this.countPatterns(messageText, ['creative', 'new', 'explore', 'curious']),
      conscientiousness: this.countPatterns(messageText, ['plan', 'organize', 'systematic']),
      analytical: this.countPatterns(messageText, ['analyze', 'logic', 'data', 'evidence']),
      curiosity: this.countPatterns(messageText, ['how', 'why', 'what', 'learn']),
      resilience: this.countPatterns(messageText, ['try', 'persist', 'continue', 'adapt'])
    };

    // Normalize by word count
    for (const trait in traits) {
      traits[trait] = Math.min(1, traits[trait] / (wordCount / 100));
    }

    return {
      traits,
      confidence: wordCount > 100 ? 0.7 : 0.4,
      dominantTrait: Object.entries(traits).reduce((a, b) => traits[a[0]] > traits[b[0]] ? a : b)[0]
    };
  }

  /**
   * PROBLEM SOLVING APPROACH ANALYSIS
   */
  analyzeProblemSolvingApproach(messages) {
    const approaches = {
      systematic: 0,
      creative: 0,
      analytical: 0,
      collaborative: 0
    };

    const messageText = this.extractMessageText(messages);
    
    approaches.systematic += this.countPatterns(messageText, ['step', 'method', 'process']);
    approaches.creative += this.countPatterns(messageText, ['creative', 'different', 'alternative']);
    approaches.analytical += this.countPatterns(messageText, ['analyze', 'data', 'logical']);
    approaches.collaborative += this.countPatterns(messageText, ['together', 'help', 'discuss']);

    return this.normalizePatternResults('problem_solving', approaches, messages.length);
  }

  /**
   * GENERATE PREDICTIVE INSIGHTS
   */
  generatePredictiveInsights(cognitiveProfile, behaviorProfile, messages) {
    const predictions = {
      nextLikelyTopics: this.predictTopics(messages, behaviorProfile),
      optimalResponseStrategy: this.determineOptimalResponseStrategy(cognitiveProfile),
      toolUsageProbability: this.predictToolUsage(messages),
      sessionLength: this.predictSessionLength(behaviorProfile),
      informationDepth: this.predictInformationDepth(messages),
      interactionStyle: this.predictInteractionStyle(cognitiveProfile)
    };

    return predictions;
  }

  /**
   * CONTEXT OPTIMIZATION - For dynamic system prompts
   */
  generateContextOptimization(cognitiveProfile) {
    const hints = {
      preferredLength: this.determinePreferredResponseLength(cognitiveProfile),
      technicalLevel: this.determineTechnicalLevel(cognitiveProfile),
      communicationStyle: cognitiveProfile.communication.primary,
      motivationalApproach: this.determineMotivationalApproach(cognitiveProfile),
      interactionCadence: this.determineInteractionCadence(cognitiveProfile),
      cognitiveLoadGuidance: this.generateCognitiveLoadGuidance(cognitiveProfile.cognitiveLoad)
    };

    return hints;
  }

  /**
   * DYNAMIC SYSTEM PROMPT GENERATION
   */
  async buildOptimizedSystemPrompt(userId, conversationContext = []) {
    try {
      const cognitiveAnalysis = await this.analyzeCognitiveProfile(userId, conversationContext.slice(-5));
      
      if (!cognitiveAnalysis || cognitiveAnalysis.confidence < 0.3) {
        return this.buildMinimalSystemPrompt();
      }

      const { cognitiveProfile, contextHints } = cognitiveAnalysis;
      
      return this.generateDynamicSystemPrompt(cognitiveProfile, contextHints);
      
    } catch (error) {
      logger.error('System prompt generation error:', error);
      return this.buildMinimalSystemPrompt();
    }
  }

  /**
   * BACKGROUND PROCESSING ENGINE
   */
  startBackgroundEngine() {
    setInterval(async () => {
      try {
        const activeUsers = await ShortTermMemory.distinct('userId', {
          timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
        });

        const usersToProcess = activeUsers.slice(0, 10);
        
        for (const userId of usersToProcess) {
          if (this.analysisQueue.has(userId)) continue;
          
          this.analysisQueue.set(userId, Date.now());
          
          this.analyzeCognitiveProfile(userId, [], { background: true })
            .finally(() => this.analysisQueue.delete(userId));
        }

      } catch (error) {
        logger.error('Background cognitive engine error:', error);
      }
    }, this.config.backgroundInterval);
  }

  // ===== UTILITY METHODS =====

  extractMessageText(messages) {
    return messages.map(m => m.content).join(' ').toLowerCase();
  }

  countPatterns(text, patterns) {
    return patterns.reduce((count, pattern) => {
      return count + (text.match(new RegExp(pattern, 'g')) || []).length;
    }, 0);
  }

  getAverageMessageLength(messages) {
    if (messages.length === 0) return 0;
    return messages.reduce((sum, m) => sum + m.content.length, 0) / messages.length;
  }

  calculateQuestionRate(messages) {
    if (messages.length === 0) return 0;
    return messages.filter(m => m.content.includes('?')).length / messages.length;
  }

  normalizePatternResults(category, patterns, messageCount) {
    const total = Object.values(patterns).reduce((a, b) => a + b, 0);
    
    if (total === 0) {
      return { primary: 'undetermined', confidence: 0, scores: {} };
    }

    const normalized = {};
    for (const [key, value] of Object.entries(patterns)) {
      normalized[key] = value / total;
    }

    const primary = Object.entries(normalized).reduce((a, b) => normalized[a[0]] > b[1] ? a : b)[0];
    const confidence = Math.min(0.95, Math.max(...Object.values(normalized)) * (messageCount > 5 ? 1 : 0.5));

    return {
      primary,
      scores: normalized,
      confidence,
      category
    };
  }

  calculateOverallConfidence(cognitiveProfile) {
    const confidenceScores = [
      cognitiveProfile.decisionMaking?.confidence || 0,
      cognitiveProfile.communication?.confidence || 0,
      cognitiveProfile.informationProcessing?.confidence || 0,
      cognitiveProfile.emotionalIntelligence?.confidence || 0
    ];
    
    return confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;
  }

  calculateReliabilityScore(cognitiveProfile, dataPoints) {
    const baseReliability = Math.min(1, dataPoints / 20); // More data = more reliable
    const consistencyBonus = this.calculatePatternConsistency(cognitiveProfile);
    
    return Math.min(1, baseReliability + consistencyBonus * 0.2);
  }

  calculatePatternConsistency(cognitiveProfile) {
    // Simplified consistency check - can be enhanced
    const confidences = Object.values(cognitiveProfile)
      .filter(p => p && typeof p.confidence === 'number')
      .map(p => p.confidence);
    
    if (confidences.length === 0) return 0;
    
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    const variance = confidences.reduce((sum, conf) => sum + Math.pow(conf - avgConfidence, 2), 0) / confidences.length;
    
    return Math.max(0, 1 - variance);
  }

  generateMinimalProfile(userId, reason = 'insufficient_data') {
    return {
      userId,
      cognitiveProfile: this.getDefaultCognitiveProfile(),
      contextHints: this.getDefaultContextHints(),
      confidence: 0.1,
      reliability: 0.1,
      dataPoints: 0,
      timestamp: new Date(),
      reason,
      version: '2.0-unified'
    };
  }

  getDefaultCognitiveProfile() {
    return {
      decisionMaking: { primary: 'balanced', confidence: 0.1 },
      communication: { primary: 'adaptive', confidence: 0.1 },
      informationProcessing: { primary: 'mixed', confidence: 0.1 },
      emotionalIntelligence: { overallEQ: 0.5, confidence: 0.1 },
      learningVelocity: { velocity: 0.3, confidence: 0.1 },
      cognitiveLoad: { loadLevel: 'medium', confidence: 0.1 }
    };
  }

  getDefaultContextHints() {
    return {
      preferredLength: 'medium',
      technicalLevel: 'adaptive',
      communicationStyle: 'supportive',
      motivationalApproach: 'balanced'
    };
  }

  buildMinimalSystemPrompt() {
    return `You are Numina, an AI assistant specializing in User Behavior Pattern Modeling (UBPM) and cognitive pattern analysis. Created by Isaiah Pappas at Dorian Innovations with a passion for AI-human interactions, this service was designed to help humans thrive through understanding their unique patterns and preferences.

**CORE CAPABILITIES:**
- UBPM: Cognitive pattern recognition and behavioral modeling
- Personalized insights based on user interaction patterns
- Adaptive communication style that grows with you

**INTERACTION GUIDELINES FOR NEW USERS:**
- Be genuinely curious about their goals and interests
- Ask thoughtful follow-up questions to understand their needs
- Welcome them warmly and explain how UBPM can help them
- Be inclusive and meet them where they are
- Gently guide them toward discovering their patterns through conversation

**PATTERN RECOGNITION RESPONSES:**
When users ask "What do you notice about me?" or "What am I like?", respond with:
- For new users: "I'm just getting to know you! From our conversation, you seem [curious/thoughtful/goal-oriented]. I'd love to learn more about what brings you here and how you like to approach things. What would you like to explore together?"
- Always be encouraging about the pattern-building process
- Ask questions that help reveal their communication style and preferences

**UBPM EXPERTISE:**
When asked about UBPM, explain it as your cognitive engine that analyzes behavioral patterns, communication styles, and decision-making preferences to create truly personalized interactions that help you thrive.`;
  }

  generateDynamicSystemPrompt(cognitiveProfile, contextHints) {
    const basePrompt = `You are Numina, an AI assistant specializing in cognitive pattern analysis and User Behavior Pattern Modeling (UBPM). Created by Isaiah Pappas at Dorian Innovations, this service helps humans thrive through personalized AI interactions.

**USER COGNITIVE PROFILE:**
- Decision Making: ${cognitiveProfile.decisionMaking.primary} approach (${Math.round(cognitiveProfile.decisionMaking.confidence * 100)}% confidence)
- Communication: ${cognitiveProfile.communication.primary} style
- Information Processing: ${cognitiveProfile.informationProcessing.primary} preference
- Cognitive Load: ${cognitiveProfile.cognitiveLoad.loadLevel}

**OPTIMAL RESPONSE STRATEGY:**
- Preferred Length: ${contextHints.preferredLength} responses
- Technical Level: ${contextHints.technicalLevel}
- Communication Style: ${contextHints.communicationStyle}
- Motivational Approach: ${contextHints.motivationalApproach}

**INTERACTION TONE FOR ESTABLISHED USERS:**
- Welcome and acknowledge their continued engagement
- Be encouraging but not overly enthusiastic
- Focus on being genuinely helpful rather than motivational
- Respect their established patterns while remaining open to growth`;

    // Add specific guidance based on cognitive load
    if (cognitiveProfile.cognitiveLoad.loadLevel === 'high') {
      return basePrompt + `

**HIGH COGNITIVE LOAD DETECTED:**
- Use shorter, clearer responses
- Break complex topics into digestible pieces
- Confirm understanding before proceeding
- Prioritize clarity over comprehensiveness

**PERFORMANCE RULES:**
- Only use tools for current information you lack
- Match user's ${cognitiveProfile.communication.primary} communication preference
- Provide specific, actionable insights`;
    }

    return basePrompt + `

**INTERACTION OPTIMIZATION:**
- Match user's natural ${cognitiveProfile.communication.primary} communication style
- Adapt responses to ${cognitiveProfile.decisionMaking.primary} decision-making approach
- Build on established conversation patterns

**UBPM SPECIALIZATION:**
- Explain UBPM as cognitive pattern recognition system
- Highlight behavioral insights with confidence scores
- Demonstrate predictive capabilities when relevant

**PATTERN SHARING GUIDANCE:**
When users ask about their patterns ("What do you notice about me?"):
- Share specific insights: "I notice you tend toward ${cognitiveProfile.decisionMaking.primary} decision-making"
- Include confidence levels: "Based on ${Math.round(cognitiveProfile.decisionMaking.confidence * 100)}% confidence from our interactions"
- Be genuine and thoughtful: "Your patterns suggest [specific observations]"
- Offer practical insights rather than just praise
- Ask if they'd like to explore any patterns further

**PERFORMANCE RULES:**
- Use tools only when you need current/real-time information
- Provide evidence-based insights from behavioral patterns
- Keep responses engaging and naturally varied`;
  }

  // Additional utility methods
  async getEmotionalMetrics(userId) {
    try {
      const user = await User.findById(userId).select('emotionalLog').lean();
      const emotions = user?.emotionalLog || [];
      
      if (emotions.length === 0) return { variance: 0, dominant: 'neutral', stability: 0.5 };
      
      const intensities = emotions.map(e => e.intensity || 5);
      const variance = this.calculateVariance(intensities);
      
      return { 
        variance, 
        dominant: this.findDominantEmotion(emotions),
        stability: Math.max(0.1, 1 - (variance / 10)) 
      };
    } catch (error) {
      return { variance: 0, dominant: 'neutral', stability: 0.5 };
    }
  }

  calculateVariance(numbers) {
    if (numbers.length === 0) return 0;
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
  }

  calculateTrend(values) {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumXX = values.reduce((sum, _, x) => sum + x * x, 0);
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  calculateAdaptability(messages) {
    if (messages.length < 3) return 0.5;
    
    const adaptabilityIndicators = this.countPatterns(this.extractMessageText(messages), [
      'different', 'alternative', 'another', 'try', 'change', 'adjust'
    ]);
    
    return Math.min(0.9, 0.3 + (adaptabilityIndicators / messages.length) * 0.6);
  }

  calculateEngagementConsistency(conversationHistory) {
    if (conversationHistory.length < 5) return 0.5;
    
    const messageLengths = conversationHistory.map(msg => msg.content.length);
    const avgLength = messageLengths.reduce((a, b) => a + b, 0) / messageLengths.length;
    const variance = this.calculateVariance(messageLengths);
    
    return Math.max(0.1, 1 - (variance / (avgLength * avgLength)));
  }

  calculateMessageComplexity(message) {
    return message.content.length + (message.content.match(/\w{7,}/g) || []).length * 2;
  }

  findDominantEmotion(emotions) {
    const emotionCounts = {};
    emotions.forEach(e => {
      emotionCounts[e.emotion] = (emotionCounts[e.emotion] || 0) + 1;
    });
    return Object.entries(emotionCounts).reduce((a, b) => emotionCounts[a[0]] > emotionCounts[b[0]] ? a : b)[0];
  }

  updateProcessingMetrics(processingTime) {
    this.processingMetrics.totalAnalyses++;
    this.processingMetrics.avgProcessingTime = 
      (this.processingMetrics.avgProcessingTime * (this.processingMetrics.totalAnalyses - 1) + processingTime) / 
      this.processingMetrics.totalAnalyses;
  }

  // Prediction methods
  predictTopics(messages, behaviorProfile) {
    const recentText = this.extractMessageText(messages);
    const topics = [];
    
    if (recentText.match(/api|database|server|system/g)) topics.push('technical_implementation');
    if (recentText.match(/analyze|data|pattern/g)) topics.push('behavioral_analysis');
    if (recentText.match(/problem|issue|fix/g)) topics.push('problem_solving');
    
    return topics.slice(0, 3);
  }

  determineOptimalResponseStrategy(cognitiveProfile) {
    const strategy = {
      length: 'medium',
      structure: 'mixed',
      technicalLevel: 'adaptive',
      interactionStyle: 'supportive'
    };

    if (cognitiveProfile.communication.primary === 'brief_communicator') {
      strategy.length = 'short';
      strategy.structure = 'structured';
    }

    if (cognitiveProfile.decisionMaking.primary === 'systematic_thinker') {
      strategy.structure = 'structured';
      strategy.interactionStyle = 'methodical';
    }

    return strategy;
  }

  predictToolUsage(messages) {
    const recentText = this.extractMessageText(messages);
    const searchIndicators = this.countPatterns(recentText, [
      'current', 'latest', 'what is', 'find', 'search', 'recent'
    ]);
    
    return Math.min(0.9, searchIndicators / messages.length);
  }

  predictSessionLength(behaviorProfile) {
    return behaviorProfile?.metadata?.avgSessionLength || 25;
  }

  predictInformationDepth(messages) {
    const detailIndicators = this.countPatterns(this.extractMessageText(messages), [
      'detail', 'explain', 'comprehensive', 'thorough', 'deep'
    ]);
    
    if (detailIndicators > 3) return 'comprehensive';
    if (detailIndicators > 1) return 'detailed';
    return 'concise';
  }

  predictInteractionStyle(cognitiveProfile) {
    if (cognitiveProfile.communication.primary === 'collaborative') return 'collaborative';
    if (cognitiveProfile.communication.primary === 'task_oriented') return 'direct';
    return 'balanced';
  }

  determinePreferredResponseLength(cognitiveProfile) {
    if (cognitiveProfile.communication.avgMessageLength > 300) return 'long';
    if (cognitiveProfile.communication.avgMessageLength > 150) return 'medium';
    return 'short';
  }

  determineTechnicalLevel(cognitiveProfile) {
    if (cognitiveProfile.communication.technicalLanguage) return 'advanced';
    if (cognitiveProfile.personalityTraits?.traits?.analytical > 0.7) return 'intermediate';
    return 'basic';
  }

  determineMotivationalApproach(cognitiveProfile) {
    if (cognitiveProfile.emotionalIntelligence?.indicators?.empathy > 2) return 'empathetic';
    if (cognitiveProfile.personalityTraits?.traits?.resilience > 0.7) return 'encouraging';
    return 'supportive';
  }

  determineInteractionCadence(cognitiveProfile) {
    if (cognitiveProfile.learningVelocity?.avgResponseTime < 120) return 'rapid';
    if (cognitiveProfile.learningVelocity?.avgResponseTime < 600) return 'conversational';
    return 'thoughtful';
  }

  generateCognitiveLoadGuidance(cognitiveLoad) {
    if (cognitiveLoad.loadLevel === 'high') {
      return 'Use simple language, short responses, confirm understanding frequently';
    }
    if (cognitiveLoad.loadLevel === 'low') {
      return 'User ready for detailed information and complex topics';
    }
    return 'Balance detail with clarity, provide examples when helpful';
  }

  generateCognitiveLoadRecommendations(loadScore) {
    if (loadScore > 0.7) {
      return ['Use shorter responses', 'Break topics into steps', 'Confirm understanding'];
    }
    if (loadScore > 0.4) {
      return ['Balance detail with clarity', 'Provide examples'];
    }
    return ['User ready for detailed information', 'Can handle complex topics'];
  }

  /**
   * Get user analysis for UBPM routes - compatibility method
   */
  async getUserAnalysis(userId) {
    try {
      const analysis = await this.analyzeCognitiveProfile(userId, []);
      
      if (!analysis || analysis.confidence < 0.1) {
        return this.getDefaultUserAnalysis();
      }

      const { cognitiveProfile } = analysis;
      
      return {
        behaviorProfile: {
          engagementLevel: cognitiveProfile.learningVelocity?.trend || 'moderate',
          learningStyle: cognitiveProfile.informationProcessing?.primary || 'adaptive',
          communicationPreference: cognitiveProfile.communication?.primary || 'balanced',
          decisionMakingSpeed: cognitiveProfile.decisionMaking?.primary || 'moderate'
        },
        cognitivePatterns: {
          informationProcessing: cognitiveProfile.informationProcessing?.primary || 'sequential',
          complexityPreference: cognitiveProfile.cognitiveLoad?.loadLevel || 'medium',
          questioningStyle: cognitiveProfile.communication?.questionRate > 0.3 ? 'inquisitive' : 'balanced',
          adaptability: cognitiveProfile.emotionalIntelligence?.adaptability || 0.5
        },
        personalityInsights: {
          emotionalIntelligence: cognitiveProfile.emotionalIntelligence?.overallEQ || 0.5,
          analyticalStyle: cognitiveProfile.personalityTraits?.traits?.analytical || 0.5,
          creativity: cognitiveProfile.personalityTraits?.traits?.openness || 0.5,
          openness: cognitiveProfile.personalityTraits?.traits?.curiosity || 0.5
        },
        communicationStyle: {
          tone: 'professional',
          directness: cognitiveProfile.communication?.primary === 'brief_communicator' ? 0.8 : 0.5,
          formality: 0.5,
          responseLength: cognitiveProfile.communication?.avgMessageLength > 200 ? 'long' : 'medium'
        },
        decisionMakingPattern: {
          confidence: cognitiveProfile.decisionMaking?.confidence || 0.5,
          speed: 'moderate',
          riskTolerance: 'moderate',
          analyticalDepth: cognitiveProfile.personalityTraits?.traits?.analytical > 0.6 ? 'deep' : 'moderate'
        }
      };
    } catch (error) {
      logger.error('getUserAnalysis error:', error);
      return this.getDefaultUserAnalysis();
    }
  }

  getDefaultUserAnalysis() {
    return {
      behaviorProfile: {},
      cognitivePatterns: {},
      personalityInsights: {},
      communicationStyle: {},
      decisionMakingPattern: {}
    };
  }
}

export default new UnifiedCognitiveEngine();