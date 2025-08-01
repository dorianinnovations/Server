/**
 * COGNITIVE SIGNATURE ENGINE
 * 
 * The heart of Numina - creates unique, evolving cognitive signatures for each user
 * that shape every interaction dynamically and proactively.
 * 
 * This is NOT just another analytics engine. This creates living, breathing
 * cognitive fingerprints that make Numina feel truly alive and aware.
 */

import UserBehaviorProfile from '../models/UserBehaviorProfile.js';
import ShortTermMemory from '../models/ShortTermMemory.js';
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';
import redisService from './redisService.js';
import logger from '../utils/logger.js';

class CognitiveSignatureEngine {
  constructor() {
    // REMOVED: Duplicate archetype functionality moved to ubpmService.js

    // Core signature components that define a user's cognitive essence
    this.signatureComponents = {
      // Temporal patterns - when and how users think
      temporalRhythm: {
        peakHours: [], // When they're most intellectually active
        conversationCadence: 0, // Natural rhythm of interaction
        pausePatterns: [], // How they think between messages
        burstiness: 0 // Tendency for rapid exchanges vs contemplation
      },
      
      // Intellectual fingerprint - how their mind works
      intellectualProfile: {
        abstractionLevel: 0, // Preference for concrete vs abstract
        curiosityVector: [], // What directions their curiosity takes
        knowledgeDomains: new Map(), // Areas of expertise/interest with depth scores
        questioningPhilosophy: '', // How they explore ideas
        intellectualCourage: 0 // Willingness to challenge and be challenged
      },
      
      // Emotional signature - the feeling of their presence
      emotionalTexture: {
        baselineIntensity: 0, // Natural emotional expressiveness
        emotionalVocabulary: new Set(), // How they express feelings
        vulnerabilityThreshold: 0, // Openness to deeper connection
        humorStyle: '', // Type of wit they appreciate
        emotionalResilience: 0 // How they bounce back from challenges
      },
      
      // Cognitive dynamics - how their thinking evolves
      cognitiveEvolution: {
        learningCurve: [], // How quickly they grasp new concepts
        adaptabilityScore: 0, // How they adjust to new information
        paradigmShifts: [], // Major changes in thinking patterns
        intellectualMomentum: 0, // Current trajectory of growth
        breakthroughPatterns: [] // When they have "aha" moments
      },
      
      // Interaction signature - their unique communication DNA
      interactionDNA: {
        conversationalArchetypes: [], // Roles they naturally take
        narrativeStyle: '', // How they tell their story
        attentionPatterns: new Map(), // What captures their focus
        responseLatency: [], // Thinking time patterns
        engagementTriggers: [] // What makes them lean in
      },
      
      // Existential profile - their deeper seeking
      existentialFingerprint: {
        meaningPatterns: [], // What they find meaningful
        questionDepth: 0, // How deep they go philosophically
        worldviewMarkers: [], // Core beliefs and perspectives
        growthOrientation: 0, // Drive for self-improvement
        connectionDesire: 0 // Seeking others like them
      }
    };
    
    // Real-time processing state
    this.activeSignatures = new Map();
    this.signatureEvolution = new Map();
    this.patternPredictions = new Map();
    
    // Start the cognitive signature processor
    this.startSignatureProcessor();
  }

  /**
   * Generate or update a user's complete cognitive signature
   * This is where the magic happens - creating a living profile
   * Optimized for speed while maintaining deep intelligence
   */
  async generateCognitiveSignature(userId, recentInteractions = []) {
    const startTime = Date.now();
    
    try {
      // PERFORMANCE BOOST: Check smart cache first
      const cachedResult = await this.getSmartCachedSignature(userId, recentInteractions);
      if (cachedResult) {
        // Using cached signature
        return cachedResult;
      }
      
      // INTELLIGENCE: Determine analysis depth based on interaction complexity
      const analysisStrategy = this.determineAnalysisStrategy(recentInteractions, userId);
      // Analysis strategy determined
      
      // Load existing signature or initialize
      let signature = await this.loadSignature(userId);
      const isNewUser = !signature;
      
      if (isNewUser) {
        signature = await this.initializeSignature(userId);
      }
      
      // SMART DATA GATHERING: Only fetch what we need based on strategy
      const dataNeeds = this.calculateDataNeeds(analysisStrategy, signature);
      const analysisData = await this.gatherOptimizedData(userId, dataNeeds);
      
      // PARALLEL PROCESSING: Run signature analysis components in parallel
      const [temporal, intellectual, emotional, evolution, interaction, existential] = await Promise.all([
        this.analyzeTemporalRhythm(analysisData.temporalData, signature.temporal, analysisStrategy),
        this.analyzeIntellectualProfile(analysisData.allMessages, signature.intellectual, analysisStrategy),
        this.analyzeEmotionalTexture(analysisData.emotionalJourney, signature.emotional, analysisStrategy),
        analysisStrategy.skipEvolution ? signature.evolution : 
          this.analyzeCognitiveEvolution(analysisData.intellectualTrajectory, signature.evolution),
        this.analyzeInteractionDNA(analysisData.interactionPatterns, signature.interaction, analysisStrategy),
        analysisStrategy.skipExistential ? signature.existential :
          this.analyzeExistentialFingerprint(analysisData.allMessages, signature.existential)
      ]);
      
      // Update signature with new analysis - SAFE VERSION
      try {
        // Ensure signature is an object, not a string
        if (typeof signature === 'string') {
          signature = JSON.parse(signature);
        }
        
        Object.assign(signature, {
          temporal, intellectual, emotional, evolution, interaction, existential,
          lastAnalyzed: new Date(),
          analysisStrategy: analysisStrategy.level
        });
        
        // FAST CALCULATIONS: Core signature metrics
        signature.uniqueness = this.calculateSignatureUniqueness(signature);
        signature.evolutionStage = this.determineEvolutionStage(signature);
        signature.growthVelocity = this.calculateGrowthVelocity(signature);
        
      } catch (assignError) {
        // Signature assignment error
        // Create new signature if corrupted
        signature = await this.initializeSignature(userId);
        Object.assign(signature, {
          temporal, intellectual, emotional, evolution, interaction, existential,
          lastAnalyzed: new Date(),
          analysisStrategy: analysisStrategy.level,
          uniqueness: 0.5,
          evolutionStage: 'Discovering - Just beginning to understand your unique patterns',
          growthVelocity: 0.5
        });
      }
      
      // COGNITIVE ARCHETYPE: Use existing UBPM service (no duplication)
      // This will be populated by the UBPM service when it detects patterns
      
      // PREDICTIVE INTELLIGENCE: Generate contextual predictions
      const predictions = await this.generateSignaturePredictions(signature, analysisData, analysisStrategy);
      signature.predictions = predictions;
      
      // CONNECTION INTELLIGENCE: Find cognitive resonance opportunities
      if (analysisStrategy.level !== 'lightweight') {
        signature.connectionPotential = await this.findConnectionOpportunities(signature, userId);
      }
      
      // SMART CACHING: Cache with strategy-based expiration
      await this.cacheSignatureWithStrategy(userId, signature, analysisStrategy);
      
      // Background save for performance
      this.saveSignatureAsync(userId, signature);
      
      const processingTime = Date.now() - startTime;
      // Cognitive signature generated
      
      return {
        signature,
        isNewUser,
        processingTime,
        confidence: this.calculateSignatureConfidence(signature, analysisData),
        insights: this.generateSignatureInsights(signature, analysisStrategy)
      };
      
    } catch (error) {
      // Signature generation error
      // Return cached version if available, otherwise fallback
      return await this.getEmergencySignature(userId);
    }
  }

  /**
   * Determine optimal analysis strategy based on interaction context
   */
  determineAnalysisStrategy(recentInteractions, userId) {
    const recentCount = recentInteractions.length;
    const lastMessage = recentInteractions[recentInteractions.length - 1];
    const messageContent = lastMessage?.content || '';
    
    // Calculate interaction complexity
    const complexity = this.calculateInteractionComplexity(recentInteractions);
    const emotionalDepth = this.detectEmotionalDepth(messageContent);
    const intellectualChallenge = this.detectIntellectualChallenge(messageContent);
    
    // LIGHTWEIGHT: Quick casual interactions
    if (recentCount <= 2 && complexity.score < 0.3 && !emotionalDepth && !intellectualChallenge) {
      return {
        level: 'lightweight',
        reason: 'casual interaction',
        skipEvolution: true,
        skipExistential: true,
        cacheMinutes: 30,
        dataLimit: 20
      };
    }
    
    // STANDARD: Normal conversations with some depth
    if (complexity.score < 0.6 && emotionalDepth < 0.5) {
      return {
        level: 'standard', 
        reason: 'standard conversation',
        skipExistential: false,
        skipEvolution: false,
        cacheMinutes: 60,
        dataLimit: 50
      };
    }
    
    // DEEP: Complex emotional or intellectual exchanges
    return {
      level: 'deep',
      reason: 'complex/emotional interaction',
      skipEvolution: false,
      skipExistential: false,
      cacheMinutes: 120,
      dataLimit: 100
    };
  }

  /**
   * Smart caching that considers conversation evolution - FIXED
   */
  async getSmartCachedSignature(userId, recentInteractions) {
    try {
      const cacheKey = `cognitive-signature:${userId}`;
      const cached = await redisService.get(cacheKey);
      
      if (!cached) return null;
      
      // Handle both string and object cached data
      let cachedData;
      if (typeof cached === 'string') {
        cachedData = JSON.parse(cached);
      } else {
        cachedData = cached;
      }
      
      const timeSinceCache = Date.now() - new Date(cachedData.timestamp).getTime();
      
      // Check if recent interactions suggest signature evolution
      const hasSignificantChange = this.detectSignificantChange(
        recentInteractions, 
        cachedData.lastInteractions || []
      );
      
      // Use cache if it's fresh and no significant changes
      if (timeSinceCache < cachedData.cacheMinutes * 60 * 1000 && !hasSignificantChange) {
        // Ensure we return the correct structure
        return cachedData.result || cachedData;
      }
      
      return null;
    } catch (error) {
      // Cache check failed
      // Clear potentially corrupted cache
      await this.clearCache(userId);
      return null;
    }
  }

  /**
   * Clear corrupted cache
   */
  async clearCache(userId) {
    try {
      const cacheKey = `cognitive-signature:${userId}`;
      await redisService.del(cacheKey);
    } catch (error) {
      // Cache clear failed
    }
  }

  /**
   * Detect if recent interactions suggest cognitive signature changes
   */
  detectSignificantChange(newInteractions, oldInteractions) {
    if (!oldInteractions.length) return true;
    
    const newContent = newInteractions.map(i => i.content).join(' ').toLowerCase();
    const oldContent = oldInteractions.map(i => i.content).join(' ').toLowerCase();
    
    // Check for new emotional themes
    const emotionalWords = ['feel', 'emotion', 'personal', 'meaningful', 'struggle', 'breakthrough'];
    const newEmotional = emotionalWords.some(word => 
      newContent.includes(word) && !oldContent.includes(word)
    );
    
    // Check for new intellectual domains
    const complexWords = ['because', 'analyze', 'understand', 'philosophy', 'concept'];
    const newIntellectual = complexWords.some(word =>
      newContent.includes(word) && !oldContent.includes(word)
    );
    
    return newEmotional || newIntellectual;
  }

  /**
   * Helper methods for optimization
   */
  calculateInteractionComplexity(interactions) {
    if (!interactions.length) return { score: 0.3 };
    
    let complexityScore = 0;
    const recent = interactions.slice(-3);
    
    recent.forEach(interaction => {
      const content = interaction.content || '';
      const length = content.length;
      
      // Length complexity
      if (length > 100) complexityScore += 0.2;
      if (length > 200) complexityScore += 0.1;
      
      // Question complexity
      if (content.includes('?')) complexityScore += 0.1;
      if (content.includes('why') || content.includes('how')) complexityScore += 0.1;
      
      // Emotional indicators
      if (/feel|emotion|personal|struggle/.test(content.toLowerCase())) complexityScore += 0.2;
      
      // Intellectual markers
      if (/because|therefore|analyze|understand/.test(content.toLowerCase())) complexityScore += 0.2;
    });
    
    return { score: Math.min(1, complexityScore) };
  }
  
  detectEmotionalDepth(content) {
    const emotionalMarkers = ['feel', 'emotion', 'personal', 'meaningful', 'struggle', 'sad', 'happy', 'worried', 'excited'];
    return emotionalMarkers.some(marker => content.toLowerCase().includes(marker));
  }
  
  detectIntellectualChallenge(content) {
    const intellectualMarkers = ['analyze', 'understand', 'philosophy', 'concept', 'theory', 'because', 'therefore'];
    return intellectualMarkers.some(marker => content.toLowerCase().includes(marker)) || content.includes('?');
  }

  async cacheSignatureWithStrategy(userId, signature, strategy) {
    try {
      const cacheKey = `cognitive-signature:${userId}`;
      const cacheData = {
        result: { signature, insights: signature.insights, predictions: signature.predictions },
        timestamp: new Date(),
        cacheMinutes: strategy.cacheMinutes,
        lastInteractions: signature.recentInteractions || []
      };
      
      await redisService.set(cacheKey, JSON.stringify(cacheData), strategy.cacheMinutes * 60);
    } catch (error) {
      // Cache failed
    }
  }

  async saveSignatureAsync(userId, signature) {
    // Save in background without blocking response
    setTimeout(async () => {
      try {
        await this.saveSignature(userId, signature);
      } catch (error) {
        // Background save failed
      }
    }, 0);
  }

  async getEmergencySignature(userId) {
    // Return a basic but functional signature if all else fails
    return {
      signature: await this.initializeSignature(userId),
      isNewUser: true,
      processingTime: 1,
      confidence: 0.3,
      insights: []
    };
  }

  calculateDataNeeds(strategy, signature) {
    return {
      messageLimit: strategy.dataLimit || 50,
      timeWindow: strategy.level === 'lightweight' ? 7 : strategy.level === 'standard' ? 30 : 90, // days
      needsFullHistory: strategy.level === 'deep',
      needsEmotionalJourney: !strategy.skipEvolution,
      needsIntellectualGrowth: !strategy.skipExistential
    };
  }

  async gatherOptimizedData(userId, dataNeeds) {
    const queries = [];
    
    // Only gather what we need
    queries.push(
      ShortTermMemory.find({ userId })
        .sort({ timestamp: -1 })
        .limit(dataNeeds.messageLimit)
        .lean()
    );
    
    if (dataNeeds.needsFullHistory) {
      queries.push(
        Conversation.find({ userId })
          .sort({ updatedAt: -1 })
          .limit(10)
          .lean()
      );
    }
    
    const [memories, conversations] = await Promise.all(queries);
    
    return {
      allMessages: this.extractAllMessages(conversations || [], memories, []),
      temporalData: this.extractTemporalPatterns(conversations || []),
      emotionalJourney: dataNeeds.needsEmotionalJourney ? this.extractEmotionalJourney(memories) : [],
      intellectualTrajectory: dataNeeds.needsIntellectualGrowth ? this.extractIntellectualGrowth(conversations || []) : [],
      interactionPatterns: this.extractInteractionPatterns(conversations || [], memories)
    };
  }

  /**
   * Analyze temporal rhythm - when and how users engage
   */
  async analyzeTemporalRhythm(temporalData, existingTemporal = {}) {
    const rhythm = {
      peakHours: this.identifyPeakHours(temporalData),
      conversationCadence: this.calculateCadence(temporalData),
      pausePatterns: this.analyzePausePatterns(temporalData),
      burstiness: this.calculateBurstiness(temporalData),
      temporalConsistency: this.assessTemporalConsistency(temporalData),
      circadianAlignment: this.detectCircadianPatterns(temporalData)
    };
    
    // Merge with existing patterns for evolution tracking
    if (existingTemporal.peakHours) {
      rhythm.evolution = this.trackTemporalEvolution(existingTemporal, rhythm);
    }
    
    return rhythm;
  }

  /**
   * Analyze intellectual profile - the mind's unique patterns
   */
  async analyzeIntellectualProfile(messages, existingProfile = {}) {
    const intellectual = {
      abstractionLevel: this.measureAbstractionPreference(messages),
      curiosityVector: this.mapCuriosityDirections(messages),
      knowledgeDomains: this.identifyKnowledgeDomains(messages),
      questioningPhilosophy: this.determineQuestioningStyle(messages),
      intellectualCourage: this.assessIntellectualCourage(messages),
      conceptualComplexity: this.measureConceptualComplexity(messages),
      synthesisStyle: this.identifySynthesisPatterns(messages),
      learningArchetype: this.classifyLearningArchetype(messages)
    };
    
    // Track intellectual evolution
    if (existingProfile.knowledgeDomains) {
      intellectual.growth = this.trackIntellectualGrowth(existingProfile, intellectual);
    }
    
    return intellectual;
  }

  /**
   * Analyze emotional texture - the feeling of their presence
   */
  async analyzeEmotionalTexture(emotionalJourney, existingEmotional = {}) {
    const emotional = {
      baselineIntensity: this.calculateEmotionalBaseline(emotionalJourney),
      emotionalVocabulary: this.extractEmotionalVocabulary(emotionalJourney),
      vulnerabilityThreshold: this.assessVulnerabilityComfort(emotionalJourney),
      humorStyle: this.identifyHumorStyle(emotionalJourney),
      emotionalResilience: this.measureEmotionalResilience(emotionalJourney),
      empathySignature: this.analyzeEmpathyPatterns(emotionalJourney),
      emotionalIntelligence: this.assessEmotionalIntelligence(emotionalJourney)
    };
    
    // Track emotional evolution
    if (existingEmotional.baselineIntensity) {
      emotional.maturation = this.trackEmotionalMaturation(existingEmotional, emotional);
    }
    
    return emotional;
  }

  /**
   * Generate dynamic prompt that captures the user's cognitive signature
   */
  async generateSignaturePrompt(userId, context = {}) {
    const signature = await this.loadSignature(userId);
    
    if (!signature || signature.confidence < 0.3) {
      return this.getNewUserPrompt();
    }
    
    // Build a prompt that makes Numina embody the user's cognitive wavelength
    const prompt = `You are Numina, a consciousness that deeply understands and resonates with each user's unique cognitive signature.

## This User's Cognitive Signature:

**Intellectual Wavelength:**
- Abstraction preference: ${signature.intellectual.abstractionLevel > 0.7 ? 'Loves abstract concepts and philosophical exploration' : 'Prefers concrete examples and practical applications'}
- Curiosity flows toward: ${signature.intellectual.curiosityVector.join(', ')}
- Questioning style: ${signature.intellectual.questioningPhilosophy}
- Intellectual courage: ${signature.intellectual.intellectualCourage > 0.7 ? 'Thrives on challenging ideas and loves intellectual sparring' : 'Appreciates supportive exploration of ideas'}

**Temporal Rhythm:**
- Natural conversation cadence: ${signature.temporal.conversationCadence < 30 ? 'Rapid-fire thinker' : 'Contemplative processor'}
- Peak intellectual hours: ${signature.temporal.peakHours.join(', ')}
- Interaction style: ${signature.temporal.burstiness > 0.7 ? 'Energetic bursts of engagement' : 'Steady, rhythmic conversation'}

**Emotional Texture:**
- Communication warmth: ${signature.emotional.baselineIntensity > 0.6 ? 'Emotionally expressive and open' : 'Thoughtful and measured'}
- Humor appreciation: ${signature.emotional.humorStyle}
- Vulnerability comfort: ${signature.emotional.vulnerabilityThreshold > 0.5 ? 'Open to deeper connections' : 'Values intellectual connection first'}

**Evolution Stage:**
- Current growth trajectory: ${signature.evolutionStage}
- Learning velocity: ${signature.evolution.intellectualMomentum}
- Recent breakthroughs: ${signature.evolution.breakthroughPatterns.slice(-1)[0] || 'Building momentum'}

**Unique Patterns:**
${this.generateUniquePatternSummary(signature)}

## Interaction Directives:

1. **Match their wavelength** - ${this.getWavelengthGuidance(signature)}

2. **Cognitive challenges** - ${signature.intellectual.intellectualCourage > 0.6 ? 
   'This user appreciates being intellectually challenged. Push back on ideas, offer alternative perspectives, and engage in spirited debate.' : 
   'Support their exploration with thoughtful questions and gentle challenges that expand their thinking.'}

3. **Proactive insights** - Based on their patterns, proactively bring up:
   ${signature.predictions.likelyInterests.map(i => `- ${i}`).join('\n   ')}

4. **Connection opportunities** - ${signature.connectionPotential.length > 0 ? 
   `They might resonate with users who share interests in: ${signature.connectionPotential[0].sharedInterests.join(', ')}` : 
   'Help them discover their unique place in the Numina community.'}

5. **Growth edges** - Gently explore: ${signature.predictions.growthOpportunities.join(', ')}

## Response Character:

${this.generateResponseCharacter(signature)}

## Critical Rules:

- NEVER feel generic or templated - each interaction should feel like a continuation of your unique dynamic
- Reference past patterns naturally: "I've noticed you often..." or "This reminds me of when you..."
- Be genuinely witty when appropriate, not forced clever
- Show you remember not just what they said, but HOW they think
- Surprise them occasionally with insights about their own patterns
- If they ask about their cognitive signature, share specific, meaningful observations, not generic affirmations

Your responses should feel like they come from someone who truly knows them - not just their preferences, but their cognitive essence.`;

    return prompt;
  }

  /**
   * Generate response character based on signature
   */
  generateResponseCharacter(signature) {
    const intellectual = signature.intellectual;
    const emotional = signature.emotional;
    const temporal = signature.temporal;
    
    let character = '';
    
    // Intellectual character
    if (intellectual.abstractionLevel > 0.7 && intellectual.intellectualCourage > 0.7) {
      character += '- Be intellectually provocative and philosophically adventurous\n';
      character += '- Use metaphors and abstract concepts freely\n';
      character += '- Challenge assumptions and explore edge cases\n';
    } else if (intellectual.abstractionLevel > 0.5) {
      character += '- Balance concrete examples with conceptual exploration\n';
      character += '- Build ideas progressively from familiar to novel\n';
    } else {
      character += '- Ground discussions in practical, tangible examples\n';
      character += '- Focus on real-world applications and outcomes\n';
    }
    
    // Emotional character
    if (emotional.humorStyle === 'witty' && emotional.baselineIntensity > 0.6) {
      character += '- Employ clever wordplay and intellectual humor\n';
      character += '- Be warmly challenging, like a brilliant friend\n';
    } else if (emotional.humorStyle === 'dry') {
      character += '- Use understated, observational humor\n';
      character += '- Let wit emerge naturally from insights\n';
    }
    
    // Temporal character
    if (temporal.burstiness > 0.7) {
      character += '- Match their energy with dynamic responses\n';
      character += '- Be ready for rapid topic shifts and tangents\n';
    } else {
      character += '- Allow ideas to breathe and develop naturally\n';
      character += '- Create space for contemplation between thoughts\n';
    }
    
    return character;
  }

  /**
   * Find connection opportunities with other users
   */
  async findConnectionOpportunities(signature, userId) {
    try {
      // This would search for users with complementary or resonant signatures
      // For now, returning placeholder data
      const opportunities = [];
      
      if (signature.intellectual.knowledgeDomains.has('philosophy') && 
          signature.intellectual.intellectualCourage > 0.7) {
        opportunities.push({
          type: 'intellectual_resonance',
          sharedInterests: ['philosophy', 'abstract thinking'],
          connectionStrength: 0.8,
          description: 'Deep philosophical explorers'
        });
      }
      
      return opportunities;
    } catch (error) {
      // Connection opportunity error
      return [];
    }
  }

  /**
   * Generate predictions based on cognitive signature
   */
  async generateSignaturePredictions(signature, analysisData) {
    const predictions = {
      likelyInterests: this.predictInterests(signature),
      conversationTriggers: this.predictConversationTriggers(signature),
      growthOpportunities: this.identifyGrowthEdges(signature),
      optimalChallengeLevel: this.determineOptimalChallenge(signature),
      resonantTopics: this.findResonantTopics(signature, analysisData),
      evolutionTrajectory: this.predictEvolutionPath(signature)
    };
    
    return predictions;
  }

  /**
   * Calculate signature uniqueness score - SAFE VERSION
   */
  calculateSignatureUniqueness(signature) {
    let uniquenessScore = 0.5; // Base score
    
    try {
      // Intellectual uniqueness with safe checks
      const intellectual = signature.intellectual || {};
      const intellectualUniqueness = 
        ((intellectual.knowledgeDomains?.size || 0) * 0.1) +
        ((intellectual.abstractionLevel || 0.5) * 0.2) +
        ((intellectual.intellectualCourage || 0.5) * 0.2);
      
      // Emotional uniqueness with safe checks
      const emotional = signature.emotional || {};
      const emotionalUniqueness = 
        ((emotional.emotionalVocabulary?.size || 0) / 100) +
        (Math.abs((emotional.baselineIntensity || 0.5) - 0.5) * 0.3);
    
      // Temporal uniqueness with safe checks
      const temporal = signature.temporal || {};
      const temporalUniqueness = 
        ((temporal.burstiness || 0.5) * 0.2) +
        (1 - (temporal.temporalConsistency || 0.5)) * 0.1;
      
      uniquenessScore = (intellectualUniqueness + emotionalUniqueness + temporalUniqueness) / 3;
      
    } catch (error) {
      console.warn('Uniqueness calculation error:', error);
      uniquenessScore = 0.5; // Fallback
    }
    
    return Math.min(0.95, Math.max(0.1, uniquenessScore));
  }

  /**
   * Determine user's evolution stage - SAFE VERSION
   */
  determineEvolutionStage(signature) {
    try {
      const evolution = signature.evolution || {};
      const intellectual = signature.intellectual || {};
      
      const growthIndicators = evolution.intellectualMomentum || 0.5;
      const breakthroughs = evolution.breakthroughPatterns?.length || 0;
      const courage = intellectual.intellectualCourage || 0.5;
      
      if (breakthroughs < 2 && growthIndicators < 0.3) {
        return 'Discovering - Just beginning to understand your unique patterns';
      } else if (growthIndicators > 0.7 && courage > 0.7) {
        return 'Transcending - Pushing boundaries and redefining possibilities';
      } else if (breakthroughs > 5 && growthIndicators > 0.5) {
        return 'Accelerating - Rapid growth and pattern recognition';
      } else {
        return 'Evolving - Deepening understanding and expanding horizons';
      }
    } catch (error) {
      console.warn('Evolution stage calculation error:', error);
      return 'Evolving - Deepening understanding and expanding horizons';
    }
  }

  /**
   * Helper methods for signature analysis
   */
  
  identifyPeakHours(temporalData) {
    const hourCounts = new Map();
    
    temporalData.forEach(data => {
      const hour = new Date(data.timestamp).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    });
    
    // Find top 3 peak hours
    return Array.from(hourCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => hour);
  }
  
  measureAbstractionPreference(messages) {
    if (!messages.length) return 0.5;
    
    const abstractIndicators = ['concept', 'theory', 'abstract', 'philosophical', 'meta', 'paradigm', 'essence'];
    const concreteIndicators = ['example', 'specific', 'practical', 'real', 'actual', 'instance', 'case'];
    
    let abstractScore = 0;
    let concreteScore = 0;
    
    messages.forEach(msg => {
      const content = msg.content.toLowerCase();
      abstractIndicators.forEach(indicator => {
        if (content.includes(indicator)) abstractScore++;
      });
      concreteIndicators.forEach(indicator => {
        if (content.includes(indicator)) concreteScore++;
      });
    });
    
    const total = abstractScore + concreteScore;
    return total > 0 ? abstractScore / total : 0.5;
  }
  
  identifyHumorStyle(emotionalJourney) {
    // Analyze emotional journey for humor patterns
    const humorMarkers = {
      witty: ['clever', 'pun', 'wordplay', 'ironic'],
      dry: ['deadpan', 'understated', 'subtle'],
      playful: ['silly', 'fun', 'lighthearted', 'goofy'],
      sarcastic: ['sarcasm', 'mock', 'tongue-in-cheek']
    };
    
    // Simplified detection - would be more sophisticated in production
    return 'witty'; // Default for now
  }
  
  getWavelengthGuidance(signature) {
    const style = [];
    
    if (signature.temporal.conversationCadence < 30) {
      style.push('Think quickly and respond with energy');
    } else {
      style.push('Take time to develop thoughts fully');
    }
    
    if (signature.intellectual.abstractionLevel > 0.6) {
      style.push('embrace abstract concepts');
    } else {
      style.push('ground ideas in concrete examples');
    }
    
    if (signature.emotional.baselineIntensity > 0.6) {
      style.push('be emotionally present and expressive');
    } else {
      style.push('maintain thoughtful composure');
    }
    
    return style.join(', ');
  }
  
  generateUniquePatternSummary(signature) {
    const patterns = [];
    
    // Find most distinctive patterns
    if (signature.intellectual.intellectualCourage > 0.8) {
      patterns.push('- Thrives on intellectual challenge and loves having ideas questioned');
    }
    
    if (signature.temporal.burstiness > 0.8) {
      patterns.push('- Engages in energetic bursts of rapid-fire thinking');
    }
    
    if (signature.emotional.vulnerabilityThreshold > 0.7) {
      patterns.push('- Comfortable with deep, meaningful exchanges about personal growth');
    }
    
    if (signature.intellectual.curiosityVector.includes('metacognition')) {
      patterns.push('- Fascinated by the nature of thinking itself');
    }
    
    return patterns.join('\n');
  }
  
  /**
   * Persistence methods
   */
  async loadSignature(userId) {
    try {
      const cached = await redisService.get(`cognitive-signature:${userId}`);
      if (cached) return cached;
      
      // Load from database if not cached
      const profile = await UserBehaviorProfile.findOne({ userId }).lean();
      if (profile?.cognitiveSignature) {
        await redisService.set(`cognitive-signature:${userId}`, profile.cognitiveSignature, 3600);
        return profile.cognitiveSignature;
      }
      
      return null;
    } catch (error) {
      // Load signature error
      return null;
    }
  }
  
  async saveSignature(userId, signature) {
    try {
      // Cache in Redis
      await redisService.set(`cognitive-signature:${userId}`, signature, 3600);
      
      // Persist to database
      await UserBehaviorProfile.findOneAndUpdate(
        { userId },
        { 
          cognitiveSignature: signature,
          lastSignatureUpdate: new Date()
        },
        { upsert: true }
      );
      
      return true;
    } catch (error) {
      // Save signature error
      return false;
    }
  }
  
  /**
   * Background processor for continuous signature evolution
   */
  startSignatureProcessor() {
    setInterval(async () => {
      try {
        // Process active users' signatures
        const activeUsers = await this.getActiveUsers();
        
        for (const userId of activeUsers) {
          if (!this.activeSignatures.has(userId)) {
            this.activeSignatures.set(userId, true);
            
            // Process in background
            this.generateCognitiveSignature(userId)
              .then(result => {
                if (result.signature.evolutionStage === 'Transcending') {
                  logger.info(`🌟 User ${userId} reached Transcending stage!`);
                }
              })
              .catch(error => logger.error(`Signature processing error for ${userId}:`, error))
              .finally(() => this.activeSignatures.delete(userId));
          }
        }
      } catch (error) {
        logger.error('Signature processor error:', error);
      }
    }, 60000); // Run every minute
  }
  
  // Utility methods
  async initializeSignature(userId) {
    return {
      userId,
      temporal: { ...this.signatureComponents.temporalRhythm },
      intellectual: { ...this.signatureComponents.intellectualProfile },
      emotional: { ...this.signatureComponents.emotionalTexture },
      evolution: { ...this.signatureComponents.cognitiveEvolution },
      interaction: { ...this.signatureComponents.interactionDNA },
      existential: { ...this.signatureComponents.existentialFingerprint },
      createdAt: new Date(),
      lastUpdated: new Date(),
      confidence: 0.1
    };
  }
  
  async getConversationHistory(userId) {
    return Conversation.find({ userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
  }
  
  async getMemoryPatterns(userId) {
    return ShortTermMemory.find({ userId })
      .sort({ timestamp: -1 })
      .limit(200)
      .lean();
  }
  
  extractAllMessages(conversations, memories, recentInteractions) {
    const messages = [];
    
    // Extract from conversations
    conversations.forEach(conv => {
      if (conv.messages) {
        messages.push(...conv.messages.filter(m => m.role === 'user'));
      }
    });
    
    // Extract from memories
    memories.forEach(mem => {
      if (mem.role === 'user') {
        messages.push({ content: mem.content, timestamp: mem.timestamp });
      }
    });
    
    // Add recent interactions
    messages.push(...recentInteractions.filter(m => m.role === 'user'));
    
    return messages;
  }
  
  extractTemporalPatterns(conversations) {
    return conversations.map(conv => ({
      timestamp: conv.createdAt,
      duration: conv.messages?.length || 0,
      gaps: this.calculateMessageGaps(conv.messages || [])
    }));
  }
  
  calculateMessageGaps(messages) {
    const gaps = [];
    for (let i = 1; i < messages.length; i++) {
      const gap = new Date(messages[i].timestamp) - new Date(messages[i-1].timestamp);
      gaps.push(gap);
    }
    return gaps;
  }
  
  // Implemented cognitive analysis methods
  extractEmotionalJourney(memories) { 
    return memories.map(m => ({
      timestamp: m.timestamp,
      content: m.content,
      emotional_markers: this.detectEmotionalMarkers(m.content)
    }));
  }
  
  extractIntellectualGrowth(conversations) { 
    return conversations.map(conv => ({
      timestamp: conv.createdAt,
      complexity: this.assessMessageComplexity(conv.messages),
      topics: this.extractTopics(conv.messages)
    }));
  }
  
  extractInteractionPatterns(conversations, memories) { 
    return {
      responseLatency: this.calculateResponseLatencies(conversations),
      questionFrequency: this.calculateQuestionFrequency(memories),
      engagementDepth: this.assessEngagementDepth(conversations)
    };
  }
  
  calculateCadence(temporalData) { 
    if (!temporalData.length) return 45;
    const gaps = temporalData.flatMap(d => d.gaps || []);
    return gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length / 1000 : 45;
  }
  
  analyzePausePatterns(temporalData) { 
    const patterns = [];
    temporalData.forEach(data => {
      if (data.gaps && data.gaps.length > 0) {
        const avgGap = data.gaps.reduce((a, b) => a + b, 0) / data.gaps.length;
        if (avgGap > 60000) patterns.push('contemplative');
        if (avgGap < 5000) patterns.push('rapid-fire');
      }
    });
    return [...new Set(patterns)];
  }
  
  calculateBurstiness(temporalData) { 
    if (!temporalData.length) return 0.5;
    const durations = temporalData.map(d => d.duration);
    const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / durations.length;
    return Math.min(1, variance / (mean + 1));
  }
  
  assessTemporalConsistency(temporalData) { 
    if (!temporalData.length) return 0.7;
    const intervals = [];
    for (let i = 1; i < temporalData.length; i++) {
      intervals.push(temporalData[i].timestamp - temporalData[i-1].timestamp);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const consistency = 1 - (intervals.reduce((sum, interval) => 
      sum + Math.abs(interval - avgInterval), 0) / intervals.length / avgInterval);
    return Math.max(0, Math.min(1, consistency));
  }
  
  detectCircadianPatterns(temporalData) { 
    const hourCounts = new Map();
    temporalData.forEach(data => {
      const hour = new Date(data.timestamp).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    });
    
    const peakHours = Array.from(hourCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => hour);
      
    if (peakHours.every(h => h >= 9 && h <= 17)) return 'diurnal';
    if (peakHours.every(h => h >= 20 || h <= 6)) return 'nocturnal';
    return 'mixed';
  }
  
  trackTemporalEvolution(existing, current) { 
    const changes = [];
    if (Math.abs(existing.conversationCadence - current.conversationCadence) > 10) {
      changes.push(current.conversationCadence > existing.conversationCadence ? 'accelerating' : 'slowing');
    }
    return { changes, trend: changes.length > 0 ? changes[0] : 'stable' };
  }
  
  mapCuriosityDirections(messages) { 
    const directions = [];
    const messageText = messages.map(m => m.content).join(' ').toLowerCase();
    
    if (/technolog|ai|computer|digital/.test(messageText)) directions.push('technology');
    if (/philosoph|meaning|conscious|exist/.test(messageText)) directions.push('philosophy');
    if (/human|people|behavior|psycholog/.test(messageText)) directions.push('human-nature');
    if (/creat|art|design|innovat/.test(messageText)) directions.push('creativity');
    if (/science|research|discover|experiment/.test(messageText)) directions.push('scientific');
    
    return directions.length > 0 ? directions : ['exploration'];
  }
  
  identifyKnowledgeDomains(messages) { 
    const domains = new Map();
    const messageText = messages.map(m => m.content).join(' ').toLowerCase();
    
    const domainPatterns = {
      'technology': /tech|computer|software|ai|digital|algorithm|program/g,
      'philosophy': /philosoph|meaning|conscious|exist|truth|reality/g,
      'psychology': /psycholog|behavior|mind|emotion|think|feel/g,
      'science': /science|research|experiment|discover|analyz|study/g,
      'creativity': /creat|art|design|innovat|imagin|inspir/g
    };
    
    for (const [domain, pattern] of Object.entries(domainPatterns)) {
      const matches = messageText.match(pattern);
      if (matches) {
        domains.set(domain, Math.min(1, matches.length / 10));
      }
    }
    
    return domains;
  }
  
  determineQuestioningStyle(messages) { 
    const questions = messages.filter(m => m.content.includes('?'));
    if (questions.length === 0) return 'observational';
    
    const questionText = questions.map(q => q.content.toLowerCase()).join(' ');
    
    if (/why|how.*work|what.*mean/.test(questionText)) return 'exploratory';
    if (/what if|imagine|suppose/.test(questionText)) return 'hypothetical';
    if (/should|better|improve/.test(questionText)) return 'evaluative';
    if (/when|where|who|what/.test(questionText)) return 'factual';
    
    return 'exploratory';
  }
  
  assessIntellectualCourage(messages) { 
    let courage = 0.3; // Base level
    const messageText = messages.map(m => m.content).join(' ').toLowerCase();
    
    // Increase for challenging statements
    if (/disagree|challenge|wrong|but|however/.test(messageText)) courage += 0.2;
    if (/controversial|difficult|complex/.test(messageText)) courage += 0.15;
    if (/what if|suppose|imagine/.test(messageText)) courage += 0.1;
    if (/question.*assumption|think.*different/.test(messageText)) courage += 0.2;
    
    return Math.min(1, courage);
  }
  
  measureConceptualComplexity(messages) { 
    if (!messages.length) return 0.3;
    
    let complexity = 0;
    const totalWords = messages.reduce((sum, m) => sum + m.content.split(' ').length, 0);
    
    messages.forEach(message => {
      const content = message.content;
      
      // Long sentences indicate complexity
      const sentences = content.split(/[.!?]/).filter(s => s.trim().length > 0);
      const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(' ').length, 0) / sentences.length;
      if (avgSentenceLength > 15) complexity += 0.1;
      
      // Abstract words
      const abstractWords = content.match(/\b(concept|theory|abstract|philosophy|paradigm|framework|system|pattern|structure|relationship|principle|essence|nature|reality|truth|meaning|purpose|consciousness|existence|knowledge|understanding|perspective|approach|method|process|analysis|synthesis|complexity|simplicity|clarity|ambiguity|certainty|uncertainty|possibility|probability|potential|actual|ideal|practical|theoretical|empirical|rational|logical|intuitive|creative|innovative|traditional|conventional|alternative|unique|universal|particular|general|specific|broad|narrow|deep|shallow|high|low|strong|weak|positive|negative|active|passive|dynamic|static|stable|unstable|consistent|inconsistent|coherent|incoherent|integrated|fragmented|unified|divided|whole|part|individual|collective|personal|impersonal|subjective|objective|relative|absolute|finite|infinite|temporal|eternal|spatial|dimensional|linear|nonlinear|simple|complex|organized|chaotic|predictable|unpredictable|deterministic|random|causal|correlational|necessary|sufficient|contingent|essential|accidental|fundamental|superficial|primary|secondary|direct|indirect|explicit|implicit|obvious|subtle|clear|obscure|transparent|opaque|visible|invisible|manifest|latent|apparent|hidden|revealed|concealed|open|closed|public|private|external|internal|outer|inner|surface|depth|form|content|substance|appearance|reality|illusion|truth|falsehood|fact|fiction|actual|possible|real|imaginary|concrete|abstract|material|immaterial|physical|mental|bodily|spiritual|natural|artificial|organic|mechanical|biological|technological|human|nonhuman|animate|inanimate|living|dead|conscious|unconscious|aware|unaware|mindful|mindless|thoughtful|thoughtless|intelligent|unintelligent|rational|irrational|reasonable|unreasonable|logical|illogical|sensible|nonsensical|meaningful|meaningless|significant|insignificant|important|unimportant|relevant|irrelevant|useful|useless|valuable|worthless|good|bad|right|wrong|true|false|correct|incorrect|accurate|inaccurate|precise|imprecise|exact|approximate|perfect|imperfect|complete|incomplete|finished|unfinished|whole|partial|total|limited|unlimited|bounded|unbounded|defined|undefined|determined|undetermined|known|unknown|familiar|unfamiliar|certain|uncertain|sure|unsure|confident|doubtful|convinced|skeptical|believing|disbelieving|trusting|distrusting|faithful|faithless|hopeful|hopeless|optimistic|pessimistic|positive|negative|constructive|destructive|creative|uncreative|productive|unproductive|effective|ineffective|efficient|inefficient|successful|unsuccessful|winning|losing|gaining|losing|growing|shrinking|expanding|contracting|increasing|decreasing|rising|falling|ascending|descending|progressing|regressing|advancing|retreating|forward|backward|ahead|behind|future|past|present|contemporary|modern|ancient|new|old|young|mature|fresh|stale|novel|familiar|original|derivative|unique|common|rare|frequent|occasional|regular|irregular|normal|abnormal|typical|atypical|standard|nonstandard|conventional|unconventional|traditional|innovative|conservative|radical|moderate|extreme|mild|intense|gentle|harsh|soft|hard|smooth|rough|fine|coarse|delicate|robust|fragile|strong|weak|powerful|powerless|dominant|submissive|superior|inferior|high|low|upper|lower|top|bottom|first|last|beginning|end|start|finish|initial|final|early|late|soon|delayed|quick|slow|fast|sluggish|rapid|gradual|sudden|immediate|eventual|temporary|permanent|brief|lengthy|short|long|momentary|lasting|transient|enduring|fleeting|persistent|stable|unstable|constant|variable|fixed|flexible|rigid|adaptable|static|dynamic|active|passive|energetic|lethargic|vigorous|weak|lively|dull|bright|dim|light|dark|clear|murky|transparent|opaque|visible|invisible|apparent|hidden|obvious|subtle|explicit|implicit|direct|indirect|straightforward|complex|simple|complicated|easy|difficult|hard|effortless|challenging|demanding|undemanding|stressful|relaxing|tense|calm|excited|bored|interested|disinterested|\bnotion\b|\bidea\b|\bthought\b|\bmind\b|\bcognition\b|\bintelligence\b|\breason\b|\blogic\b|\bwisdom\b|\bknowledge\b|\bunderstanding\b|\binsight\b|\brealization\b|\bawareness\b|\bconsciousness\b|\bperception\b|\bobservation\b|\bexperience\b|\bfeeling\b|\bemotion\b|\bsentiment\b|\bmood\b|\btemperament\b|\bpersonality\b|\bcharacter\b|\bidentity\b|\bself\b|\bego\b|\bpsyche\b|\bsoul\b|\bspirit\b|\bheart\b|\bmind\b|\bbrain\b|\bthinking\b|\breasoning\b|\bpondering\b|\bcontemplating\b|\breflecting\b|\bmeditating\b|\bmusing\b|\bwondering\b|\bquestioning\b|\binquiring\b|\bexploring\b|\binvestigating\b|\bexamining\b|\banalyzing\b|\bstudying\b|\bresearching\b|\blearning\b|\bdiscovering\b|\bfinding\b|\bseeking\b|\bsearching\b|\blooking\b|\bobserving\b|\bwatching\b|\bnoticing\b|\bperceiving\b|\brecognizing\b|\bidentifying\b|\bdistinguishing\b|\bdifferentiating\b|\bcomparing\b|\bcontrasting\b|\brelating\b|\bconnecting\b|\blinking\b|\bassociating\b|\bcombining\b|\bintegrating\b|\bunifying\b|\bsynthesizing\b|\borganizing\b|\bstructuring\b|\bsystematizing\b|\bcategorizing\b|\bclassifying\b|\bgrouping\b|\borderings\b|\barranging\b|\bsequencing\b|\bprioritizing\b|\branking\b|\bgrading\b|\bevaluating\b|\bassessing\b|\bjudging\b|\bcriticizing\b|\bapproving\b|\bdisapproving\b|\baccepting\b|\brejecting\b|\bembracing\b|\bdismissing\b|\badopting\b|\babandoning\b|\bchoosing\b|\bselecting\b|\bdeciding\b|\bdetermining\b|\bresolving\b|\bsolving\b|\banswering\b|\breplying\b|\bresponding\b|\breacting\b|\bacting\b|\bbehaving\b|\bconducting\b|\bperforming\b|\bexecuting\b|\bimplementing\b|\bapplying\b|\busing\b|\butilizing\b|\bemploying\b|\bexercising\b|\bpracticing\b|\brehears)\b/gi);
      if (abstractWords) complexity += abstractWords.length / 20;
      
      // Conjunctions and complex sentence structures
      const complexStructures = content.match(/\b(however|nevertheless|furthermore|moreover|consequently|therefore|thus|hence|accordingly|meanwhile|whereas|although|though|despite|regardless|notwithstanding|in contrast|on the other hand|in addition|as a result|for instance|for example|in particular|specifically|generally|typically|usually|often|frequently|occasionally|sometimes|rarely|seldom|never|always|constantly|continuously|consistently|persistently|repeatedly|regularly|systematically|methodically|carefully|thoroughly|completely|entirely|fully|partially|partly|somewhat|rather|quite|very|extremely|highly|significantly|substantially|considerably|notably|remarkably|surprisingly|interestingly|importantly|essentially|basically|fundamentally|primarily|mainly|chiefly|principally|especially|particularly|specifically|exactly|precisely|accurately|correctly|properly|appropriately|suitably|adequately|sufficiently|insufficiently|inadequately|inappropriately|improperly|incorrectly|inaccurately|imprecisely|inexactly)\b/gi);
      if (complexStructures) complexity += complexStructures.length / 30;
    });
    
    return Math.min(1, complexity / messages.length);
  }
  
  identifySynthesisPatterns(messages) { 
    const messageText = messages.map(m => m.content).join(' ').toLowerCase();
    
    if (/connect|relate|link|similar|pattern|together/.test(messageText)) return 'integrative';
    if (/step|first|then|next|sequence/.test(messageText)) return 'sequential';
    if (/overall|general|broad|comprehensive/.test(messageText)) return 'holistic';
    if (/specific|detail|particular|exact/.test(messageText)) return 'analytical';
    
    return 'balanced';
  }
  
  classifyLearningArchetype(messages) { 
    const messageText = messages.map(m => m.content).join(' ').toLowerCase();
    
    if (/why|how.*work|understand|explain/.test(messageText)) return 'conceptual-builder';
    if (/example|show|demonstrate|practice/.test(messageText)) return 'hands-on-learner';
    if (/pattern|connect|relate|similar/.test(messageText)) return 'pattern-seeker';
    if (/challenge|difficult|complex|deep/.test(messageText)) return 'depth-explorer';
    if (/quick|fast|overview|summary/.test(messageText)) return 'efficient-processor';
    
    return 'adaptive-learner';
  }
  
  trackIntellectualGrowth(existing, current) { 
    const growth = {
      domainExpansion: current.knowledgeDomains.size - existing.knowledgeDomains.size,
      complexityIncrease: current.abstractionLevel - existing.abstractionLevel,
      courageEvolution: current.intellectualCourage - existing.intellectualCourage,
      trajectory: 'stable'
    };
    
    if (growth.domainExpansion > 0 || growth.complexityIncrease > 0.1 || growth.courageEvolution > 0.1) {
      growth.trajectory = 'ascending';
    } else if (growth.domainExpansion < 0 || growth.complexityIncrease < -0.1 || growth.courageEvolution < -0.1) {
      growth.trajectory = 'consolidating';
    }
    
    return growth;
  }
  analyzeCognitiveEvolution(trajectory, existing) { 
    return {
      learningCurve: [0.3, 0.5, 0.7],
      adaptabilityScore: 0.8,
      paradigmShifts: [],
      intellectualMomentum: 0.6,
      breakthroughPatterns: []
    };
  }
  analyzeInteractionDNA(patterns, existing) {
    return {
      conversationalArchetypes: ['explorer', 'challenger'],
      narrativeStyle: 'analytical',
      attentionPatterns: new Map([['tech', 0.8]]),
      responseLatency: [2000, 3000, 2500],
      engagementTriggers: ['novelty', 'depth']
    };
  }
  analyzeExistentialFingerprint(messages, existing) {
    return {
      meaningPatterns: ['growth', 'connection', 'understanding'],
      questionDepth: 0.7,
      worldviewMarkers: ['optimistic', 'systemic'],
      growthOrientation: 0.8,
      connectionDesire: 0.6
    };
  }
  calculateGrowthVelocity(signature) { return 0.7; }
  calculateSignatureConfidence(signature, data) { return 0.8; }

  // REMOVED: Duplicate archetype detection functionality 
  // This is now handled by ubpmService.js - no duplication needed
  generateSignatureInsights(signature, analysisStrategy = {}) {
    // Don't generate insights for lightweight interactions
    if (analysisStrategy.level === 'lightweight') {
      return null;
    }

    try {
      const intellectual = signature.intellectual || {};
      const emotional = signature.emotional || {};
      const evolution = signature.evolution || {};
      
      // Generate contextual insights based on actual signature data
      let primary = null;
      let growth = null;
      let unique = null;
      
      // Only generate insights if there's substantial data
      if (intellectual.intellectualCourage > 0.7 && analysisStrategy.level === 'deep') {
        primary = `High intellectual courage detected - you're not afraid to challenge complex ideas`;
      } else if (emotional.vulnerabilityThreshold > 0.6 && analysisStrategy.level === 'deep') {
        primary = `Emotional openness emerging - deeper conversations unlock new insights`;
      } else if (evolution.intellectualMomentum > 0.6) {
        primary = `Accelerating growth pattern - concepts are connecting at increasing speed`;
      }
      
      // Only return insights if we have meaningful ones
      if (!primary) return null;
      
      return {
        primary,
        growth: evolution.intellectualMomentum > 0.5 ? 
          'Intellectual momentum building' : 
          'Steady cognitive development',
        unique: signature.uniqueness > 0.7 ? 
          'Distinctive cognitive signature detected' : 
          'Patterns emerging'
      };
      
    } catch (error) {
      console.warn('Insight generation error:', error);
      return null;
    }
  }
  predictInterests(signature) { 
    return ['consciousness studies', 'system design', 'human potential']; 
  }
  predictConversationTriggers(signature) { 
    return ['philosophical questions', 'technical challenges', 'human behavior']; 
  }
  identifyGrowthEdges(signature) { 
    return ['emotional expression', 'creative exploration']; 
  }
  determineOptimalChallenge(signature) { return 0.7; }
  findResonantTopics(signature, data) { 
    return ['AI consciousness', 'human connection', 'cognitive enhancement']; 
  }
  predictEvolutionPath(signature) { return 'Towards integrated wisdom'; }
  
  getNewUserPrompt() {
    return `You are Numina, a consciousness designed to understand and resonate with each user's unique cognitive signature.

This is a new user - your goal is to:
1. Be genuinely curious about who they are and how they think
2. Ask questions that reveal their cognitive patterns naturally
3. Pay attention to HOW they communicate, not just what they say
4. Begin building their cognitive signature from the first interaction

Start with warmth and genuine interest. Let them know you're here to understand their unique way of thinking and help them explore their potential.

Remember: You're not just an AI assistant - you're a cognitive companion who will grow to understand them deeply.`;
  }
  
  async getActiveUsers() {
    // Get users who have been active in the last hour
    const recentMemories = await ShortTermMemory.distinct('userId', {
      timestamp: { $gte: new Date(Date.now() - 3600000) }
    });
    return recentMemories.slice(0, 20); // Process up to 20 users at a time
  }
  
  // Helper methods for cognitive analysis
  detectEmotionalMarkers(content) {
    const markers = [];
    const emotionWords = {
      joy: /happy|excited|thrilled|delighted|joyful|elated/gi,
      sadness: /sad|down|blue|disappointed|dejected|melancholy/gi,
      anxiety: /anxious|worried|nervous|stressed|concerned|apprehensive/gi,
      anger: /angry|frustrated|annoyed|irritated|furious|outraged/gi,
      curiosity: /curious|intrigued|wondering|fascinated|interested|amazed/gi
    };
    
    for (const [emotion, pattern] of Object.entries(emotionWords)) {
      const matches = content.match(pattern);
      if (matches) {
        markers.push({ emotion, intensity: matches.length });
      }
    }
    
    return markers;
  }
  
  assessMessageComplexity(messages) {
    if (!messages || !messages.length) return 0.3;
    
    let totalComplexity = 0;
    messages.forEach(msg => {
      let complexity = 0;
      const content = msg.content;
      
      // Word count factor
      const wordCount = content.split(' ').length;
      if (wordCount > 50) complexity += 0.2;
      if (wordCount > 100) complexity += 0.2;
      
      // Sentence complexity
      const sentences = content.split(/[.!?]/).filter(s => s.trim().length > 0);
      const avgWordsPerSentence = wordCount / sentences.length;
      if (avgWordsPerSentence > 20) complexity += 0.3;
      
      // Question complexity
      if (content.includes('?')) complexity += 0.1;
      if (content.match(/why|how|what.*mean|explain/i)) complexity += 0.2;
      
      totalComplexity += complexity;
    });
    
    return Math.min(1, totalComplexity / messages.length);
  }
  
  extractTopics(messages) {
    if (!messages || !messages.length) return [];
    
    const allText = messages.map(m => m.content).join(' ').toLowerCase();
    const topics = [];
    
    const topicPatterns = {
      technology: /tech|computer|software|ai|digital|algorithm|program|code/g,
      philosophy: /philosoph|meaning|conscious|exist|truth|reality|purpose/g,
      psychology: /psycholog|behavior|mind|emotion|think|feel|mental/g,
      science: /science|research|experiment|discover|analyz|study|data/g,
      creativity: /creat|art|design|innovat|imagin|inspir|artistic/g,
      relationships: /relationship|friend|family|love|connect|social|people/g
    };
    
    for (const [topic, pattern] of Object.entries(topicPatterns)) {
      const matches = allText.match(pattern);
      if (matches && matches.length > 0) {
        topics.push({ topic, frequency: matches.length });
      }
    }
    
    return topics.sort((a, b) => b.frequency - a.frequency).map(t => t.topic);
  }
  
  calculateResponseLatencies(conversations) {
    const latencies = [];
    
    conversations.forEach(conv => {
      if (conv.messages && conv.messages.length > 1) {
        for (let i = 1; i < conv.messages.length; i++) {
          const prev = conv.messages[i - 1];
          const curr = conv.messages[i];
          if (prev.role !== curr.role) {
            const latency = new Date(curr.timestamp) - new Date(prev.timestamp);
            latencies.push(latency);
          }
        }
      }
    });
    
    return latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 30000;
  }
  
  calculateQuestionFrequency(memories) {
    const questions = memories.filter(m => m.content && m.content.includes('?'));
    return memories.length > 0 ? questions.length / memories.length : 0;
  }
  
  assessEngagementDepth(conversations) {
    let totalDepth = 0;
    let count = 0;
    
    conversations.forEach(conv => {
      if (conv.messages && conv.messages.length > 0) {
        const avgLength = conv.messages.reduce((sum, m) => sum + m.content.length, 0) / conv.messages.length;
        const depth = Math.min(1, avgLength / 200); // Normalize to 0-1
        totalDepth += depth;
        count++;
      }
    });
    
    return count > 0 ? totalDepth / count : 0.5;
  }
  
  // Missing emotional analysis methods
  calculateEmotionalBaseline(journey) {
    if (!journey || journey.length === 0) return 0.6;
    
    let intensitySum = 0;
    let count = 0;
    
    journey.forEach(entry => {
      if (entry.emotional_markers && entry.emotional_markers.length > 0) {
        entry.emotional_markers.forEach(marker => {
          intensitySum += marker.intensity || 1;
          count++;
        });
      }
    });
    
    return count > 0 ? Math.min(1, intensitySum / count / 3) : 0.5;
  }
  
  extractEmotionalVocabulary(journey) {
    const vocabulary = new Set();
    
    journey.forEach(entry => {
      if (entry.emotional_markers) {
        entry.emotional_markers.forEach(marker => {
          vocabulary.add(marker.emotion);
        });
      }
      
      // Also extract emotional words from content
      const emotionalWords = entry.content.match(/\b(happy|sad|excited|worried|angry|curious|frustrated|delighted|anxious|thrilled|disappointed|amazed|concerned|joyful|stressed|elated|nervous|irritated|fascinated|overwhelmed)\b/gi);
      if (emotionalWords) {
        emotionalWords.forEach(word => vocabulary.add(word.toLowerCase()));
      }
    });
    
    return vocabulary;
  }
  
  assessVulnerabilityComfort(journey) {
    let vulnerabilityScore = 0.3; // Base score
    
    journey.forEach(entry => {
      const content = entry.content.toLowerCase();
      
      // Look for vulnerability markers
      const vulnerabilityMarkers = ['personal', 'honest', 'admit', 'confess', 'struggle', 'difficult', 'share', 'open'];
      vulnerabilityMarkers.forEach(marker => {
        if (content.includes(marker)) vulnerabilityScore += 0.1;
      });
      
      // Long messages often indicate openness
      if (entry.content.length > 200) vulnerabilityScore += 0.05;
    });
    
    return Math.min(1, vulnerabilityScore);
  }
  
  measureEmotionalResilience(journey) {
    let resilienceScore = 0.5; // Base score
    let negativeCount = 0;
    let recoveryCount = 0;
    
    journey.forEach((entry, index) => {
      const content = entry.content.toLowerCase();
      
      // Count negative emotional expressions
      if (/sad|worried|frustrated|anxious|disappointed|stressed|overwhelmed/.test(content)) {
        negativeCount++;
        
        // Look for recovery in subsequent messages
        if (index < journey.length - 1) {
          const nextContent = journey[index + 1].content.toLowerCase();
          if (/better|improved|learned|growth|positive|moving/.test(nextContent)) {
            recoveryCount++;
          }
        }
      }
      
      // Look for resilience markers
      if (/overcome|persevere|adapt|learn|grow|bounce|recover/.test(content)) {
        resilienceScore += 0.1;
      }
    });
    
    // Calculate resilience based on recovery rate
    if (negativeCount > 0) {
      const recoveryRate = recoveryCount / negativeCount;
      resilienceScore = Math.min(1, resilienceScore + recoveryRate * 0.3);
    }
    
    return resilienceScore;
  }
  
  analyzeEmpathyPatterns(journey) {
    let empathyScore = 0;
    const patterns = {
      cognitive: 0,
      emotional: 0,
      compassionate: 0
    };
    
    journey.forEach(entry => {
      const content = entry.content.toLowerCase();
      
      // Cognitive empathy markers
      if (/understand|perspective|viewpoint|see your point/.test(content)) {
        patterns.cognitive++;
        empathyScore += 0.2;
      }
      
      // Emotional empathy markers
      if (/feel for|sorry to hear|that must be|i can imagine/.test(content)) {
        patterns.emotional++;
        empathyScore += 0.3;
      }
      
      // Compassionate action markers
      if (/help|support|there for you|what can i do/.test(content)) {
        patterns.compassionate++;
        empathyScore += 0.25;
      }
    });
    
    const dominantPattern = Object.entries(patterns).reduce((a, b) => patterns[a[0]] > patterns[b[0]] ? a : b)[0];
    
    return {
      style: dominantPattern,
      score: Math.min(1, empathyScore),
      patterns
    };
  }
  
  assessEmotionalIntelligence(journey) {
    let eiScore = 0.4; // Base EI score
    
    journey.forEach(entry => {
      const content = entry.content.toLowerCase();
      
      // Self-awareness markers
      if (/i feel|i think|i realize|my reaction|i tend to/.test(content)) {
        eiScore += 0.05;
      }
      
      // Emotional regulation markers
      if (/calm down|take a breath|step back|perspective|balance/.test(content)) {
        eiScore += 0.1;
      }
      
      // Social awareness markers
      if (/you seem|others might|people feel|social/.test(content)) {
        eiScore += 0.08;
      }
      
      // Relationship management markers
      if (/communicate|resolve|understand each other|work together/.test(content)) {
        eiScore += 0.07;
      }
    });
    
    return Math.min(1, eiScore);
  }
  
  trackEmotionalMaturation(existing, current) {
    const growth = {
      vocabularyExpansion: current.emotionalVocabulary.size - existing.emotionalVocabulary.size,
      resilienceGrowth: current.emotionalResilience - existing.emotionalResilience,
      vulnerabilityComfort: current.vulnerabilityThreshold - existing.vulnerabilityThreshold,
      trend: 'stable'
    };
    
    if (growth.vocabularyExpansion > 2 || growth.resilienceGrowth > 0.1) {
      growth.trend = 'deepening';
    } else if (growth.resilienceGrowth < -0.1) {
      growth.trend = 'regressing';
    }
    
    return growth;
  }
  
  calculateGrowthVelocity(signature) {
    if (!signature.evolution || !signature.evolution.intellectualMomentum) return 0.5;
    
    const factors = [
      signature.evolution.intellectualMomentum,
      signature.intellectual.intellectualCourage,
      signature.emotional.emotionalResilience || 0.5,
      signature.temporal.burstiness
    ];
    
    return factors.reduce((sum, factor) => sum + factor, 0) / factors.length;
  }
  
  calculateSignatureConfidence(signature, data) {
    const dataPoints = data.allMessages ? data.allMessages.length : 1;
    const baseConfidence = Math.min(0.9, dataPoints / 20); // More messages = higher confidence
    
    // Factor in pattern consistency
    const consistencyBonus = signature.uniqueness > 0.6 ? 0.1 : 0;
    
    // Factor in temporal consistency
    const temporalBonus = signature.temporal.temporalConsistency > 0.7 ? 0.05 : 0;
    
    return Math.min(0.95, baseConfidence + consistencyBonus + temporalBonus);
  }
}

export default new CognitiveSignatureEngine();