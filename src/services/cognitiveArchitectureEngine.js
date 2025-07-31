/**
 * Cognitive Architecture Engine
 * Advanced behavioral pattern recognition and cognitive mapping
 * NOT just another AI wrapper - actual cognitive analysis
 */

import ShortTermMemory from '../models/ShortTermMemory.js';
import UserBehaviorProfile from '../models/UserBehaviorProfile.js';
import logger from '../utils/logger.js';

class CognitiveArchitectureEngine {
  constructor() {
    // Cognitive patterns we're detecting
    this.cognitivePatterns = {
      DECISION_MAKING: {
        SYSTEMATIC: 'systematic_thinker',        // Wants step-by-step analysis
        INTUITIVE: 'intuitive_decider',          // Goes with gut feeling
        SECURITY_FOCUSED: 'security_conscious',   // Risk-averse, safety first
        OPPORTUNITY_DRIVEN: 'opportunity_seeker', // Risk-taking, growth focused
        CREATIVE_EXPLORER: 'creative_explorer'    // Seeks novel solutions
      },
      COMMUNICATION_STYLE: {
        ANALYTICAL: 'analytical_communicator',    // Loves data, logic, structure
        EMOTIONAL: 'emotional_communicator',      // Values feelings, empathy
        DIRECTIVE: 'directive_communicator',      // Direct, action-oriented
        COLLABORATIVE: 'collaborative_thinker',   // Seeks input, consensus
        NARRATIVE: 'narrative_processor'          // Thinks in stories
      },
      INFORMATION_PROCESSING: {
        DETAIL_ORIENTED: 'detail_processor',      // Focuses on specifics
        BIG_PICTURE: 'holistic_thinker',         // Sees patterns, connections
        SEQUENTIAL: 'sequential_processor',       // Linear thinking
        PARALLEL: 'parallel_processor',          // Multiple threads of thought
        VISUAL: 'visual_processor'               // Thinks in images, examples
      },
      STRESS_RESPONSE: {
        PLANNING: 'stress_planner',              // Plans way out of problems
        ACTION: 'stress_actor',                  // Takes immediate action
        SEEKING_SUPPORT: 'support_seeker',       // Looks for help/validation
        WITHDRAWAL: 'withdrawal_response',       // Needs space to process
        ANALYSIS: 'analysis_paralysis'           // Over-analyzes when stressed
      }
    };

    // Linguistic markers for pattern detection
    this.linguisticMarkers = {
      systematic: [
        'step-by-step', 'analysis', 'criteria', 'systematic', 'detailed',
        'compare', 'evaluate', 'specific', 'structure', 'organize'
      ],
      intuitive: [
        'gut', 'feel', 'instinct', 'sense', 'naturally', 'immediately',
        'quick decision', 'trust', 'spontaneous', 'impulse'
      ],
      security_focused: [
        'safe', 'stable', 'risk', 'worried', 'careful', 'family',
        'security', 'afford', 'unemployment', 'cautious'
      ],
      creative: [
        'creative', 'alternative', 'different', 'novel', 'innovative',
        'outside the box', 'brainstorm', 'possibility', 'imagine'
      ],
      analytical: [
        'data', 'evidence', 'logic', 'rational', 'analyze', 'research',
        'facts', 'numbers', 'proof', 'objective'
      ],
      emotional: [
        'feel', 'emotions', 'heart', 'passion', 'love', 'excited',
        'frustrated', 'happy', 'sad', 'emotional'
      ]
    };

    // Conversation pattern indicators (simplified for now)
    this.conversationPatterns = {
      question_complexity: 'moderate',
      decision_approach: 'balanced',
      information_preference: 'detailed',
      response_style: 'conversational',
      stress_indicators: 'minimal'
    };
  }

  /**
   * Main cognitive analysis entry point
   * Analyzes conversation patterns to map cognitive architecture
   */
  async analyzeCognitiveArchitecture(userId, conversationContext) {
    try {
      logger.info(` Cognitive Architecture: Analyzing user ${userId}`);

      // Get recent conversation data
      const recentMessages = await ShortTermMemory
        .find({ userId })
        .sort({ timestamp: -1 })
        .limit(50);

      if (recentMessages.length < 1) { // Changed from 3 to 1 - allow analysis with minimal data
        return this.generateMinimalProfile(userId);
      }

      // Analyze different cognitive dimensions
      const cognitiveProfile = await this.buildCognitiveProfile(userId, recentMessages);
      
      // Update behavior profile with cognitive insights
      await this.updateCognitiveBehaviorProfile(userId, cognitiveProfile);

      return {
        userId,
        cognitiveArchitecture: cognitiveProfile,
        confidence: this.calculateOverallConfidence(cognitiveProfile),
        timestamp: new Date().toISOString(),
        messagesSampled: recentMessages.length
      };

    } catch (error) {
      logger.error('Cognitive Architecture analysis unsuccessful, please try again:', error);
      return this.generateErrorProfile(userId);
    }
  }

  /**
   * Build comprehensive cognitive profile
   */
  async buildCognitiveProfile(userId, messages) {
    const userMessages = messages.filter(m => m.role === 'user');
    const conversationText = userMessages.map(m => m.content).join(' ');

    return {
      decisionMaking: await this.analyzeDecisionMaking(userMessages),
      communicationStyle: await this.analyzeCommunicationStyle(userMessages),
      informationProcessing: await this.analyzeInformationProcessing(userMessages),
      stressResponse: await this.analyzeStressResponse(userMessages),
      cognitiveFlexibility: await this.analyzeCognitiveFlexibility(userMessages),
      personalityMarkers: await this.extractPersonalityMarkers(conversationText),
      conversationDynamics: await this.analyzeConversationDynamics(messages)
    };
  }

  /**
   * Analyze decision-making patterns from conversation
   */
  async analyzeDecisionMaking(userMessages) {
    const patterns = {
      systematic: 0,
      intuitive: 0,
      security_focused: 0,
      opportunity_driven: 0,
      creative: 0
    };

    for (const message of userMessages) {
      const text = message.content.toLowerCase();
      
      // Check for systematic thinking markers
      if (this.containsMarkers(text, this.linguisticMarkers.systematic)) {
        patterns.systematic += 1;
      }
      
      // Check for intuitive decision markers
      if (this.containsMarkers(text, this.linguisticMarkers.intuitive)) {
        patterns.intuitive += 1;
      }
      
      // Check for security consciousness
      if (this.containsMarkers(text, this.linguisticMarkers.security_focused)) {
        patterns.security_focused += 1;
      }
      
      // Check for creative thinking
      if (this.containsMarkers(text, this.linguisticMarkers.creative)) {
        patterns.creative += 1;
      }

      // Opportunity-driven indicators (opposite of security-focused language)
      if (text.includes('exciting') || text.includes('opportunity') || 
          text.includes('growth') || text.includes('challenge')) {
        patterns.opportunity_driven += 1;
      }
    }

    // Normalize scores
    const total = Object.values(patterns).reduce((a, b) => a + b, 0);
    if (total === 0) return { primary: 'undetermined', confidence: 0 };

    const normalized = {};
    for (const [key, value] of Object.entries(patterns)) {
      normalized[key] = value / total;
    }

    // Find dominant pattern
    const primary = Object.entries(normalized)
      .reduce((a, b) => normalized[a[0]] > b[1] ? a : b)[0];

    return {
      primary,
      scores: normalized,
      confidence: Math.max(...Object.values(normalized)),
      indicators: this.getDecisionMakingIndicators(primary)
    };
  }

  /**
   * Analyze communication style patterns
   */
  async analyzeCommunicationStyle(userMessages) {
    const styles = {
      analytical: 0,
      emotional: 0,
      directive: 0,
      collaborative: 0,
      narrative: 0
    };

    for (const message of userMessages) {
      const text = message.content.toLowerCase();
      
      // Analytical communication
      if (this.containsMarkers(text, this.linguisticMarkers.analytical)) {
        styles.analytical += 1;
      }
      
      // Emotional communication
      if (this.containsMarkers(text, this.linguisticMarkers.emotional)) {
        styles.emotional += 1;
      }
      
      // Directive communication (imperatives, action words)
      if (text.match(/\b(should|must|need to|have to|tell me|give me)\b/g)) {
        styles.directive += 1;
      }
      
      // Collaborative communication
      if (text.match(/\b(what do you think|help me|together|we should|our)\b/g)) {
        styles.collaborative += 1;
      }
      
      // Narrative communication (storytelling patterns)
      if (text.match(/\b(so|then|but|however|meanwhile|actually)\b/g)) {
        styles.narrative += 1;
      }
    }

    return this.normalizeAndRank('communication', styles);
  }

  /**
   * Analyze information processing preferences
   */
  async analyzeInformationProcessing(userMessages) {
    const preferences = {
      detail_oriented: 0,
      big_picture: 0,
      sequential: 0,
      parallel: 0,
      visual: 0
    };

    for (const message of userMessages) {
      const text = message.content.toLowerCase();
      
      // Detail-oriented processing
      if (text.match(/\b(specific|detail|exactly|precisely|step|particular)\b/g)) {
        preferences.detail_oriented += 1;
      }
      
      // Big picture thinking
      if (text.match(/\b(overall|general|broad|pattern|connection|holistic)\b/g)) {
        preferences.big_picture += 1;
      }
      
      // Sequential processing (linear, ordered thinking)
      if (text.match(/\b(first|then|next|finally|step|order|sequence)\b/g)) {
        preferences.sequential += 1;
      }
      
      // Parallel processing (multiple considerations)
      if (text.match(/\b(also|both|either|while|meanwhile|simultaneously)\b/g)) {
        preferences.parallel += 1;
      }
      
      // Visual processing (examples, analogies, imagery)
      if (text.match(/\b(like|example|imagine|picture|see|show|visual)\b/g)) {
        preferences.visual += 1;
      }
    }

    return this.normalizeAndRank('information_processing', preferences);
  }

  /**
   * Analyze stress response patterns
   */
  async analyzeStressResponse(userMessages) {
    const responses = {
      planning: 0,
      action: 0,
      seeking_support: 0,
      withdrawal: 0,
      analysis: 0
    };

    // Look for stress indicators and how they respond
    for (const message of userMessages) {
      const text = message.content.toLowerCase();
      
      if (text.match(/\b(worried|stressed|anxious|concerned|problem)\b/g)) {
        // How do they respond to stress?
        if (text.match(/\b(plan|prepare|strategy|think through)\b/g)) {
          responses.planning += 1;
        }
        if (text.match(/\b(do|act|take action|decide|move forward)\b/g)) {
          responses.action += 1;
        }
        if (text.match(/\b(help|advice|support|what do you think)\b/g)) {
          responses.seeking_support += 1;
        }
        if (text.match(/\b(need time|think about|consider|analyze)\b/g)) {
          responses.analysis += 1;
        }
      }
    }

    return this.normalizeAndRank('stress_response', responses);
  }

  /**
   * Analyze cognitive flexibility and adaptability
   */
  async analyzeCognitiveFlexibility(userMessages) {
    let flexibilityScore = 0;
    let adaptabilityIndicators = [];

    for (let i = 1; i < userMessages.length; i++) {
      const current = userMessages[i].content.toLowerCase();
      const previous = userMessages[i-1].content.toLowerCase();

      // Look for perspective changes
      if (current.match(/\b(actually|wait|hmm|but|however)\b/g)) {
        flexibilityScore += 1;
        adaptabilityIndicators.push('perspective_shift');
      }

      // Look for incorporating new information
      if (current.match(/\b(thanks|that helps|i see|good point)\b/g)) {
        flexibilityScore += 1;
        adaptabilityIndicators.push('information_integration');
      }

      // Look for exploring alternatives
      if (current.match(/\b(alternative|different|another way|what if)\b/g)) {
        flexibilityScore += 1;
        adaptabilityIndicators.push('alternative_exploration');
      }
    }

    return {
      score: Math.min(flexibilityScore / userMessages.length, 1),
      indicators: adaptabilityIndicators,
      confidence: adaptabilityIndicators.length > 2 ? 0.8 : 0.4
    };
  }

  /**
   * Extract personality markers from conversation
   */
  async extractPersonalityMarkers(conversationText) {
    const text = conversationText.toLowerCase();
    const markers = {};

    // Openness markers
    markers.openness = text.match(/\b(creative|new|different|explore|curious|imagine)\b/g)?.length || 0;
    
    // Conscientiousness markers
    markers.conscientiousness = text.match(/\b(plan|organize|careful|systematic|responsible)\b/g)?.length || 0;
    
    // Extraversion markers (harder to detect in chat, but try)
    markers.extraversion = text.match(/\b(people|social|together|share|connect)\b/g)?.length || 0;
    
    // Agreeableness markers
    markers.agreeableness = text.match(/\b(help|support|understand|care|kind)\b/g)?.length || 0;
    
    // Neuroticism markers
    markers.neuroticism = text.match(/\b(worry|stress|anxious|nervous|fear)\b/g)?.length || 0;

    // Normalize by text length
    const wordCount = conversationText.split(' ').length;
    for (const [trait, count] of Object.entries(markers)) {
      markers[trait] = Math.min(count / (wordCount / 100), 1); // Per 100 words
    }

    return markers;
  }

  /**
   * Analyze conversation dynamics and interaction patterns
   */
  async analyzeConversationDynamics(messages) {
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');

    return {
      averageMessageLength: this.calculateAverageMessageLength(userMessages),
      questionToStatementRatio: this.calculateQuestionRatio(userMessages),
      responseLatency: this.calculateResponsePatterns(messages),
      topicCoherence: this.analyzeTopicCoherence(userMessages),
      interactionStyle: this.determineInteractionStyle(userMessages)
    };
  }

  // Helper methods
  containsMarkers(text, markers) {
    return markers.some(marker => text.includes(marker));
  }

  normalizeAndRank(category, scores) {
    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    if (total === 0) return { primary: 'undetermined', confidence: 0 };

    const normalized = {};
    for (const [key, value] of Object.entries(scores)) {
      normalized[key] = value / total;
    }

    const primary = Object.entries(normalized)
      .reduce((a, b) => normalized[a[0]] > b[1] ? a : b)[0];

    return {
      primary,
      scores: normalized,
      confidence: Math.max(...Object.values(normalized))
    };
  }

  calculateAverageMessageLength(messages) {
    if (messages.length === 0) return 0;
    const totalLength = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return totalLength / messages.length;
  }

  calculateQuestionRatio(messages) {
    if (messages.length === 0) return 0;
    const questionCount = messages.filter(msg => msg.content.includes('?')).length;
    return questionCount / messages.length;
  }

  calculateResponsePatterns(messages) {
    // Would need timestamps to calculate actual latency
    // For now, return a placeholder
    return { average: 0, pattern: 'immediate' };
  }

  analyzeTopicCoherence(messages) {
    // Simple topic coherence analysis
    // In a real implementation, you'd use more sophisticated NLP
    const topics = new Set();
    for (const message of messages) {
      const words = message.content.toLowerCase().split(' ');
      words.forEach(word => {
        if (word.length > 5) topics.add(word);
      });
    }
    return {
      coherenceScore: Math.min(topics.size / messages.length, 1),
      topicCount: topics.size
    };
  }

  determineInteractionStyle(messages) {
    // Analyze how user interacts with AI
    const styles = [];
    const text = messages.map(m => m.content).join(' ').toLowerCase();
    
    if (text.includes('help')) styles.push('help_seeking');
    if (text.includes('?')) styles.push('questioning');
    if (text.includes('tell me') || text.includes('explain')) styles.push('information_seeking');
    if (text.includes('what do you think')) styles.push('consultation_seeking');
    
    return styles;
  }

  getDecisionMakingIndicators(type) {
    const indicators = {
      systematic: ['Prefers structured analysis', 'Wants step-by-step breakdowns', 'Values comprehensive evaluation'],
      intuitive: ['Trusts gut feelings', 'Makes quick decisions', 'Values emotional resonance'],
      security_focused: ['Prioritizes safety and stability', 'Risk-averse', 'Values predictability'],
      opportunity_driven: ['Embraces risk for growth', 'Seeks new experiences', 'Values potential over security'],
      creative: ['Explores novel solutions', 'Thinks outside conventional frameworks', 'Values innovation']
    };
    return indicators[type] || [];
  }

  calculateOverallConfidence(profile) {
    const confidenceScores = [
      profile.decisionMaking.confidence,
      profile.communicationStyle.confidence,
      profile.informationProcessing.confidence,
      profile.cognitiveFlexibility.confidence
    ];
    return confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;
  }

  generateMinimalProfile(userId) {
    return {
      userId,
      cognitiveArchitecture: {
        decisionMaking: { primary: 'insufficient_data', confidence: 0 },
        communicationStyle: { primary: 'insufficient_data', confidence: 0 },
        informationProcessing: { primary: 'insufficient_data', confidence: 0 }
      },
      confidence: 0,
      messagesSampled: 0,
      note: 'Requires more interaction data for analysis'
    };
  }

  generateErrorProfile(userId) {
    return {
      userId,
      error: 'Analysis failed',
      confidence: 0,
      timestamp: new Date().toISOString()
    };
  }

  async updateCognitiveBehaviorProfile(userId, cognitiveProfile) {
    try {
      await UserBehaviorProfile.findOneAndUpdate(
        { userId },
        {
          $set: {
            cognitiveArchitecture: cognitiveProfile,
            lastCognitiveAnalysis: new Date()
          }
        },
        { upsert: true }
      );
    } catch (error) {
      logger.error('Failed to update cognitive behavior profile:', error);
    }
  }
}

export default new CognitiveArchitectureEngine();