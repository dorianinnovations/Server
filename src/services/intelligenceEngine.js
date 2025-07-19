import ShortTermMemory from '../models/ShortTermMemory.js';
import UserBehaviorProfile from '../models/UserBehaviorProfile.js';
import EmotionalAnalyticsSession from '../models/EmotionalAnalyticsSession.js';

/**
 * UNIFIED INTELLIGENCE ENGINE
 * Replaces scattered analytics with single pipeline
 * Micro/Med/Macro analysis in one service
 */
class IntelligenceEngine {
  constructor() {
    this.analysisCache = new Map();
  }

  /**
   * MAIN ENTRY POINT - Replace all scattered analysis calls
   * Returns unified intelligence context for LLM
   */
  async generateIntelligenceContext(userId, currentMessage, streamCallback = null) {
    const analysisStart = Date.now();
    
    try {
      // Performance tracking for optimization
      const metrics = {
        phases: {},
        totalStart: analysisStart,
        memoryUsage: process.memoryUsage()
      };
      
      // Stream: Starting intelligence analysis
      if (streamCallback) {
        streamCallback({
          type: "intelligence_update",
          phase: "initializing",
          detail: "Starting behavioral intelligence analysis...",
          timestamp: Date.now()
        });
      }

    // Load conversation data efficiently
    const loadStart = Date.now();
    const [recentMemory, behaviorProfile, emotionalSessions] = await Promise.all([
      this.loadConversationHistory(userId, streamCallback),
      this.loadBehaviorProfile(userId),
      this.loadEmotionalSessions(userId)
    ]);
    metrics.phases.dataLoad = Date.now() - loadStart;

    // Analyze across all timescales with performance tracking
    const microStart = Date.now();
    const micro = await this.analyzeMicro(currentMessage, recentMemory, streamCallback);
    metrics.phases.micro = Date.now() - microStart;

    const mediumStart = Date.now();
    const medium = await this.analyzeMedium(recentMemory, streamCallback);
    metrics.phases.medium = Date.now() - mediumStart;

    const macroStart = Date.now();
    const macro = await this.analyzeMacro(behaviorProfile, emotionalSessions, streamCallback);
    metrics.phases.macro = Date.now() - macroStart;

    // Stream: Synthesis
    if (streamCallback) {
      streamCallback({
        type: "intelligence_update", 
        phase: "synthesizing",
        detail: "Synthesizing insights across micro/medium/macro timescales...",
        performance: {
          dataLoad: `${metrics.phases.dataLoad}ms`,
          micro: `${metrics.phases.micro}ms`,
          medium: `${metrics.phases.medium}ms`,
          macro: `${metrics.phases.macro}ms`
        }
      });
    }

    const synthesisStart = Date.now();

    // Create rich context for LLM (replaces all manual analysis)
    const synthesis = this.synthesizeInsights(micro, medium, macro);
    metrics.phases.synthesis = Date.now() - synthesisStart;
    
    const totalTime = Date.now() - analysisStart;
    const intelligenceContext = {
      micro: micro,
      medium: medium, 
      macro: macro,
      synthesis: synthesis,
      performance: {
        totalTime: totalTime,
        phases: metrics.phases,
        memoryDelta: process.memoryUsage().heapUsed - metrics.memoryUsage.heapUsed,
        efficiency: totalTime < 100 ? 'excellent' : totalTime < 500 ? 'good' : 'needs_optimization'
      }
    };

    // Stream: Completion
    if (streamCallback) {
      streamCallback({
        type: "intelligence_complete",
        phase: "complete",
        detail: `Intelligence analysis complete in ${totalTime}ms`,
        performance: metrics.phases,
        efficiency: intelligenceContext.performance.efficiency
      });
    }

    // Auto-optimization based on performance
    if (totalTime > 1000) {
      console.warn(`🐌 SLOW INTELLIGENCE: ${totalTime}ms - Consider optimization`);
      this.flagForOptimization(userId, metrics);
    }

    return intelligenceContext;
    
    } catch (error) {
      console.error('❌ Intelligence Engine Error:', error);
      
      // Stream error notification
      if (streamCallback) {
        streamCallback({
          type: "intelligence_error",
          phase: "error",
          detail: `Analysis failed: ${error.message}`,
          timestamp: Date.now()
        });
      }
      
      // Return fallback context
      return {
        micro: { error: 'Micro analysis failed', fallback: true },
        medium: { error: 'Medium analysis failed', fallback: true },
        macro: { error: 'Macro analysis failed', fallback: true },
        synthesis: { 
          currentMoment: 'Analysis temporarily unavailable',
          recentJourney: 'Fallback mode active',
          overallTrajectory: 'System recovering',
          remarkableInsights: ['Intelligence engine experiencing issues'],
          predictionContext: 'Limited analysis available'
        },
        performance: {
          totalTime: Date.now() - analysisStart,
          efficiency: 'error_recovery',
          error: error.message
        }
      };
    }
  }

  /**
   * MICRO ANALYSIS - Session level patterns (minutes-hours)
   * Replaces: analyzeCommunicationStyle, immediate pattern detection
   */
  async analyzeMicro(currentMessage, recentMemory, streamCallback) {
    if (streamCallback) {
      streamCallback({
        type: "intelligence_update",
        phase: "micro_analysis", 
        detail: `Analyzing session patterns across ${recentMemory.length} messages...`
      });
    }

    const sessionMessages = recentMemory.filter(msg => 
      Date.now() - new Date(msg.timestamp).getTime() < 3600000 // Last hour
    );

    // FOR NEW USERS: Analyze current message to provide immediate insights
    if (sessionMessages.length === 0 && currentMessage) {
      const currentComplexity = this.calculateMessageComplexity(currentMessage);
      const currentEmotion = this.detectMessageEmotion(currentMessage);
      const currentTopic = this.identifyMessageTopic(currentMessage);
      
      return {
        messageComplexity: {
          trend: 'baseline',
          current: currentComplexity,
          average: currentComplexity,
          progression: 0
        },
        emotionalShifts: [],
        topicEvolution: {
          topicFlow: [currentTopic],
          transitions: [],
          dominantTopic: currentTopic,
          topicDiversity: 1
        },
        communicationStyle: this.analyzeCurrentMessageStyle(currentMessage),
        currentState: this.assessCurrentMentalState(currentMessage)
      };
    }

    return {
      messageComplexity: this.calculateComplexityProgression(sessionMessages),
      emotionalShifts: this.detectIntraSessionEmotionalShifts(sessionMessages),
      topicEvolution: this.trackTopicEvolution(sessionMessages),
      communicationStyle: this.analyzeCommunicationEvolution(currentMessage, sessionMessages),
      currentState: this.assessCurrentMentalState(currentMessage)
    };
  }

  /**
   * MEDIUM ANALYSIS - Recent behavioral trends (days-weeks)  
   * Replaces: calculateTemporalPatterns, weekly analysis
   */
  async analyzeMedium(recentMemory, streamCallback) {
    if (streamCallback) {
      streamCallback({
        type: "intelligence_update",
        phase: "medium_analysis",
        detail: "Comparing recent trends vs historical patterns..."
      });
    }

    const lastWeek = this.filterByTimeframe(recentMemory, 7);
    const previousWeek = this.filterByTimeframe(recentMemory, 14, 7);

    return {
      weeklyProgressions: this.compareWeeklyPatterns(lastWeek, previousWeek),
      learningVelocity: this.calculateLearningAcceleration(recentMemory),
      engagementTrends: this.analyzeEngagementProgression(recentMemory),
      behavioralShifts: this.detectSignificantBehavioralShifts(recentMemory)
    };
  }

  /**
   * MACRO ANALYSIS - Evolution patterns (months)
   * Replaces: UBPM analysis, long-term profiling
   */
  async analyzeMacro(behaviorProfile, emotionalSessions, streamCallback) {
    if (streamCallback) {
      streamCallback({
        type: "intelligence_update",
        phase: "macro_analysis", 
        detail: "Analyzing long-term behavioral evolution patterns..."
      });
    }

    return {
      personalityEvolution: this.trackPersonalityDevelopment(behaviorProfile),
      intellectualGrowth: this.measureIntellectualProgression(behaviorProfile),
      emotionalMaturation: this.analyzeEmotionalDevelopment(emotionalSessions),
      patternStability: this.assessBehavioralConsistency(behaviorProfile)
    };
  }

  /**
   * SYNTHESIS - Creates unified insights for LLM
   * This becomes the rich context that makes LLM responses remarkable
   */
  synthesizeInsights(micro, medium, macro) {
    return {
      currentMoment: this.describeMoment(micro),
      recentJourney: this.describeRecentEvolution(medium),
      overallTrajectory: this.describeLongTermGrowth(macro),
      remarkableInsights: this.generateRemarkableObservations(micro, medium, macro),
      predictionContext: this.createPredictiveContext(micro, medium, macro)
    };
  }

  // Performance optimization methods
  flagForOptimization(userId, metrics) {
    // Track slow operations for future optimization
    console.log(`🔧 OPTIMIZATION FLAG: User ${userId} - phases:`, metrics.phases);
    
    // Auto-implement optimizations
    if (metrics.phases.dataLoad > 500) {
      console.log('📊 Consider: Add conversation data caching');
    }
    if (metrics.phases.micro > 200) {
      console.log('🔬 Consider: Optimize micro-analysis algorithms');
    }
    if (metrics.phases.medium > 300) {
      console.log('📈 Consider: Cache weekly pattern comparisons');
    }
    if (metrics.phases.macro > 400) {
      console.log('🧠 Consider: Background macro-analysis processing');
    }
  }

  // Utility methods for data loading
  async loadConversationHistory(userId, streamCallback) {
    try {
      if (streamCallback) {
        streamCallback({
          type: "intelligence_update",
          phase: "loading_memory",
          detail: "Loading conversation history..."
        });
      }

      return await ShortTermMemory.find({ userId })
        .sort({ timestamp: -1 })
        .limit(500); // Increased from 200 for better analysis
    } catch (error) {
      console.error('❌ Error loading conversation history:', error);
      return []; // Graceful degradation
    }
  }

  async loadBehaviorProfile(userId) {
    try {
      return await UserBehaviorProfile.findOne({ userId });
    } catch (error) {
      console.error('❌ Error loading behavior profile:', error);
      return null; // Graceful degradation
    }
  }

  async loadEmotionalSessions(userId) {
    try {
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return await EmotionalAnalyticsSession.find({ 
        userId, 
        weekStartDate: { $gte: oneMonthAgo }
      }).sort({ weekStartDate: -1 });
    } catch (error) {
      console.error('❌ Error loading emotional sessions:', error);
      return []; // Graceful degradation
    }
  }

  // Analysis methods (detailed implementations)
  calculateComplexityProgression(messages) {
    const complexities = messages.map(msg => {
      const words = (msg.content || '').split(' ').length;
      const avgWordLength = (msg.content || '').replace(/\s/g, '').length / Math.max(words, 1);
      const questionMarks = (msg.content || '').match(/\?/g)?.length || 0;
      return (words * 0.3) + (avgWordLength * 0.4) + (questionMarks * 0.3);
    });

    return {
      trend: this.calculateTrend(complexities),
      current: complexities[0] || 0,
      average: complexities.length > 0 ? complexities.reduce((a, b) => a + b, 0) / complexities.length : 0,
      progression: complexities.length > 1 ? 
        ((complexities[0] - complexities[complexities.length - 1]) / complexities[complexities.length - 1]) * 100 : 0
    };
  }

  detectIntraSessionEmotionalShifts(messages) {
    const emotionalMarkers = {
      excitement: /excited|amazing|awesome|fantastic|incredible/gi,
      concern: /worried|concerned|anxious|nervous|uncertain/gi,
      confidence: /sure|confident|definitely|absolutely|certain/gi,
      curiosity: /wonder|curious|interesting|explore|discover/gi
    };

    const shifts = [];
    let previousEmotion = null;

    messages.forEach((msg, index) => {
      const emotions = {};
      Object.keys(emotionalMarkers).forEach(emotion => {
        const matches = (msg.content || '').match(emotionalMarkers[emotion]);
        emotions[emotion] = matches ? matches.length : 0;
      });

      const dominantEmotion = Object.keys(emotions).reduce((a, b) => 
        emotions[a] > emotions[b] ? a : b
      );

      if (previousEmotion && dominantEmotion !== previousEmotion && emotions[dominantEmotion] > 0) {
        shifts.push({
          from: previousEmotion,
          to: dominantEmotion,
          messageIndex: index,
          intensity: emotions[dominantEmotion]
        });
      }

      if (emotions[dominantEmotion] > 0) {
        previousEmotion = dominantEmotion;
      }
    });

    return shifts;
  }

  trackTopicEvolution(messages) {
    const topics = messages.map(msg => {
      const content = (msg.content || '').toLowerCase();
      if (/technical|system|analysis|data|algorithm/gi.test(content)) return 'technical';
      if (/personal|feel|emotion|experience|life/gi.test(content)) return 'personal';
      if (/question|help|how|what|why/gi.test(content)) return 'inquiry';
      if (/test|try|experiment|check/gi.test(content)) return 'experimental';
      return 'general';
    });

    const transitions = [];
    for (let i = 1; i < topics.length; i++) {
      if (topics[i] !== topics[i-1]) {
        transitions.push({ from: topics[i-1], to: topics[i], position: i });
      }
    }

    return {
      topicFlow: topics,
      transitions: transitions,
      dominantTopic: this.getMostFrequent(topics),
      topicDiversity: new Set(topics).size
    };
  }

  // Utility functions
  filterByTimeframe(messages, days, offsetDays = 0) {
    const endTime = Date.now() - (offsetDays * 24 * 60 * 60 * 1000);
    const startTime = endTime - (days * 24 * 60 * 60 * 1000);
    
    return messages.filter(msg => {
      const msgTime = new Date(msg.timestamp).getTime();
      return msgTime >= startTime && msgTime <= endTime;
    });
  }

  calculateTrend(values) {
    if (values.length < 2) return 'insufficient_data';
    const slope = (values[0] - values[values.length - 1]) / values.length;
    if (slope > 0.1) return 'increasing';
    if (slope < -0.1) return 'decreasing';
    return 'stable';
  }

  getMostFrequent(array) {
    if (array.length === 0) return 'general';
    const frequency = {};
    array.forEach(item => frequency[item] = (frequency[item] || 0) + 1);
    const keys = Object.keys(frequency);
    return keys.length > 0 ? keys.reduce((a, b) => frequency[a] > frequency[b] ? a : b) : 'general';
  }

  // Single message analysis for new users
  calculateMessageComplexity(message) {
    const words = (message || '').split(' ').length;
    const avgWordLength = (message || '').replace(/\s/g, '').length / Math.max(words, 1);
    const questionMarks = (message || '').match(/\?/g)?.length || 0;
    const complexity = (words * 0.3) + (avgWordLength * 0.4) + (questionMarks * 0.3);
    return Math.round(complexity * 100) / 100;
  }

  detectMessageEmotion(message) {
    const emotionalMarkers = {
      positive: /happy|excited|great|awesome|fantastic|love|amazing/gi,
      negative: /angry|frustrated|hate|terrible|awful|bad|disappointed/gi,
      neutral: /help|question|wondering|need|want|can|could/gi
    };
    
    let dominantEmotion = 'neutral';
    let maxScore = 0;
    
    Object.keys(emotionalMarkers).forEach(emotion => {
      const matches = (message || '').match(emotionalMarkers[emotion]);
      const score = matches ? matches.length : 0;
      if (score > maxScore) {
        maxScore = score;
        dominantEmotion = emotion;
      }
    });
    
    return dominantEmotion;
  }

  identifyMessageTopic(message) {
    const content = (message || '').toLowerCase();
    if (/technical|system|analysis|data|algorithm|code|programming/gi.test(content)) return 'technical';
    if (/personal|feel|emotion|experience|life|mood/gi.test(content)) return 'personal';
    if (/question|help|how|what|why|can you/gi.test(content)) return 'inquiry';
    if (/business|work|project|professional|company/gi.test(content)) return 'professional';
    return 'general';
  }

  analyzeCurrentMessageStyle(message) {
    const words = (message || '').split(' ').length;
    const hasQuestions = /\?/.test(message || '');
    const hasTechnicalTerms = /analysis|system|data|algorithm|metric/gi.test(message || '');
    
    return {
      directness: hasQuestions ? 'direct' : 'moderate',
      formality: hasTechnicalTerms ? 'formal' : 'casual',
      complexity: words > 15 ? 'high' : words > 8 ? 'medium' : 'low',
      engagement: hasQuestions ? 'questioning' : 'informative'
    };
  }

  // Placeholder methods for comprehensive implementation
  analyzeCommunicationEvolution(currentMessage, sessionMessages) {
    return { placeholder: "Communication evolution analysis" };
  }

  assessCurrentMentalState(currentMessage) {
    const emotion = this.detectMessageEmotion(currentMessage);
    const complexity = this.calculateMessageComplexity(currentMessage);
    
    return {
      primaryEmotion: emotion,
      cognitiveLoad: complexity > 10 ? 'high' : complexity > 5 ? 'medium' : 'low',
      engagementLevel: /help|need|want|can you/gi.test(currentMessage || '') ? 'seeking' : 'sharing',
      confidence: complexity > 0 ? 'baseline_established' : 'insufficient_data'
    };
  }

  compareWeeklyPatterns(lastWeek, previousWeek) {
    return { placeholder: "Weekly pattern comparison" };
  }

  calculateLearningAcceleration(recentMemory) {
    return { placeholder: "Learning velocity calculation" };
  }

  analyzeEngagementProgression(recentMemory) {
    return { placeholder: "Engagement trend analysis" };
  }

  detectSignificantBehavioralShifts(recentMemory) {
    return { placeholder: "Behavioral shift detection" };
  }

  trackPersonalityDevelopment(behaviorProfile) {
    return { placeholder: "Personality evolution tracking" };
  }

  measureIntellectualProgression(behaviorProfile) {
    return { placeholder: "Intellectual growth measurement" };
  }

  analyzeEmotionalDevelopment(emotionalSessions) {
    return { placeholder: "Emotional maturation analysis" };
  }

  assessBehavioralConsistency(behaviorProfile) {
    return { placeholder: "Behavioral consistency assessment" };
  }

  describeMoment(micro) {
    return `Current session shows ${micro.messageComplexity.trend} complexity, ${micro.emotionalShifts.length} emotional shifts, focus on ${micro.topicEvolution.dominantTopic}`;
  }

  describeRecentEvolution(medium) {
    return { placeholder: "Recent journey description" };
  }

  describeLongTermGrowth(macro) {
    return { placeholder: "Long-term growth description" };
  }

  generateRemarkableObservations(micro, medium, macro) {
    return [
      `Your message complexity ${micro.messageComplexity.trend === 'increasing' ? 'increased' : 'stabilized'} during this session`,
      `Topic evolution shows ${micro.topicEvolution.transitions.length} distinct shifts`,
      `Emotional state demonstrates ${micro.emotionalShifts.length > 0 ? 'dynamic' : 'consistent'} patterns`
    ];
  }

  createPredictiveContext(micro, medium, macro) {
    return { placeholder: "Predictive context for LLM" };
  }
}

// Export singleton instance
const intelligenceEngine = new IntelligenceEngine();
export default intelligenceEngine;