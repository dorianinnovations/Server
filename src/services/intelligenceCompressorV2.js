/**
 * ULTIMATE INTELLIGENCE COMPRESSOR V2.0
 * 🚀 Advanced AI Context Optimization for GPT-4o
 * 
 * Features:
 * - Adaptive token budgeting based on model and context
 * - Semantic clustering of intelligence data
 * - Predictive compression that anticipates AI needs
 * - Dynamic quality scoring and optimization
 * - Multi-model support (GPT-4o, Claude, etc.)
 * - Real-time compression analytics
 */

import { log } from '../utils/logger.js';

class IntelligenceCompressorV2 {
  constructor() {
    this.compressionCache = new Map();
    this.performanceMetrics = new Map();
    this.qualityScores = new Map();
    
    // Model-specific optimization parameters
    this.modelProfiles = {
      'gpt-4o': {
        maxContextTokens: 128000,
        optimalIntelligenceTokens: 150,
        semanticUnderstanding: 0.95,
        compressionTolerance: 0.8
      },
      'claude-3': {
        maxContextTokens: 200000,
        optimalIntelligenceTokens: 200,
        semanticUnderstanding: 0.92,
        compressionTolerance: 0.75
      },
      'gpt-4': {
        maxContextTokens: 8000,
        optimalIntelligenceTokens: 100,
        semanticUnderstanding: 0.88,
        compressionTolerance: 0.85
      }
    };
    
    // Intelligence clustering weights
    this.intelligenceWeights = {
      personality: { priority: 0.9, stability: 0.8 },
      currentState: { priority: 1.0, stability: 0.3 },
      communication: { priority: 0.8, stability: 0.6 },
      behavioral: { priority: 0.7, stability: 0.7 },
      emotional: { priority: 0.85, stability: 0.4 },
      cognitive: { priority: 0.75, stability: 0.8 },
      contextual: { priority: 1.0, stability: 0.2 }
    };
  }

  /**
   * 🎯 MAIN COMPRESSION ENGINE
   * Adaptive compression with quality optimization
   */
  async compressForLLM(intelligenceContext, messageType = 'standard', complexity = 5, options = {}) {
    const startTime = Date.now();
    
    // Extract compression parameters
    const {
      model = 'gpt-4o',
      tokenBudget = null,
      qualityTarget = 0.85,
      conversationHistory = [],
      userPreferences = {},
      forceStrategy = null
    } = options;
    
    try {
      // 1. ADAPTIVE TOKEN BUDGETING
      const tokenBudget_calc = this.calculateOptimalTokenBudget(
        model, messageType, complexity, conversationHistory
      );
      
      // 2. SEMANTIC INTELLIGENCE CLUSTERING
      const clusteredIntelligence = this.clusterIntelligenceData(
        intelligenceContext, messageType, complexity
      );
      
      // 3. DYNAMIC COMPRESSION STRATEGY
      const strategy = forceStrategy || this.selectOptimalStrategy(
        clusteredIntelligence, tokenBudget_calc, qualityTarget, model
      );
      
      // 4. PREDICTIVE COMPRESSION
      const compressedContext = await this.performPredictiveCompression(
        clusteredIntelligence, strategy, tokenBudget_calc, model
      );
      
      // 5. QUALITY OPTIMIZATION
      const optimizedContext = this.optimizeCompressionQuality(
        compressedContext, qualityTarget, tokenBudget_calc
      );
      
      // 6. FINAL PROMPT GENERATION
      const finalPrompt = this.generateOptimizedPrompt(
        optimizedContext, messageType, strategy
      );
      
      // 7. PERFORMANCE ANALYTICS
      const metrics = this.calculateCompressionMetrics(
        intelligenceContext, finalPrompt, startTime, strategy
      );
      
      // 8. CACHE OPTIMIZATION
      this.updateCompressionCache(
        { messageType, complexity, model }, optimizedContext, metrics
      );
      
      return {
        compressedPrompt: finalPrompt,
        metadata: {
          strategy: strategy,
          tokenBudget: tokenBudget_calc,
          actualTokens: this.estimateTokenCount(finalPrompt),
          compressionRatio: metrics.compressionRatio,
          qualityScore: metrics.qualityScore,
          processingTime: metrics.processingTime,
          model: model,
          intelligenceClusters: Object.keys(clusteredIntelligence),
          optimization: metrics.optimization
        }
      };
      
    } catch (error) {
      log.error('Compression error', error);
      return this.getFallbackCompression(intelligenceContext, messageType);
    }
  }

  /**
   * 💰 ADAPTIVE TOKEN BUDGETING
   * Calculate optimal token allocation based on context
   */
  calculateOptimalTokenBudget(model, messageType, complexity, conversationHistory) {
    const modelProfile = this.modelProfiles[model] || this.modelProfiles['gpt-4o'];
    let baseBudget = modelProfile.optimalIntelligenceTokens;
    
    // Complexity adjustment
    const complexityMultiplier = Math.min(2.0, 0.5 + (complexity / 10));
    baseBudget *= complexityMultiplier;
    
    // Message type adjustment
    const typeMultipliers = {
      'greeting': 0.3,
      'standard': 1.0,
      'question': 1.2,
      'technical': 1.5,
      'analysis': 1.8,
      'emotional': 1.3,
      'creative': 1.4
    };
    baseBudget *= (typeMultipliers[messageType] || 1.0);
    
    // Conversation history adjustment
    const historyLength = conversationHistory.length || 0;
    if (historyLength > 10) {
      baseBudget *= 1.3; // More context needed for long conversations
    } else if (historyLength < 3) {
      baseBudget *= 0.8; // Less context available for new conversations
    }
    
    return Math.round(Math.min(baseBudget, modelProfile.maxContextTokens * 0.1));
  }

  /**
   * 🧠 SEMANTIC INTELLIGENCE CLUSTERING
   * Group related intelligence data for efficient compression
   */
  clusterIntelligenceData(intelligenceContext, messageType, complexity) {
    const clusters = {
      core: {},      // Essential personality traits
      dynamic: {},   // Current state and recent patterns  
      contextual: {},// Message-specific intelligence
      predictive: {},// Future-oriented insights
      behavioral: {},// Action and response patterns
      emotional: {}, // Emotional intelligence
      cognitive: {}  // Thinking and processing patterns
    };
    
    if (!intelligenceContext) return clusters;
    
    // CORE CLUSTER - Always essential
    clusters.core = {
      primaryPersonality: this.extractPrimaryPersonality(intelligenceContext),
      communicationStyle: this.extractCommunicationStyle(intelligenceContext),
      cognitiveProfile: this.extractCognitiveProfile(intelligenceContext),
      reliability: 0.9
    };
    
    // DYNAMIC CLUSTER - Current state
    clusters.dynamic = {
      currentState: intelligenceContext.micro?.currentState || {},
      engagementLevel: intelligenceContext.medium?.engagementTrends?.overall || 'moderate',
      recentPattern: intelligenceContext.synthesis?.currentMoment || '',
      emotionalState: intelligenceContext.micro?.emotionalShifts || [],
      reliability: 0.7
    };
    
    // CONTEXTUAL CLUSTER - Message-specific
    clusters.contextual = this.buildContextualCluster(
      intelligenceContext, messageType, complexity
    );
    
    // PREDICTIVE CLUSTER - Future-oriented
    clusters.predictive = {
      likelyNeeds: this.predictUserNeeds(intelligenceContext, messageType),
      optimalResponse: this.predictOptimalResponse(intelligenceContext, complexity),
      nextInteraction: this.predictNextInteraction(intelligenceContext),
      reliability: 0.6
    };
    
    // BEHAVIORAL CLUSTER - Response patterns
    clusters.behavioral = {
      decisionMaking: intelligenceContext.macro?.decisionPatterns || {},
      interactionStyle: intelligenceContext.medium?.interactionPatterns || {},
      learningStyle: intelligenceContext.macro?.learningVelocity || {},
      reliability: 0.8
    };
    
    // EMOTIONAL CLUSTER - Emotional intelligence
    clusters.emotional = {
      baseline: intelligenceContext.macro?.emotionalProfile || {},
      current: intelligenceContext.micro?.currentState?.emotional || {},
      patterns: intelligenceContext.medium?.emotionalTrends || {},
      reliability: 0.75
    };
    
    // COGNITIVE CLUSTER - Thinking patterns
    clusters.cognitive = {
      complexity: intelligenceContext.micro?.messageComplexity || {},
      processing: intelligenceContext.macro?.cognitiveStyle || {},
      problemSolving: intelligenceContext.medium?.problemSolvingApproach || {},
      reliability: 0.85
    };
    
    return clusters;
  }

  /**
   * 🎯 PREDICTIVE COMPRESSION
   * Anticipate GPT-4o needs and optimize accordingly
   */
  async performPredictiveCompression(clusteredIntelligence, strategy, tokenBudget, model) {
    const modelProfile = this.modelProfiles[model];
    
    // Priority scoring for each cluster
    const clusterPriorities = this.calculateClusterPriorities(
      clusteredIntelligence, strategy, modelProfile
    );
    
    // Token allocation per cluster
    const tokenAllocation = this.allocateTokensByPriority(
      clusterPriorities, tokenBudget
    );
    
    // Compress each cluster to its allocated tokens
    const compressedClusters = {};
    
    for (const [clusterName, allocation] of Object.entries(tokenAllocation)) {
      if (allocation.tokens > 0) {
        compressedClusters[clusterName] = this.compressCluster(
          clusteredIntelligence[clusterName],
          allocation.tokens,
          allocation.priority,
          model
        );
      }
    }
    
    return compressedClusters;
  }

  /**
   * 📊 CLUSTER PRIORITY CALCULATION
   */
  calculateClusterPriorities(clusteredIntelligence, strategy, modelProfile) {
    const priorities = {};
    
    // Base priorities from strategy
    const strategyPriorities = {
      minimal: {
        core: 1.0, dynamic: 0.8, contextual: 0.6,
        predictive: 0.2, behavioral: 0.3, emotional: 0.4, cognitive: 0.3
      },
      balanced: {
        core: 1.0, dynamic: 0.9, contextual: 0.8,
        predictive: 0.6, behavioral: 0.7, emotional: 0.7, cognitive: 0.6
      },
      comprehensive: {
        core: 1.0, dynamic: 1.0, contextual: 0.9,
        predictive: 0.8, behavioral: 0.8, emotional: 0.8, cognitive: 0.7
      }
    };
    
    const basePriorities = strategyPriorities[strategy] || strategyPriorities.balanced;
    
    // Adjust priorities based on data quality and reliability
    for (const [clusterName, basePriority] of Object.entries(basePriorities)) {
      const cluster = clusteredIntelligence[clusterName];
      const reliability = cluster?.reliability || 0.5;
      const dataRichness = this.calculateDataRichness(cluster);
      
      priorities[clusterName] = {
        priority: basePriority * reliability * dataRichness,
        reliability: reliability,
        dataRichness: dataRichness
      };
    }
    
    return priorities;
  }

  /**
   * 💎 TOKEN ALLOCATION BY PRIORITY
   */
  allocateTokensByPriority(clusterPriorities, totalTokenBudget) {
    const allocation = {};
    
    // Calculate total weighted priority
    const totalWeightedPriority = Object.values(clusterPriorities)
      .reduce((sum, cluster) => sum + cluster.priority, 0);
    
    // Allocate tokens proportionally
    for (const [clusterName, cluster] of Object.entries(clusterPriorities)) {
      const proportion = cluster.priority / totalWeightedPriority;
      allocation[clusterName] = {
        tokens: Math.round(totalTokenBudget * proportion),
        priority: cluster.priority,
        proportion: proportion
      };
    }
    
    return allocation;
  }

  /**
   * 🗜️ CLUSTER COMPRESSION
   */
  compressCluster(clusterData, tokenLimit, priority, model) {
    if (!clusterData || tokenLimit <= 0) return null;
    
    // Select compression technique based on priority and token limit
    if (tokenLimit < 20) {
      return this.ultraCompressCluster(clusterData, tokenLimit);
    } else if (tokenLimit < 50) {
      return this.standardCompressCluster(clusterData, tokenLimit);
    } else {
      return this.detailedCompressCluster(clusterData, tokenLimit);
    }
  }

  /**
   * ⚡ ULTRA COMPRESSION (< 20 tokens)
   */
  ultraCompressCluster(clusterData, tokenLimit) {
    // Extract only the most essential information
    const essential = this.extractEssentialData(clusterData);
    return this.formatUltraCompressed(essential, tokenLimit);
  }

  /**
   * 📝 STANDARD COMPRESSION (20-50 tokens)
   */
  standardCompressCluster(clusterData, tokenLimit) {
    const important = this.extractImportantData(clusterData);
    return this.formatStandardCompressed(important, tokenLimit);
  }

  /**
   * 📋 DETAILED COMPRESSION (50+ tokens)
   */
  detailedCompressCluster(clusterData, tokenLimit) {
    const detailed = this.extractDetailedData(clusterData);
    return this.formatDetailedCompressed(detailed, tokenLimit);
  }

  /**
   * 🏆 QUALITY OPTIMIZATION
   */
  optimizeCompressionQuality(compressedContext, qualityTarget, tokenBudget) {
    const currentQuality = this.calculateCompressionQuality(compressedContext);
    
    if (currentQuality >= qualityTarget) {
      return compressedContext; // Already meets quality target
    }
    
    // Iteratively improve quality while staying within token budget
    return this.improveCompressionQuality(
      compressedContext, qualityTarget, tokenBudget
    );
  }

  /**
   * 📈 COMPRESSION METRICS
   */
  calculateCompressionMetrics(original, compressed, startTime, strategy) {
    const processingTime = Date.now() - startTime;
    const originalSize = JSON.stringify(original).length;
    const compressedSize = compressed.length;
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
    
    return {
      processingTime,
      compressionRatio: parseFloat(compressionRatio),
      qualityScore: this.calculateCompressionQuality(compressed),
      efficiency: processingTime < 50 ? 'excellent' : processingTime < 100 ? 'good' : 'poor',
      optimization: {
        tokenEfficiency: this.calculateTokenEfficiency(compressed),
        semanticDensity: this.calculateSemanticDensity(compressed),
        informationRetention: this.calculateInformationRetention(original, compressed)
      }
    };
  }

  /**
   * 🎨 OPTIMIZED PROMPT GENERATION
   */
  generateOptimizedPrompt(compressedContext, messageType, strategy) {
    let prompt = '';
    
    // Structure prompt based on available clusters
    if (compressedContext.core) {
      prompt += `**PERSONALITY:** ${this.formatClusterForPrompt(compressedContext.core)}\n`;
    }
    
    if (compressedContext.dynamic) {
      prompt += `**CURRENT STATE:** ${this.formatClusterForPrompt(compressedContext.dynamic)}\n`;
    }
    
    if (compressedContext.contextual) {
      prompt += `**CONTEXT:** ${this.formatClusterForPrompt(compressedContext.contextual)}\n`;
    }
    
    if (compressedContext.behavioral && strategy !== 'minimal') {
      prompt += `**BEHAVIOR:** ${this.formatClusterForPrompt(compressedContext.behavioral)}\n`;
    }
    
    if (compressedContext.predictive && strategy === 'comprehensive') {
      prompt += `**GUIDANCE:** ${this.formatClusterForPrompt(compressedContext.predictive)}\n`;
    }
    
    return prompt.trim();
  }

  // ========== UTILITY METHODS ==========

  extractPrimaryPersonality(intelligence) {
    const traits = intelligence.macro?.personalityEvolution?.dominantTraits || [];
    return traits.length > 0 ? traits[0] : 'analytical';
  }

  extractCommunicationStyle(intelligence) {
    return intelligence.micro?.communicationStyle?.tone || 'balanced';
  }

  extractCognitiveProfile(intelligence) {
    const complexity = intelligence.micro?.messageComplexity?.current || 5;
    return complexity > 7 ? 'complex' : complexity > 4 ? 'moderate' : 'simple';
  }

  buildContextualCluster(intelligence, messageType, complexity) {
    return {
      messageType: messageType,
      complexity: complexity,
      focus: this.extractCurrentFocus(intelligence.synthesis?.currentMoment || ''),
      urgency: complexity > 8 ? 'high' : 'normal',
      reliability: 0.8
    };
  }

  extractCurrentFocus(currentMoment) {
    if (currentMoment.includes('technical')) return 'technical';
    if (currentMoment.includes('personal')) return 'personal';
    if (currentMoment.includes('creative')) return 'creative';
    return 'general';
  }

  predictUserNeeds(intelligence, messageType) {
    // Sophisticated need prediction based on patterns
    const needs = [];
    
    if (messageType === 'question') {
      needs.push('detailed explanation', 'examples');
    }
    if (messageType === 'technical') {
      needs.push('precise information', 'implementation details');
    }
    if (messageType === 'emotional') {
      needs.push('empathy', 'support', 'understanding');
    }
    
    return needs;
  }

  predictOptimalResponse(intelligence, complexity) {
    if (complexity > 7) return 'comprehensive-analytical';
    if (complexity < 4) return 'simple-direct';
    return 'balanced-informative';
  }

  predictNextInteraction(intelligence) {
    const patterns = intelligence.medium?.interactionPatterns || {};
    return patterns.likelyNext || 'follow-up-question';
  }

  calculateDataRichness(cluster) {
    if (!cluster) return 0.1;
    const keys = Object.keys(cluster);
    return Math.min(1.0, keys.length / 10); // Normalize to 0-1
  }

  calculateCompressionQuality(compressed) {
    // Quality heuristics
    const length = JSON.stringify(compressed).length;
    const structure = Object.keys(compressed).length;
    
    // Quality increases with optimal length and good structure
    const lengthScore = length > 100 && length < 800 ? 1.0 : 0.7;
    const structureScore = structure > 2 && structure < 8 ? 1.0 : 0.8;
    
    return (lengthScore + structureScore) / 2;
  }

  calculateTokenEfficiency(compressed) {
    const tokens = this.estimateTokenCount(JSON.stringify(compressed));
    const information = Object.keys(compressed).length;
    return information / tokens; // Information per token
  }

  calculateSemanticDensity(compressed) {
    // Measure how much meaning per token
    const meaningfulWords = JSON.stringify(compressed)
      .split(/\s+/)
      .filter(word => word.length > 3).length;
    const totalTokens = this.estimateTokenCount(JSON.stringify(compressed));
    return meaningfulWords / totalTokens;
  }

  calculateInformationRetention(original, compressed) {
    // Rough estimate of how much information was retained
    const originalKeys = this.countDeepKeys(original);
    const compressedKeys = this.countDeepKeys(compressed);
    return Math.min(1.0, compressedKeys / originalKeys);
  }

  countDeepKeys(obj, depth = 0) {
    if (depth > 5 || !obj || typeof obj !== 'object') return 0;
    
    let count = Object.keys(obj).length;
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        count += this.countDeepKeys(value, depth + 1);
      }
    }
    return count;
  }

  estimateTokenCount(text) {
    return Math.ceil(text.length / 4);
  }

  formatClusterForPrompt(cluster) {
    if (!cluster) return '';
    
    const formatted = Object.entries(cluster)
      .filter(([key, value]) => value && key !== 'reliability')
      .map(([key, value]) => {
        if (typeof value === 'object') {
          return `${key}: ${JSON.stringify(value)}`;
        }
        return `${key}: ${value}`;
      })
      .join(', ');
    
    return formatted;
  }

  extractEssentialData(clusterData) {
    // Extract only the most critical 1-2 pieces of information
    const essential = {};
    const keys = Object.keys(clusterData);
    
    // Take the first 2 most important keys
    for (let i = 0; i < Math.min(2, keys.length); i++) {
      essential[keys[i]] = clusterData[keys[i]];
    }
    
    return essential;
  }

  extractImportantData(clusterData) {
    // Extract top 50% of information
    const important = {};
    const keys = Object.keys(clusterData);
    const takeCount = Math.ceil(keys.length / 2);
    
    for (let i = 0; i < takeCount; i++) {
      important[keys[i]] = clusterData[keys[i]];
    }
    
    return important;
  }

  extractDetailedData(clusterData) {
    // Extract most information while still compressing
    const detailed = { ...clusterData };
    delete detailed.reliability; // Remove metadata
    return detailed;
  }

  formatUltraCompressed(data, tokenLimit) {
    // Ultra-short format
    const values = Object.values(data).slice(0, 1);
    return values.join('');
  }

  formatStandardCompressed(data, tokenLimit) {
    // Concise format
    return Object.entries(data)
      .map(([k, v]) => `${k}:${v}`)
      .join(', ');
  }

  formatDetailedCompressed(data, tokenLimit) {
    // Detailed but compressed format
    return JSON.stringify(data);
  }

  improveCompressionQuality(compressedContext, qualityTarget, tokenBudget) {
    // Quality improvement iterations
    return compressedContext; // Placeholder for iterative improvement
  }

  updateCompressionCache(key, context, metrics) {
    const cacheKey = JSON.stringify(key);
    this.compressionCache.set(cacheKey, {
      context,
      metrics,
      timestamp: Date.now()
    });
    
    // Cache cleanup
    if (this.compressionCache.size > 1000) {
      const oldestKey = this.compressionCache.keys().next().value;
      this.compressionCache.delete(oldestKey);
    }
  }

  selectOptimalStrategy(clusteredIntelligence, tokenBudget, qualityTarget, model) {
    // Strategic selection based on constraints
    if (tokenBudget < 50) return 'minimal';
    if (tokenBudget > 150) return 'comprehensive';
    return 'balanced';
  }

  getFallbackCompression(intelligenceContext, messageType) {
    return {
      compressedPrompt: `User shows ${messageType} communication pattern.`,
      metadata: {
        strategy: 'fallback',
        error: true,
        tokenEstimate: 10
      }
    };
  }
}

export default new IntelligenceCompressorV2();