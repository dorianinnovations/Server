/**
 * AI Insight Service - Real Database Integration
 * Provides AI-powered insights based on user behavior data
 * Integrates with UBPM and conversation history
 */

import UserBehaviorProfile from '../models/UserBehaviorProfile.js';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import Event from '../models/Event.js';
import { createLLMService } from './llmService.js';
import logger from '../utils/logger.js';

class AIInsightService {
  constructor() {
    this.llmService = createLLMService();
    this.cooldownPeriod = 30 * 60 * 1000; // 30 minutes
    this.userCooldowns = new Map();
  }
  async getUserCooldownStatus(userId) {
    const now = Date.now();
    const lastInsight = this.userCooldowns.get(userId);
    
    if (lastInsight && (now - lastInsight) < this.cooldownPeriod) {
      const cooldownEndTime = new Date(lastInsight + this.cooldownPeriod);
      return {
        isOnCooldown: true,
        cooldownEndTime,
        availableCategories: []
      };
    }
    
    return {
      isOnCooldown: false,
      cooldownEndTime: null,
      availableCategories: ['communication', 'personality', 'behavioral', 'emotional', 'growth']
    };
  }

  async getUserInsights(userId, limit = 5) {
    try {
      const behaviorProfile = await UserBehaviorProfile.findOne({ userId });
      if (!behaviorProfile) {
        return [];
      }

      const insights = [];
      const categories = ['communication', 'behavioral', 'emotional', 'personality', 'growth'];
      
      for (const category of categories.slice(0, limit)) {
        const insight = await this._generateInsightFromProfile(behaviorProfile, category);
        if (insight) {
          insights.push({
            id: `${userId}_${category}_${Date.now()}`,
            category,
            insight: insight.text,
            confidence: insight.confidence,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      return insights;
    } catch (error) {
      logger.error('Error getting user insights:', error);
      return [];
    }
  }

  async generateCategoryInsight(userId, category, forceGenerate = false) {
    try {
      if (!forceGenerate) {
        const cooldownStatus = await this.getUserCooldownStatus(userId);
        if (cooldownStatus.isOnCooldown) {
          return {
            success: false,
            error: 'User is on cooldown',
            cooldownEndTime: cooldownStatus.cooldownEndTime
          };
        }
      }

      const [behaviorProfile, user, recentConversations] = await Promise.all([
        UserBehaviorProfile.findOne({ userId }),
        User.findById(userId),
        Conversation.find({ userId }).sort({ updatedAt: -1 }).limit(5)
      ]);

      if (!behaviorProfile) {
        return {
          success: false,
          error: 'Insufficient user data for analysis'
        };
      }

      const insight = await this._generateAIInsight(behaviorProfile, user, recentConversations, category);
      
      if (!forceGenerate) {
        this.userCooldowns.set(userId, Date.now());
      }

      return {
        success: true,
        insight: insight.text,
        category,
        confidence: insight.confidence,
        timestamp: new Date().toISOString(),
        isCached: false
      };
    } catch (error) {
      logger.error('Error generating category insight:', error);
      return {
        success: false,
        error: 'Failed to generate insight'
      };
    }
  }

  async getUserAnalyticsData(userId) {
    try {
      const [behaviorProfile, totalConversations, recentEvents] = await Promise.all([
        UserBehaviorProfile.findOne({ userId }),
        Conversation.countDocuments({ userId }),
        Event.find({ userId }).sort({ timestamp: -1 }).limit(100)
      ]);

      if (!behaviorProfile) {
        return {
          success: false,
          error: 'No behavior profile found'
        };
      }

      const patterns = {
        communication: behaviorProfile.communicationPatterns || [],
        behavioral: behaviorProfile.behaviorPatterns.map(p => p.type) || [],
        emotional: behaviorProfile.emotionalPatterns || []
      };

      return {
        success: true,
        data: {
          totalInteractions: totalConversations + recentEvents.length,
          patterns,
          confidence: behaviorProfile.dataQuality?.reliability || 0.5,
          lastAnalysis: behaviorProfile.updatedAt?.toISOString() || new Date().toISOString(),
          profileCompleteness: this._calculateProfileCompleteness(behaviorProfile),
          recentActivity: recentEvents.length
        }
      };
    } catch (error) {
      logger.error('Error getting user analytics data:', error);
      return {
        success: false,
        error: 'Failed to retrieve analytics data'
      };
    }
  }

  async generateAdvancedAnalysis(userId, prompt, options = {}) {
    try {
      const [behaviorProfile, user, conversations] = await Promise.all([
        UserBehaviorProfile.findOne({ userId }),
        User.findById(userId),
        Conversation.find({ userId }).sort({ updatedAt: -1 }).limit(10)
      ]);

      if (!behaviorProfile || !conversations.length) {
        return {
          success: false,
          error: 'Insufficient data for advanced analysis'
        };
      }

      const analysisPrompt = `
Perform advanced psychological analysis based on user behavior data:

User Profile: ${JSON.stringify(behaviorProfile.personalityTraits)}
Behavior Patterns: ${JSON.stringify(behaviorProfile.behaviorPatterns)}
Communication Style: ${JSON.stringify(behaviorProfile.communicationPatterns)}
Emotional Patterns: ${JSON.stringify(behaviorProfile.emotionalPatterns)}

Specific Analysis Request: ${prompt}

Provide a comprehensive analysis with specific insights and confidence ratings.`;

      const response = await this.llmService.generateResponse([
        { role: 'system', content: 'You are an expert psychological analyst. Provide detailed, evidence-based insights.' },
        { role: 'user', content: analysisPrompt }
      ], {
        temperature: 0.3,
        maxTokens: 800
      });

      const insights = this._extractInsights(response);

      return {
        success: true,
        analysis: response,
        insights,
        confidence: behaviorProfile.dataQuality?.reliability || 0.7,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error generating advanced analysis:', error);
      return {
        success: false,
        error: 'Failed to generate advanced analysis'
      };
    }
  }

  async getRecentInteractionData(userId, timeWindow = '1h') {
    try {
      const timeWindowMs = this._parseTimeWindow(timeWindow);
      const since = new Date(Date.now() - timeWindowMs);
      
      const [recentEvents, recentConversations] = await Promise.all([
        Event.find({ 
          userId, 
          timestamp: { $gte: since } 
        }).sort({ timestamp: -1 }),
        Conversation.find({ 
          userId, 
          updatedAt: { $gte: since } 
        })
      ]);

      const totalInteractions = recentEvents.length + recentConversations.length;
      const patterns = this._analyzeRecentPatterns(recentEvents, recentConversations);

      return {
        success: true,
        interactions: totalInteractions,
        timeWindow,
        patterns,
        timestamp: new Date().toISOString(),
        breakdown: {
          events: recentEvents.length,
          conversations: recentConversations.length
        }
      };
    } catch (error) {
      logger.error('Error getting recent interaction data:', error);
      return {
        success: false,
        error: 'Failed to retrieve interaction data'
      };
    }
  }

  async generateRealtimeInsight(userId, prompt, analysisType) {
    try {
      const behaviorProfile = await UserBehaviorProfile.findOne({ userId });
      if (!behaviorProfile) {
        return {
          success: false,
          error: 'No behavior profile available for real-time analysis'
        };
      }

      const contextPrompt = `
Real-time behavioral analysis request:
Analysis Type: ${analysisType}
User Query: ${prompt}

Current User Patterns:
- Communication: ${JSON.stringify(behaviorProfile.communicationPatterns)}
- Behavioral: ${JSON.stringify(behaviorProfile.behaviorPatterns.slice(0, 3))}
- Emotional: ${JSON.stringify(behaviorProfile.emotionalPatterns)}

Provide a concise, actionable real-time insight.`;

      const response = await this.llmService.generateResponse([
        { role: 'system', content: 'You are a real-time behavioral analyst. Provide immediate, actionable insights.' },
        { role: 'user', content: contextPrompt }
      ], {
        temperature: 0.4,
        maxTokens: 200
      });

      return {
        success: true,
        insight: response,
        analysisType,
        confidence: Math.min(behaviorProfile.dataQuality?.reliability || 0.5, 0.9),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error generating realtime insight:', error);
      return {
        success: false,
        error: 'Failed to generate real-time insight'
      };
    }
  }

  // Helper methods
  async _generateInsightFromProfile(behaviorProfile, category) {
    const patterns = {
      communication: behaviorProfile.communicationPatterns,
      behavioral: behaviorProfile.behaviorPatterns,
      emotional: behaviorProfile.emotionalPatterns,
      personality: behaviorProfile.personalityTraits,
      growth: behaviorProfile.learningPatterns
    };

    const relevantData = patterns[category];
    if (!relevantData || (Array.isArray(relevantData) && relevantData.length === 0)) {
      return null;
    }

    const prompt = `Based on the following ${category} data, generate a concise insight:\n${JSON.stringify(relevantData)}`;
    
    try {
      const response = await this.llmService.generateResponse([
        { role: 'system', content: 'Generate a brief, actionable insight from user behavior data.' },
        { role: 'user', content: prompt }
      ], { temperature: 0.3, maxTokens: 150 });

      return {
        text: response,
        confidence: behaviorProfile.dataQuality?.reliability || 0.6
      };
    } catch (error) {
      logger.error('Error generating insight from profile:', error);
      return null;
    }
  }

  async _generateAIInsight(behaviorProfile, user, conversations, category) {
    const contextData = {
      profile: behaviorProfile,
      userInfo: { email: user.email, name: user.name },
      recentActivity: conversations.length,
      category
    };

    const prompt = `Generate a detailed ${category} insight for this user:\n${JSON.stringify(contextData, null, 2)}`;
    
    const response = await this.llmService.generateResponse([
      { role: 'system', content: `You are an expert in ${category} analysis. Provide specific, actionable insights.` },
      { role: 'user', content: prompt }
    ], { temperature: 0.3, maxTokens: 300 });

    return {
      text: response,
      confidence: behaviorProfile.dataQuality?.reliability || 0.7
    };
  }

  _calculateProfileCompleteness(profile) {
    const fields = [
      'personalityTraits',
      'communicationPatterns', 
      'behaviorPatterns',
      'emotionalPatterns',
      'interests'
    ];
    
    const completedFields = fields.filter(field => {
      const value = profile[field];
      return value && (Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0);
    });
    
    return completedFields.length / fields.length;
  }

  _parseTimeWindow(timeWindow) {
    const unit = timeWindow.slice(-1);
    const value = parseInt(timeWindow.slice(0, -1));
    
    switch (unit) {
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 60 * 60 * 1000; // Default 1 hour
    }
  }

  _analyzeRecentPatterns(events, conversations) {
    const patterns = new Set();
    
    if (events.length > 0) patterns.add('active');
    if (conversations.length > 0) patterns.add('communicative');
    if (events.length > 5) patterns.add('highly-engaged');
    if (conversations.some(c => c.messages?.length > 10)) patterns.add('detailed');
    
    return Array.from(patterns);
  }

  _extractInsights(analysisText) {
    const lines = analysisText.split('\n').filter(line => line.trim());
    return lines.slice(0, 3).map(line => line.replace(/^[-*•]\s*/, '').trim());
  }
}

export default new AIInsightService();