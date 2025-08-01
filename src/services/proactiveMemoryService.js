/**
 * PROACTIVE MEMORY SERVICE
 * 
 * Goes beyond storage - actively analyzes patterns and surfaces insights
 * at the perfect moment in conversations.
 */

import ShortTermMemory from '../models/ShortTermMemory.js';
import Conversation from '../models/Conversation.js';
import UserBehaviorProfile from '../models/UserBehaviorProfile.js';
import redisService from './redisService.js';
import logger from '../utils/logger.js';

class ProactiveMemoryService {
  constructor() {
    // Memory indexing for rapid pattern matching
    this.memoryIndex = new Map();
    this.patternCache = new Map();
    this.triggerPatterns = new Map();
    
    // Pattern recognition configurations
    this.patterns = {
      recurring: {
        threshold: 3, // Times a theme must appear
        window: 7 * 24 * 60 * 60 * 1000, // 7 days
        significance: 0.7
      },
      breakthrough: {
        markers: ['realize', 'understand', 'aha', 'now I see', 'breakthrough'],
        emotionalShift: 0.3,
        significanceBoost: 0.9
      },
      emotional: {
        depth: ['personal', 'meaningful', 'important', 'significant'],
        vulnerability: ['honest', 'confession', 'admit', 'struggle'],
        growth: ['learned', 'changed', 'evolved', 'grew']
      },
      intellectual: {
        curiosity: ['why', 'how', 'what if', 'wonder', 'curious'],
        challenge: ['but', 'however', 'actually', 'disagree', 'challenge'],
        synthesis: ['connect', 'relate', 'similar', 'pattern', 'together']
      }
    };
    
    // Start background pattern analyzer
    this.startPatternAnalyzer();
  }

  /**
   * Save conversation with proactive pattern analysis
   */
  async saveWithPatternAnalysis(userId, userMessage, assistantResponse) {
    try {
      // Standard save operations
      const memories = await this.saveToMemory(userId, userMessage, assistantResponse);
      
      // Extract patterns from this exchange
      const patterns = await this.extractPatterns(userId, userMessage, assistantResponse);
      
      // Update pattern index
      await this.updatePatternIndex(userId, patterns);
      
      // Check for trigger conditions
      const triggers = await this.checkTriggerConditions(userId, userMessage, patterns);
      
      // Store analysis results for future proactive use
      await this.storeAnalysisResults(userId, {
        patterns,
        triggers,
        timestamp: new Date(),
        significance: this.calculateSignificance(patterns, triggers)
      });
      
      return {
        saved: true,
        patterns,
        triggers,
        proactiveInsights: await this.generateProactiveInsights(userId, patterns, triggers)
      };
      
    } catch (error) {
      logger.error('Proactive memory save error:', error);
      throw error;
    }
  }

  /**
   * Get contextual memories with proactive insights - OPTIMIZED
   */
  async getProactiveContext(userId, currentMessage, limit = 10) {
    try {
      // PERFORMANCE: Determine processing depth based on message complexity
      const processingDepth = this.determineProcessingDepth(currentMessage);
      
      // SMART QUERY: Only get what we need
      const recentMemories = await ShortTermMemory.find({ userId })
        .sort({ timestamp: -1 })
        .limit(processingDepth.memoryLimit)
        .lean();
      
      // PARALLEL PROCESSING: Run analysis components in parallel
      const [relevantPatterns, breakthroughs, emergingThemes] = await Promise.all([
        processingDepth.level === 'lightweight' ? [] : this.findRelevantPatterns(userId, currentMessage),
        processingDepth.skipBreakthroughs ? [] : this.identifyBreakthroughs(userId, recentMemories),
        this.detectEmergingThemes(userId, recentMemories, processingDepth)
      ]);
      
      // INTELLIGENT CONNECTION POINTS: Only for complex conversations
      const connectionPoints = processingDepth.level !== 'lightweight' ? 
        await this.findConnectionPoints(currentMessage, recentMemories, relevantPatterns) : [];
      
      // Build proactive context with appropriate depth
      const proactiveContext = {
        recentExchanges: this.formatRecentExchanges(recentMemories.slice(0, limit)),
        relevantHistory: this.selectRelevantHistory(relevantPatterns, currentMessage),
        breakthroughMoments: breakthroughs,
        emergingThemes: emergingThemes,
        connectionOpportunities: connectionPoints,
        emotionalJourney: processingDepth.skipEmotional ? 
          { trajectory: [], currentState: 'neutral', volatility: 0.5, depth: 0.3 } :
          await this.trackEmotionalJourney(userId, recentMemories),
        intellectualThreads: processingDepth.level === 'deep' ? 
          await this.identifyIntellectualThreads(recentMemories) : [],
        proactivePrompts: await this.generateProactivePrompts(userId, currentMessage, emergingThemes, processingDepth)
      };
      
      return proactiveContext;
      
    } catch (error) {
      logger.error('Proactive context error:', error);
      return this.getFallbackContext(userId);
    }
  }

  /**
   * Determine processing depth based on message complexity
   */
  determineProcessingDepth(currentMessage) {
    const messageLength = currentMessage.length;
    const hasQuestions = currentMessage.includes('?');
    const hasEmotionalWords = /feel|emotion|personal|struggle|sad|happy|worried|excited/i.test(currentMessage);
    const hasComplexThoughts = /because|however|analyze|understand|philosophy/i.test(currentMessage);
    const isCasual = /hey|hi|hello|whats up|sup/i.test(currentMessage.toLowerCase());
    
    // LIGHTWEIGHT: Casual greetings and simple messages
    if (isCasual && messageLength < 50 && !hasQuestions && !hasEmotionalWords) {
      return {
        level: 'lightweight', 
        memoryLimit: 10,
        skipBreakthroughs: true,
        skipEmotional: true,
        reason: 'casual interaction'
      };
    }
    
    // STANDARD: Normal conversations
    if (messageLength < 100 && !hasComplexThoughts && !hasEmotionalWords) {
      return {
        level: 'standard',
        memoryLimit: 20,
        skipBreakthroughs: false,
        skipEmotional: false,
        reason: 'standard conversation'
      };
    }
    
    // DEEP: Complex or emotional conversations
    return {
      level: 'deep',
      memoryLimit: 50,
      skipBreakthroughs: false,
      skipEmotional: false,
      reason: 'complex conversation'
    };
  }

  /**
   * Extract patterns from conversation
   */
  async extractPatterns(userId, userMessage, assistantResponse) {
    const patterns = {
      topics: [],
      emotions: [],
      questions: [],
      insights: [],
      recurring: [],
      novel: []
    };
    
    // Topic extraction
    patterns.topics = this.extractTopics(userMessage + ' ' + assistantResponse);
    
    // Emotional pattern detection
    patterns.emotions = this.detectEmotionalPatterns(userMessage);
    
    // Question pattern analysis
    if (userMessage.includes('?')) {
      patterns.questions = this.analyzeQuestionPatterns(userMessage);
    }
    
    // Insight detection
    patterns.insights = this.detectInsights(userMessage, assistantResponse);
    
    // Check for recurring themes
    const history = await this.getUserHistory(userId, 50);
    patterns.recurring = this.findRecurringThemes(userMessage, history);
    
    // Identify novel elements
    patterns.novel = this.identifyNovelElements(userMessage, history);
    
    return patterns;
  }

  /**
   * Check trigger conditions for proactive responses
   */
  async checkTriggerConditions(userId, message, patterns) {
    const triggers = [];
    
    // Breakthrough trigger
    if (this.isBreakthroughMoment(message, patterns)) {
      triggers.push({
        type: 'breakthrough',
        confidence: 0.8,
        action: 'celebrate_and_deepen',
        message: 'This seems like a significant realization'
      });
    }
    
    // Pattern completion trigger
    if (patterns.recurring.length > 0 && this.isPatternCompleting(patterns.recurring)) {
      triggers.push({
        type: 'pattern_completion',
        confidence: 0.7,
        action: 'synthesize_pattern',
        message: 'Noticing a pattern completing'
      });
    }
    
    // Emotional depth trigger
    if (patterns.emotions.some(e => e.depth > 0.7)) {
      triggers.push({
        type: 'emotional_depth',
        confidence: 0.9,
        action: 'mirror_and_validate',
        message: 'Deep emotional expression detected'
      });
    }
    
    // Curiosity spike trigger
    if (patterns.questions.length > 2 || patterns.questions.some(q => q.depth > 0.8)) {
      triggers.push({
        type: 'curiosity_spike',
        confidence: 0.8,
        action: 'explore_deeply',
        message: 'High curiosity detected'
      });
    }
    
    return triggers;
  }

  /**
   * Find relevant patterns from history
   */
  async findRelevantPatterns(userId, currentMessage) {
    try {
      // Get user's pattern index
      const patternIndex = await this.getPatternIndex(userId);
      
      // Extract key concepts from current message
      const currentConcepts = this.extractKeyConcepts(currentMessage);
      
      // Find patterns with highest relevance
      const relevantPatterns = [];
      
      for (const [concept, occurrences] of patternIndex) {
        const relevance = this.calculateRelevance(concept, currentConcepts);
        
        if (relevance > 0.6) {
          relevantPatterns.push({
            concept,
            relevance,
            occurrences: occurrences.slice(-5), // Last 5 occurrences
            firstSeen: occurrences[0].timestamp,
            evolution: this.trackConceptEvolution(occurrences)
          });
        }
      }
      
      // Sort by relevance
      return relevantPatterns.sort((a, b) => b.relevance - a.relevance).slice(0, 5);
      
    } catch (error) {
      logger.error('Find relevant patterns error:', error);
      return [];
    }
  }

  /**
   * Identify breakthrough moments
   */
  async identifyBreakthroughs(userId, memories) {
    const breakthroughs = [];
    
    for (let i = 0; i < memories.length - 1; i++) {
      const current = memories[i];
      const previous = memories[i + 1];
      
      // Check for breakthrough markers
      const hasMarkers = this.patterns.breakthrough.markers.some(marker => 
        current.content.toLowerCase().includes(marker)
      );
      
      // Check for emotional shift
      const emotionalShift = this.calculateEmotionalShift(previous, current);
      
      // Check for conceptual leap
      const conceptualLeap = this.detectConceptualLeap(previous, current);
      
      if (hasMarkers || emotionalShift > 0.3 || conceptualLeap) {
        breakthroughs.push({
          timestamp: current.timestamp,
          content: current.content,
          type: hasMarkers ? 'explicit' : emotionalShift > 0.3 ? 'emotional' : 'conceptual',
          significance: this.calculateBreakthroughSignificance(current, previous),
          context: previous.content.slice(0, 100) + '...'
        });
      }
    }
    
    return breakthroughs.slice(0, 3); // Return top 3 recent breakthroughs
  }

  /**
   * Detect emerging themes - INTELLIGENT VERSION
   */
  async detectEmergingThemes(userId, memories, processingDepth = {}) {
    // Skip theme detection for lightweight processing
    if (processingDepth.level === 'lightweight') {
      return [];
    }
    
    const themeMap = new Map();
    const minRequiredMessages = processingDepth.level === 'standard' ? 3 : 2;
    
    // Analyze recent memories for themes with context awareness
    memories.forEach(memory => {
      const themes = this.extractIntelligentThemes(memory.content, memories.length);
      
      themes.forEach(themeData => {
        if (!themeMap.has(themeData.theme)) {
          themeMap.set(themeData.theme, {
            count: 0,
            firstSeen: memory.timestamp,
            examples: [],
            totalStrength: 0
          });
        }
        
        const existingData = themeMap.get(themeData.theme);
        existingData.count++;
        existingData.totalStrength += themeData.strength;
        existingData.lastSeen = memory.timestamp;
        existingData.examples.push(memory.content.slice(0, 50));
      });
    });
    
    // Find genuinely emerging themes with significance
    const emergingThemes = [];
    
    for (const [theme, data] of themeMap) {
      // Higher threshold for significance
      if (data.count >= minRequiredMessages && data.totalStrength > 0.5) {
        const recency = Date.now() - new Date(data.lastSeen).getTime();
        const frequency = data.count / memories.length;
        const avgStrength = data.totalStrength / data.count;
        
        // Boost themes that appear with increasing frequency
        const recencyBoost = 1 / (recency / (24 * 60 * 60 * 1000) + 1);
        const finalStrength = frequency * avgStrength * recencyBoost;
        
        // Only include themes with substantial strength
        if (finalStrength > 0.3) {
          emergingThemes.push({
            theme,
            strength: finalStrength,
            examples: data.examples.slice(0, 2),
            trajectory: 'emerging',
            frequency: data.count
          });
        }
      }
    }
    
    // Return only the most significant themes
    return emergingThemes
      .sort((a, b) => b.strength - a.strength)
      .slice(0, processingDepth.level === 'deep' ? 3 : 2);
  }

  /**
   * Extract themes with intelligence and context awareness
   */
  extractIntelligentThemes(text, conversationLength) {
    const themes = [];
    const lowerText = text.toLowerCase();
    
    // Advanced theme patterns with strength scoring
    const intelligentThemePatterns = {
      'philosophical_inquiry': {
        patterns: ['meaning', 'existence', 'consciousness', 'truth', 'reality', 'purpose', 'why do we'],
        minLength: 30,
        strength: 0.8
      },
      'personal_growth': {
        patterns: ['learn', 'grow', 'develop', 'improve', 'change', 'evolve', 'better myself'],
        minLength: 20,
        strength: 0.7
      },
      'emotional_processing': {
        patterns: ['feel deeply', 'struggling with', 'emotional', 'vulnerable', 'personal journey'],
        minLength: 25,
        strength: 0.8
      },
      'intellectual_challenge': {
        patterns: ['analyze', 'understand deeply', 'complex', 'theory', 'concept', 'paradigm'],
        minLength: 20,
        strength: 0.7
      },
      'creative_exploration': {
        patterns: ['creative', 'imagination', 'innovative', 'artistic', 'design', 'express'],
        minLength: 15,
        strength: 0.6
      },
      'technology_ethics': {
        patterns: ['ai ethics', 'technology impact', 'digital', 'artificial intelligence', 'automation'],
        minLength: 25,
        strength: 0.8
      }
    };
    
    // Only extract themes if text has sufficient depth
    if (text.length < 20) return themes;
    
    for (const [theme, config] of Object.entries(intelligentThemePatterns)) {
      if (text.length >= config.minLength) {
        const matches = config.patterns.filter(pattern => lowerText.includes(pattern));
        if (matches.length > 0) {
          // Calculate strength based on matches and context
          const matchStrength = matches.length / config.patterns.length;
          const contextStrength = Math.min(1, text.length / 100); // Longer text = more context
          
          themes.push({
            theme,
            strength: config.strength * matchStrength * contextStrength,
            matches: matches.slice(0, 2)
          });
        }
      }
    }
    
    return themes.filter(t => t.strength > 0.4); // Only return meaningful themes
  }

  /**
   * Generate proactive prompts based on patterns
   */
  async generateProactivePrompts(userId, currentMessage, emergingThemes) {
    const prompts = [];
    
    // Based on emerging themes
    if (emergingThemes.length > 0) {
      const strongestTheme = emergingThemes[0];
      prompts.push({
        type: 'theme_exploration',
        prompt: `I've noticed you've been exploring ${strongestTheme.theme} recently...`,
        confidence: strongestTheme.strength
      });
    }
    
    // Based on question patterns
    if (currentMessage.includes('?') && currentMessage.includes('why')) {
      prompts.push({
        type: 'deep_inquiry',
        prompt: 'This touches on something fundamental...',
        confidence: 0.7
      });
    }
    
    // Based on emotional expression
    const emotionalDepth = this.assessEmotionalDepth(currentMessage);
    if (emotionalDepth > 0.6) {
      prompts.push({
        type: 'emotional_resonance',
        prompt: 'Thank you for sharing something so personal...',
        confidence: 0.8
      });
    }
    
    return prompts;
  }

  /**
   * Track emotional journey through memories
   */
  async trackEmotionalJourney(userId, memories) {
    const journey = {
      trajectory: [],
      currentState: 'neutral',
      volatility: 0,
      depth: 0
    };
    
    memories.forEach((memory, index) => {
      const emotion = this.analyzeEmotionalContent(memory.content);
      journey.trajectory.push({
        timestamp: memory.timestamp,
        valence: emotion.valence,
        intensity: emotion.intensity,
        primary: emotion.primary
      });
    });
    
    // Calculate overall metrics
    if (journey.trajectory.length > 0) {
      journey.currentState = journey.trajectory[0].primary;
      journey.volatility = this.calculateEmotionalVolatility(journey.trajectory);
      journey.depth = journey.trajectory.reduce((sum, e) => sum + e.intensity, 0) / journey.trajectory.length;
    }
    
    return journey;
  }

  /**
   * Helper methods
   */
  
  async saveToMemory(userId, userMessage, assistantResponse) {
    const memories = await ShortTermMemory.insertMany([
      {
        userId,
        content: userMessage,
        role: 'user',
        timestamp: new Date(),
        metadata: {
          processed: true,
          significance: 0
        }
      },
      {
        userId,
        content: assistantResponse,
        role: 'assistant',
        timestamp: new Date(),
        metadata: {
          processed: true,
          significance: 0
        }
      }
    ]);
    
    return memories;
  }
  
  extractTopics(text) {
    // Simplified topic extraction
    const topics = [];
    const topicPatterns = {
      technology: ['ai', 'computer', 'software', 'technology', 'digital'],
      philosophy: ['think', 'meaning', 'consciousness', 'existence', 'truth'],
      emotion: ['feel', 'emotion', 'love', 'fear', 'joy', 'sad'],
      growth: ['learn', 'grow', 'improve', 'develop', 'evolve']
    };
    
    const lowerText = text.toLowerCase();
    
    for (const [topic, patterns] of Object.entries(topicPatterns)) {
      if (patterns.some(pattern => lowerText.includes(pattern))) {
        topics.push(topic);
      }
    }
    
    return topics;
  }
  
  detectEmotionalPatterns(text) {
    const emotions = [];
    const emotionWords = {
      joy: ['happy', 'excited', 'thrilled', 'delighted'],
      sadness: ['sad', 'disappointed', 'down', 'blue'],
      fear: ['afraid', 'worried', 'anxious', 'scared'],
      anger: ['angry', 'frustrated', 'annoyed', 'irritated'],
      curiosity: ['curious', 'wonder', 'interested', 'intrigued']
    };
    
    const lowerText = text.toLowerCase();
    
    for (const [emotion, words] of Object.entries(emotionWords)) {
      const matches = words.filter(word => lowerText.includes(word));
      if (matches.length > 0) {
        emotions.push({
          emotion,
          intensity: matches.length / words.length,
          depth: this.calculateEmotionalDepth(text, emotion)
        });
      }
    }
    
    return emotions;
  }
  
  analyzeQuestionPatterns(text) {
    const questions = text.split('?').filter(q => q.trim().length > 0);
    
    return questions.map(question => ({
      text: question.trim() + '?',
      type: this.classifyQuestionType(question),
      depth: this.assessQuestionDepth(question),
      exploratory: question.includes('what if') || question.includes('why')
    }));
  }
  
  classifyQuestionType(question) {
    if (question.includes('why')) return 'causal';
    if (question.includes('how')) return 'procedural';
    if (question.includes('what')) return 'definitional';
    if (question.includes('when')) return 'temporal';
    return 'exploratory';
  }
  
  assessQuestionDepth(question) {
    let depth = 0.3; // Base depth
    
    // Increase depth for philosophical markers
    const deepMarkers = ['meaning', 'purpose', 'essence', 'fundamental', 'really'];
    deepMarkers.forEach(marker => {
      if (question.includes(marker)) depth += 0.15;
    });
    
    // Increase for length (more complex questions tend to be longer)
    if (question.length > 50) depth += 0.1;
    if (question.length > 100) depth += 0.1;
    
    return Math.min(1, depth);
  }
  
  isBreakthroughMoment(message, patterns) {
    const breakthroughScore = 
      (patterns.insights.length > 0 ? 0.3 : 0) +
      (patterns.emotions.some(e => e.intensity > 0.7) ? 0.3 : 0) +
      (this.patterns.breakthrough.markers.some(m => message.toLowerCase().includes(m)) ? 0.4 : 0);
    
    return breakthroughScore > 0.6;
  }
  
  calculateSignificance(patterns, triggers) {
    const patternScore = 
      patterns.insights.length * 0.2 +
      patterns.recurring.length * 0.1 +
      patterns.novel.length * 0.15;
    
    const triggerScore = triggers.reduce((sum, t) => sum + t.confidence, 0) / 10;
    
    return Math.min(1, patternScore + triggerScore);
  }
  
  calculateEmotionalShift(previous, current) {
    const prevEmotion = this.analyzeEmotionalContent(previous.content);
    const currEmotion = this.analyzeEmotionalContent(current.content);
    
    return Math.abs(currEmotion.valence - prevEmotion.valence) + 
           Math.abs(currEmotion.intensity - prevEmotion.intensity);
  }
  
  analyzeEmotionalContent(text) {
    // Simplified emotional analysis
    const positive = ['happy', 'excited', 'great', 'wonderful', 'amazing'].filter(w => text.includes(w)).length;
    const negative = ['sad', 'worried', 'afraid', 'angry', 'frustrated'].filter(w => text.includes(w)).length;
    
    return {
      valence: (positive - negative) / Math.max(1, positive + negative),
      intensity: Math.min(1, (positive + negative) / 5),
      primary: positive > negative ? 'positive' : negative > positive ? 'negative' : 'neutral'
    };
  }
  
  /**
   * Background pattern analyzer
   */
  startPatternAnalyzer() {
    setInterval(async () => {
      try {
        // Analyze patterns for active users
        const activeUsers = await ShortTermMemory.distinct('userId', {
          timestamp: { $gte: new Date(Date.now() - 3600000) } // Last hour
        });
        
        for (const userId of activeUsers.slice(0, 10)) {
          await this.analyzeUserPatterns(userId);
        }
      } catch (error) {
        logger.error('Pattern analyzer error:', error);
      }
    }, 300000); // Every 5 minutes
  }
  
  async analyzeUserPatterns(userId) {
    try {
      const memories = await ShortTermMemory.find({ userId })
        .sort({ timestamp: -1 })
        .limit(100)
        .lean();
      
      if (memories.length < 10) return;
      
      // Deep pattern analysis
      const analysis = {
        conversationArcs: this.identifyConversationArcs(memories),
        cognitiveLoops: this.detectCognitiveLoops(memories),
        growthVectors: this.calculateGrowthVectors(memories),
        resonancePatterns: this.findResonancePatterns(memories)
      };
      
      // Cache analysis results
      await redisService.set(`pattern-analysis:${userId}`, analysis, 3600);
      
    } catch (error) {
      logger.error(`Pattern analysis error for user ${userId}:`, error);
    }
  }
  
  // Pattern analysis methods
  identifyConversationArcs(memories) { return []; }
  detectCognitiveLoops(memories) { return []; }
  calculateGrowthVectors(memories) { return []; }
  findResonancePatterns(memories) { return []; }
  
  detectConceptualLeap(previous, current) {
    // Detect significant conceptual jumps between messages
    const prevWords = new Set(previous.content.toLowerCase().split(/\s+/));
    const currWords = new Set(current.content.toLowerCase().split(/\s+/));
    
    // Calculate conceptual distance
    const intersection = new Set([...prevWords].filter(x => currWords.has(x)));
    const union = new Set([...prevWords, ...currWords]);
    const similarity = intersection.size / union.size;
    
    // Lower similarity suggests conceptual leap
    return similarity < 0.3;
  }
  
  calculateEmotionalDepth(text, emotion = null) {
    let depth = 0.3; // Base depth
    
    // Increase depth for personal markers
    const personalMarkers = ['feel', 'personal', 'meaningful', 'important', 'struggle'];
    personalMarkers.forEach(marker => {
      if (text.toLowerCase().includes(marker)) depth += 0.1;
    });
    
    // Increase for length (more complex emotional expressions tend to be longer)
    if (text.length > 100) depth += 0.1;
    if (text.length > 200) depth += 0.1;
    
    return Math.min(1, depth);
  }
  
  detectInsights(userMessage, assistantResponse) {
    const insights = [];
    
    // Look for insight markers in the conversation
    const insightMarkers = ['realize', 'understand', 'aha', 'now i see', 'makes sense', 'breakthrough'];
    const userText = userMessage.toLowerCase();
    const assistantText = assistantResponse.toLowerCase();
    
    insightMarkers.forEach(marker => {
      if (userText.includes(marker) || assistantText.includes(marker)) {
        insights.push({
          type: 'realization',
          marker: marker,
          source: userText.includes(marker) ? 'user' : 'assistant',
          confidence: 0.7
        });
      }
    });
    
    // Detect question-answer patterns that indicate understanding
    if (userMessage.includes('?') && assistantResponse.length > 100) {
      insights.push({
        type: 'knowledge_transfer',
        marker: 'question_answered',
        source: 'exchange',
        confidence: 0.5
      });
    }
    
    return insights;
  }
  
  extractThemes(text) {
    const themes = [];
    const themePatterns = {
      'technology': ['ai', 'computer', 'software', 'tech', 'digital', 'algorithm'],
      'philosophy': ['meaning', 'existence', 'consciousness', 'truth', 'reality', 'purpose'],
      'creativity': ['art', 'creative', 'imagination', 'inspire', 'design', 'innovation'],
      'growth': ['learn', 'grow', 'develop', 'improve', 'evolve', 'change'],
      'relationships': ['connect', 'relationship', 'friend', 'family', 'love', 'trust'],
      'work': ['career', 'job', 'business', 'professional', 'project', 'success']
    };
    
    const lowerText = text.toLowerCase();
    
    for (const [theme, patterns] of Object.entries(themePatterns)) {
      const matches = patterns.filter(pattern => lowerText.includes(pattern));
      if (matches.length > 0) {
        themes.push({
          theme,
          strength: matches.length / patterns.length,
          matches
        });
      }
    }
    
    return themes.map(t => t.theme);
  }
  
  identifyIntellectualThreads(memories) {
    const threads = {};
    
    memories.forEach(memory => {
      const concepts = this.extractKeyConcepts(memory.content);
      concepts.forEach(concept => {
        if (!threads[concept]) {
          threads[concept] = {
            count: 0,
            firstSeen: memory.timestamp,
            examples: []
          };
        }
        threads[concept].count++;
        threads[concept].lastSeen = memory.timestamp;
        threads[concept].examples.push(memory.content.slice(0, 100));
      });
    });
    
    // Return top intellectual threads
    return Object.entries(threads)
      .filter(([_, data]) => data.count >= 2)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([concept, data]) => ({
        concept,
        frequency: data.count,
        evolution: data.lastSeen - data.firstSeen,
        examples: data.examples.slice(0, 2)
      }));
  }
  
  async getPatternIndex(userId) {
    const cached = this.patternCache.get(userId);
    if (cached) return cached;
    
    // Build pattern index from memories
    const memories = await ShortTermMemory.find({ userId })
      .sort({ timestamp: -1 })
      .limit(200)
      .lean();
    
    const index = new Map();
    
    memories.forEach(memory => {
      const concepts = this.extractKeyConcepts(memory.content);
      concepts.forEach(concept => {
        if (!index.has(concept)) {
          index.set(concept, []);
        }
        index.get(concept).push({
          timestamp: memory.timestamp,
          context: memory.content.slice(0, 100)
        });
      });
    });
    
    this.patternCache.set(userId, index);
    return index;
  }
  
  extractKeyConcepts(text) {
    // Simplified concept extraction
    const words = text.toLowerCase().split(/\s+/);
    const concepts = words.filter(word => 
      word.length > 4 && 
      !['that', 'this', 'with', 'from', 'have'].includes(word)
    );
    return [...new Set(concepts)].slice(0, 5);
  }
  
  calculateRelevance(concept, currentConcepts) {
    const exact = currentConcepts.includes(concept) ? 0.5 : 0;
    const partial = currentConcepts.some(c => c.includes(concept) || concept.includes(c)) ? 0.3 : 0;
    return exact + partial + Math.random() * 0.2; // Add some randomness for discovery
  }
  
  formatRecentExchanges(memories) {
    return memories.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp
    }));
  }
  
  getFallbackContext(userId) {
    return {
      recentExchanges: [],
      relevantHistory: [],
      breakthroughMoments: [],
      emergingThemes: [],
      connectionOpportunities: [],
      emotionalJourney: { trajectory: [], currentState: 'neutral' },
      intellectualThreads: [],
      proactivePrompts: []
    };
  }
  
  // Missing helper methods
  trackConceptEvolution(occurrences) {
    if (!occurrences || occurrences.length < 2) return 'stable';
    
    const timeSpan = new Date(occurrences[occurrences.length - 1].timestamp) - new Date(occurrences[0].timestamp);
    const frequency = occurrences.length / (timeSpan / (24 * 60 * 60 * 1000)); // per day
    
    if (frequency > 2) return 'accelerating';
    if (frequency < 0.5) return 'declining';
    return 'steady';
  }
  
  calculateBreakthroughSignificance(current, previous) {
    let significance = 0.3; // Base significance
    
    // Check for emotional intensity markers
    const intensityMarkers = ['realize', 'understand', 'aha', 'breakthrough', 'suddenly', 'now i see'];
    intensityMarkers.forEach(marker => {
      if (current.content.toLowerCase().includes(marker)) significance += 0.2;
    });
    
    // Check for length and complexity
    if (current.content.length > previous.content.length * 1.5) significance += 0.1;
    
    // Check for question to statement shift
    if (previous.content.includes('?') && !current.content.includes('?')) significance += 0.15;
    
    return Math.min(1, significance);
  }
  
  async getUserHistory(userId, limit = 50) {
    try {
      return await ShortTermMemory.find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
    } catch (error) {
      logger.error('Get user history error:', error);
      return [];
    }
  }
  
  findRecurringThemes(message, history) {
    const themes = [];
    const messageWords = new Set(message.toLowerCase().split(/\s+/));
    
    // Look for repeated concepts in history
    const conceptCounts = new Map();
    history.forEach(msg => {
      const words = msg.content.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 4 && messageWords.has(word)) {
          conceptCounts.set(word, (conceptCounts.get(word) || 0) + 1);
        }
      });
    });
    
    // Find recurring themes
    for (const [concept, count] of conceptCounts) {
      if (count >= 3) {
        themes.push({
          concept,
          frequency: count,
          significance: Math.min(1, count / 10)
        });
      }
    }
    
    return themes.sort((a, b) => b.frequency - a.frequency).slice(0, 3);
  }
  
  identifyNovelElements(message, history) {
    const novel = [];
    const messageWords = new Set(message.toLowerCase().split(/\s+/));
    const historyWords = new Set();
    
    // Build set of all historical words
    history.forEach(msg => {
      msg.content.toLowerCase().split(/\s+/).forEach(word => {
        if (word.length > 4) historyWords.add(word);
      });
    });
    
    // Find words/concepts in current message not seen before
    messageWords.forEach(word => {
      if (word.length > 4 && !historyWords.has(word)) {
        novel.push({
          element: word,
          type: 'vocabulary',
          novelty: 0.8
        });
      }
    });
    
    return novel.slice(0, 5);
  }
  
  isPatternCompleting(patterns) {
    return patterns.some(pattern => pattern.frequency >= 5 && pattern.significance > 0.7);
  }
  
  selectRelevantHistory(patterns, currentMessage) {
    return patterns.slice(0, 3).map(pattern => ({
      concept: pattern.concept,
      relevance: pattern.relevance,
      examples: pattern.occurrences.slice(0, 2).map(occ => occ.context)
    }));
  }
  
  findConnectionPoints(currentMessage, memories, patterns) {
    const connections = [];
    
    // Find thematic connections
    patterns.forEach(pattern => {
      if (currentMessage.toLowerCase().includes(pattern.concept.toLowerCase())) {
        connections.push({
          type: 'thematic',
          concept: pattern.concept,
          strength: pattern.relevance,
          context: 'recurring pattern detected'
        });
      }
    });
    
    // Find temporal connections (similar messages at similar times)
    const currentHour = new Date().getHours();
    const similarTimeMessages = memories.filter(m => {
      const msgHour = new Date(m.timestamp).getHours();
      return Math.abs(msgHour - currentHour) <= 2;
    });
    
    if (similarTimeMessages.length > 0) {
      connections.push({
        type: 'temporal',
        pattern: 'similar_time_engagement',
        strength: 0.6,
        context: `Often active around ${currentHour}:00`
      });
    }
    
    return connections;
  }
  
  calculateEmotionalVolatility(trajectory) {
    if (!trajectory || trajectory.length < 2) return 0.5;
    
    let volatility = 0;
    for (let i = 1; i < trajectory.length; i++) {
      const prev = trajectory[i - 1];
      const curr = trajectory[i];
      
      // Calculate change in valence and intensity
      const valenceChange = Math.abs(curr.valence - prev.valence);
      const intensityChange = Math.abs(curr.intensity - prev.intensity);
      
      volatility += (valenceChange + intensityChange) / 2;
    }
    
    return Math.min(1, volatility / (trajectory.length - 1));
  }
  
  async updatePatternIndex(userId, patterns) {
    try {
      // Update the in-memory pattern cache
      let index = this.patternCache.get(userId) || new Map();
      
      // Add new patterns to the index
      patterns.topics.forEach(topic => {
        if (!index.has(topic)) {
          index.set(topic, []);
        }
        index.get(topic).push({
          timestamp: new Date(),
          context: `Topic: ${topic}`,
          type: 'topic'
        });
      });
      
      patterns.emotions.forEach(emotion => {
        const key = `emotion_${emotion.emotion}`;
        if (!index.has(key)) {
          index.set(key, []);
        }
        index.get(key).push({
          timestamp: new Date(),
          context: `Emotion: ${emotion.emotion} (intensity: ${emotion.intensity})`,
          type: 'emotion'
        });
      });
      
      // Update cache
      this.patternCache.set(userId, index);
      
      // Optionally persist to Redis
      await redisService.set(`pattern-index:${userId}`, Array.from(index.entries()), 3600);
      
      return true;
    } catch (error) {
      logger.error('Update pattern index error:', error);
      return false;
    }
  }
  
  async storeAnalysisResults(userId, analysisData) {
    try {
      const cacheKey = `analysis-results:${userId}`;
      await redisService.set(cacheKey, analysisData, 1800); // 30 minutes
      return true;
    } catch (error) {
      logger.error('Store analysis results error:', error);
      return false;
    }
  }
  
  generateProactiveInsights(userId, patterns, triggers) {
    const insights = [];
    
    // Generate insights based on patterns
    if (patterns.recurring && patterns.recurring.length > 0) {
      insights.push({
        type: 'pattern_recognition',
        insight: `You seem to frequently explore themes around ${patterns.recurring[0].concept}`,
        confidence: patterns.recurring[0].significance
      });
    }
    
    if (patterns.novel && patterns.novel.length > 0) {
      insights.push({
        type: 'vocabulary_expansion',
        insight: `You're exploring new conceptual territory with terms like "${patterns.novel[0].element}"`,
        confidence: patterns.novel[0].novelty
      });
    }
    
    // Generate insights from triggers
    triggers.forEach(trigger => {
      insights.push({
        type: trigger.type,
        insight: trigger.message,
        confidence: trigger.confidence,
        action: trigger.action
      });
    });
    
    return insights.slice(0, 3); // Return top 3 insights
  }
  
  assessEmotionalDepth(text) {
    let depth = 0.3; // Base depth
    
    // Emotional depth indicators
    const deepMarkers = ['feel', 'emotion', 'heart', 'soul', 'meaningful', 'personal', 'vulnerable', 'honest'];
    deepMarkers.forEach(marker => {
      if (text.toLowerCase().includes(marker)) depth += 0.1;
    });
    
    // Introspective markers
    const introspectiveMarkers = ['reflect', 'think about', 'realize', 'understand', 'inner', 'deep'];
    introspectiveMarkers.forEach(marker => {
      if (text.toLowerCase().includes(marker)) depth += 0.08;
    });
    
    // Length and sentence complexity can indicate depth
    if (text.length > 150) depth += 0.1;
    if (text.split('.').length > 3) depth += 0.05;
    
    return Math.min(1, depth);
  }
}

export default new ProactiveMemoryService();