import UserBehaviorProfile from '../models/UserBehaviorProfile.js';
import User from '../models/User.js';
import ShortTermMemory from '../models/ShortTermMemory.js';
import EmotionalAnalyticsSession from '../models/EmotionalAnalyticsSession.js';
import personalizationEngine from './personalizationEngine.js';
import advancedAnalytics from './advancedAnalytics.js';
import connectionEngine from './connectionEngine.js';
import websocketService from './websocketService.js';
import logger from '../utils/logger.js';

/**
 * Real-time Data Processing Pipeline
 * Continuously processes user interactions and updates personalization models
 */
class DataProcessingPipeline {
  constructor() {
    this.processingQueue = [];
    this.isProcessing = false;
    this.batchSize = 10;
    this.processingInterval = 5000; // 5 seconds
    this.analyticsInterval = 300000; // 5 minutes
    this.profileUpdateThreshold = 5; // Update profile after 5 interactions
    this.eventTypes = {
      CHAT_MESSAGE: 'chat_message',
      EMOTION_UPDATE: 'emotion_update',
      PROFILE_VIEW: 'profile_view',
      CONNECTION_REQUEST: 'connection_request',
      GOAL_UPDATE: 'goal_update',
      PREFERENCE_UPDATE: 'preference_update',
      SESSION_START: 'session_start',
      SESSION_END: 'session_end'
    };
    
    this.startProcessing();
  }

  /**
   * Start the real-time processing pipeline
   */
  startProcessing() {
    // Start batch processing
    setInterval(() => {
      this.processBatch();
    }, this.processingInterval);

    // Start periodic analytics updates
    setInterval(() => {
      this.updateAnalytics();
    }, this.analyticsInterval);

    // Start connection recommendations updates
    setInterval(() => {
      this.updateConnectionRecommendations();
    }, this.analyticsInterval * 2); // Every 10 minutes

    logger.info('Data processing pipeline started');
  }

  /**
   * Add event to processing queue
   */
  async addEvent(userId, eventType, eventData) {
    const event = {
      userId,
      eventType,
      eventData,
      timestamp: new Date(),
      processed: false,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    this.processingQueue.push(event);

    // Process high-priority events immediately
    if (this.isHighPriorityEvent(eventType)) {
      await this.processEvent(event);
    }

    return event.id;
  }

  /**
   * Process a batch of events
   */
  async processBatch() {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const eventsToProcess = this.processingQueue
        .filter(e => !e.processed)
        .slice(0, this.batchSize);

      await Promise.all(eventsToProcess.map(event => this.processEvent(event)));

      // Remove processed events
      this.processingQueue = this.processingQueue.filter(e => !e.processed);

      if (eventsToProcess.length > 0) {
        logger.info(`Processed ${eventsToProcess.length} events`);
      }

    } catch (error) {
      logger.error('Error processing batch:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process individual event
   */
  async processEvent(event) {
    try {
      const { userId, eventType, eventData } = event;

      switch (eventType) {
        case this.eventTypes.CHAT_MESSAGE:
          await this.processChatMessage(userId, eventData);
          break;
        case this.eventTypes.EMOTION_UPDATE:
          await this.processEmotionUpdate(userId, eventData);
          break;
        case this.eventTypes.PROFILE_VIEW:
          await this.processProfileView(userId, eventData);
          break;
        case this.eventTypes.CONNECTION_REQUEST:
          await this.processConnectionRequest(userId, eventData);
          break;
        case this.eventTypes.GOAL_UPDATE:
          await this.processGoalUpdate(userId, eventData);
          break;
        case this.eventTypes.PREFERENCE_UPDATE:
          await this.processPreferenceUpdate(userId, eventData);
          break;
        case this.eventTypes.SESSION_START:
          await this.processSessionStart(userId, eventData);
          break;
        case this.eventTypes.SESSION_END:
          await this.processSessionEnd(userId, eventData);
          break;
        default:
          logger.warn(`Unknown event type: ${eventType}`);
      }

      event.processed = true;
      event.processedAt = new Date();

      // Update user profile if threshold reached
      await this.checkProfileUpdateThreshold(userId);

    } catch (error) {
      logger.error(`Error processing event ${event.id}:`, error);
      event.error = error.message;
    }
  }

  /**
   * Process chat message event
   */
  async processChatMessage(userId, eventData) {
    const { message, response, emotion, context } = eventData;

    // Extract insights from message
    const insights = {
      messageLength: message.length,
      questionCount: (message.match(/\?/g) || []).length,
      emotionalWords: this.extractEmotionalWords(message),
      topicKeywords: this.extractTopicKeywords(message),
      communicationStyle: this.analyzeCommunicationStyle(message),
      personalSharing: this.detectPersonalSharing(message),
      supportSeeking: this.detectSupportSeeking(message)
    };

    // Update behavior profile
    await personalizationEngine.updateBehaviorProfile(userId, {
      type: 'chat',
      content: message,
      insights,
      emotion,
      context,
      timestamp: new Date()
    });

    // Update temporal patterns
    await this.updateTemporalPatterns(userId, {
      type: 'conversation',
      timestamp: new Date(),
      duration: eventData.duration || null
    });

    // Generate real-time recommendations
    const recommendations = await this.generateRealTimeRecommendations(userId, insights);
    if (recommendations.length > 0) {
      websocketService.sendToUser(userId, 'real_time_recommendations', recommendations);
    }
  }

  /**
   * Process emotion update event
   */
  async processEmotionUpdate(userId, eventData) {
    const { emotion, intensity, context, source } = eventData;

    // Save to user's emotional log
    await User.findByIdAndUpdate(userId, {
      $push: {
        emotionalLog: {
          emotion,
          intensity,
          context,
          timestamp: new Date()
        }
      }
    });

    // Update emotional profile
    const behaviorProfile = await UserBehaviorProfile.findOne({ userId });
    if (behaviorProfile) {
      await this.updateEmotionalProfile(behaviorProfile, eventData);
    }

    // Broadcast emotion update if confident
    if (source === 'user_input' || (eventData.confidence && eventData.confidence > 0.7)) {
      websocketService.sendToUser(userId, 'numina_senses_updated', {
        emotion,
        intensity,
        confidence: eventData.confidence || 0.8,
        source,
        timestamp: new Date()
      });
    }

    // Check for emotional support opportunities
    await this.checkEmotionalSupportOpportunities(userId, eventData);
  }

  /**
   * Process connection request event
   */
  async processConnectionRequest(userId, eventData) {
    const { targetUserId, connectionType, message } = eventData;

    // Update social profile
    await this.updateSocialProfile(userId, {
      action: 'connection_initiated',
      connectionType,
      targetUser: targetUserId,
      timestamp: new Date()
    });

    // Generate connection insights
    const insights = await connectionEngine.getConnectionInsights(userId, targetUserId);
    
    // Notify both users with insights
    if (insights.success) {
      websocketService.sendToUser(userId, 'connection_insights', {
        targetUserId,
        insights: insights.insights,
        message: 'Connection analysis available'
      });
    }
  }

  /**
   * Update analytics for all active users
   */
  async updateAnalytics() {
    try {
      // Get users with recent activity (last 24 hours)
      const recentlyActive = await ShortTermMemory.distinct('userId', {
        timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });

      // Process analytics updates in batches
      const batchSize = 5;
      for (let i = 0; i < recentlyActive.length; i += batchSize) {
        const batch = recentlyActive.slice(i, i + batchSize);
        await Promise.all(batch.map(userId => this.updateUserAnalytics(userId)));
      }

      logger.info(`Updated analytics for ${recentlyActive.length} active users`);

    } catch (error) {
      logger.error('Error updating analytics:', error);
    }
  }

  /**
   * Update analytics for a specific user
   */
  async updateUserAnalytics(userId) {
    try {
      const analytics = await advancedAnalytics.generateComprehensiveAnalytics(userId);
      
      if (analytics.success) {
        // Send updated insights to user if they're online
        if (websocketService.isUserOnline(userId)) {
          websocketService.sendToUser(userId, 'analytics_updated', {
            insights: analytics.analytics.insights,
            recommendations: analytics.analytics.recommendations,
            timestamp: new Date()
          });
        }
      }

    } catch (error) {
      logger.error(`Error updating analytics for user ${userId}:`, error);
    }
  }

  /**
   * Update connection recommendations
   */
  async updateConnectionRecommendations() {
    try {
      // Get users who allow connections
      const connectableUsers = await UserBehaviorProfile.find({
        'privacySettings.allowConnections': true
      }).select('userId').limit(50);

      // Update connection recommendations for active users
      for (const userProfile of connectableUsers) {
        if (websocketService.isUserOnline(userProfile.userId)) {
          const connections = await connectionEngine.findConnections(
            userProfile.userId, 
            'all', 
            5
          );

          if (connections.success && connections.connections.length > 0) {
            websocketService.sendToUser(userProfile.userId, 'new_connections_available', {
              connections: connections.connections.slice(0, 3),
              timestamp: new Date()
            });
          }
        }
      }

    } catch (error) {
      logger.error('Error updating connection recommendations:', error);
    }
  }

  /**
   * Check if profile update threshold is reached
   */
  async checkProfileUpdateThreshold(userId) {
    try {
      // Count unprocessed events for this user
      const userEvents = this.processingQueue.filter(e => 
        e.userId === userId && e.processed
      ).length;

      if (userEvents >= this.profileUpdateThreshold) {
        // Trigger comprehensive profile update
        await this.triggerProfileUpdate(userId);
      }

    } catch (error) {
      logger.error(`Error checking profile threshold for user ${userId}:`, error);
    }
  }

  /**
   * Trigger comprehensive profile update
   */
  async triggerProfileUpdate(userId) {
    try {
      // Get recent interaction data
      const recentMemory = await ShortTermMemory.find({ userId })
        .sort({ timestamp: -1 })
        .limit(20);

      const user = await User.findById(userId).select('emotionalLog profile');

      // Update behavior profile with comprehensive analysis
      const updateData = {
        type: 'comprehensive_update',
        conversations: recentMemory,
        emotions: user.emotionalLog?.slice(-10) || [],
        timestamp: new Date()
      };

      await personalizationEngine.updateBehaviorProfile(userId, updateData);

      // Generate fresh recommendations
      const recommendations = await personalizationEngine.generatePersonalizedRecommendations(userId);

      // Send update notification
      if (websocketService.isUserOnline(userId)) {
        websocketService.sendToUser(userId, 'profile_updated', {
          message: 'Your personalization profile has been enhanced',
          recommendations: recommendations.success ? recommendations.recommendations : null,
          timestamp: new Date()
        });
      }

      logger.info(`Triggered profile update for user ${userId}`);

    } catch (error) {
      logger.error(`Error triggering profile update for user ${userId}:`, error);
    }
  }

  // Helper Methods

  isHighPriorityEvent(eventType) {
    const highPriorityEvents = [
      this.eventTypes.EMOTION_UPDATE,
      this.eventTypes.CONNECTION_REQUEST
    ];
    return highPriorityEvents.includes(eventType);
  }

  extractEmotionalWords(message) {
    const emotionalWords = [
      'happy', 'sad', 'angry', 'excited', 'nervous', 'anxious', 'grateful',
      'frustrated', 'love', 'hate', 'fear', 'hope', 'worry', 'joy', 'pain',
      'pleasure', 'surprise', 'disgust', 'shame', 'pride', 'guilt', 'relief'
    ];

    return emotionalWords.filter(word => 
      message.toLowerCase().includes(word)
    );
  }

  extractTopicKeywords(message) {
    // Simple keyword extraction - could be enhanced with NLP
    const words = message.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(' ')
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word));

    return [...new Set(words)].slice(0, 5);
  }

  isStopWord(word) {
    const stopWords = [
      'this', 'that', 'with', 'have', 'will', 'from', 'they', 'know',
      'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when',
      'come', 'here', 'could', 'just', 'like', 'over', 'also', 'back',
      'after', 'first', 'well', 'year', 'work', 'such', 'make', 'even',
      'more', 'most', 'take', 'than', 'only', 'think', 'now', 'way'
    ];
    return stopWords.includes(word);
  }

  analyzeCommunicationStyle(message) {
    return {
      length: message.length < 50 ? 'brief' : message.length > 200 ? 'detailed' : 'moderate',
      tone: message.includes('!') ? 'enthusiastic' : 
            message.includes('?') ? 'curious' : 'neutral',
      formality: /\b(please|thank you|would you|could you)\b/i.test(message) ? 'formal' : 'casual'
    };
  }

  detectPersonalSharing(message) {
    const personalIndicators = [
      'i feel', 'i think', 'i believe', 'my', 'personally', 
      'honestly', 'i experienced', 'i went through'
    ];

    return personalIndicators.some(indicator => 
      message.toLowerCase().includes(indicator)
    );
  }

  detectSupportSeeking(message) {
    const supportIndicators = [
      'help', 'advice', 'what should i', 'i don\'t know',
      'confused', 'stuck', 'struggling', 'need guidance'
    ];

    return supportIndicators.some(indicator => 
      message.toLowerCase().includes(indicator)
    );
  }

  async updateTemporalPatterns(userId, patternData) {
    const hour = new Date().getHours();
    const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    await UserBehaviorProfile.findOneAndUpdate(
      { userId },
      {
        $addToSet: {
          'temporalPatterns.mostActiveHours': hour,
          'temporalPatterns.mostActiveDays': day
        },
        $set: {
          'temporalPatterns.lastActivity': new Date()
        }
      },
      { upsert: true }
    );
  }

  async generateRealTimeRecommendations(userId, insights) {
    // Generate contextual recommendations based on current insights
    const recommendations = [];

    if (insights.supportSeeking) {
      recommendations.push({
        type: 'immediate_support',
        content: 'I sense you might be looking for guidance. Would you like to explore this together?',
        priority: 'high'
      });
    }

    if (insights.personalSharing) {
      recommendations.push({
        type: 'emotional_acknowledgment',
        content: 'Thank you for sharing something personal. Your openness helps me understand you better.',
        priority: 'medium'
      });
    }

    if (insights.questionCount > 2) {
      recommendations.push({
        type: 'curiosity_encouragement',
        content: 'Your curiosity is wonderful. Keep exploring these questions - they lead to insights.',
        priority: 'low'
      });
    }

    return recommendations;
  }

  async updateEmotionalProfile(behaviorProfile, emotionData) {
    const { emotion, intensity } = emotionData;

    // Update emotional baseline if this emotion is frequent
    const recentEmotions = await User.findById(behaviorProfile.userId)
      .select('emotionalLog')
      .then(user => user?.emotionalLog?.slice(-10) || []);

    const emotionFrequency = recentEmotions.filter(e => e.emotion === emotion).length;

    if (emotionFrequency >= 3) {
      behaviorProfile.emotionalProfile.baselineEmotion = emotion;
    }

    // Update emotional range
    const intensityValue = typeof intensity === 'string' ? 
      { low: 0.3, moderate: 0.6, high: 0.9 }[intensity] || 0.5 : intensity;

    if (!behaviorProfile.emotionalProfile.emotionalRange) {
      behaviorProfile.emotionalProfile.emotionalRange = intensityValue;
    } else {
      // Running average of emotional range
      behaviorProfile.emotionalProfile.emotionalRange = 
        (behaviorProfile.emotionalProfile.emotionalRange + intensityValue) / 2;
    }

    await behaviorProfile.save();
  }

  async updateSocialProfile(userId, socialData) {
    await UserBehaviorProfile.findOneAndUpdate(
      { userId },
      {
        $inc: { 'socialProfile.connectionAttempts': 1 },
        $set: { 
          'socialProfile.lastConnectionAttempt': new Date(),
          'socialProfile.connectionStyle': socialData.connectionType || 'general'
        }
      },
      { upsert: true }
    );
  }

  async checkEmotionalSupportOpportunities(userId, emotionData) {
    const { emotion, intensity } = emotionData;
    
    // Check if user might need support
    const needsSupportEmotions = ['sad', 'anxious', 'frustrated', 'angry', 'depressed'];
    const highIntensity = typeof intensity === 'string' ? 
      intensity === 'high' : intensity > 0.7;

    if (needsSupportEmotions.includes(emotion) && highIntensity) {
      // Find potential support connections
      const supportConnections = await connectionEngine.findConnections(
        userId, 
        'emotional_support', 
        3
      );

      if (supportConnections.success && supportConnections.connections.length > 0) {
        websocketService.sendToUser(userId, 'support_available', {
          message: 'I notice you might be going through something difficult. There are people who might be able to help.',
          connections: supportConnections.connections.slice(0, 2),
          timestamp: new Date()
        });
      }
    }
  }

  // Additional event processing methods
  async processProfileView(userId, eventData) {
    // Track profile viewing patterns
    await this.updateTemporalPatterns(userId, {
      type: 'profile_view',
      timestamp: new Date()
    });
  }

  async processGoalUpdate(userId, eventData) {
    // Update goal tracking in behavior profile
    await UserBehaviorProfile.findOneAndUpdate(
      { userId },
      {
        $push: {
          'goals.shortTerm': eventData.goal
        }
      },
      { upsert: true }
    );
  }

  async processPreferenceUpdate(userId, eventData) {
    // Update user preferences
    await UserBehaviorProfile.findOneAndUpdate(
      { userId },
      {
        $set: {
          [`preferences.${eventData.type}`]: eventData.value
        }
      },
      { upsert: true }
    );
  }

  async processSessionStart(userId, eventData) {
    // Track session patterns
    await this.updateTemporalPatterns(userId, {
      type: 'session_start',
      timestamp: new Date()
    });
  }

  async processSessionEnd(userId, eventData) {
    // Calculate session duration and patterns
    const { startTime, duration } = eventData;
    
    await UserBehaviorProfile.findOneAndUpdate(
      { userId },
      {
        $push: {
          'temporalPatterns.sessionDurations': duration
        }
      },
      { upsert: true }
    );
  }

  /**
   * Get pipeline statistics
   */
  getStats() {
    return {
      queueLength: this.processingQueue.length,
      isProcessing: this.isProcessing,
      processedToday: this.processingQueue.filter(e => 
        e.processed && e.processedAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length,
      errorRate: this.processingQueue.filter(e => e.error).length / Math.max(this.processingQueue.length, 1)
    };
  }

  /**
   * Clear old processed events from queue
   */
  cleanupQueue() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.processingQueue = this.processingQueue.filter(e => 
      !e.processed || e.processedAt > oneDayAgo
    );
  }
}

// Export singleton instance
export default new DataProcessingPipeline();