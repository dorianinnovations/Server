import UserBehaviorProfile from '../models/UserBehaviorProfile.js';
import User from '../models/User.js';
import ShortTermMemory from '../models/ShortTermMemory.js';
import logger from '../utils/logger.js';
import websocketService from './websocketService.js';
import unifiedCognitiveEngine from './unifiedCognitiveEngine.js';

/**
 * UBPM (User Behavior Profile Model) Service
 * Seamless background intelligence that analyzes patterns and updates context
 */
class UBPMService {
  constructor() {
    this.analysisThresholds = {
      minInteractions: 5,        // Minimum interactions to generate insights
      patternConfidence: 0.6,    // Lowered for more sensitive pattern detection
      updateCooldown: 300000,    // 5 minutes between UBPM updates
      highConfidenceThreshold: 0.85,  // Threshold for high-confidence predictions
      predictionAccuracyTarget: 0.92, // Target accuracy for behavioral predictions
    };
    
    this.lastUpdates = new Map();  // Track last update times per user
    
    this.patternTypes = {
      COMMUNICATION: 'communication',
      EMOTIONAL: 'emotional', 
      TEMPORAL: 'temporal',
      DECISION_MAKING: 'decision_making',
      STRESS_RESPONSE: 'stress_response',
      SOCIAL_INTERACTION: 'social_interaction'
    };
  }

  /**
   * Main UBPM analysis - called after user interactions
   * Runs invisibly in background, updates when patterns detected
   */
  async analyzeUserBehaviorPatterns(userId, triggerEvent = null) {
    try {
      // Check cooldown to prevent spam
      const lastUpdate = this.lastUpdates.get(userId);
      const now = Date.now();
      if (lastUpdate && (now - lastUpdate) < this.analysisThresholds.updateCooldown) {
        return null; // Skip analysis, too soon
      }

      logger.info(`🧠 UBPM: Analyzing patterns for user ${userId}`, { triggerEvent });

      // Gather all user data sources
      const [user, behaviorProfileDoc, recentMemories, emotionalSessions] = await Promise.all([
        User.findById(userId).select('emotionalLog profile createdAt'),
        UserBehaviorProfile.findOne({ userId }),
        ShortTermMemory.find({ userId }).sort({ timestamp: -1 }).limit(100),
        Promise.resolve([])
      ]);

      // Create initial profile if none exists
      const behaviorProfile = behaviorProfileDoc || await this.createInitialProfile(userId);

      if (!user || recentMemories.length < this.analysisThresholds.minInteractions) {
        return null; // Not enough data for meaningful analysis
      }

      // Analyze patterns from existing data
      const newPatterns = await this.detectBehaviorPatterns({
        user,
        behaviorProfile,
        recentMemories,
        emotionalSessions,
        triggerEvent
      });

      // Check if significant patterns were found
      if (newPatterns.length === 0) {
        return null; // No new patterns detected
      }

      // Update UBPM and generate insights
      const updatedProfile = await this.updateBehaviorProfile(userId, newPatterns);
      const insight = await this.generateUBPMInsight(updatedProfile, newPatterns);

      // Send notification if significant update
      if (insight.significance >= 0.8) {
        await this.sendUBPMNotification(userId, insight);
      }

      // Update cooldown
      this.lastUpdates.set(userId, now);

      logger.info(`🧠 UBPM: Pattern analysis complete for user ${userId}`, {
        patternsFound: newPatterns.length,
        significance: insight.significance
      });

      return {
        updated: true,
        patterns: newPatterns,
        insight: insight,
        profile: updatedProfile
      };

    } catch (error) {
      logger.error(`🧠 UBPM: Analysis failed for user ${userId}`, error);
      return null;
    }
  }

  /**
   * Detect behavioral patterns from user data
   */
  async detectBehaviorPatterns({ user, behaviorProfile, recentMemories, emotionalSessions, triggerEvent }) {
    const patterns = [];
    
    logger.info(`🧠 UBPM: Starting pattern detection`, {
      memoriesCount: recentMemories.length,
      emotionalSessionsCount: emotionalSessions.length,
      triggerEvent
    });

    // 1. Communication Pattern Analysis
    const commPatterns = this.analyzeCommunicationPatterns(recentMemories);
    logger.info(`🧠 UBPM: Communication patterns found: ${commPatterns.length}`);
    patterns.push(...commPatterns);

    // 2. Emotional Response Pattern Analysis  
    const emotionalPatterns = this.analyzeEmotionalPatterns(user.emotionalLog, emotionalSessions);
    patterns.push(...emotionalPatterns);

    // 3. Temporal Behavior Pattern Analysis
    const temporalPatterns = this.analyzeTemporalPatterns(recentMemories, user.emotionalLog);
    patterns.push(...temporalPatterns);

    // 4. Decision Making Pattern Analysis
    const decisionPatterns = this.analyzeDecisionPatterns(recentMemories);
    patterns.push(...decisionPatterns);

    // 5. Stress Response Pattern Analysis (triggered by emotional data)
    if (triggerEvent === 'emotional_log_update') {
      const stressPatterns = this.analyzeStressResponse(user.emotionalLog, recentMemories);
      patterns.push(...stressPatterns);
    }

    // 6. Personality Trait Analysis from recent messages
    const personalityPatterns = this.analyzePersonalityTraits(recentMemories);
    patterns.push(...personalityPatterns);

    // Filter patterns by confidence threshold
    return patterns.filter(pattern => pattern.confidence >= this.analysisThresholds.patternConfidence);
  }

  /**
   * Analyze communication patterns from conversation data with scary accuracy
   */
  analyzeCommunicationPatterns(memories) {
    const patterns = [];
    const userMessages = memories.filter(m => m.role === 'user');
    
    if (userMessages.length < 2) return patterns;

    // Enhanced message length analysis with predictive indicators
    const avgLength = userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length;
    const lengths = userMessages.map(m => m.content.length);
    const lengthVariation = this.calculateVariation(lengths);
    const lengthTrend = this.calculateTrend(lengths);

    // Detailed communicator pattern with predictive power
    if (avgLength > 150 && lengthVariation < 0.4) {
      const consistency = Math.max(0, 1 - lengthVariation);
      const predictiveIndicators = {
        likelyToProvideContext: consistency > 0.7,
        likelyToExplainReasoning: avgLength > 300,
        prefersThoroughDiscussion: true
      };

      patterns.push({
        type: this.patternTypes.COMMUNICATION,
        pattern: 'detailed_communicator',
        description: 'Consistently provides detailed, thorough responses with context',
        confidence: Math.min(0.95, 0.7 + consistency * 0.25),
        frequency: userMessages.length,
        contexts: ['chat_interaction'],
        detectedAt: new Date(),
        evidence: { 
          avgLength, 
          lengthVariation, 
          consistency,
          predictiveIndicators,
          temporalStability: lengthTrend > -0.1 ? 0.2 : 0
        }
      });
    }

    // Brief communicator pattern
    if (avgLength < 80 && lengthVariation < 0.3) {
      const consistency = Math.max(0, 1 - lengthVariation);
      patterns.push({
        type: this.patternTypes.COMMUNICATION,
        pattern: 'brief_communicator',
        description: 'Prefers concise, direct communication',
        confidence: Math.min(0.9, 0.65 + consistency * 0.25),
        frequency: userMessages.length,
        contexts: ['quick_interaction'],
        detectedAt: new Date(),
        evidence: { 
          avgLength, 
          lengthVariation, 
          consistency,
          predictiveIndicators: {
            likelyToValueEfficiency: true,
            likelyToAvoidLongExplanations: true,
            prefersQuickResponses: true
          }
        }
      });
    }

    // Enhanced question asking pattern with intent analysis
    const questionCount = userMessages.filter(m => m.content.includes('?')).length;
    const questionRate = questionCount / userMessages.length;
    const deepQuestions = userMessages.filter(m => 
      m.content.includes('why') || m.content.includes('how') || m.content.includes('what if')
    ).length;

    if (questionRate > 0.3) {
      const depthScore = deepQuestions / Math.max(1, questionCount);
      patterns.push({
        type: this.patternTypes.COMMUNICATION,
        pattern: 'inquisitive_learner',
        description: 'Frequently asks questions to gain deep understanding',
        confidence: Math.min(0.92, 0.7 + questionRate * 0.5 + depthScore * 0.2),
        frequency: questionCount,
        contexts: ['information_seeking'],
        detectedAt: new Date(),
        evidence: { 
          questionRate, 
          questionCount, 
          depthScore,
          predictiveIndicators: {
            likelyToSeekClarification: questionRate > 0.4,
            likelyToAskFollowUp: depthScore > 0.5,
            prefersDetailedExplanations: true
          }
        }
      });
    }

    // Emotional expression pattern
    const emotionalWords = ['feel', 'think', 'believe', 'hope', 'worry', 'excited', 'frustrated', 'happy', 'sad'];
    const emotionalMessages = userMessages.filter(m => 
      emotionalWords.some(word => m.content.toLowerCase().includes(word))
    );
    const emotionalRate = emotionalMessages.length / userMessages.length;

    if (emotionalRate > 0.25) {
      patterns.push({
        type: this.patternTypes.COMMUNICATION,
        pattern: 'emotionally_expressive',
        description: 'Openly shares emotional state and feelings',
        confidence: Math.min(0.88, 0.6 + emotionalRate * 0.8),
        frequency: emotionalMessages.length,
        contexts: ['emotional_sharing'],
        detectedAt: new Date(),
        evidence: { 
          emotionalRate,
          predictiveIndicators: {
            likelyToSeekEmotionalSupport: emotionalRate > 0.4,
            likelyToSharePersonalDetails: true,
            prefersEmpathicResponses: true
          }
        }
      });
    }

    // Command/request pattern
    const commandWords = ['please', 'can you', 'help me', 'show me', 'tell me', 'explain'];
    const commandMessages = userMessages.filter(m => 
      commandWords.some(word => m.content.toLowerCase().includes(word))
    );
    const commandRate = commandMessages.length / userMessages.length;

    if (commandRate > 0.4) {
      patterns.push({
        type: this.patternTypes.COMMUNICATION,
        pattern: 'task_oriented',
        description: 'Primarily uses AI for specific tasks and requests',
        confidence: Math.min(0.85, 0.65 + commandRate * 0.4),
        frequency: commandMessages.length,
        contexts: ['task_completion'],
        detectedAt: new Date(),
        evidence: { 
          commandRate,
          predictiveIndicators: {
            likelyToProvideSpecificRequests: true,
            likelyToExpectActionableResults: true,
            prefersStructuredResponses: true
          }
        }
      });
    }

    return patterns;
  }

  /**
   * Calculate trend in a series of values (positive = increasing, negative = decreasing)
   */
  calculateTrend(values) {
    if (values.length < 2) return 0;
    
    let trend = 0;
    for (let i = 1; i < values.length; i++) {
      trend += values[i] - values[i-1];
    }
    return trend / (values.length - 1);
  }

  /**
   * Analyze emotional response patterns
   */
  analyzeEmotionalPatterns(emotionalLog, emotionalSessions) {
    const patterns = [];
    
    if (!emotionalLog || emotionalLog.length < 2) return patterns;

    // Recent emotional data (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentEmotions = emotionalLog.filter(e => new Date(e.timestamp) > thirtyDaysAgo);

    if (recentEmotions.length < 3) return patterns;

    // Emotional stability analysis
    const intensities = recentEmotions.map(e => e.intensity || 5);
    const avgIntensity = intensities.reduce((sum, i) => sum + i, 0) / intensities.length;
    const intensityVariation = this.calculateVariation(intensities);

    if (intensityVariation < 0.2 && avgIntensity > 6) {
      patterns.push({
        type: this.patternTypes.EMOTIONAL,
        pattern: 'stable_positive_outlook',
        description: 'Maintains consistent positive emotional state',
        confidence: 0.9,
        frequency: recentEmotions.length,
        contexts: ['emotional_regulation'],
        detectedAt: new Date(),
        evidence: { avgIntensity, intensityVariation }
      });
    }

    // Emotional growth analysis (comparing recent vs older data)
    if (emotionalLog.length > 20) {
      const olderEmotions = emotionalLog.slice(0, Math.floor(emotionalLog.length / 2));
      const newerEmotions = emotionalLog.slice(Math.floor(emotionalLog.length / 2));
      
      const olderAvg = olderEmotions.reduce((sum, e) => sum + (e.intensity || 5), 0) / olderEmotions.length;
      const newerAvg = newerEmotions.reduce((sum, e) => sum + (e.intensity || 5), 0) / newerEmotions.length;
      
      if (newerAvg > olderAvg + 1) {
        patterns.push({
          type: this.patternTypes.EMOTIONAL,
          pattern: 'emotional_growth_trajectory',
          description: 'Showing improvement in emotional well-being over time',
          confidence: 0.85,
          frequency: emotionalLog.length,
          contexts: ['personal_development'],
          detectedAt: new Date(),
          evidence: { improvement: newerAvg - olderAvg, olderAvg, newerAvg }
        });
      }
    }

    return patterns;
  }

  /**
   * Analyze temporal behavior patterns
   */
  analyzeTemporalPatterns(memories, emotionalLog) {
    const patterns = [];
    
    if (memories.length < 3) return patterns;

    // Activity timing analysis
    const activityHours = memories.map(m => new Date(m.timestamp).getHours());
    const hourCounts = activityHours.reduce((acc, hour) => {
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {});

    // Find peak activity hours
    const peakHours = Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    if (peakHours.length > 0) {
      patterns.push({
        type: this.patternTypes.TEMPORAL,
        pattern: 'consistent_active_hours',
        description: `Most active during ${peakHours.join(', ')}:00 hours`,
        confidence: 0.8,
        frequency: memories.length,
        contexts: ['daily_routine'],
        detectedAt: new Date(),
        evidence: { peakHours, hourCounts }
      });
    }

    return patterns;
  }

  /**
   * Analyze decision making patterns from conversation content
   */
  analyzeDecisionPatterns(memories) {
    const patterns = [];
    const userMessages = memories.filter(m => m.role === 'user');
    
    if (userMessages.length < 8) return patterns;

    // Decision-related keywords
    const decisionKeywords = ['should i', 'what do you think', 'help me decide', 'which option', 'advice'];
    const decisionMessages = userMessages.filter(m => 
      decisionKeywords.some(keyword => m.content.toLowerCase().includes(keyword))
    );

    const decisionRate = decisionMessages.length / userMessages.length;

    if (decisionRate > 0.3) {
      patterns.push({
        type: this.patternTypes.DECISION_MAKING,
        pattern: 'collaborative_decision_maker',
        description: 'Frequently seeks input before making decisions',
        confidence: 0.8,
        frequency: decisionMessages.length,
        contexts: ['decision_support'],
        detectedAt: new Date(),
        evidence: { decisionRate, decisionMessages: decisionMessages.length }
      });
    }

    return patterns;
  }

  /**
   * Analyze stress response patterns
   */
  analyzeStressResponse(emotionalLog, memories) {
    const patterns = [];
    
    if (!emotionalLog || emotionalLog.length < 2) return patterns;

    // Identify stress-related emotions
    const stressEmotions = ['anxious', 'stressed', 'overwhelmed', 'frustrated', 'worried'];
    const stressEvents = emotionalLog.filter(e => 
      stressEmotions.some(emotion => e.emotion.toLowerCase().includes(emotion))
    );

    if (stressEvents.length < 2) return patterns;

    // Analyze response patterns after stress
    const stressResponsePatterns = stressEvents.map(stressEvent => {
      const stressTime = new Date(stressEvent.timestamp);
      const nextHour = new Date(stressTime.getTime() + 60 * 60 * 1000);
      
      // Find interactions within an hour after stress
      const responseInteractions = memories.filter(m => {
        const interactionTime = new Date(m.timestamp);
        return interactionTime > stressTime && interactionTime < nextHour && m.role === 'user';
      });

      return responseInteractions.length;
    });

    const avgResponseRate = stressResponsePatterns.reduce((sum, rate) => sum + rate, 0) / stressResponsePatterns.length;

    if (avgResponseRate > 2) {
      patterns.push({
        type: this.patternTypes.STRESS_RESPONSE,
        pattern: 'seeks_support_when_stressed',
        description: 'Tends to reach out for support when experiencing stress',
        confidence: 0.85,
        frequency: stressEvents.length,
        contexts: ['stress_management', 'support_seeking'],
        detectedAt: new Date(),
        evidence: { avgResponseRate, stressEvents: stressEvents.length }
      });
    }

    return patterns;
  }

  /**
   * Analyze personality traits from conversation patterns
   */
  analyzePersonalityTraits(memories) {
    const patterns = [];
    const userMessages = memories.filter(m => m.role === 'user');
    
    if (userMessages.length < 3) return patterns;

    // Aggregate message content for analysis
    const allContent = userMessages.map(m => m.content).join(' ').toLowerCase();
    
    // Analytical thinking pattern
    const analyticalKeywords = /analyze|data|metrics|specific|precise|exact|technical|system|debug|error|function|api|database/g;
    const analyticalMatches = (allContent.match(analyticalKeywords) || []).length;
    if (analyticalMatches > 2) {
      patterns.push({
        type: 'personality',
        pattern: 'analytical_thinking',
        description: 'Demonstrates strong analytical and technical thinking',
        confidence: Math.min(0.95, 0.7 + (analyticalMatches * 0.05)),
        frequency: analyticalMatches,
        contexts: ['problem_solving'],
        detectedAt: new Date(),
        evidence: { keywordMatches: analyticalMatches, keywords: 'analytical_technical' }
      });
    }

    // Curiosity and learning orientation
    const curiosityKeywords = /how|why|what|learn|understand|explain|show|tell|help|teach/g;
    const curiosityMatches = (allContent.match(curiosityKeywords) || []).length;
    if (curiosityMatches > 3) {
      patterns.push({
        type: 'personality',
        pattern: 'high_curiosity',
        description: 'Shows strong curiosity and desire to learn',
        confidence: Math.min(0.9, 0.65 + (curiosityMatches * 0.03)),
        frequency: curiosityMatches,
        contexts: ['learning'],
        detectedAt: new Date(),
        evidence: { keywordMatches: curiosityMatches, keywords: 'curiosity_learning' }
      });
    }

    // Goal-oriented behavior
    const goalKeywords = /achieve|goal|target|objective|result|outcome|complete|finish|done|success/g;
    const goalMatches = (allContent.match(goalKeywords) || []).length;
    if (goalMatches > 1) {
      patterns.push({
        type: 'personality',
        pattern: 'goal_oriented',
        description: 'Demonstrates goal-oriented and achievement-focused behavior',
        confidence: Math.min(0.85, 0.6 + (goalMatches * 0.08)),
        frequency: goalMatches,
        contexts: ['achievement'],
        detectedAt: new Date(),
        evidence: { keywordMatches: goalMatches, keywords: 'goal_achievement' }
      });
    }

    // Creative thinking
    const creativeKeywords = /creative|innovation|new|design|invent|idea|brainstorm|imagine|build|create/g;
    const creativeMatches = (allContent.match(creativeKeywords) || []).length;
    if (creativeMatches > 1) {
      patterns.push({
        type: 'personality',
        pattern: 'creative_thinking',
        description: 'Shows creative and innovative thinking patterns',
        confidence: Math.min(0.8, 0.6 + (creativeMatches * 0.1)),
        frequency: creativeMatches,
        contexts: ['creativity'],
        detectedAt: new Date(),
        evidence: { keywordMatches: creativeMatches, keywords: 'creative_innovation' }
      });
    }

    return patterns;
  }

  /**
   * Update user behavior profile with new patterns
   */
  async updateBehaviorProfile(userId, newPatterns) {
    let profile = await UserBehaviorProfile.findOne({ userId });
    
    if (!profile) {
      profile = await this.createInitialProfile(userId);
    }

    // Add new patterns to existing ones
    for (const pattern of newPatterns) {
      const existingIndex = profile.behaviorPatterns.findIndex(
        p => p.type === pattern.type && p.pattern === pattern.pattern
      );

      if (existingIndex >= 0) {
        // Update existing pattern
        profile.behaviorPatterns[existingIndex].frequency += pattern.frequency;
        profile.behaviorPatterns[existingIndex].confidence = Math.max(
          profile.behaviorPatterns[existingIndex].confidence,
          pattern.confidence
        );
        profile.behaviorPatterns[existingIndex].lastObserved = pattern.detectedAt;
      } else {
        // Add new pattern
        profile.behaviorPatterns.push({
          ...pattern,
          firstObserved: pattern.detectedAt,
          lastObserved: pattern.detectedAt
        });
      }
    }

    // Extract and save personality traits from personality patterns
    const personalityPatterns = newPatterns.filter(p => p.type === 'personality');
    for (const personalityPattern of personalityPatterns) {
      // Map pattern to trait
      const traitMapping = {
        'analytical_thinking': 'analytical',
        'high_curiosity': 'curiosity',
        'goal_oriented': 'conscientiousness',
        'creative_thinking': 'creativity'
      };
      
      const traitName = traitMapping[personalityPattern.pattern];
      if (traitName) {
        const existingTraitIndex = profile.personalityTraits.findIndex(t => t.trait === traitName);
        
        if (existingTraitIndex >= 0) {
          // Update existing trait with higher confidence
          if (personalityPattern.confidence > profile.personalityTraits[existingTraitIndex].confidence) {
            profile.personalityTraits[existingTraitIndex].score = personalityPattern.confidence;
            profile.personalityTraits[existingTraitIndex].confidence = personalityPattern.confidence;
            profile.personalityTraits[existingTraitIndex].lastUpdated = personalityPattern.detectedAt;
          }
        } else {
          // Add new personality trait
          profile.personalityTraits.push({
            trait: traitName,
            score: personalityPattern.confidence,
            confidence: personalityPattern.confidence,
            evidence: personalityPattern.evidence,
            firstDetected: personalityPattern.detectedAt,
            lastUpdated: personalityPattern.detectedAt
          });
        }
      }
    }

    // Update profile metadata
    profile.lastAnalysisDate = new Date();
    profile.dataQuality.freshness = 1.0; // Fresh data
    profile.dataQuality.completeness = Math.min(1.0, (profile.behaviorPatterns.length + profile.personalityTraits.length) / 8);

    await profile.save();
    return profile;
  }

  /**
   * Generate UBPM insight for user context
   */
  async generateUBPMInsight(profile, newPatterns) {
    // Determine insight significance
    const significance = this.calculateInsightSignificance(newPatterns);
    
    // Generate user-facing insight
    const insight = {
      type: 'ubpm_update',
      significance,
      patterns: newPatterns.map(p => ({
        type: p.type,
        pattern: p.pattern,
        description: p.description,
        confidence: p.confidence
      })),
      summary: this.generateInsightSummary(newPatterns),
      contextForAI: this.generateAIContext(profile, newPatterns),
      timestamp: new Date()
    };

    return insight;
  }

  /**
   * Generate AI context string for OpenRouter GPT-4o
   */
  generateAIContext(profile, newPatterns) {
    // UBPM Definition for AI understanding
    const ubpmDefinition = `**UBPM (User Behavior Pattern Modeling)** is Numina's advanced behavioral analysis system that tracks and analyzes user interaction patterns, communication styles, emotional responses, and temporal behaviors to create personalized AI experiences. When users ask "What is UBPM?", explain it as your behavioral pattern analysis system that helps you understand them better.`;

    // Handle undefined or empty patterns gracefully
    let patternSummaries = '';
    if (newPatterns && newPatterns.length > 0) {
      patternSummaries = newPatterns
        .filter(p => p && p.pattern && p.description && p.confidence !== undefined)
        .map(p => `${p.pattern}: ${p.description} (confidence: ${Math.round(p.confidence * 100)}%)`)
        .join('; ');
    }

    // Handle undefined personality traits gracefully
    let topTraits = 'analyzing...';
    if (profile && profile.personalityTraits && profile.personalityTraits.length > 0) {
      topTraits = profile.personalityTraits
        .filter(t => t && t.trait && t.score !== undefined)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(t => `${t.trait}: ${Math.round(t.score * 100)}%`)
        .join(', ') || 'analyzing...';
    }

    // Build comprehensive UBPM context
    let contextString = ubpmDefinition;
    
    if (patternSummaries) {
      contextString += `\n\n**Current User Patterns**: ${patternSummaries}`;
    } else {
      contextString += `\n\n**Current User Patterns**: Building pattern analysis from interactions (new user or insufficient data)`;
    }
    
    contextString += `\n\n**Top Personality Traits**: ${topTraits}`;
    contextString += `\n\n**UBPM Instructions**: Use this behavioral analysis to personalize your responses. Reference specific patterns naturally when relevant. When asked about UBPM, explain it as your built-in system for understanding user behavior patterns.`;

    return contextString;
  }

  /**
   * Send UBPM notification to user
   */
  async sendUBPMNotification(userId, insight) {
    const notification = {
      type: 'ubpm_insight',
      title: '🧠 UBPM Pattern Detected',
      message: insight.summary,
      significance: insight.significance,
      timestamp: new Date()
    };

    // Send via WebSocket if user is online
    websocketService.sendToUser(userId, 'ubpm_notification', notification);

    logger.info(`🧠 UBPM: Notification sent to user ${userId}`, { 
      significance: insight.significance,
      summary: insight.summary 
    });
  }

  /**
   * Get current UBPM context for AI conversations - Enhanced with unified engine
   */
  async getUBPMContextForAI(userId) {
    try {
      // Try unified cognitive engine first (faster, cached)
      const cognitiveAnalysis = await unifiedCognitiveEngine.analyzeCognitiveProfile(userId, []);
      
      if (cognitiveAnalysis && cognitiveAnalysis.confidence > 0.5) {
        return this.generateEnhancedAIContext(cognitiveAnalysis);
      }

      // Fallback to traditional UBPM analysis
      const profile = await UserBehaviorProfile.findOne({ userId });
      if (!profile) return null;

      const recentPatterns = profile.behaviorPatterns
        .filter(p => p.confidence > 0.7)
        .sort((a, b) => new Date(b.lastObserved) - new Date(a.lastObserved))
        .slice(0, 5);

      if (recentPatterns.length === 0) return null;

      return this.generateAIContext(profile, recentPatterns);
    } catch (error) {
      logger.error('🧠 UBPM: Failed to get AI context', error);
      return null;
    }
  }

  /**
   * Generate enhanced AI context from unified cognitive analysis
   */
  generateEnhancedAIContext(cognitiveAnalysis) {
    const { cognitiveProfile, contextHints, confidence } = cognitiveAnalysis;
    
    const ubpmDefinition = `**UBPM (User Behavior Pattern Modeling)** is Numina's advanced behavioral analysis system that tracks and analyzes user interaction patterns, communication styles, emotional responses, and temporal behaviors to create personalized AI experiences.`;

    let contextString = ubpmDefinition;
    
    // Enhanced cognitive insights
    if (cognitiveProfile) {
      const insights = [];
      
      if (cognitiveProfile.decisionMaking?.primary) {
        insights.push(`Decision Making: ${cognitiveProfile.decisionMaking.primary} (${Math.round(cognitiveProfile.decisionMaking.confidence * 100)}% confidence)`);
      }
      
      if (cognitiveProfile.communication?.primary) {
        insights.push(`Communication: ${cognitiveProfile.communication.primary} style`);
      }
      
      if (cognitiveProfile.cognitiveLoad?.loadLevel) {
        insights.push(`Cognitive Load: ${cognitiveProfile.cognitiveLoad.loadLevel}`);
      }
      
      if (insights.length > 0) {
        contextString += `\n\n**Current Cognitive Profile**: ${insights.join('; ')}`;
      }
    }

    // Response optimization hints
    if (contextHints) {
      const hints = [];
      if (contextHints.preferredLength) hints.push(`Preferred length: ${contextHints.preferredLength}`);
      if (contextHints.technicalLevel) hints.push(`Technical level: ${contextHints.technicalLevel}`);
      if (contextHints.motivationalApproach) hints.push(`Motivational approach: ${contextHints.motivationalApproach}`);
      
      if (hints.length > 0) {
        contextString += `\n\n**Response Optimization**: ${hints.join(', ')}`;
      }
    }

    contextString += `\n\n**Overall Confidence**: ${Math.round(confidence * 100)}%`;
    contextString += `\n\n**UBPM Instructions**: Use this behavioral analysis to personalize your responses. Reference specific patterns naturally when relevant. When asked about UBPM, explain it as your built-in system for understanding user behavior patterns.`;

    return contextString;
  }

  /**
   * Utility functions
   */
  calculateVariation(values) {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / mean;
  }

  /**
   * Calculate sophisticated pattern significance for scary accuracy
   * Factors in confidence, frequency, consistency, predictive power, and pattern relationships
   */
  calculateInsightSignificance(patterns) {
    if (!patterns || patterns.length === 0) return 0;

    // Base confidence weighted by pattern strength
    const confidenceWeights = patterns.map(p => {
      const baseConfidence = p.confidence;
      const frequencyBoost = Math.min(0.2, (p.frequency || 1) * 0.02); // More occurrences = higher weight
      const consistencyBoost = p.evidence?.consistency || 0;
      const temporalStability = p.evidence?.temporalStability || 0;
      
      return baseConfidence + frequencyBoost + consistencyBoost + temporalStability;
    });

    const avgWeightedConfidence = confidenceWeights.reduce((sum, w) => sum + w, 0) / confidenceWeights.length;

    // Pattern diversity score (different types of patterns = more complete picture)
    const patternTypes = new Set(patterns.map(p => p.type));
    const diversityScore = Math.min(1.0, patternTypes.size / 6); // Max 6 pattern types

    // Predictive power score - patterns that enable better predictions
    const predictivePatterns = patterns.filter(p => 
      p.pattern.includes('consistent_') || 
      p.pattern.includes('preferred_') ||
      p.pattern.includes('likely_') ||
      p.evidence?.predictiveIndicators
    );
    const predictiveScore = predictivePatterns.length / patterns.length;

    // Behavioral consistency score - how well patterns support each other
    const consistencyScore = this.calculatePatternConsistency(patterns);

    // Temporal stability - patterns that persist over time are more significant
    const temporalScore = this.calculateTemporalStability(patterns);

    // Composite significance with weighted factors
    const significance = (
      avgWeightedConfidence * 0.35 +    // Primary factor: confidence
      diversityScore * 0.20 +           // Pattern diversity
      predictiveScore * 0.25 +          // Predictive power
      consistencyScore * 0.15 +         // Internal consistency
      temporalScore * 0.05              // Temporal stability
    );

    // Boost for high-confidence patterns that enable scary accuracy
    const highConfidenceBoost = patterns.filter(p => p.confidence >= this.analysisThresholds.highConfidenceThreshold).length > 0 ? 0.1 : 0;

    return Math.min(1.0, significance + highConfidenceBoost);
  }

  /**
   * Calculate how well patterns support each other (consistency)
   */
  calculatePatternConsistency(patterns) {
    if (patterns.length < 2) return 0.5;

    // Check for complementary patterns
    const communicationPatterns = patterns.filter(p => p.type === 'communication');
    const emotionalPatterns = patterns.filter(p => p.type === 'emotional');
    const temporalPatterns = patterns.filter(p => p.type === 'temporal');

    let consistencyScore = 0;

    // Communication-emotional consistency
    if (communicationPatterns.length > 0 && emotionalPatterns.length > 0) {
      consistencyScore += 0.3;
    }

    // Temporal consistency with other patterns
    if (temporalPatterns.length > 0 && (communicationPatterns.length > 0 || emotionalPatterns.length > 0)) {
      consistencyScore += 0.2;
    }

    // Look for contradictory patterns and penalize
    const contradictoryPairs = [
      ['detailed_communicator', 'brief_communicator'],
      ['emotional_consistent', 'emotional_volatile'],
      ['consistent_active_hours', 'irregular_schedule']
    ];

    contradictoryPairs.forEach(pair => {
      const hasFirst = patterns.some(p => p.pattern === pair[0]);
      const hasSecond = patterns.some(p => p.pattern === pair[1]);
      if (hasFirst && hasSecond) {
        consistencyScore -= 0.2; // Penalize contradictions
      }
    });

    return Math.max(0, Math.min(1.0, consistencyScore + 0.5));
  }

  /**
   * Calculate temporal stability of patterns
   */
  calculateTemporalStability(patterns) {
    const now = new Date();
    const patternAges = patterns.map(p => {
      const age = now - new Date(p.detectedAt);
      return age / (1000 * 60 * 60 * 24); // Age in days
    });

    const avgAge = patternAges.reduce((sum, age) => sum + age, 0) / patternAges.length;
    
    // Patterns that have been stable for longer are more significant
    if (avgAge < 1) return 0.3;        // New patterns
    if (avgAge < 7) return 0.6;        // Week old patterns
    if (avgAge < 30) return 0.8;       // Month old patterns
    return 1.0;                        // Established patterns
  }

  generateInsightSummary(patterns) {
    if (patterns.length === 1) {
      return `New pattern detected: ${patterns[0].description}`;
    }
    return `${patterns.length} new behavioral patterns identified in your interactions`;
  }

  async createInitialProfile(userId) {
    const profile = new UserBehaviorProfile({
      userId,
      behaviorPatterns: [],
      personalityTraits: [],
      socialProfile: {},
      temporalPatterns: {},
      dataQuality: {
        completeness: 0.1,
        freshness: 1.0,
        reliability: 0.5
      },
      lastAnalysisDate: new Date()
    });

    await profile.save();
    return profile;
  }
}

// Export singleton instance
export default new UBPMService();