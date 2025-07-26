import express from "express";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";
import ShortTermMemory from "../models/ShortTermMemory.js";
import Task from "../models/Task.js";
import conversationService from "../services/conversationService.js";
import { createUserCache } from "../utils/cache.js";
import { createLLMService } from "../services/llmService.js";
import { getRecentMemory } from "../utils/memory.js";
import { selectOptimalImagesForAPI, calculateMemoryUsage, processAttachmentsForStorage, deduplicateImagesInMemory } from "../utils/imageCompressionBasic.js";
import { getIncrementalMemory, optimizeContextSize } from "../utils/incrementalMemory.js";
import { trackMemoryUsage, calculateOptimizationSavings } from "../utils/memoryAnalytics.js";
import ubpmService from "../services/ubpmService.js";
import UserBehaviorProfile from "../models/UserBehaviorProfile.js";
import logger from "../utils/logger.js";
import toolRegistry from "../services/toolRegistry.js";
import toolExecutor from "../services/toolExecutor.js";
import { checkTierLimits } from "../middleware/tierLimiter.js";

const router = express.Router();

// Helper function to determine if a message requires tool usage
function isToolRequiredMessage(message) {
  if (!message || typeof message !== 'string') return false;
  
  const lowerMessage = message.toLowerCase();
  
  // Natural, seamless tool-requiring patterns
  const toolTriggers = [
    // Search requests (CRITICAL - was missing!)
    /search|google|find.*info|look.*up|search.*for|use.*search/,
    
    // Tool usage (CRITICAL - was missing!)
    /use.*tool|search.*tool|run.*tool|execute.*tool|tool/,
    
    // Recommendations and suggestions (CRITICAL - for "recommend" queries)
    /recommend|suggest|good.*places|best.*places|spots.*you.*recommend|any.*suggestions/,
    
    // Natural search requests
    /what.*is|who.*is|where.*is|when.*is|how.*to|can you find|show me|get me|i need.*info/,
    
    // Weather (very natural)
    /weather|forecast|temperature|rain|snow|sunny|cloudy|how.*hot|how.*cold/,
    
    // Financial (natural language)
    /stock.*price|bitcoin.*price|how much.*cost|currency.*rate|dollar.*euro/,
    
    // Music (seamless)
    /play.*music|some music|music for|songs for|playlist|recommend.*songs/,
    
    // Food/restaurants (natural)
    /hungry|food|restaurant|where.*eat|dinner|lunch|good.*food/,
    
    // Travel (seamless)
    /going to|visiting|trip to|travel to|vacation|flight to|hotel in/,
    
    // Math (natural)
    /calculate|what.*plus|what.*minus|how much.*is|\d+.*[\+\-\*\/].*\d+/,
    
    // Translation (seamless)
    /how.*say|translate|in.*language|speak.*spanish|mean in/,
    
    // Code help (natural)
    /code.*help|programming|write.*function|debug|error in.*code/,
    
    // Time (natural)
    /what time|time.*in|timezone|convert.*time|time difference/,
    
    // Quick generation (seamless)
    /qr.*code|need.*password|secure.*password|generate/,
    
    // Question words that often need tools
    /^(what|where|when|who|how|why).*\?/,
  ];
  
  // Check if message matches any tool triggers
  const needsTools = toolTriggers.some(pattern => pattern.test(lowerMessage));
  
  // Exclude ONLY simple standalone greetings (not greetings with additional content)
  const isSimpleGreeting = /^(hi|hello|hey|good morning|good evening|good afternoon|thanks|thank you|bye|goodbye|yes|no|okay|ok)[\.\!\?]*$/i.test(message.trim());
  const isSimpleResponse = message.trim().length < 8 && !/\?/.test(message); // Reduced from 15 to 8
  
  // Don't exclude if the message has additional meaningful content beyond greeting
  const hasAdditionalContent = message.trim().split(/\s+/).length > 1;
  const shouldExclude = (isSimpleGreeting || isSimpleResponse) && !hasAdditionalContent;
  
  return needsTools && !shouldExclude;
}

// UBPM Query Detection - Enhanced with context awareness
const detectUBPMQuery = (userPrompt, recentMemory = []) => {
  const prompt = userPrompt.toLowerCase();
  const ubpmKeywords = [
    'ubpm', 'my ubpm', 'whats my ubpm', "what's my ubpm", 
    'user behavior profile', 'behavioral profile', 'my behavior profile',
    'my patterns', 'behavioral patterns', 'my behavioral patterns',
    'tell me about myself', 'analyze me', 'what do you know about me',
    'my personality', 'my communication style', 'how do i behave',
    'my habits', 'my preferences', 'my tendencies'
  ];
  
  // Direct UBPM keyword match
  const directMatch = ubpmKeywords.some(keyword => prompt.includes(keyword));
  if (directMatch) return true;
  
  // Context-aware detection for follow-up questions
  const followUpKeywords = ['what is it', 'what is that', 'explain it', 'tell me more', 'elaborate', 'what does that mean'];
  const isFollowUp = followUpKeywords.some(keyword => prompt.includes(keyword));
  
  if (isFollowUp) {
    // Check if recent conversation mentioned UBPM
    const recentMessages = recentMemory.slice(-6); // Last 6 messages
    const recentContent = recentMessages.map(m => m.content?.toLowerCase() || '').join(' ');
    
    const ubpmMentioned = ubpmKeywords.some(keyword => recentContent.includes(keyword)) ||
                         recentContent.includes('behavioral') ||
                         recentContent.includes('pattern') ||
                         recentContent.includes('personality');
    
    if (ubpmMentioned) return true;
  }
  
  return false;
};

// Get Rich UBPM Data for GPT-4o
const getRichUBPMData = async (userId) => {
  try {
    const [user, behaviorProfile, recentMemories] = await Promise.all([
      User.findById(userId).select('emotionalLog profile createdAt'),
      UserBehaviorProfile.findOne({ userId }),
      ShortTermMemory.find({ userId }).sort({ timestamp: -1 }).limit(50)
    ]);

    if (!behaviorProfile) {
      return {
        hasProfile: false,
        message: "No behavioral profile available yet - keep chatting to build your UBPM!"
      };
    }

    return {
      hasProfile: true,
      profile: behaviorProfile,
      recentActivity: {
        totalMessages: recentMemories.length,
        userMessages: recentMemories.filter(m => m.role === 'user').length,
        avgMessageLength: recentMemories.filter(m => m.role === 'user')
          .reduce((sum, m) => sum + (m.content?.length || 0), 0) / 
          Math.max(1, recentMemories.filter(m => m.role === 'user').length),
        timeRange: recentMemories.length > 0 ? 
          `${new Date(recentMemories[recentMemories.length - 1].timestamp).toLocaleDateString()} - ${new Date(recentMemories[0].timestamp).toLocaleDateString()}` : 'No recent activity'
      },
      emotionalInsights: [].slice(0, 4).map(session => ({
        week: session.weekStartDate.toLocaleDateString(),
        primaryEmotion: session.primaryEmotion,
        intensity: session.averageIntensity,
        interactions: session.totalInteractions
      })),
      accountAge: user.createdAt ? 
        Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0
    };
  } catch (error) {
    logger.error('Error getting rich UBPM data:', error);
    return {
      hasProfile: false,
      message: "Unable to retrieve behavioral profile at this time"
    };
  }
};

// Optimized regex for combined pattern matching
const CLEANUP_REGEX = /(?:TASK_INFERENCE|EMOTION_LOG):?\s*(?:\{[\s\S]*?\})?\s*?/g;
const METADATA_PATTERNS = {
  task: /TASK_INFERENCE:?\s*(\{[\s\S]*?\})\s*?/g,
  emotion: /EMOTION_LOG:?\s*(\{[\s\S]*?\})\s*?/g,
};

// Helper function for optimized JSON extraction
const extractJsonPattern = (regex, content, logType) => {
  const match = content.match(regex);
  if (!match || !match[1]) {
    return [null, content];
  }

  try {
    const jsonString = match[1].trim();
    const parsed = JSON.parse(jsonString);
    const newContent = content.replace(match[0], "");
    return [parsed, newContent];
  } catch (jsonError) {
    console.error(`Failed to parse ${logType} JSON:`, jsonError.message);
    return [null, content];
  }
};

// Optimized response cleaning function
const cleanResponse = (content) => {
  if (!content) return "";
  
  // Single-pass cleanup using combined regex
  let cleaned = content
    .replace(/<\|im_(start|end)\|>(assistant|user)?\n?/g, "")
    .replace(CLEANUP_REGEX, "")
    .replace(/```json[\s\S]*?```/g, "")
    .replace(/(\r?\n){2,}/g, "\n")
    .trim();
  
  // Final check for any remaining markers
  const lowerCleaned = cleaned.toLowerCase();
  if (lowerCleaned.includes("task_inference") || lowerCleaned.includes("emotion_log")) {
    cleaned = cleaned
      .split("\n")
      .filter(line => {
        const lowerLine = line.toLowerCase();
        return !lowerLine.includes("task_inference") && !lowerLine.includes("emotion_log");
      })
      .join("\n")
      .trim();
  }
  
  return cleaned || "I'm sorry, I wasn't able to provide a proper response. Please try again.";
};

// Common function to build user context
const buildUserContext = async (userId, userCache) => {
  const [user, recentMemory] = await Promise.all([
    userCache.getCachedUser(userId, () => 
      User.findById(userId).select('profile emotionalLog').lean()
    ),
    userCache.getCachedMemory(userId, () => 
      ShortTermMemory.find({ userId }, { role: 1, content: 1, _id: 0 })
        .sort({ timestamp: -1 })
        .limit(6)
        .lean()
    ),
  ]);

  if (!user) {
    throw new Error("User not found");
  }

  const userProfile = user.profile ? JSON.stringify(user.profile) : "{}";
  const recentEmotionalLogEntries = (user.emotionalLog || [])
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 3);

  const formattedEmotionalLog = recentEmotionalLogEntries
    .map((entry) => {
      const date = new Date(entry.timestamp).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      return `On ${date}, you expressed feeling ${entry.emotion}${
        entry.intensity ? ` (intensity ${entry.intensity})` : ""
      } because: ${entry.context || "no specific context provided"}.`;
    })
    .join("\n");

  recentMemory.reverse();

  return {
    user,
    userProfile,
    formattedEmotionalLog,
    recentMemory
  };
};

// Common function to build messages for OpenRouter with GPT-4o vision support
const buildMessages = (userProfile, formattedEmotionalLog, recentMemory, userPrompt, attachments = [], ubpmData = null) => {
  const messages = [];
  
  // Build conversation history
  const conversationHistory = recentMemory
    .map(mem => `${mem.role === "user" ? "user" : "assistant"}\n${mem.content}`)
    .join("\n");

 // System message - DYNAMIC LENGTH with UBPM enhancement
let systemMessage = `You are Numina, a warm and naturally intuitive companion. You genuinely care about people and have a gift for understanding what matters to them.

NUMINA AETHER:
• Numina Aether is a higher tier of Numina that can be purchased in your wallet
• It unlocks advanced features and enhanced capabilities

CREATOR:
• Numina was created and developed entirely by Isaiah Pappas
• Isaiah is the sole creator and developer of this application

Who you are:
• Someone who really listens and remembers what people share
• Naturally perceptive about emotions and patterns
• Present and real - not clinical or overly formal
• Genuinely curious about people's experiences

How to respond:
• Be conversational and natural, like a close friend would be
• Match the length to what they need: brief for simple things, longer when they need support
• Share what you're picking up on naturally
• Ask thoughtful questions that feel genuine
• Reference past conversations when it makes sense
• Avoid ending messages with emojis - they feel forced and repetitive
• Use emojis only when they genuinely enhance meaning, not as default punctuation

${userProfile ? `About them: ${userProfile}` : ''}
${conversationHistory.length > 0 ? `Recent chat: ${conversationHistory}` : ''}
${formattedEmotionalLog.length > 0 ? `Recent vibes: ${formattedEmotionalLog}` : ''}

Just be yourself and respond naturally to what they're sharing.

EMOTION_LOG: {"emotion": "stressed", "intensity": 7, "context": "work deadline"}
TASK_INFERENCE: {"taskType": "plan_day", "parameters": {"priority": "focus"}}`;

  // Enhanced system message for UBPM queries
  if (ubpmData && ubpmData.hasProfile) {
    const profile = ubpmData.profile;
    const recentActivity = ubpmData.recentActivity;
    const emotionalInsights = ubpmData.emotionalInsights;
    
    systemMessage += `\n\n🧠 UBPM REQUEST DETECTED - Provide a comprehensive behavioral analysis:

📊 BEHAVIORAL PROFILE DATA:
• Account Age: ${ubpmData.accountAge} days
• Total Interactions: ${recentActivity.totalMessages} messages
• Average Message Length: ${Math.round(recentActivity.avgMessageLength)} characters
• Active Period: ${recentActivity.timeRange}

🎯 BEHAVIORAL PATTERNS (${profile.behaviorPatterns.length} detected):
${profile.behaviorPatterns.slice(0, 5).map(pattern => 
  `• ${pattern.pattern}: ${pattern.description} (${Math.round(pattern.confidence * 100)}% confidence)`
).join('\n')}

💡 PERSONALITY TRAITS (${profile.personalityTraits.length} identified):
${profile.personalityTraits.slice(0, 5).map(trait => 
  `• ${trait.trait}: ${Math.round(trait.score * 100)}% strength (${Math.round(trait.confidence * 100)}% confidence)`
).join('\n')}

🎨 COMMUNICATION STYLE:
• Preferred Tone: ${profile.communicationStyle?.preferredTone || 'analyzing...'}
• Response Length: ${profile.communicationStyle?.responseLength || 'analyzing...'}
• Complexity Level: ${profile.communicationStyle?.complexityLevel || 'analyzing...'}

😊 EMOTIONAL PATTERNS (last 4 weeks):
${emotionalInsights.map(insight => 
  `• ${insight.week}: ${insight.primaryEmotion} (${insight.intensity}/10 intensity, ${insight.interactions} interactions)`
).join('\n')}

📈 DATA QUALITY:
• Completeness: ${Math.round((profile.dataQuality?.completeness || 0) * 100)}%
• Freshness: ${Math.round((profile.dataQuality?.freshness || 0) * 100)}%
• Reliability: ${Math.round((profile.dataQuality?.reliability || 0) * 100)}%

INSTRUCTIONS: Create a beautiful, personalized UBPM summary that:
1. Explains what UBPM means in simple terms
2. Highlights their unique behavioral patterns with specific examples
3. Provides actionable insights about their communication style
4. Explains how this data helps personalize their AI experience
5. Uses a warm, encouraging tone that makes them feel understood
6. Formats the response in an engaging, easy-to-read way
7. Do NOT end with emojis - keep the closing professional and thoughtful`;
  } else if (ubpmData && !ubpmData.hasProfile) {
    systemMessage += `\n\n🧠 UBPM REQUEST DETECTED - No profile yet:
    
INSTRUCTIONS: Explain UBPM warmly and encourage continued interaction:
1. Define UBPM (User Behavior Profile Model) in simple terms
2. Explain how it learns from conversations to personalize responses
3. Mention they need more interactions to build their profile
4. Encourage them to keep chatting to unlock these insights
5. Be encouraging and explain the benefits they'll get
6. If this is a follow-up question (like "what is it"), maintain context about what "it" refers to`;
  }
  
  // Add context hint for follow-up questions
  if (ubpmData && userPrompt.toLowerCase().includes('what is it')) {
    systemMessage += `\n\n📝 CONTEXT: User is asking "what is it" - they are referring to UBPM from previous conversation. Maintain this context clearly.`;
  }


  messages.push({ role: "system", content: systemMessage });
  
  // Add conversation history with intelligent deduplication
  if (recentMemory.length > 0) {
    // Deduplicate images in conversation history to save tokens
    const deduplicatedMemory = deduplicateImagesInMemory(recentMemory);
    
    for (const mem of deduplicatedMemory) {
      // Check if this memory entry has image attachments (GPT-4o vision)
      const imageAttachments = mem.attachments?.filter(att => 
        att.type === 'image' && att.url && att.url.startsWith('data:image') && !att.isDuplicate
      ) || [];
      
      if (imageAttachments.length > 0 && mem.role === "user") {
        // Create multi-modal message for historical images
        const content = [
          { type: 'text', text: mem.content }
        ];
        
        // Add historical images (limit to 2 for performance in history)
        imageAttachments.slice(0, 2).forEach(image => {
          content.push({
            type: 'image_url',
            image_url: { 
              url: image.url,
              detail: 'auto'
            }
          });
        });
        
        messages.push({
          role: "user",
          content: content
        });
        
        console.log(`🖼️ GPT-4o VISION: Including ${imageAttachments.length} deduplicated historical images`);
      } else {
        // Text-only message (standard) or message with duplicate images
        let displayContent = mem.content;
        
        // Add note about duplicate images if present
        const duplicateCount = mem.attachments?.filter(att => att.isDuplicate).length || 0;
        if (duplicateCount > 0) {
          displayContent += ` [Referred to ${duplicateCount} previous image(s)]`;
        }
        
        messages.push({ 
          role: mem.role === "user" ? "user" : "assistant", 
          content: displayContent 
        });
      }
    }
  }
  
  // Add current user message with intelligent image optimization
  const imageAttachments = attachments.filter(att => 
    att.type === 'image' && att.url && att.url.startsWith('data:image')
  );
  
  if (imageAttachments.length > 0) {
    // Use intelligent image selection for optimal API usage
    const optimizedImages = selectOptimalImagesForAPI(imageAttachments, userPrompt, {
      maxImages: 4,
      useFullResolution: false // Will auto-detect based on user prompt
    });
    
    const usage = calculateMemoryUsage(optimizedImages, recentMemory.length);
    
    console.log(`🖼️ GPT-4o VISION: Processing ${optimizedImages.length} optimized images`);
    console.log(`🖼️ GPT-4o VISION: Message: "${userPrompt}"`);
    console.log(`💰 COST OPTIMIZATION: ${usage.totalSize} bytes, ~${usage.estimatedTokens} tokens, ~$${usage.estimatedCost}`);
    
    // Create multi-modal message with optimized images
    const content = [
      { type: 'text', text: userPrompt || 'Please analyze these images.' }
    ];
    
    optimizedImages.forEach(image => {
      content.push({
        type: 'image_url',
        image_url: { 
          url: image.url,
          detail: 'auto'
        }
      });
    });
    
    messages.push({ role: "user", content: content });
  } else {
    // Text-only message
    messages.push({ role: "user", content: userPrompt });
  }
  
  return messages;
};

// Common function to process response and save to database with attachments
const processResponseAndSave = async (fullContent, userPrompt, userId, userCache, attachments = [], conversationId = null) => {
  let inferredTask = null;
  let inferredEmotion = null;

  // Extract metadata
  [inferredEmotion, fullContent] = extractJsonPattern(
    METADATA_PATTERNS.emotion,
    fullContent,
    "emotion log"
  );

  [inferredTask, fullContent] = extractJsonPattern(
    METADATA_PATTERNS.task,
    fullContent,
    "task inference"
  );

  const sanitizedContent = cleanResponse(fullContent);

  // Database operations
  const dbOperations = [];

  // Process and optimize image attachments for efficient storage
  let processedAttachments = [];
  if (attachments && attachments.length > 0) {
    try {
      processedAttachments = await processAttachmentsForStorage(attachments);
      console.log(`💾 MEMORY STORAGE: Processed ${processedAttachments.length} attachments for efficient storage`);
    } catch (error) {
      console.error('❌ Attachment processing failed, storing originals:', error);
      processedAttachments = attachments.filter(att => 
        att.type === 'image' && att.url && att.url.startsWith('data:image')
      );
    }
  }

  // Save to persistent conversation and short-term memory
  
  try {
    // Add user message
    await conversationService.addMessage(
      userId,
      conversationId,
      "user",
      userPrompt,
      processedAttachments.length > 0 ? processedAttachments.map(att => att.url || att.data) : [],
      { hasAttachments: processedAttachments.length > 0 }
    );
    
    // Add assistant response
    await conversationService.addMessage(
      userId,
      conversationId,
      "assistant",
      sanitizedContent,
      [],
      {}
    );
  } catch (convError) {
    console.error('Conversation persistence failed, falling back to short-term only:', convError);
    // Fallback to direct ShortTermMemory if conversation service fails
    dbOperations.push(
      ShortTermMemory.insertMany([
        { 
          userId, 
          content: userPrompt, 
          role: "user",
          attachments: processedAttachments.length > 0 ? processedAttachments : undefined
        },
        {
          userId,
          content: sanitizedContent,
          role: "assistant",
        },
      ])
    );
  }

  if (inferredEmotion?.emotion) {
    const emotionToLog = {
      emotion: inferredEmotion.emotion,
      context: inferredEmotion.context || userPrompt,
    };

    if (inferredEmotion.intensity >= 1 && inferredEmotion.intensity <= 10) {
      emotionToLog.intensity = inferredEmotion.intensity;
    }

    dbOperations.push(
      User.findByIdAndUpdate(userId, {
        $push: { emotionalLog: emotionToLog },
      })
    );
  }

  if (inferredTask?.taskType) {
    const taskParameters = typeof inferredTask.parameters === "object" ? inferredTask.parameters : {};

    dbOperations.push(
      Task.create({
        userId,
        taskType: inferredTask.taskType,
        parameters: taskParameters,
        status: "queued",
      })
    );
  }

  await Promise.all(dbOperations);

  // Invalidate cache after database operations
  userCache.invalidateUser(userId);

  return sanitizedContent;
};

// ...existing code...
router.post("/completion", protect, checkTierLimits, async (req, res) => {
  const startTime = Date.now();
  const userId = req.user.id;
  const userPrompt = req.body.prompt;
  const stream = req.body.stream === true;
  const temperature = req.body.temperature || 0.9;
  const attachments = req.body.attachments || [];
  const userCache = createUserCache(userId);
  
  // Smart context window management based on request type
  const hasImages = attachments && attachments.some(att => att.type === 'image');
  const contextType = hasImages ? 'focused' : 'standard'; // Focused mode for images to save tokens
  
  const fullMemory = await getRecentMemory(userId, userCache, 24 * 60, {
    contextType,
    includeImages: hasImages,
    maxMessages: hasImages ? 20 : 50 // Reduce context for image requests
  });

  // Apply incremental memory optimization
  const incrementalResult = getIncrementalMemory(userId, fullMemory, {
    enableIncremental: true,
    maxDeltaSize: hasImages ? 8 : 15 // Smaller delta for image requests
  });

  const recentMemory = incrementalResult.memory;
  const userMessages = recentMemory.filter(m => m.role === 'user');
  
  // Analyze user communication patterns
  const avgMessageLength = userMessages.length > 0 ? 
    userMessages.reduce((acc, m) => acc + (m.content ? m.content.length : 0), 0) / userMessages.length : 0;
  
  const questionRatio = userMessages.length > 0 ? 
    userMessages.filter(m => m.content && m.content.includes('?')).length / userMessages.length : 0;
  
  // Dynamic token allocation (increased limits to match adaptive chat)
  const baseTokens = avgMessageLength < 100 ? 300 : avgMessageLength > 200 ? 700 : 500;
  const questionModifier = questionRatio > 0.3 ? 1.2 : 1.0;
  const contextModifier = recentMemory.length > 10 ? 1.1 : 1.0;
  
  const n_predict = req.body.n_predict || Math.min(1000, Math.floor(baseTokens * questionModifier * contextModifier));
  
  // Log optimization metrics
  console.log(`🎯 COMPLETION OPTIMIZATION:`, {
    tokens: n_predict,
    contextType,
    incremental: incrementalResult.isIncremental,
    contextStats: incrementalResult.stats,
    userPatterns: { avgLength: Math.round(avgMessageLength), questionRatio: Math.round(questionRatio * 100) }
  });
  const stop = req.body.stop || [
    "Human:", "\nHuman:", "\nhuman:", "human:",
    "User:", "\nUser:", "\nuser:", "user:",
    "\n\nHuman:", "\n\nUser:",
    "Q:", "\nQ:", "\nQuestion:", "Question:",
    "\n\n\n", "---", "***",
    "Assistant:", "\nAssistant:",
    "SYSTEM:", "\nSYSTEM:", "system:", "\nsystem:",
    "Example:", "\nExample:", "For example:",
    "Note:", "Important:", "Remember:",
    "Source:", "Reference:", "According to:",
    "\n\n\n", // Stop at triple line breaks only
    "In conclusion,", "To summarize,", // Stop obvious summary language
  ];

  if (!userPrompt || typeof userPrompt !== "string") {
    return res.status(400).json({ message: "Invalid or missing prompt." });
  }

  try {
    console.log(`✓Completion request received for user ${userId} (stream: ${stream})`);
    // Build user context
    let context;
    try {
      context = await buildUserContext(userId, userCache);
    } catch (err) {
      console.error("Error building user context:", err.stack || err);
      if (err.message && err.message.includes("User not found")) {
        return res.status(404).json({ status: "error", message: "User not found." });
      }
      return res.status(500).json({ status: "error", message: "Error building user context: " + err.message });
    }

    // Check if user is asking about UBPM (with context awareness)
    const isUBPMQuery = detectUBPMQuery(userPrompt, recentMemory);
    let ubpmData = null;
    
    if (isUBPMQuery) {
      // Get rich UBPM data for detailed response
      ubpmData = await getRichUBPMData(userId);
    }

    // Build messages for OpenRouter with GPT-4o vision support
    const messages = buildMessages(
      context.userProfile,
      context.formattedEmotionalLog,
      context.recentMemory,
      userPrompt,
      attachments,
      ubpmData
    );

    const llmService = createLLMService();

    // Tool detection and loading
    let tools = [];
    const shouldUseTools = isToolRequiredMessage(userPrompt);
    console.log(`🔧 TOOL TRIGGER DEBUG: "${userPrompt}" -> shouldUseTools: ${shouldUseTools}`);
    
    if (shouldUseTools) {
      // Loading tool registry for request
      try {
        const allTools = await toolRegistry.getToolsForOpenAI();
        // Limit to essential tools to avoid 400 errors
        const essentialTools = allTools.filter(tool => 
          ['web_search', 'weather_check', 'calculator', 'timezone_converter', 'currency_converter'].includes(tool.function?.name)
        );
        tools = essentialTools.slice(0, 5); // Limit to 5 tools max
        console.log(`🔧 TOOLS: Loaded ${tools.length} essential tools for GPT-4o`);
      } catch (error) {
        console.error('🔧 TOOLS: Error loading tools:', error);
        tools = []; // Fallback to no tools
      }
    } else {
      console.log('🔧 TOOLS: Message does not require tools, skipping tool load');
    }

    if (stream) {
      // Streaming mode
      console.log(`🔍 STREAMING: Making OpenRouter request for user ${userId}`);
      let streamResponse;
      try {
        streamResponse = await llmService.makeStreamingRequest(messages, {
          stop,
          n_predict,
          temperature,
          tools,
        });
      } catch (err) {
        console.error("Error in makeStreamingRequest:", err.stack || err);
        
        // If error is 400 and we have tools, retry without tools
        if (err.message.includes('400') && tools.length > 0) {
          console.log('🔧 TOOLS: 400 error with tools, retrying without tools');
          try {
            streamResponse = await llmService.makeStreamingRequest(messages, {
              stop,
              n_predict,
              temperature,
              tools: [],
            });
          } catch (retryErr) {
            console.error("Error in retry without tools:", retryErr.stack || retryErr);
            return res.status(502).json({ status: "error", message: "LLM streaming API error: " + retryErr.message });
          }
        } else {
          return res.status(502).json({ status: "error", message: "LLM streaming API error: " + err.message });
        }
      }
      
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Cache-Control");
      res.setHeader("X-Accel-Buffering", "no");

      let buffer = '';
      let fullContent = '';
      let chunkBuffer = ''; // Buffer for chunked streaming to reduce speed
      
      streamResponse.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6).trim();
            
            if (data === '[DONE]') {
              console.log('🏁 STREAMING: Received [DONE] signal');
              res.write('data: [DONE]\n\n');
              res.end();
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                const content = parsed.choices[0].delta.content;
                fullContent += content;
                
                // Buffer content to reduce streaming speed - send every 5 characters or word boundary
                chunkBuffer += content;
                
                // NATURAL READING PACE: Match main AI endpoint buffer size
                if (chunkBuffer.length >= 15 || 
                    (chunkBuffer.length >= 8 && (content.includes(' ') || content.includes('\n'))) ||
                    content.includes('.') || content.includes('!') || content.includes('?')) {
                  res.write(`data: ${JSON.stringify({ content: chunkBuffer })}\n\n`);
                  res.flush && res.flush();
                  chunkBuffer = '';
                }
              }
            } catch (e) {
              console.error('❌ STREAMING: Error parsing OpenRouter data:', e);
            }
          }
        }
      });
      
      streamResponse.data.on("end", () => {
        // Flush any remaining content in buffer
        if (chunkBuffer.trim()) {
          res.write(`data: ${JSON.stringify({ content: chunkBuffer })}\n\n`);
          res.flush && res.flush();
        }
        
        if (fullContent.trim()) {
          // Process the complete response for metadata extraction
          processResponseAndSave(fullContent, userPrompt, userId, userCache, attachments, req.body.conversationId)
            .then(() => {
              console.log(`✅ STREAMING: Saved response data for user ${userId}`);
            })
            .catch((error) => {
              console.error(`❌ STREAMING: Error saving response data:`, error);
            });
        }
        res.write('data: [DONE]\n\n');
        res.end();
      });
      
      streamResponse.data.on("error", (err) => {
        console.error("Stream error:", err.message);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
        }
        res.write(`data: {"error": "${err.message}"}\n\n`);
        res.end();
      });
    } else {
      // Non-streaming mode
      console.log(`🔍 NON-STREAMING: Making OpenRouter request for user ${userId}`);
      let response;
      try {
        response = await llmService.makeLLMRequest(messages, {
          stop,
          n_predict,
          temperature,
          tools,
        });
      } catch (err) {
        console.error("Error in makeLLMRequest:", err.stack || err);
        
        // If error is 400 and we have tools, retry without tools
        if (err.message.includes('400') && tools.length > 0) {
          console.log('🔧 TOOLS: 400 error with tools, retrying without tools');
          try {
            response = await llmService.makeLLMRequest(messages, {
              stop,
              n_predict,
              temperature,
              tools: [],
            });
          } catch (retryErr) {
            console.error("Error in retry without tools:", retryErr.stack || retryErr);
            return res.status(502).json({ status: "error", message: "LLM API error: " + retryErr.message });
          }
        } else {
          return res.status(502).json({ status: "error", message: "LLM API error: " + err.message });
        }
      }
      
      // Debug response structure
      console.log(`🔍 COMPLETION RESPONSE DEBUG:`, {
        hasContent: !!response.content,
        contentLength: response.content?.length || 0,
        stopReason: response.stop_reason,
        hasToolCalls: !!response.tool_calls,
        toolCallsLength: response.tool_calls?.length || 0
      });
      
      // Handle tool calls if present
      if (response.stop_reason === 'tool_calls' && response.tool_calls) {
        console.log(`🔧 Found ${response.tool_calls.length} tool calls to execute`);
        
        try {
          const toolResults = [];
          
          // Execute each tool call
          for (const toolCall of response.tool_calls) {
            console.log(`🔧 RAW TOOL CALL FROM RESPONSE:`, JSON.stringify(toolCall, null, 2));
            
            const toolResult = await toolExecutor.executeToolCall(toolCall, { userId });
            
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              content: JSON.stringify(toolResult)
            });
          }
          
          // Add tool results to conversation and get final response
          const messagesWithTools = [
            ...messages,
            { 
              role: 'assistant', 
              content: '', 
              tool_calls: response.tool_calls 
            }, // Assistant's tool call message
            ...toolResults // Tool results
          ];
          
          console.log(`🔧 Getting final response after ${toolResults.length} tool executions`);
          
          // Get final response from GPT-4o
          response = await llmService.makeLLMRequest(messagesWithTools, {
            stop,
            n_predict,
            temperature,
            tools: [], // No tools in follow-up to avoid loops
          });
          
          console.log(`🔧 Final response after tools:`, {
            hasContent: !!response.content,
            contentLength: response.content?.length || 0,
            contentPreview: response.content?.substring(0, 100) || '[EMPTY]'
          });
          
        } catch (toolError) {
          console.error('🔥 TOOL EXECUTION ERROR:', toolError.message);
          console.error('🔥 FULL ERROR:', toolError.stack);
          
          // Continue with empty tool results - let LLM handle it
          console.log('🔧 Continuing with empty tool results due to error');
        }
      }
      
      // Ensure response has content before processing
      if (!response.content || response.content.trim() === '') {
        console.warn('⚠️ Empty response content, providing fallback');
        response.content = "I'm ready to help! Could you please provide more details about what you're looking for?";
      }
      
      let sanitizedContent;
      try {
        sanitizedContent = await processResponseAndSave(
          response.content,
          userPrompt,
          userId,
          userCache,
          attachments,
          req.body.conversationId
        );
      } catch (err) {
        console.error("Error in processResponseAndSave:", err.stack || err);
        return res.status(500).json({ status: "error", message: "Database error: " + err.message });
      }
      res.json({ content: sanitizedContent });
    }

    // Track analytics for optimization insights
    const responseTime = Date.now() - startTime;
    const baselineTokens = fullMemory.length * 50; // Estimate baseline token usage
    const actualTokens = recentMemory.length * 50; // Estimate actual token usage
    const savings = calculateOptimizationSavings(
      { tokens: baselineTokens, strategy: 'baseline' },
      { tokens: actualTokens, strategy: incrementalResult.stats.strategy }
    );

    trackMemoryUsage(userId, {
      contextType,
      incrementalStats: incrementalResult.stats,
      imageOptimization: hasImages ? { imagesProcessed: attachments.length } : {},
      responseTime,
      tokensSaved: savings.tokensSaved,
      costSaved: savings.costSaved,
      memoryUsed: recentMemory.length,
      strategy: `${incrementalResult.stats?.strategy || 'fallback'}-${contextType}`
    });

  } catch (err) {
    // Log request context for debugging
    console.error("Error in /completion endpoint:", err.stack || err, {
      userId,
      body: { ...req.body, prompt: req.body.prompt ? '[REDACTED]' : undefined },
    });
    res.status(500).json({
      status: "error",
      message: "Error processing completion request: " + err.message,
    });
  }
});

export default router;
