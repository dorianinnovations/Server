import ShortTermMemory from '../models/ShortTermMemory.js';
import UserConstants from '../models/UserConstants.js';
import User from '../models/User.js';

/**
 * Enhanced Memory Service
 * Combines short-term conversation memory with persistent user constants
 * for much richer, more persistent AI context
 */
class EnhancedMemoryService {
  constructor() {
    this.memoryCache = new Map(); // Cache user constants for performance
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get comprehensive user context for AI prompts
   * Combines conversation history + persistent user constants
   */
  async getUserContext(userId, conversationLimit = 12) {
    try {
      // High-performance mode: minimal logging
      
      // Get short-term conversation memory
      const recentMemory = await ShortTermMemory.find({ userId })
        .select('role content timestamp')
        .sort({ timestamp: -1 })
        .limit(conversationLimit)
        .lean();

      // Get or create user constants
      let userConstants = await this.getUserConstants(userId);
      if (!userConstants) {
        userConstants = await this.initializeUserConstants(userId);
      }
      
      // Fallback if initialization failed
      if (!userConstants) {
        console.warn(`Failed to get/create user constants for ${userId}, using defaults`);
        userConstants = {
          getContextSummary: () => ({
            personal: {},
            preferences: {},
            current: {},
            insights: [],
            memories: []
          })
        };
      }

      // Get basic user info
      const user = await User.findById(userId)
        .select('profile emotionalLog createdAt')
        .lean();

      // Build comprehensive context
      const context = {
        conversation: {
          recentMessages: recentMemory.reverse(), // Chronological order
          messageCount: recentMemory.length,
          hasHistory: recentMemory.length > 0
        },
        userConstants: userConstants.getContextSummary ? userConstants.getContextSummary() : {
          personal: {},
          preferences: {},
          current: {},
          insights: [],
          memories: []
        },
        profile: user?.profile || {},
        recentEmotions: (user?.emotionalLog || [])
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 5),
        metadata: {
          userSince: user?.createdAt,
          totalInteractions: userConstants.totalInteractions,
          lastConversation: userConstants.lastConversation
        }
      };

      // Context built successfully
      
      return context;
    } catch (error) {
      console.error('Error building user context:', error);
      return {
        conversation: { recentMessages: [], messageCount: 0, hasHistory: false },
        userConstants: {},
        profile: {},
        recentEmotions: [],
        metadata: {}
      };
    }
  }

  /**
   * Get user constants with caching
   */
  async getUserConstants(userId) {
    try {
      const cacheKey = `constants_${userId}`;
      const cached = this.memoryCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.data;
      }

      const userConstants = await UserConstants.findOne({ userId });
      if (userConstants) {
        this.memoryCache.set(cacheKey, {
          data: userConstants,
          timestamp: Date.now()
        });
      }

      return userConstants;
    } catch (error) {
      console.error('Error getting user constants:', error);
      return null;
    }
  }

  /**
   * Initialize user constants for new users
   */
  async initializeUserConstants(userId) {
    try {
      // Initializing user constants
      
      const userConstants = new UserConstants({
        userId,
        totalInteractions: 0,
        lastConversation: new Date()
      });

      await userConstants.save();
      return userConstants;
    } catch (error) {
      console.error('Error initializing user constants:', error);
      return null;
    }
  }

  /**
   * Update user constants based on conversation analysis
   */
  async updateUserConstants(userId, updates) {
    try {
      const userConstants = await this.getUserConstants(userId);
      if (!userConstants) return;

      let hasChanges = false;

      // Update personal info if provided
      if (updates.personalInfo) {
        Object.entries(updates.personalInfo).forEach(([key, value]) => {
          if (value && userConstants.personalInfo[key] !== value) {
            userConstants.personalInfo[key] = value;
            hasChanges = true;
          }
        });
      }

      // Add insights
      if (updates.insights && Array.isArray(updates.insights)) {
        for (const insight of updates.insights) {
          await userConstants.addInsight(insight.text, insight.category, insight.confidence);
          hasChanges = true;
        }
      }

      // Add key memories
      if (updates.keyMemories && Array.isArray(updates.keyMemories)) {
        for (const memory of updates.keyMemories) {
          await userConstants.addKeyMemory(memory.text, memory.importance, memory.category);
          hasChanges = true;
        }
      }

      // Add goals
      if (updates.goals && Array.isArray(updates.goals)) {
        for (const goal of updates.goals) {
          await userConstants.addGoal(goal.text, goal.category, goal.importance);
          hasChanges = true;
        }
      }

      // Add challenges
      if (updates.challenges && Array.isArray(updates.challenges)) {
        for (const challenge of updates.challenges) {
          await userConstants.addChallenge(challenge.text, challenge.severity);
          hasChanges = true;
        }
      }

      // Update communication preferences
      if (updates.communicationStyle) {
        Object.entries(updates.communicationStyle).forEach(([key, value]) => {
          if (value && userConstants.communicationStyle[key] !== value) {
            userConstants.communicationStyle[key] = value;
            hasChanges = true;
          }
        });
      }

      // Increment interaction count and update last conversation
      userConstants.totalInteractions++;
      userConstants.lastConversation = new Date();

      if (hasChanges) {
        await userConstants.save();
        // Invalidate cache
        this.memoryCache.delete(`constants_${userId}`);
      }

      return userConstants;
    } catch (error) {
      console.error('Error updating user constants:', error);
    }
  }

  /**
   * Build enhanced system prompt with full user context
   */
  buildEnhancedPrompt(basePrompt, userContext, adaptiveStyle) {
    const { userConstants, conversation, recentEmotions, metadata } = userContext;
    
    let enhancedPrompt = basePrompt + '\n\n';

    // Add persistent user knowledge
    if (Object.keys(userConstants.personal || {}).length > 0) {
      enhancedPrompt += '**WHAT YOU KNOW ABOUT THIS USER:**\n';
      
      if (userConstants.personal.name) {
        enhancedPrompt += `• Name: ${userConstants.personal.preferredName || userConstants.personal.name}\n`;
      }
      if (userConstants.personal.occupation) {
        enhancedPrompt += `• Occupation: ${userConstants.personal.occupation}\n`;
      }
      if (userConstants.personal.location) {
        enhancedPrompt += `• Location: ${userConstants.personal.location}\n`;
      }
      if (userConstants.personal.pets && userConstants.personal.pets.length > 0) {
        enhancedPrompt += `• Pets: ${userConstants.personal.pets.join(', ')}\n`;
      }
    }

    // Add current life context
    if (userConstants.current) {
      if (userConstants.current.goals && userConstants.current.goals.length > 0) {
        enhancedPrompt += '\n**THEIR CURRENT GOALS:**\n';
        userConstants.current.goals.forEach(goal => {
          enhancedPrompt += `• ${goal.goal} (${goal.category}, importance: ${goal.importance}/10)\n`;
        });
      }

      if (userConstants.current.challenges && userConstants.current.challenges.length > 0) {
        enhancedPrompt += '\n**CURRENT CHALLENGES:**\n';
        userConstants.current.challenges.forEach(challenge => {
          enhancedPrompt += `• ${challenge.challenge} (severity: ${challenge.severity}/10)\n`;
        });
      }
    }

    // Add key insights about the user
    if (userConstants.insights && userConstants.insights.length > 0) {
      enhancedPrompt += '\n**KEY INSIGHTS ABOUT THEM:**\n';
      userConstants.insights.forEach(insight => {
        enhancedPrompt += `• ${insight.insight} (${insight.category}, confidence: ${Math.round(insight.confidence * 100)}%)\n`;
      });
    }

    // Add important memories
    if (userConstants.memories && userConstants.memories.length > 0) {
      enhancedPrompt += '\n**IMPORTANT MEMORIES TO REMEMBER:**\n';
      userConstants.memories.forEach(memory => {
        enhancedPrompt += `• ${memory.memory} (${memory.category}, importance: ${memory.importance}/10)\n`;
      });
    }

    // Add communication preferences
    if (userConstants.preferences) {
      enhancedPrompt += '\n**THEIR COMMUNICATION PREFERENCES:**\n';
      if (userConstants.preferences.emotionalSupport) {
        enhancedPrompt += `• Emotional support style: ${userConstants.preferences.emotionalSupport}\n`;
      }
      if (userConstants.preferences.formalityLevel) {
        enhancedPrompt += `• Prefers ${userConstants.preferences.formalityLevel} communication\n`;
      }
      if (userConstants.preferences.topicsToAvoid && userConstants.preferences.topicsToAvoid.length > 0) {
        enhancedPrompt += `• Topics to avoid: ${userConstants.preferences.topicsToAvoid.join(', ')}\n`;
      }
    }

    // Add conversation context
    if (conversation.hasHistory) {
      enhancedPrompt += `\n**RECENT CONVERSATION CONTEXT:**\n`;
      enhancedPrompt += `You've been talking for ${conversation.messageCount} messages. `;
      
      if (metadata.totalInteractions) {
        enhancedPrompt += `Total interactions: ${metadata.totalInteractions}. `;
      }
      
      enhancedPrompt += 'Reference your shared history naturally.\n';
    } else {
      enhancedPrompt += '\n**CONVERSATION STATUS:** This is your first exchange with this user. Be welcoming while using what you know about them.\n';
    }

    // Add recent emotional context
    if (recentEmotions && recentEmotions.length > 0) {
      const latestEmotion = recentEmotions[0];
      enhancedPrompt += `\n**RECENT EMOTIONAL STATE:** ${latestEmotion.emotion}`;
      if (latestEmotion.intensity) {
        enhancedPrompt += ` (intensity: ${latestEmotion.intensity}/10)`;
      }
      enhancedPrompt += '\n';
    }

    enhancedPrompt += '\n**REMEMBER:** Use this knowledge naturally and conversationally. Don\'t list facts - weave them into your responses as a close friend would.\n';

    return enhancedPrompt;
  }

  /**
   * Analyze conversation for automatic constant updates
   */
  async analyzeAndUpdateConstants(userId, userMessage, assistantResponse) {
    try {
      // Enhanced pattern detection for comprehensive user data extraction
      
      const updates = {
        insights: [],
        keyMemories: [],
        personalInfo: {},
        goals: [],
        challenges: []
      };

      // High-performance message analysis

      // Enhanced name detection
      const namePatterns = [
        /(?:my name is|i'm|i am|call me) (\w+)/i,
        /hi[!,.]?\s*my name is (\w+)/i,
        /hello[!,.]?\s*i'm (\w+)/i
      ];
      namePatterns.forEach(pattern => {
        const match = userMessage.match(pattern);
        if (match) {
          updates.personalInfo.name = match[1];
        }
      });

      // Job/occupation detection
      const jobPatterns = [
        /i work as (?:a|an) ([^.!?]+)/i,
        /i'm (?:a|an) ([^.!?]+)/i,
        /my job is ([^.!?]+)/i,
        /i am (?:a|an) ([^.!?]+)/i,
        /profession[al]*ly i'm (?:a|an) ([^.!?]+)/i
      ];
      jobPatterns.forEach(pattern => {
        const match = userMessage.match(pattern);
        if (match) {
          const occupation = match[1].trim();
          // Filter out common non-job words
          if (!['trying', 'looking', 'thinking', 'working', 'person', 'student'].some(word => 
              occupation.toLowerCase().includes(word))) {
            updates.personalInfo.occupation = occupation;
          }
        }
      });

      // Pet detection
      const petPatterns = [
        /i have (?:a|an|\d+) ([^.!?]*(?:cat|dog|bird|fish|hamster|rabbit|pet)[s]?[^.!?]*)/i,
        /my ([^.!?]*(?:cat|dog|bird|fish|hamster|rabbit|pet)[s]?[^.!?]*) (?:is|are) (?:named|called) ([^.!?]+)/i,
        /(?:cat|dog|bird|fish|hamster|rabbit|pet)[s]? named ([^.!?]+)/i
      ];
      petPatterns.forEach(pattern => {
        const match = userMessage.match(pattern);
        if (match) {
          let petInfo = match[1] || match[2] || match[0];
          if (match[2]) petInfo += ` named ${match[2]}`;
          
          if (!updates.personalInfo.pets) updates.personalInfo.pets = [];
          updates.personalInfo.pets.push(petInfo.trim());
        }
      });

      // Hobby/interest detection
      const hobbyPatterns = [
        /i love ([^.!?]+)/i,
        /i enjoy ([^.!?]+)/i,
        /i like ([^.!?]+)/i,
        /hobby is ([^.!?]+)/i,
        /hobbies include ([^.!?]+)/i
      ];
      hobbyPatterns.forEach(pattern => {
        const match = userMessage.match(pattern);
        if (match) {
          const hobby = match[1].trim();
          // Filter out relationship/personal statements
          if (!['you', 'that', 'when', 'how'].some(word => 
              hobby.toLowerCase().startsWith(word))) {
            updates.insights.push({
              text: `Enjoys ${hobby}`,
              category: 'interests',
              confidence: 0.8
            });
          }
        }
      });

      // Enhanced goal detection
      const goalPatterns = [
        /my goal (?:this year |for \d+|\w*) is to ([^.!?]+)/i,
        /i want to ([^.!?]+)/i,
        /my goal is to ([^.!?]+)/i,
        /i'm trying to ([^.!?]+)/i,
        /hoping to ([^.!?]+)/i,
        /plan to ([^.!?]+)/i,
        /transition (?:into|to) ([^.!?]+)/i
      ];
      goalPatterns.forEach(pattern => {
        const match = userMessage.match(pattern);
        if (match) {
          const goalText = match[1].trim();
          updates.goals.push({
            text: goalText,
            category: 'personal',
            importance: 8
          });
        }
      });

      // Location detection
      const locationPatterns = [
        /i live in ([^.!?]+)/i,
        /i'm from ([^.!?]+)/i,
        /located in ([^.!?]+)/i,
        /based in ([^.!?]+)/i
      ];
      locationPatterns.forEach(pattern => {
        const match = userMessage.match(pattern);
        if (match) {
          updates.personalInfo.location = match[1].trim();
        }
      });

      // Enhanced challenge detection  
      const challengePatterns = [
        /i'm struggling with ([^.!?]+)/i,
        /having trouble with ([^.!?]+)/i,
        /it's hard to ([^.!?]+)/i,
        /difficult to ([^.!?]+)/i,
        /challenge is ([^.!?]+)/i
      ];
      challengePatterns.forEach(pattern => {
        const match = userMessage.match(pattern);
        if (match) {
          updates.challenges.push({
            text: match[1].trim(),
            severity: 6
          });
        }
      });

      // Apply updates if any were found
      const hasUpdates = Object.values(updates).some(arr => 
        Array.isArray(arr) ? arr.length > 0 : Object.keys(arr).length > 0);
      
      if (hasUpdates) {
        await this.updateUserConstants(userId, updates);
      }

    } catch (error) {
      console.error('Error analyzing conversation for constants:', error);
    }
  }

  /**
   * Save conversation to memory with enhanced tracking
   */
  async saveConversation(userId, userMessage, assistantResponse, metadata = {}) {
    try {
      // Save to short-term memory
      await ShortTermMemory.insertMany([
        { userId, content: userMessage, role: "user" },
        { userId, content: assistantResponse, role: "assistant" }
      ]);

      // Analyze and update constants
      await this.analyzeAndUpdateConstants(userId, userMessage, assistantResponse);

      // Conversation saved and analyzed
    } catch (error) {
      console.error('Error saving enhanced conversation:', error);
    }
  }
}

// Export singleton instance
const enhancedMemoryService = new EnhancedMemoryService();
export default enhancedMemoryService;