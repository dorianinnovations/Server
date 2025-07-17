import UserBehaviorProfile from '../models/UserBehaviorProfile.js';
import User from '../models/User.js';
import ShortTermMemory from '../models/ShortTermMemory.js';
import EmotionalAnalyticsSession from '../models/EmotionalAnalyticsSession.js';
import logger from '../utils/logger.js';
import websocketService from './websocketService.js';

/**
 * UBPM (User Behavior Profile Model) Service
 * Seamless background intelligence that analyzes patterns and updates context
 */
class UBPMService {
  constructor() {
    this.analysisThresholds = {
      minInteractions: 5,        // Minimum interactions to generate insights
      patternConfidence: 0.7,    // Minimum confidence for pattern recognition
      updateCooldown: 300000,    // 5 minutes between UBPM updates
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
        EmotionalAnalyticsSession.find({ userId }).sort({ weekStartDate: -1 }).limit(4)
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

    // Filter patterns by confidence threshold
    return patterns.filter(pattern => pattern.confidence >= this.analysisThresholds.patternConfidence);
  }

  /**
   * Analyze communication patterns from conversation data
   */
  analyzeCommunicationPatterns(memories) {
    const patterns = [];
    const userMessages = memories.filter(m => m.role === 'user');
    
    if (userMessages.length < 2) return patterns;

    // Message length analysis
    const avgLength = userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length;
    const lengths = userMessages.map(m => m.content.length);
    const lengthVariation = this.calculateVariation(lengths);

    if (avgLength > 200 && lengthVariation < 0.3) {
      patterns.push({
        type: this.patternTypes.COMMUNICATION,
        pattern: 'detailed_communicator',
        description: 'Consistently provides detailed, thorough responses',
        confidence: 0.85,
        frequency: userMessages.length,
        contexts: ['chat_interaction'],
        detectedAt: new Date(),
        evidence: { avgLength, lengthVariation }
      });
    }

    // Question asking pattern
    const questionCount = userMessages.filter(m => m.content.includes('?')).length;
    const questionRate = questionCount / userMessages.length;

    if (questionRate > 0.4) {
      patterns.push({
        type: this.patternTypes.COMMUNICATION,
        pattern: 'inquisitive_learner',
        description: 'Frequently asks questions to gain understanding',
        confidence: 0.8,
        frequency: questionCount,
        contexts: ['information_seeking'],
        detectedAt: new Date(),
        evidence: { questionRate, questionCount }
      });
    }

    return patterns;
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

    // Update profile metadata
    profile.lastAnalysisDate = new Date();
    profile.dataQuality.freshness = 1.0; // Fresh data
    profile.dataQuality.completeness = Math.min(1.0, profile.behaviorPatterns.length / 5);

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
   * Get current UBPM context for AI conversations
   */
  async getUBPMContextForAI(userId) {
    try {
      const profile = await UserBehaviorProfile.findOne({ userId });
      if (!profile) return null;

      // Get most recent and confident patterns
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
   * Utility functions
   */
  calculateVariation(values) {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / mean;
  }

  calculateInsightSignificance(patterns) {
    const avgConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
    const patternDiversity = new Set(patterns.map(p => p.type)).size;
    return Math.min(1.0, avgConfidence * (patternDiversity / 3));
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