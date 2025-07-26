#!/usr/bin/env node

/**
 * ANALYTICS ARCHITECTURE REORGANIZATION
 * 
 * This demonstrates the proper separation of concerns:
 * 1. Raw data storage (uncompressed, fully readable)
 * 2. Analytics processing (structured insights)
 * 3. LLM compression (for AI consumption only)
 * 4. API endpoints (return readable data)
 */

class AnalyticsArchitecture {
  
  /**
   * LAYER 1: Raw Data Storage
   * Always stored uncompressed for full auditability and flexibility
   */
  static storeRawUserData(userId, messageData) {
    return {
      collection: 'ShortTermMemory',
      document: {
        userId,
        role: messageData.role,
        content: messageData.content, // ALWAYS uncompressed
        timestamp: new Date(),
        metadata: {
          originalFormat: 'uncompressed',
          messageLength: messageData.content.length,
          attachments: messageData.attachments || []
        }
      }
    };
  }

  /**
   * LAYER 2: Analytics Processing  
   * Transforms raw data into structured insights (still readable)
   */
  static processAnalytics(rawConversations) {
    const userMessages = rawConversations.filter(msg => msg.role === 'user');
    const allText = userMessages.map(msg => msg.content).join(' ').toLowerCase();
    
    // Generate readable analytics (NOT compressed)
    const analytics = {
      userId: rawConversations[0]?.userId,
      analysisTimestamp: new Date().toISOString(),
      
      // Personality insights (readable)
      personalityProfile: {
        traits: this.extractPersonalityTraits(allText),
        communicationStyle: this.analyzeCommunicationStyle(userMessages),
        emotionalPatterns: this.identifyEmotionalPatterns(allText),
        interests: this.extractInterests(allText)
      },
      
      // Behavioral metrics (structured but readable)
      behaviorMetrics: {
        totalMessages: userMessages.length,
        averageMessageLength: Math.round(userMessages.reduce((sum, msg) => sum + msg.content.length, 0) / userMessages.length),
        messageFrequency: this.calculateMessageFrequency(rawConversations),
        topicConsistency: this.assessTopicConsistency(userMessages),
        engagementLevel: this.assessEngagementLevel(userMessages)
      },
      
      // Contextual data (immediately useful)
      contextualData: {
        recentTopics: this.extractRecentTopics(userMessages.slice(-3)),
        dominantThemes: this.identifyDominantThemes(allText),
        currentMood: this.assessCurrentMood(userMessages.slice(-2)),
        conversationFlow: this.analyzeConversationFlow(rawConversations)
      },
      
      // Response guidance (clear instructions)
      responseGuidance: {
        preferredTone: this.determinePreferredTone(allText),
        detailLevel: this.determineDetailLevel(userMessages),
        exampleTypes: this.suggestExampleTypes(allText),
        emotionalSupport: this.assessEmotionalSupportNeeds(allText),
        followUpSuggestions: this.generateFollowUpSuggestions(allText)
      }
    };
    
    return analytics; // Readable, structured, useful
  }
  
  /**
   * LAYER 3: LLM Compression Service
   * ONLY used when sending to AI - not for storage or API responses
   */
  static compressForLLM(analytics, messageContext = 'standard') {
    const intelligenceCompressor = require('./src/services/intelligenceCompressor.js');
    
    // Convert analytics to intelligence context format
    const intelligenceContext = {
      macro: {
        personalityEvolution: {
          dominantTraits: analytics.personalityProfile.traits
        },
        communicationPreferences: {
          detailPreference: analytics.responseGuidance.detailLevel
        }
      },
      micro: {
        communicationStyle: {
          tone: analytics.personalityProfile.communicationStyle
        },
        currentState: {
          mood: analytics.contextualData.currentMood
        }
      },
      synthesis: {
        currentMoment: analytics.contextualData.recentTopics.join(', '),
        recentJourney: {
          trend: analytics.contextualData.conversationFlow
        }
      }
    };
    
    // Compress ONLY for LLM consumption
    return intelligenceCompressor.compressForLLM(intelligenceContext, messageContext);
  }
  
  /**
   * LAYER 4: API Response Layer
   * Returns readable data to clients, never compressed
   */
  static formatForAPI(analytics, includeGuidance = false) {
    const response = {
      success: true,
      timestamp: analytics.analysisTimestamp,
      userProfile: {
        personality: analytics.personalityProfile,
        behavior: analytics.behaviorMetrics,
        context: analytics.contextualData
      }
    };
    
    // Include AI guidance only when requested
    if (includeGuidance) {
      response.aiGuidance = analytics.responseGuidance;
    }
    
    return response; // Always readable JSON
  }
  
  /**
   * DEMONSTRATION: Complete Flow
   */
  static demonstrateProperFlow(rawConversations) {
    console.log('🏗️ PROPER ANALYTICS ARCHITECTURE');
    console.log('==================================\n');
    
    // Step 1: Raw data (always uncompressed)
    console.log('📚 LAYER 1: Raw Data Storage');
    console.log('Format: Uncompressed, fully readable');
    console.log('Purpose: Auditability, flexibility, debugging');
    console.log('Example:', JSON.stringify(rawConversations[0], null, 2).substring(0, 200) + '...\n');
    
    // Step 2: Analytics processing (readable insights)
    console.log('🔍 LAYER 2: Analytics Processing');
    const analytics = this.processAnalytics(rawConversations);
    console.log('Format: Structured, readable insights');
    console.log('Purpose: Human-readable analytics, API responses');
    console.log('Example:', JSON.stringify(analytics.personalityProfile, null, 2) + '\n');
    
    // Step 3: LLM compression (only when needed)
    console.log('🤖 LAYER 3: LLM Compression (AI-bound only)');
    const compressed = this.compressForLLM(analytics, 'analysis');
    console.log('Format: Optimized prompt');
    console.log('Purpose: Efficient AI consumption only');
    console.log('Example:', compressed.compressedPrompt.substring(0, 300) + '...\n');
    
    // Step 4: API responses (readable)
    console.log('🌐 LAYER 4: API Response');
    const apiResponse = this.formatForAPI(analytics, true);
    console.log('Format: Clean JSON for clients');
    console.log('Purpose: Frontend consumption, debugging');
    console.log('Example:', JSON.stringify(apiResponse.userProfile.personality.traits, null, 2) + '\n');
    
    console.log('✅ RESULT: Each layer serves its purpose:');
    console.log('   • Raw data: Uncompressed, auditable');
    console.log('   • Analytics: Readable insights');
    console.log('   • LLM layer: Efficient AI prompts');
    console.log('   • API layer: Clean client responses');
    
    return { analytics, compressed, apiResponse };
  }
  
  /**
   * Helper Methods for Analytics Processing
   */
  static extractPersonalityTraits(text) {
    const traits = [];
    if (text.includes('analytic') || text.includes('test') || text.includes('understand')) {
      traits.push('analytical_thinker');
    }
    if (text.includes('creative') || text.includes('problem solving')) {
      traits.push('creative_problem_solver');
    }
    if (text.includes('stressed') || text.includes('worried')) {
      traits.push('emotionally_aware');
    }
    if (text.includes('curious') || text.includes('learn')) {
      traits.push('intellectually_curious');
    }
    return traits;
  }
  
  static analyzeCommunicationStyle(messages) {
    const avgLength = messages.reduce((sum, msg) => sum + msg.content.length, 0) / messages.length;
    if (avgLength > 100) return 'detailed_expressive';
    if (avgLength > 50) return 'thoughtful_moderate';
    return 'concise_direct';
  }
  
  static identifyEmotionalPatterns(text) {
    const patterns = [];
    if (text.includes('stressed') || text.includes('worried') || text.includes('overwhelming')) {
      patterns.push('stress_awareness');
    }
    if (text.includes('curious') || text.includes('explore') || text.includes('understand')) {
      patterns.push('curiosity_driven');
    }
    if (text.includes('creative') || text.includes('challenges')) {
      patterns.push('creative_engagement');
    }
    return patterns;
  }
  
  static extractInterests(text) {
    const interests = [];
    if (text.includes('analytics') || text.includes('system') || text.includes('test')) {
      interests.push('technology_systems');
    }
    if (text.includes('personality') || text.includes('patterns') || text.includes('understand')) {
      interests.push('self_improvement');
    }
    if (text.includes('work') || text.includes('project') || text.includes('deadline')) {
      interests.push('professional_development');
    }
    return interests;
  }
  
  static calculateMessageFrequency(conversations) {
    // Simple frequency calculation
    const timeSpan = new Date(conversations[0].timestamp) - new Date(conversations[conversations.length - 1].timestamp);
    const hours = timeSpan / (1000 * 60 * 60);
    return hours < 1 ? 'high' : hours < 24 ? 'moderate' : 'low';
  }
  
  static assessTopicConsistency(messages) {
    // Simple consistency check
    const topics = messages.map(msg => this.extractMainTopic(msg.content));
    const uniqueTopics = new Set(topics);
    return uniqueTopics.size < topics.length * 0.7 ? 'high' : 'moderate';
  }
  
  static extractMainTopic(content) {
    if (content.includes('analytics') || content.includes('test')) return 'analytics';
    if (content.includes('work') || content.includes('stressed')) return 'work_stress';
    if (content.includes('creative') || content.includes('problem')) return 'creativity';
    return 'general';
  }
  
  static assessEngagementLevel(messages) {
    const totalLength = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    const avgLength = totalLength / messages.length;
    return avgLength > 80 ? 'high' : avgLength > 40 ? 'moderate' : 'low';
  }
  
  static extractRecentTopics(recentMessages) {
    return recentMessages.map(msg => this.extractMainTopic(msg.content));
  }
  
  static identifyDominantThemes(text) {
    const themes = [];
    if (text.includes('analytics') || text.includes('system')) themes.push('technical_analysis');
    if (text.includes('stressed') || text.includes('work')) themes.push('work_challenges');
    if (text.includes('creative') || text.includes('curiosity')) themes.push('creative_exploration');
    return themes;
  }
  
  static assessCurrentMood(recentMessages) {
    const recentText = recentMessages.map(msg => msg.content).join(' ').toLowerCase();
    if (recentText.includes('stressed') || recentText.includes('worried')) return 'stressed_but_engaged';
    if (recentText.includes('curious') || recentText.includes('love')) return 'positive_engaged';
    return 'neutral_focused';
  }
  
  static analyzeConversationFlow(conversations) {
    const userMessages = conversations.filter(msg => msg.role === 'user');
    if (userMessages.length < 2) return 'initial_contact';
    
    const first = userMessages[0].content.toLowerCase();
    const last = userMessages[userMessages.length - 1].content.toLowerCase();
    
    if (first.includes('test') && last.includes('creative')) {
      return 'analytical_to_personal';
    }
    return 'progressive_disclosure';
  }
  
  static determinePreferredTone(text) {
    if (text.includes('stressed') || text.includes('worried')) return 'empathetic_supportive';
    if (text.includes('test') || text.includes('analytics')) return 'professional_informative';
    return 'balanced_supportive';
  }
  
  static determineDetailLevel(messages) {
    const avgLength = messages.reduce((sum, msg) => sum + msg.content.length, 0) / messages.length;
    return avgLength > 80 ? 'comprehensive' : avgLength > 40 ? 'detailed' : 'concise';
  }
  
  static suggestExampleTypes(text) {
    const types = [];
    if (text.includes('analytics') || text.includes('test')) types.push('technical_examples');
    if (text.includes('creative') || text.includes('problem')) types.push('practical_scenarios');
    if (text.includes('work') || text.includes('project')) types.push('workplace_analogies');
    return types;
  }
  
  static assessEmotionalSupportNeeds(text) {
    if (text.includes('stressed') || text.includes('worried') || text.includes('overwhelming')) {
      return 'acknowledge_validate';
    }
    return 'minimal_encouragement';
  }
  
  static generateFollowUpSuggestions(text) {
    const suggestions = [];
    if (text.includes('personality') || text.includes('patterns')) {
      suggestions.push('personality_deep_dive');
    }
    if (text.includes('stressed') || text.includes('work')) {
      suggestions.push('stress_management_techniques');
    }
    if (text.includes('creative') || text.includes('problem')) {
      suggestions.push('creative_problem_solving_methods');
    }
    return suggestions;
  }
}

// Demo with sample data
const sampleConversations = [
  {
    userId: "test123",
    role: "user",
    content: "Hello, I want to test the analytics system. Can you help me understand my personality patterns?",
    timestamp: "2025-07-25T18:44:37.480Z"
  },
  {
    userId: "test123", 
    role: "assistant",
    content: "I'd be happy to help you understand your personality patterns...",
    timestamp: "2025-07-25T18:44:38.480Z"
  },
  {
    userId: "test123",
    role: "user", 
    content: "I am feeling stressed about work today. My boss gave me a difficult project and I am worried about meeting the deadline.",
    timestamp: "2025-07-25T18:44:51.725Z"
  },
  {
    userId: "test123",
    role: "user",
    content: "I love creative problem solving and approach challenges with curiosity. Today was just overwhelming.",
    timestamp: "2025-07-25T18:45:52.830Z"
  }
];

// Run the demonstration
AnalyticsArchitecture.demonstrateProperFlow(sampleConversations);

export default AnalyticsArchitecture;