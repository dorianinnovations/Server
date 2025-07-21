/**
 * INTELLIGENCE CONTEXT COMPRESSOR
 * Converts rich intelligence data into optimized prompts for GPT-4o
 * Prevents overwhelming while maintaining sophistication
 */
class IntelligenceCompressor {
  
  /**
   * MAIN COMPRESSION STRATEGY
   * Converts 500+ data points into ~200 focused tokens
   */
  compressForLLM(intelligenceContext, messageType = 'standard', complexity = 'moderate') {
    if (!intelligenceContext) {
      return { compressedPrompt: '', metadata: { compressionRatio: 0 } };
    }
    
    // Adaptive compression based on message complexity
    const compressionStrategy = this.selectCompressionStrategy(complexity, messageType);
    
    const compressed = {
      // Core personality (always include)
      core: this.compressCorePersonality(intelligenceContext),
      
      // Dynamic context (based on current situation)
      dynamic: this.compressDynamicContext(intelligenceContext, compressionStrategy),
      
      // Behavioral hints (optimized for current interaction)
      behavioral: this.compressBehavioralHints(intelligenceContext, messageType)
    };
    
    const compressedPrompt = this.formatCompressedPrompt(compressed, compressionStrategy);
    
    return {
      compressedPrompt,
      metadata: {
        compressionRatio: this.calculateCompressionRatio(intelligenceContext, compressedPrompt),
        strategy: compressionStrategy,
        tokenEstimate: this.estimateTokenCount(compressedPrompt)
      }
    };
  }
  
  /**
   * CORE PERSONALITY - Always included (30-50 tokens)
   * Most essential personality traits that affect ALL responses
   */
  compressCorePersonality(intel) {
    const personality = intel.macro?.personalityEvolution || {};
    const communication = intel.micro?.communicationStyle || {};
    
    return {
      primaryTrait: this.extractPrimaryTrait(personality),
      communicationStyle: communication.tone || 'balanced',
      complexityPreference: this.deriveComplexityPreference(intel),
      interactionStyle: this.deriveInteractionStyle(intel)
    };
  }
  
  /**
   * DYNAMIC CONTEXT - Situation-specific (40-80 tokens)
   * Current state and recent patterns relevant to this interaction
   */
  compressDynamicContext(intel, strategy) {
    const current = intel.synthesis?.currentMoment || '';
    const engagement = intel.medium?.engagementTrends || {};
    const emotional = intel.micro?.currentState || {};
    
    const context = {
      currentFocus: this.extractCurrentFocus(current),
      engagementLevel: engagement.overall || 'moderate',
      emotionalState: emotional.mood || 'neutral',
      recentPattern: this.extractRecentPattern(intel.synthesis?.recentJourney)
    };
    
    // Strategy-based filtering
    if (strategy === 'minimal') {
      return { currentFocus: context.currentFocus, emotionalState: context.emotionalState };
    } else if (strategy === 'comprehensive') {
      return context;
    }
    
    return context;
  }
  
  /**
   * BEHAVIORAL HINTS - Message-type specific (20-40 tokens)
   * Specific guidance for how to respond to THIS type of message
   */
  compressBehavioralHints(intel, messageType) {
    const hints = {};
    
    switch (messageType) {
      case 'question':
        hints.responseStyle = this.getQuestionResponseStyle(intel);
        hints.detailLevel = this.getPreferredDetailLevel(intel);
        break;
        
      case 'emotional':
        hints.supportStyle = this.getEmotionalSupportStyle(intel);
        hints.empathyLevel = this.getEmpathyLevel(intel);
        break;
        
      case 'technical':
        hints.technicalDepth = this.getTechnicalDepth(intel);
        hints.examplePreference = this.getExamplePreference(intel);
        break;
        
      case 'creative':
        hints.creativityEncouragement = this.getCreativityLevel(intel);
        hints.explorationStyle = this.getExplorationStyle(intel);
        break;
        
      default:
        hints.adaptiveResponse = this.getAdaptiveGuidance(intel);
    }
    
    return hints;
  }
  
  /**
   * COMPRESSION STRATEGIES
   * Different approaches based on context complexity
   */
  selectCompressionStrategy(complexity, messageType) {
    // Simple messages get minimal context
    if (complexity < 3 || messageType === 'greeting') {
      return 'minimal';
    }
    
    // Complex analytical requests get comprehensive context
    if (complexity > 7 || messageType === 'analysis') {
      return 'comprehensive';
    }
    
    // Most interactions get balanced context
    return 'balanced';
  }
  
  /**
   * FORMAT COMPRESSED PROMPT
   * Convert compressed data into optimized prompt format
   */
  formatCompressedPrompt(compressed, strategy) {
    let prompt = '';
    
    // Core personality (concise format)
    prompt += `**USER PROFILE:** ${compressed.core.primaryTrait} personality, prefers ${compressed.core.complexityPreference} complexity, ${compressed.core.communicationStyle} communication style.\n`;
    
    // Dynamic context (current situation)
    if (compressed.dynamic.currentFocus) {
      prompt += `**CURRENT STATE:** Focused on ${compressed.dynamic.currentFocus}, ${compressed.dynamic.emotionalState} mood, ${compressed.dynamic.engagementLevel} engagement.\n`;
    }
    
    // Behavioral hints (response guidance)
    if (Object.keys(compressed.behavioral).length > 0) {
      const hints = Object.entries(compressed.behavioral)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      prompt += `**RESPONSE GUIDANCE:** ${hints}.\n`;
    }
    
    // Strategy-specific additions
    if (strategy === 'comprehensive') {
      prompt += this.addComprehensiveContext(compressed);
    }
    
    return prompt.trim();
  }
  
  /**
   * EXTRACTION HELPERS
   * Extract key insights from complex intelligence data
   */
  extractPrimaryTrait(personality) {
    // Logic to determine dominant personality trait
    const traits = personality.dominantTraits || [];
    return traits.length > 0 ? traits[0] : 'analytical';
  }
  
  deriveComplexityPreference(intel) {
    const complexity = intel.micro?.messageComplexity?.current || 5;
    return complexity > 7 ? 'high' : complexity > 4 ? 'moderate' : 'simple';
  }
  
  deriveInteractionStyle(intel) {
    const style = intel.micro?.communicationStyle || {};
    return style.directness === 'direct' ? 'direct' : 'conversational';
  }
  
  extractCurrentFocus(currentMoment) {
    // Extract focus from synthesis
    if (currentMoment.includes('technical')) return 'technical analysis';
    if (currentMoment.includes('personal')) return 'personal growth';
    if (currentMoment.includes('creative')) return 'creative exploration';
    return 'general inquiry';
  }
  
  extractRecentPattern(recentJourney) {
    if (!recentJourney) return 'new interaction';
    return recentJourney.trend || 'developing understanding';
  }
  
  getQuestionResponseStyle(intel) {
    const complexity = intel.micro?.messageComplexity?.current || 5;
    return complexity > 6 ? 'detailed-analytical' : 'clear-concise';
  }
  
  getPreferredDetailLevel(intel) {
    const prefs = intel.macro?.communicationPreferences || {};
    return prefs.detailPreference || 'moderate';
  }
  
  getEmotionalSupportStyle(intel) {
    const emotional = intel.macro?.emotionalProfile || {};
    return emotional.supportPreference || 'understanding';
  }
  
  getEmpathyLevel(intel) {
    const traits = intel.macro?.personalityEvolution?.empathyLevel || 0.7;
    return traits > 0.8 ? 'high' : traits > 0.5 ? 'moderate' : 'gentle';
  }
  
  getTechnicalDepth(intel) {
    const technical = intel.macro?.intellectualProfile?.technicalAptitude || 0.5;
    return technical > 0.8 ? 'expert' : technical > 0.6 ? 'intermediate' : 'beginner';
  }
  
  getExamplePreference(intel) {
    const learning = intel.medium?.learningVelocity?.style || {};
    return learning.exampleBased ? 'concrete-examples' : 'conceptual-explanations';
  }
  
  getCreativityLevel(intel) {
    const creativity = intel.macro?.creativityProfile?.level || 0.5;
    return creativity > 0.7 ? 'high-creative' : 'structured-creative';
  }
  
  getExplorationStyle(intel) {
    const exploration = intel.medium?.explorationPatterns || {};
    return exploration.style || 'guided';
  }
  
  getAdaptiveGuidance(intel) {
    const synthesis = intel.synthesis?.predictionContext || {};
    return synthesis.optimalApproach || 'supportive-analytical';
  }
  
  /**
   * COMPREHENSIVE CONTEXT - For complex interactions
   */
  addComprehensiveContext(compressed) {
    return `**ADVANCED CONTEXT:** High-complexity interaction detected. User demonstrates sophisticated thinking patterns and appreciates nuanced responses.`;
  }
  
  /**
   * UTILITIES
   */
  calculateCompressionRatio(original, compressed) {
    const originalSize = JSON.stringify(original).length;
    const compressedSize = compressed.length;
    return ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
  }
  
  estimateTokenCount(text) {
    // Rough token estimation (1 token ≈ 4 characters)
    return Math.ceil(text.length / 4);
  }
}

export default new IntelligenceCompressor();