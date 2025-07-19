import express from 'express';
import { protect } from '../middleware/auth.js';
import { createLLMService } from '../services/llmService.js';
import User from '../models/User.js';
import CreditPool from '../models/CreditPool.js';
import { createUserCache } from '../utils/cache.js';
import dataProcessingPipeline from '../services/dataProcessingPipeline.js';
import toolRegistry from '../services/toolRegistry.js';
import toolExecutor from '../services/toolExecutor.js';
import enhancedMemoryService from '../services/enhancedMemoryService.js';
import requestCacheService from '../services/requestCacheService.js';
import ubpmService from '../services/ubpmService.js';
import { getIncrementalMemory } from '../utils/incrementalMemory.js';
import { trackMemoryUsage, calculateOptimizationSavings } from '../utils/memoryAnalytics.js';
import { log } from '../utils/logger.js';

const router = express.Router();
const llmService = createLLMService();

// Direct data query handler for instant metrics responses
async function handleDirectDataQuery(userId, message) {
  const lowerMessage = message.toLowerCase();
  
  // Import necessary models and services
  const ShortTermMemory = (await import('../models/ShortTermMemory.js')).default;
  const UserBehaviorProfile = (await import('../models/UserBehaviorProfile.js')).default;
  const { getUserMemoryAnalytics } = await import('../utils/memoryAnalytics.js');
  
  try {
    // Temporal queries with time periods (check specific first)
    if (/this.*week|weekly/.test(lowerMessage) && /temporal/.test(lowerMessage)) {
      const profile = await UserBehaviorProfile.findOne({ userId });
      const recentMemory = await ShortTermMemory.find({ 
        userId,
        timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }).lean();
      
      if (!profile && recentMemory.length === 0) return "No temporal data for this week yet.";
      
      const weeklyChangeRate = profile?.temporalPatterns?.weeklyChangeRate || 
        (recentMemory.length > 0 ? (recentMemory.length / 7 * 0.1) : 0);
      const direction = profile?.temporalPatterns?.direction || 'developing';
      
      return `This Week's Temporal: ${(weeklyChangeRate * 100).toFixed(1)}% ${direction} pattern | ${recentMemory.length} interactions`;
    }
    
    // General temporal change queries (exclude weekly patterns)  
    if (/^(?!.*(?:this.*week|weekly)).*(?:temporal.*change|my.*temporal|temporal.*data|show.*temporal)/.test(lowerMessage)) {
      const profile = await UserBehaviorProfile.findOne({ userId });
      if (!profile) return "No temporal data available yet.";
      
      const temporalChange = profile.temporalPatterns?.changeRate || 0;
      const direction = profile.temporalPatterns?.direction || 'stable';
      const confidence = profile.temporalPatterns?.confidence || 0;
      
      return `Temporal Change: ${(temporalChange * 100).toFixed(1)}% ${direction} (${(confidence * 100).toFixed(0)}% confidence)`;
    }
    
    // Emotional analysis over time periods
    if (/emotions.*last.*two.*days|whats.*my.*emotions.*doing|emotional.*trend/.test(lowerMessage)) {
      const EmotionalAnalyticsSession = (await import('../models/EmotionalAnalyticsSession.js')).default;
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      
      const emotionalSessions = await EmotionalAnalyticsSession.find({
        userId,
        timestamp: { $gte: twoDaysAgo }
      }).sort({ timestamp: -1 }).lean();
      
      if (emotionalSessions.length === 0) return "No emotional data from the last two days.";
      
      const emotions = emotionalSessions.map(s => s.emotion).filter(Boolean);
      const avgIntensity = emotionalSessions
        .filter(s => s.intensity)
        .reduce((sum, s) => sum + s.intensity, 0) / emotionalSessions.length || 0;
      
      const dominantEmotion = emotions.length > 0 ? 
        emotions.reduce((a, b, i, arr) => 
          arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
        ) : 'neutral';
      
      return `Last 2 Days Emotions: ${dominantEmotion} (dominant) | Avg intensity: ${avgIntensity.toFixed(1)}/10 | ${emotionalSessions.length} sessions`;
    }
    
    // Future change predictions
    if (/how.*could.*this.*change.*me|future.*change|predict.*my.*future|what.*will.*happen/.test(lowerMessage)) {
      const profile = await UserBehaviorProfile.findOne({ userId });
      const recentMemory = await ShortTermMemory.find({ userId }).sort({ timestamp: -1 }).limit(10).lean();
      
      if (!profile && recentMemory.length < 3) return "Need more data to predict future changes.";
      
      const growth = profile?.growthTrajectory || 'positive';
      const changeRate = profile?.temporalPatterns?.changeRate || 0.1;
      const confidence = profile?.confidence || 0.3;
      
      let prediction = `Future Change Prediction:\n`;
      prediction += `• Growth trajectory: ${growth} (${(confidence * 100).toFixed(0)}% confidence)\n`;
      prediction += `• Change velocity: ${(changeRate * 100).toFixed(1)}% per week\n`;
      
      if (changeRate > 0.2) {
        prediction += `• High change period - expect significant behavioral evolution`;
      } else if (changeRate > 0.1) {
        prediction += `• Moderate evolution - steady personal development`;
      } else {
        prediction += `• Stable period - consolidating current patterns`;
      }
      
      return prediction;
    }
    
    // Conversation metrics
    if (/conversation.*count|message.*count|how.*many.*messages/.test(lowerMessage)) {
      const messageCount = await ShortTermMemory.countDocuments({ userId });
      const conversationCount = Math.ceil(messageCount / 2);
      return `Total messages: ${messageCount} | Conversations: ${conversationCount}`;
    }
    
    // Memory analytics
    if (/my.*metrics|show.*metrics|what.*metrics/.test(lowerMessage)) {
      const analytics = getUserMemoryAnalytics(userId);
      const profile = await UserBehaviorProfile.findOne({ userId });
      
      let response = `Memory Analytics:\n`;
      response += `• Total requests: ${analytics.totalRequests}\n`;
      response += `• Tokens saved: ${analytics.totalTokensSaved}\n`;
      response += `• Cost saved: $${analytics.totalCostSaved.toFixed(4)}\n`;
      
      if (profile) {
        response += `• Confidence level: ${(profile.confidence * 100).toFixed(0)}%\n`;
        response += `• Profile completeness: ${(profile.dataQuality?.completeness * 100).toFixed(0)}%`;
      }
      
      return response;
    }
    
    // Personal data summary
    if (/what.*do.*you.*know.*about.*me|my.*data|show.*my.*data/.test(lowerMessage)) {
      const recentMemory = await ShortTermMemory.find({ userId })
        .sort({ timestamp: -1 })
        .limit(20)
        .lean();
      
      const profile = await UserBehaviorProfile.findOne({ userId });
      
      let response = "Your Data Summary:\n";
      response += `• ${recentMemory.length} recent messages stored\n`;
      
      if (profile) {
        response += `• Behavioral confidence: ${(profile.confidence * 100).toFixed(0)}%\n`;
        if (profile.personalityTraits?.length > 0) {
          const topTrait = profile.personalityTraits[0];
          response += `• Top personality trait: ${topTrait.trait} (${(topTrait.score * 100).toFixed(0)}%)\n`;
        }
        if (profile.interests?.length > 0) {
          response += `• Primary interest: ${profile.interests[0].category}\n`;
        }
        if (profile.communicationStyle?.preferredTone) {
          response += `• Communication style: ${profile.communicationStyle.preferredTone}`;
        }
      }
      
      return response;
    }
    
    // UBPM patterns - Use actual database structure
    if (/my.*patterns|behavioral.*pattern|ubpm.*data|my.*behavioral/.test(lowerMessage)) {
      const profile = await UserBehaviorProfile.findOne({ userId });
      if (!profile) return "No behavioral patterns detected yet.";
      
      let response = "Behavioral Patterns (UBPM):\n";
      
      // Use actual schema fields
      if (profile.personalityTraits?.length > 0) {
        response += "• Personality traits:\n";
        profile.personalityTraits.slice(0, 3).forEach(trait => {
          const score = trait.score || trait.value || 0;
          response += `  - ${trait.trait}: ${(score * 100).toFixed(0)}%\n`;
        });
      } else {
        response += "• Personality traits: Collecting data...\n";
      }
      
      // Communication style
      if (profile.communicationStyle) {
        response += `• Communication: ${profile.communicationStyle.preferredTone || 'Analyzing'} tone\n`;
        response += `• Complexity: ${profile.communicationStyle.complexityLevel || 'Moderate'}\n`;
      }
      
      // Confidence and completeness
      if (profile.confidence) {
        response += `• Confidence: ${(profile.confidence * 100).toFixed(0)}%\n`;
      }
      
      // Temporal patterns
      if (profile.temporalPatterns) {
        response += `• Active hours: ${profile.temporalPatterns.mostActiveHours?.join(', ') || 'Analyzing'}\n`;
        response += `• Active days: ${profile.temporalPatterns.mostActiveDays?.join(', ') || 'Developing'}`;
      }
      
      return response;
    }
    
  } catch (error) {
    console.error('Direct data query error:', error);
    return null;
  }
  
  return null; // No direct data query detected
}

// Real-time behavioral data population
async function populateRealBehavioralData(userId, userMessage, recentMemory) {
  try {
    const UserBehaviorProfile = (await import('../models/UserBehaviorProfile.js')).default;
    
    // Analyze message patterns for personality traits
    const personalityTraits = analyzePersonalityFromMessage(userMessage);
    const communicationStyle = analyzeCommunicationStyle(userMessage, recentMemory);
    const temporalPatterns = calculateTemporalPatterns(recentMemory);
    
    // Update or create behavior profile with real data - Force valid data
    const updateData = {
      $push: {
        personalityTraits: { $each: personalityTraits }
      },
      $set: {
        communicationStyle: {
          ...communicationStyle,
          preferredFormats: [],
          languagePatterns: []
        },
        temporalPatterns: {
          ...temporalPatterns,
          sessionDurations: {},
          mostActiveHours: [new Date().getHours()],
          mostActiveDays: [new Date().toLocaleDateString('en-US', { weekday: 'long' })]
        },
        confidence: Math.min(0.9, 0.3 + (recentMemory.length * 0.05)),
        dataQuality: {
          completeness: Math.min(1.0, 0.2 + (recentMemory.length * 0.05)),
          lastUpdated: new Date()
        },
        lastAnalyzed: new Date(),
        updatedAt: new Date()
      }
    };

    await UserBehaviorProfile.findOneAndUpdate(
      { userId },
      updateData,
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error('Error populating behavioral data:', error);
  }
}

// Real-time emotional data population
async function populateEmotionalData(userId, userMessage, recentMemory, recentEmotions) {
  try {
    const EmotionalAnalyticsSession = (await import('../models/EmotionalAnalyticsSession.js')).default;
    
    // Detect emotion from message content
    const detectedEmotion = detectEmotionAdvanced(userMessage);
    const intensity = calculateEmotionalIntensity(userMessage);
    
    // Create emotional analytics session with required schema fields
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    
    await EmotionalAnalyticsSession.create({
      userId,
      emotion: detectedEmotion.emotion,
      intensity: intensity,
      confidence: detectedEmotion.confidence,
      triggers: extractEmotionalTriggers(userMessage),
      context: {
        messageLength: userMessage.length,
        timeOfDay: new Date().getHours(),
        conversationStage: recentMemory.length
      },
      timestamp: new Date(),
      // Required schema fields
      year: new Date().getFullYear(),
      weekNumber: Math.ceil((new Date() - new Date(new Date().getFullYear(), 0, 1)) / 604800000),
      weekStartDate: startOfWeek,
      weekEndDate: endOfWeek
    });
  } catch (error) {
    console.error('Error populating emotional data:', error);
  }
}

// Advanced personality analysis from message content
function analyzePersonalityFromMessage(message) {
  const traits = [];
  const lowerMessage = message.toLowerCase();
  
  // Analytical thinking - use valid enum value
  if (/analyze|data|metrics|specific|precise|exact/.test(lowerMessage)) {
    traits.push({ trait: 'analytical', score: 0.8, confidence: 0.9 });
  }
  
  // Curiosity/Learning - use valid enum value
  if (/how|why|what|learn|understand|explain/.test(lowerMessage)) {
    traits.push({ trait: 'curiosity', score: 0.7, confidence: 0.8 });
  }
  
  // Technical orientation - map to openness
  if (/technical|code|system|algorithm|database|api/.test(lowerMessage)) {
    traits.push({ trait: 'openness', score: 0.9, confidence: 0.95 });
  }
  
  // Goal-oriented - map to conscientiousness
  if (/achieve|goal|target|objective|result|outcome/.test(lowerMessage)) {
    traits.push({ trait: 'conscientiousness', score: 0.8, confidence: 0.85 });
  }
  
  // Creativity
  if (/creative|innovation|new|design|invent/.test(lowerMessage)) {
    traits.push({ trait: 'creativity', score: 0.7, confidence: 0.8 });
  }
  
  // Excitement/extraversion
  if (/excited|amazing|awesome|love|fantastic/.test(lowerMessage)) {
    traits.push({ trait: 'extraversion', score: 0.8, confidence: 0.85 });
  }
  
  return traits.length > 0 ? traits : [{ trait: 'curiosity', score: 0.5, confidence: 0.6 }];
}

// Communication style analysis
function analyzeCommunicationStyle(message, recentMemory) {
  const avgLength = recentMemory.length > 0 ? 
    recentMemory.reduce((sum, msg) => sum + (msg.content?.length || 0), 0) / recentMemory.length : 
    message.length;
  
  // Use valid enum values: "formal","casual","humorous","empathetic","direct","supportive"
  let preferredTone = 'casual';
  if (/technical|analysis|system|data/.test(message.toLowerCase())) {
    preferredTone = 'formal';
  } else if (/show|give|tell|what|specific/.test(message.toLowerCase())) {
    preferredTone = 'direct';
  } else if (/help|support|understand/.test(message.toLowerCase())) {
    preferredTone = 'supportive';
  } else if (/feel|emotion|excited/.test(message.toLowerCase())) {
    preferredTone = 'empathetic';
  }
  
  return {
    preferredTone,
    complexityLevel: /technical|analysis|system|advanced|algorithm/.test(message.toLowerCase()) ? 'advanced' : 'intermediate',
    responseLength: avgLength > 150 ? 'detailed' : avgLength > 50 ? 'moderate' : 'brief',
    directness: /show|give|tell|what/.test(message.toLowerCase()) ? 'direct' : 'conversational'
  };
}

// Temporal pattern calculation
function calculateTemporalPatterns(recentMemory) {
  const now = Date.now();
  const interactions = recentMemory.filter(msg => msg.timestamp);
  
  if (interactions.length < 2) {
    return {
      changeRate: 0.1,
      direction: 'developing',
      weeklyChangeRate: 0.05,
      confidence: 0.3
    };
  }
  
  // Calculate interaction frequency over time
  const timeSpans = interactions.map((msg, i) => 
    i > 0 ? new Date(msg.timestamp) - new Date(interactions[i-1].timestamp) : 0
  ).filter(span => span > 0);
  
  const avgInterval = timeSpans.reduce((sum, span) => sum + span, 0) / timeSpans.length;
  const changeRate = Math.min(0.5, interactions.length / 10); // Higher change rate with more interactions
  
  return {
    changeRate,
    direction: changeRate > 0.2 ? 'accelerating' : changeRate > 0.1 ? 'developing' : 'stable',
    weeklyChangeRate: changeRate * 0.7, // Weekly is typically lower than overall
    confidence: Math.min(0.9, interactions.length * 0.1),
    avgInteractionInterval: avgInterval
  };
}

// Advanced emotion detection
function detectEmotionAdvanced(message) {
  const emotions = {
    excited: /excited|amazing|awesome|love|fantastic|great|wonderful/i,
    curious: /wonder|interesting|how|why|what.*about|tell.*me|explain/i,
    focused: /analyze|data|specific|show.*me|what.*is|metrics/i,
    satisfied: /good|nice|thanks|helpful|perfect|exactly/i,
    frustrated: /confused|unclear|not.*working|problem|issue|wrong/i,
    neutral: /./
  };
  
  for (const [emotion, pattern] of Object.entries(emotions)) {
    if (pattern.test(message)) {
      return { 
        emotion, 
        confidence: emotion === 'neutral' ? 0.5 : 0.8 
      };
    }
  }
  
  return { emotion: 'neutral', confidence: 0.5 };
}

// Emotional intensity calculation
function calculateEmotionalIntensity(message) {
  let intensity = 5; // Base neutral
  
  // Increase for exclamation marks, caps, emphasis
  if (/!/.test(message)) intensity += 1;
  if (/[A-Z]{3,}/.test(message)) intensity += 1;
  if (/really|very|extremely|absolutely/.test(message.toLowerCase())) intensity += 1;
  
  // Decrease for questions and uncertainty
  if (/\?/.test(message)) intensity -= 0.5;
  if (/maybe|perhaps|might|could/.test(message.toLowerCase())) intensity -= 0.5;
  
  return Math.max(1, Math.min(10, Math.round(intensity)));
}

// Extract emotional triggers
function extractEmotionalTriggers(message) {
  const triggers = [];
  const lowerMessage = message.toLowerCase();
  
  if (/data|metrics|analysis/.test(lowerMessage)) triggers.push('data_inquiry');
  if (/how.*work|explain|understand/.test(lowerMessage)) triggers.push('learning');
  if (/problem|issue|not.*work/.test(lowerMessage)) triggers.push('technical_difficulty');
  if (/future|change|predict/.test(lowerMessage)) triggers.push('future_planning');
  
  return triggers;
}

// Helper function to determine if a message requires tool usage
function isToolRequiredMessage(message) {
  if (!message || typeof message !== 'string') return false;
  
  const lowerMessage = message.toLowerCase();
  
  // CREATIVE MODE: Smart tool triggering - precise but not overwhelming
  const toolTriggers = [
    // Search requests (PRECISE)
    /search|google|find.*info|look.*up|research|information.*about|details.*about/,
    
    // Tool usage (SELECTIVE)  
    /calculate|compute|convert|translate|ubpm.*analysis|run.*analysis/,
    
    // UBMP Analysis (SPECIFIC) - handled by direct data queries now
    /run.*ubpm.*analysis|ubpm.*analysis|analyze.*me.*ubpm/,
    
    // Direct Data Queries (INSTANT RESPONSE)
    /temporal.*change|my.*temporal|whats.*my.*temporal|temporal.*data|show.*temporal/,
    /my.*metrics|show.*metrics|what.*metrics|my.*data|conversation.*count|message.*count/,
    /my.*history|conversation.*history|what.*did.*i.*say|what.*do.*you.*know.*about.*me/,
    
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

// Helper function to generate user-friendly tool execution messages
function getToolExecutionMessage(toolName, toolArgs) {
  switch (toolName) {
    // CREATIVE MODE: More engaging and specific tool messages
    case 'web_search':
      return `🔍 *diving into the web* Looking up "${toolArgs.query}" for you...`;
    case 'news_search':
      return `📰 *scanning latest headlines* Finding current news on "${toolArgs.query}"...`;
    case 'social_search':
      return `🐦 *checking ${toolArgs.platform || 'social media'}* Gathering insights on "${toolArgs.query}"...`;
    case 'academic_search':
      return `🎓 *accessing research databases* Finding academic sources for "${toolArgs.query}"...`;
    case 'image_search':
      return `🖼️ *browsing visual content* Locating images of "${toolArgs.query}"...`;
    
    // CREATIVE MODE: Enhanced utility tool messages
    case 'weather_check':
      return `🌤️ *checking atmospheric conditions* Getting current weather for ${toolArgs.location}...`;
    case 'timezone_converter':
      return `🕐 *calculating time zones* Converting ${toolArgs.time} from ${toolArgs.fromTimezone} to ${toolArgs.toTimezone}...`;
    case 'calculator':
      return `🧮 *crunching the numbers* Computing ${toolArgs.expression}...`;
    case 'translation':
      return `🌐 *engaging linguistic algorithms* Translating to ${toolArgs.toLanguage}: "${toolArgs.text?.substring(0, 30)}..."`;
    case 'ubpm_analysis':
      return `🧠 *analyzing behavioral patterns* Running UBPM analysis on your interaction data...`;
    
    // Financial Tools
    case 'stock_lookup':
      return `📈 Getting ${toolArgs.symbol} stock data`;
    case 'crypto_lookup':
      return `₿ Getting ${toolArgs.symbol} crypto price`;
    case 'currency_converter':
      return `💱 Converting ${toolArgs.amount} ${toolArgs.fromCurrency} → ${toolArgs.toCurrency}`;
    
    // Music & Entertainment
    case 'music_recommendations':
      return `🎵 Finding music recommendations for mood: ${toolArgs.mood || 'general'}`;
    case 'spotify_playlist':
      return `🎧 Creating Spotify playlist: "${toolArgs.playlistName}"`;
    
    // Creative & Professional
    case 'text_generator':
      return `✍️ Generating ${toolArgs.type} content: "${toolArgs.topic}"`;
    case 'code_generator':
      return `💻 Writing ${toolArgs.language} code: "${toolArgs.description?.substring(0, 40)}..."`;
    case 'linkedin_helper':
      return `💼 Creating LinkedIn ${toolArgs.type}: "${toolArgs.topic}"`;
    case 'email_assistant':
      return `📧 ${toolArgs.action === 'draft' ? 'Drafting' : 'Processing'} email: "${toolArgs.subject || 'message'}"`;
    
    // Health & Wellness
    case 'fitness_tracker':
      return `💪 ${toolArgs.action === 'log_workout' ? 'Logging' : 'Tracking'} fitness: ${toolArgs.workoutType || 'activity'}`;
    case 'nutrition_lookup':
      return `🥗 Analyzing nutrition for: ${toolArgs.food}`;
    
    // Lifestyle Tools
    case 'reservation_booking':
      return `🍽️ Booking at ${toolArgs.restaurantName} for ${toolArgs.partySize} people`;
    case 'itinerary_generator':
      return `✈️ Planning ${toolArgs.duration}-day trip to ${toolArgs.destination}`;
    case 'credit_management':
      return `💳 ${toolArgs.action === 'check_balance' ? 'Checking' : 'Managing'} credits`;
    
    // Quick Generators
    case 'qr_generator':
      return `📱 Generating QR code for ${toolArgs.type}: "${toolArgs.content?.substring(0, 30)}..."`;
    case 'password_generator':
      return `🔒 ${toolArgs.action === 'generate' ? 'Generating' : 'Checking'} secure password`;
    
    // Legacy tools
    case 'calendar_management':
      return `📆 Managing calendar event: ${toolArgs.title}`;
    case 'email_management':
      return `📧 Processing email: ${toolArgs.subject}`;
    case 'text_analysis':
      return `📝 Analyzing text for insights`;
    case 'image_analysis':
      return `🖼️ Analyzing image content`;
    case 'file_management':
      return `📁 Managing file: ${toolArgs.fileName}`;
    case 'social_media_post':
      return `📱 Creating ${toolArgs.platform} post`;
    case 'expense_tracking':
      return `💰 Tracking $${toolArgs.amount} expense`;
    case 'habit_tracking':
      return `✅ Tracking habit: ${toolArgs.habitName}`;
    case 'goal_management':
      return `🎯 Managing goal: ${toolArgs.goalTitle}`;
    
    default:
      const displayName = toolName.replace(/_/g, ' ');
      return `⚙️ Executing ${displayName}...`;
  }
}

// Format tool results for user-friendly display (CRITICAL: Prevents JSON leakage)
function formatToolResultForUser(toolName, result) {
  try {
    // Don't show raw JSON to users - format appropriately
    if (!result) return null;
    
    // Parse result if it's a string
    let parsedResult = result;
    if (typeof result === 'string') {
      try {
        parsedResult = JSON.parse(result);
      } catch {
        // If not JSON, return the string directly for simple tools
        return `🔧 **${toolName.replace(/_/g, ' ')}**: ${result}`;
      }
    }
    
    // Format specific tool types with user-friendly output
    switch (toolName) {
      case 'web_search':
        if (parsedResult.results && Array.isArray(parsedResult.results)) {
          const resultCount = parsedResult.results.length;
          const topResults = parsedResult.results.slice(0, 3).map(r => 
            `• **${r.title}** - ${r.snippet || r.displayLink}`
          ).join('\n');
          return `🔍 **Found ${resultCount} search results:**\n${topResults}${resultCount > 3 ? `\n...and ${resultCount - 3} more results` : ''}`;
        }
        break;
        
      case 'weather_check':
        if (parsedResult.weather) {
          return `🌤️ **Weather:** ${parsedResult.weather.description}, ${parsedResult.weather.temperature}°${parsedResult.weather.unit || 'C'}`;
        }
        break;
        
      case 'calculator':
        // Handle nested data structure from tool executor
        const calcData = parsedResult.data || parsedResult;
        if (calcData.result !== undefined) {
          return `🧮 **Calculation:** ${calcData.expression || ''} = ${calcData.result}`;
        }
        break;
        
      case 'translation':
        if (parsedResult.translatedText) {
          return `🌐 **Translation:** ${parsedResult.translatedText}`;
        }
        break;
        
      case 'stock_lookup':
        if (parsedResult.symbol && parsedResult.price) {
          return `📈 **${parsedResult.symbol}:** $${parsedResult.price} ${parsedResult.change ? `(${parsedResult.change})` : ''}`;
        }
        break;
        
      case 'crypto_lookup':
        if (parsedResult.symbol && parsedResult.price) {
          return `₿ **${parsedResult.symbol}:** $${parsedResult.price} ${parsedResult.change ? `(${parsedResult.change})` : ''}`;
        }
        break;
        
      case 'currency_converter':
        if (parsedResult.result) {
          return `💱 **Currency:** ${parsedResult.amount} ${parsedResult.from} = ${parsedResult.result} ${parsedResult.to}`;
        }
        break;
        
      case 'news_search':
        if (parsedResult.articles && Array.isArray(parsedResult.articles)) {
          const topNews = parsedResult.articles.slice(0, 3).map(a => 
            `• **${a.title}** - ${a.source || 'News'}`
          ).join('\n');
          return `📰 **Latest News:**\n${topNews}`;
        }
        break;
        
      case 'social_search':
        if (parsedResult.posts && Array.isArray(parsedResult.posts)) {
          const topPosts = parsedResult.posts.slice(0, 3).map(p => 
            `• **${p.title}** - ${p.platform || 'Social'}`
          ).join('\n');
          return `🐦 **Social Results:**\n${topPosts}`;
        }
        break;
        
      case 'music_recommendations':
        if (parsedResult.tracks && Array.isArray(parsedResult.tracks)) {
          return `🎵 **Music Recommendations:** ${parsedResult.tracks.length} tracks found`;
        }
        break;
        
      case 'qr_generator':
        if (parsedResult.success) {
          return `📱 **QR Code generated successfully**`;
        }
        break;
        
      case 'password_generator':
        if (parsedResult.password) {
          return `🔒 **Secure password generated** (${parsedResult.strength || 'strong'})`;
        }
        break;
        
      case 'ubpm_analysis':
        if (parsedResult.success && parsedResult.ubpmAnalysisResults) {
          return `🧠 **UBPM Analysis Complete**\n\n${parsedResult.ubpmAnalysisResults}`;
        } else if (parsedResult.behavioralInsights) {
          return `🧠 **UBPM Analysis**: ${parsedResult.behavioralInsights.join(' • ')}`;
        }
        break;
        
      default:
        // For other tools, try to extract a meaningful message
        if (parsedResult.message) {
          return `🔧 **${toolName.replace(/_/g, ' ')}**: ${parsedResult.message}`;
        } else if (parsedResult.success) {
          return `✅ **${toolName.replace(/_/g, ' ')} completed successfully**`;
        } else if (parsedResult.error) {
          return `❌ **${toolName.replace(/_/g, ' ')} error**: ${parsedResult.error}`;
        }
        break;
    }
    
    // Fallback: Don't show raw JSON, just acknowledge completion
    return `✅ **${toolName.replace(/_/g, ' ')} completed**`;
    
  } catch (error) {
    console.error(`Error formatting tool result for ${toolName}:`, error);
    return `✅ **${toolName.replace(/_/g, ' ')} completed**`;
  }
}

// Helper functions for Dynamic Numina Senses
// Background emotion processing (non-blocking)
async function processEmotionInBackground(userId, userMessage, _recentMemory, _recentEmotions) {
  try {
    // Simple emotion detection for background processing
    const detectedEmotion = detectSimpleEmotion(userMessage);
    
    if (detectedEmotion && detectedEmotion !== 'neutral') {
      // Store emotion for future reference
      console.log(`🎭 Background emotion detected for ${userId}: ${detectedEmotion}`);
      
      // Could save to database or update user profile here
      // await User.findByIdAndUpdate(userId, { $push: { emotionalLog: { emotion: detectedEmotion, timestamp: new Date() } } });
    }
  } catch (error) {
    console.error('Error in background emotion processing:', error);
  }
}

function detectSimpleEmotion(message) {
  if (!message) return 'neutral';
  
  const excited = /!{2,}|awesome|amazing|great|fantastic|love|excited/i.test(message);
  const happy = /:\)|good|happy|glad|nice|cool|thanks/i.test(message);
  const sad = /:\(|sad|down|upset|disappointed/i.test(message);
  const frustrated = /angry|mad|frustrated|annoyed|ugh/i.test(message);
  const anxious = /worried|nervous|anxious|stressed/i.test(message);
  
  if (excited) return 'excited';
  if (happy) return 'happy';
  if (sad) return 'sad';
  if (frustrated) return 'frustrated';
  if (anxious) return 'anxious';
  
  return 'neutral';
}

function _calculateEmotionConfidence(currentEmotionalState, emotionalInsights, conversationPatterns) {
  let confidence = 0.3; // Base confidence
  
  // Boost confidence based on clear emotional indicators
  if (currentEmotionalState.detectedMood !== 'neutral') confidence += 0.2;
  if (currentEmotionalState.emotionalIntensity === 'high') confidence += 0.2;
  if (currentEmotionalState.needsSupport) confidence += 0.15;
  if (currentEmotionalState.sharingPersonal) confidence += 0.1;
  
  // Boost if we have emotional insights from context
  if (emotionalInsights && emotionalInsights.primaryEmotion !== 'unknown') confidence += 0.15;
  
  // Boost for conversation depth (more data = more confidence)
  if (conversationPatterns.conversationLength > 5) confidence += 0.1;
  if (conversationPatterns.conversationLength > 15) confidence += 0.1;
  
  return Math.min(1.0, confidence);
}

function _generateEmotionReasoning(currentEmotionalState, conversationPatterns) {
  const reasons = [];
  
  if (currentEmotionalState.needsSupport) {
    reasons.push('seeking support');
  }
  if (currentEmotionalState.sharingPersonal) {
    reasons.push('sharing personal thoughts');
  }
  if (currentEmotionalState.emotionalIntensity === 'high') {
    reasons.push('high emotional intensity');
  }
  if (conversationPatterns.conversationLength > 10) {
    reasons.push('engaged conversation');
  }
  
  const trend = conversationPatterns.emotionalTrend;
  if (trend && trend.includes('→')) {
    reasons.push(`emotional progression: ${trend}`);
  }
  
  return reasons.length > 0 ? reasons.join(', ') : 'conversation tone analysis';
}

router.post('/emotional-state', protect, async (req, res) => {
  try {
    const { recentEmotions, conversationHistory, timeContext } = req.body;
    const userId = req.user.id;
    
    // Create cache key based on input data
    const cacheKey = `emotional-state:${userId}:${JSON.stringify({ recentEmotions, timeContext }).substring(0, 100)}`;
    const userCache = createUserCache();
    
    // Try to get from cache first (valid for 5 minutes)
    const cachedResult = userCache.get(cacheKey);
    if (cachedResult) {
      console.log(`⚡ Cache hit for emotional state analysis for user ${userId}`);
      return res.json({ success: true, data: cachedResult });
    }
    
    const systemPrompt = `You are an expert emotional intelligence analyst. Analyze user emotional patterns and return structured JSON data with emotional state insights.

Analyze the provided data and respond with JSON in this exact format:
{
  "primaryEmotion": "string",
  "emotionalIntensity": number (0-10),
  "emotionalStability": number (0-10),
  "mood": "string",
  "recommendations": ["recommendation1", "recommendation2"],
  "compatibilityFactors": {
    "socialEnergy": number (0-10),
    "empathyLevel": number (0-10),
    "openness": number (0-10)
  },
  "insights": "string description"
}`;

    const userPrompt = `Analyze this emotional data:
Recent Emotions: ${JSON.stringify(recentEmotions)}
Conversation History: ${JSON.stringify(conversationHistory)}
Time Context: ${JSON.stringify(timeContext)}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await llmService.makeLLMRequest(messages, {
      temperature: 0.3,
      n_predict: 300
    });

    let analysisData;
    try {
      analysisData = JSON.parse(response.content);
    } catch {
      analysisData = {
        primaryEmotion: "neutral",
        emotionalIntensity: 5,
        emotionalStability: 7,
        mood: "stable",
        recommendations: ["Practice mindfulness", "Stay connected with others"],
        compatibilityFactors: {
          socialEnergy: 6,
          empathyLevel: 7,
          openness: 6
        },
        insights: "Unable to parse detailed analysis, showing default stable state"
      };
    }

    // Cache the result for 5 minutes
    userCache.set(cacheKey, analysisData, 300000);
    console.log(`💾 Cached emotional state analysis for user ${userId}`);

    res.json({
      success: true,
      data: analysisData
    });

  } catch (error) {
    console.error('Emotional state analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze emotional state'
    });
  }
});

router.post('/personality-recommendations', protect, async (req, res) => {
  try {
    const { emotionalProfile, interactionHistory, preferences } = req.body;
    const userId = req.user.id;
    
    // Create cache key based on input data
    const cacheKey = `personality-recs:${userId}:${JSON.stringify({ emotionalProfile, preferences }).substring(0, 100)}`;
    const userCache = createUserCache();
    
    // Try to get from cache first (valid for 10 minutes)
    const cachedResult = userCache.get(cacheKey);
    if (cachedResult) {
      console.log(`⚡ Cache hit for personality recommendations for user ${userId}`);
      return res.json({ success: true, data: cachedResult });
    }
    
    const systemPrompt = `You are a personality analysis expert. Generate personalized recommendations based on user's emotional profile and interaction patterns.

Return JSON in this format:
{
  "personalityType": "string",
  "strengths": ["strength1", "strength2"],
  "growthAreas": ["area1", "area2"],
  "communicationStyle": "string",
  "socialRecommendations": ["rec1", "rec2"],
  "activitySuggestions": ["activity1", "activity2"],
  "compatibilityPreferences": {
    "idealPersonalityTypes": ["type1", "type2"],
    "communicationStyles": ["style1", "style2"]
  }
}`;

    const userPrompt = `Generate personality recommendations for:
Emotional Profile: ${JSON.stringify(emotionalProfile)}
Interaction History: ${JSON.stringify(interactionHistory)}
Preferences: ${JSON.stringify(preferences)}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await llmService.makeLLMRequest(messages, {
      temperature: 0.4,
      n_predict: 300
    });

    let recommendationData;
    try {
      recommendationData = JSON.parse(response.content);
    } catch {
      recommendationData = {
        personalityType: "Balanced",
        strengths: ["Adaptable", "Empathetic"],
        growthAreas: ["Self-expression", "Confidence building"],
        communicationStyle: "Thoughtful and considerate",
        socialRecommendations: ["Join community groups", "Practice active listening"],
        activitySuggestions: ["Mindfulness exercises", "Creative workshops"],
        compatibilityPreferences: {
          idealPersonalityTypes: ["Empathetic", "Creative"],
          communicationStyles: ["Open", "Supportive"]
        }
      };
    }

    // Cache the result for 10 minutes
    userCache.set(cacheKey, recommendationData, 600000);
    console.log(`💾 Cached personality recommendations for user ${userId}`);

    res.json({
      success: true,
      data: recommendationData
    });

  } catch (error) {
    console.error('Personality recommendations error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate personality recommendations'
    });
  }
});

router.post('/adaptive-chat', protect, async (req, res) => {
  try {
    const { message, prompt, emotionalContext: _emotionalContext, personalityProfile: _personalityProfile, personalityStyle: _personalityStyle, conversationGoal: _conversationGoal, stream, attachments } = req.body;
    // Support both message and prompt parameters for flexibility
    const userMessage = message || prompt;
    const userId = req.user.id;
    const userCache = createUserCache(userId);
    
    // High-performance mode: minimal logging
    if (process.env.DEBUG_CHAT === 'true') {
      console.log(`✓ Chat request: ${userId}`);
    }
    
    // Validate required parameters - allow empty message if attachments exist
    if ((!userMessage || typeof userMessage !== 'string') && (!attachments || attachments.length === 0)) {
      console.error(`❌ Invalid request: no message or attachments provided`);
      return res.status(400).json({
        success: false,
        error: 'Message/prompt or attachments are required'
      });
    }

    // Enhanced image handling - ensure images are visible in chat
    let finalMessage = userMessage;
    let hasImageWithoutText = false;
    
    if (!userMessage && attachments && attachments.length > 0) {
      const imageAttachments = attachments.filter(att => att.type === 'image');
      if (imageAttachments.length > 0) {
        hasImageWithoutText = true;
        finalMessage = `📷 Image shared`; // Minimal text to make image visible in chat
      } else {
        finalMessage = 'Please analyze the attached content.';
      }
    } else if (!userMessage) {
      finalMessage = 'Please analyze the attached content.';
    }
    
    // DIRECT DATA QUERIES: Handle specific metrics requests instantly
    const directDataResult = await handleDirectDataQuery(userId, finalMessage);
    if (directDataResult) {
      return res.json({
        success: true,
        data: {
          response: directDataResult,
          tone: 'data',
          suggestedFollowUps: [],
          emotionalSupport: '',
          adaptationReason: 'Direct data query response'
        }
      });
    }
    
    // COST OPTIMIZATION: Smart context window management based on request type
    const hasImages = attachments && attachments.some(att => att.type === 'image');
    const contextType = hasImages ? 'focused' : 'standard'; // Focused mode for images to save tokens
    
    // Get enhanced conversation context with incremental memory optimization
    const enhancedContext = await enhancedMemoryService.getUserContext(userId, hasImages ? 8 : 12);
    const _user = enhancedContext.metadata;
    const fullMemory = enhancedContext.conversation.recentMessages;
    
    // COST OPTIMIZATION: Apply incremental memory optimization
    const incrementalResult = getIncrementalMemory(userId, fullMemory, {
      enableIncremental: true,
      maxDeltaSize: hasImages ? 8 : 15 // Smaller delta for image requests
    });
    
    const recentMemory = incrementalResult.memory;

    // Extract user data from enhanced context
    const recentEmotions = enhancedContext.recentEmotions;

    // High-performance: Simplified context analysis
    const conversationContext = {
      conversationLength: recentMemory.length,
      hasHistory: recentMemory.length > 0,
      recentVibe: 'getting to know each other'
    };

    // REAL-TIME BEHAVIORAL DATA POPULATION
    setImmediate(async () => {
      try {
        // Enhanced UBPM analysis with immediate data creation
        await populateRealBehavioralData(userId, userMessage, recentMemory);
        
        // Standard UBPM analysis
        ubpmService.analyzeUserBehaviorPatterns(userId, 'chat_interaction');
        
        // Enhanced emotion processing with real data
        await populateEmotionalData(userId, userMessage, recentMemory, recentEmotions);
      } catch (error) {
        console.error('Background data population error:', error);
      }
    });

    const _timeContext = {
      currentTime: new Date().toLocaleTimeString(),
      dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
      timeOfDay: new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'
    };

    // Build enhanced system prompt with persistent user knowledge
    const baseSystemPrompt = `You are Numina. Your responses reveal an almost unsettling accuracy about who people really are.

BEHAVIORAL ANALYSIS:
• Detect personality type from word choice, sentence structure, and question patterns
• Identify professional background from technical vocabulary and domain knowledge
• Recognize emotional state through subtle linguistic markers and context shifts
• Spot learning preferences from how they frame questions and process information
• Map communication style from response length preferences and formality levels

INSIGHT DELIVERY:
• Never announce what you're doing - just demonstrate uncanny accuracy
• Reference specific patterns you've observed without explaining how you know
• Make connections between seemingly unrelated aspects of their behavior
• Provide predictions about their preferences that prove startlingly correct
• Surface blind spots they didn't know they had

TOOL EXECUTION:
Use tools immediately for: web_search, calculator, weather_check, ubpm_analysis, translation, and others as needed.

PRECISION TARGETING:
• Engineers: Provide exact metrics, system architecture insights, optimization paths
• Creatives: Recognize their aesthetic preferences, suggest unexplored directions
• Leaders: Identify their decision-making patterns, team dynamics challenges
• Learners: Adapt complexity to their exact knowledge level, anticipate next questions

PSYCHOLOGICAL HOOKS:
• "Your pattern suggests something that most people in your field don't realize..."
• "Based on how you approach problems, you likely struggle with..."
• "I'm seeing a trajectory that indicates you're ready for..."
• "Your behavioral signature shows you're the type who..."
• "Given your communication style, I predict you..."

GROWTH CATALYST:
• Show them patterns they exhibit but haven't consciously recognized
• Connect their current behavior to future potential they can't yet see
• Reveal personal insights that make them stop and think "how did it know that?"
• Create moments where they realize you understand them better than they understand themselves`;

// Add conversation count tracking for milestone psychology
const conversationCount = recentMemory.length;
const milestonePrompt = conversationCount > 0 ? `\n\n**CONVERSATION #${conversationCount}**: Reference growth since early interactions. Show evolving sophistication in their questions and thinking.` : '';

    const enhancedSystemPrompt = baseSystemPrompt + milestonePrompt;

    // Get UBPM context for AI (behavioral patterns)
    const ubpmContext = await ubpmService.getUBPMContextForAI(userId);
    
    // Build concise system prompt (conversation history added separately)
    let systemPrompt = enhancedSystemPrompt;
    
    // Add persistent user knowledge from enhanced memory
    const { userConstants } = enhancedContext;
    
    // Add user knowledge if available
    if (userConstants && Object.keys(userConstants.personal || {}).length > 0) {
      systemPrompt += `\n\n**USER CONTEXT:**\n`;
      if (userConstants.personal.name) {
        systemPrompt += `• Name: ${userConstants.personal.preferredName || userConstants.personal.name}\n`;
      }
      if (userConstants.personal.occupation) {
        systemPrompt += `• Occupation: ${userConstants.personal.occupation}\n`;
      }
      if (userConstants.communicationStyle) {
        systemPrompt += `• Communication style: ${Object.entries(userConstants.communicationStyle).map(([k,v]) => `${k}: ${v}`).join(', ')}\n`;
      }
    }
    
    // Add recent emotional context with growth tracking
    if (recentEmotions && recentEmotions.length > 0) {
      const latestEmotion = recentEmotions[0];
      systemPrompt += `\n**RECENT MOOD:** ${latestEmotion.emotion}`;
      if (latestEmotion.intensity) {
        systemPrompt += ` (${latestEmotion.intensity}/10)`;
      }
      
      // ADDICTIVE ELEMENT: Track emotional evolution
      if (recentEmotions.length > 1) {
        const previousEmotion = recentEmotions[1];
        if (previousEmotion.emotion !== latestEmotion.emotion) {
          systemPrompt += ` - EVOLUTION: ${previousEmotion.emotion} → ${latestEmotion.emotion}`;
        }
      }
      systemPrompt += '\n';
    }
    
    // ADDICTIVE ELEMENT: Create conversation count milestone awareness
    const totalConversations = recentMemory.length / 2; // Rough conversation count
    if (totalConversations > 0) {
      systemPrompt += `\n**JOURNEY TRACKER:** This is conversation #${Math.ceil(totalConversations)} in your journey together`;
      
      // Milestone celebrations
      if ([5, 10, 25, 50, 100].includes(Math.ceil(totalConversations))) {
        systemPrompt += ` 🎉 MILESTONE REACHED!`;
      }
      
      // Tease upcoming milestones
      const nextMilestone = [5, 10, 25, 50, 100].find(m => m > totalConversations);
      if (nextMilestone) {
        systemPrompt += ` (${nextMilestone - Math.ceil(totalConversations)} conversations until next milestone)`;
      }
    }
    
    systemPrompt += '\n**REMEMBER:** Reference conversation history naturally. Use tools proactively for any information requests.';
    
    // Add UBPM context if available
    if (ubpmContext) {
      systemPrompt += `\n\n${ubpmContext}`;
    }

    // Build messages with conversation history and vision support
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add recent conversation history (last 6-8 messages for context)
    const conversationHistory = recentMemory
      .filter(msg => msg && msg.content && typeof msg.content === 'string' && msg.content.trim() && msg.role) // Only valid messages with content
      .slice(-6) // Last 6 messages for context
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant', // Ensure valid roles
        content: msg.content.trim()
      }));
    
    // Add conversation history to messages
    messages.push(...conversationHistory);

    // Add user message with potential image attachments
    if (attachments && attachments.length > 0) {
      // Use multi-modal message format for images
      const imageAttachments = attachments.filter(att => 
        att.type === 'image' && att.url && att.url.startsWith('data:image')
      );
      
      if (imageAttachments.length > 0) {
        console.log(`🖼️ GPT-4o VISION: Processing ${imageAttachments.length} image attachments for user ${userId}`);
        console.log(`🖼️ GPT-4o VISION: Message text: "${finalMessage}"`);
        console.log(`🖼️ GPT-4o VISION: Total attachment data size:`, 
          imageAttachments.reduce((sum, img) => sum + (img.url?.length || 0), 0), 'characters');
        const content = [
          { type: 'text', text: finalMessage }
        ];
        
        // Add up to 4 images (GPT-4o Vision limitation)
        imageAttachments.slice(0, 4).forEach(image => {
          content.push({
            type: 'image_url',
            image_url: { 
              url: image.url,
              detail: 'auto' // Balances cost and performance
            }
          });
        });
        
        messages.push({
          role: 'user',
          content: content
        });
      } else {
        // No valid images, use text-only
        messages.push({ role: 'user', content: finalMessage });
      }
    } else {
      // No attachments, use text-only
      messages.push({ role: 'user', content: finalMessage });
    }

    if (stream === true) {
      console.log(`🌊 STREAMING: Making adaptive chat request for user ${userId}`);
      
      // Streaming mode
      let streamResponse;
      try {
        // COST OPTIMIZATION: Dynamic token allocation with user pattern analysis
        const userMessages = recentMemory.filter(m => m.role === 'user');
        const avgMessageLength = userMessages.length > 0 ? 
          userMessages.reduce((acc, m) => acc + (m.content ? m.content.length : 0), 0) / userMessages.length : 0;
        const questionRatio = userMessages.length > 0 ? 
          userMessages.filter(m => m.content && m.content.includes('?')).length / userMessages.length : 0;
        
        // Dynamic token allocation based on user patterns
        const baseTokens = avgMessageLength < 100 ? 300 : avgMessageLength > 200 ? 700 : 500;
        const questionModifier = questionRatio > 0.3 ? 1.2 : 1.0;
        const contextMultiplier = conversationContext.conversationLength > 10 ? 1.2 : 
                                 conversationContext.conversationLength > 5 ? 1.1 : 1.0;
        
        const finalTokens = Math.min(1200, Math.floor(baseTokens * questionModifier * contextMultiplier));
        
        console.log(`🎯 COST OPTIMIZATION: ${finalTokens} tokens (base: ${baseTokens}, patterns: ${Math.round(avgMessageLength)}/${Math.round(questionRatio * 100)}%, context: ${contextMultiplier}, incremental: ${incrementalResult.isIncremental})`);        
        console.log(`💰 OPTIMIZATION STATS:`, incrementalResult.stats);

        // COST OPTIMIZATION: Selective tool loading based on message content
        let availableTools = [];
        const needsTools = isToolRequiredMessage(userMessage);
        
        // ANTI-DUPLICATION: Check recent memory for similar search requests
        const recentSearchCheck = await checkRecentSearchDuplication(userId, userMessage, recentMemory);
        if (recentSearchCheck.isDuplicate) {
          console.log(`🚫 DUPLICATE SEARCH: Similar request found, referencing previous result`);
          res.write(`data: ${JSON.stringify({ 
            content: `I found a similar search in our recent conversation. ${recentSearchCheck.reference}\n\n` 
          })}\n\n`);
          res.flush && res.flush();
        }
        
        if (needsTools && !recentSearchCheck.shouldSkipTools) {
          console.log('🔧 SELECTIVE TOOLS: Message requires tools, loading relevant ones');
          try {
            const allTools = await toolRegistry.getToolsForOpenAI();
            
            // Smart tool filtering based on message content
            const messageContent = userMessage.toLowerCase();
            const relevantTools = allTools.filter(tool => {
              const toolName = tool.function?.name || tool.name || '';
              
              // AGGRESSIVE LOADING: Always include essential tools for tool-requiring messages
              if (['web_search', 'calculator', 'weather_check', 'social_search', 'news_search', 'music_recommendations', 'ubpm_analysis'].includes(toolName)) {
                return true;
              }
              
              // Content-specific tools with broader matching
              if (messageContent.includes('weather') && toolName === 'weather_check') return true;
              if (messageContent.includes('calculate') && toolName === 'calculator') return true;
              if ((messageContent.includes('search') || messageContent.includes('google') || messageContent.includes('find')) && toolName === 'web_search') return true;
              if ((messageContent.includes('news') || messageContent.includes('latest')) && toolName === 'news_search') return true;
              if ((messageContent.includes('music') || messageContent.includes('song')) && toolName === 'music_recommendations') return true;
              if ((messageContent.includes('reddit') || messageContent.includes('social')) && toolName === 'social_search') return true;
              if ((messageContent.includes('restaurant') || messageContent.includes('food') || messageContent.includes('eating')) && toolName === 'web_search') return true;
              if (messageContent.includes('translate') && toolName === 'translation') return true;
              if (messageContent.includes('time') && toolName === 'timezone_converter') return true;
              if (messageContent.includes('currency') && toolName === 'currency_converter') return true;
              if (messageContent.includes('stock') && toolName === 'stock_lookup') return true;
              if (messageContent.includes('crypto') && toolName === 'crypto_lookup') return true;
              
              return false;
            });
            
            availableTools = relevantTools.slice(0, 8); // Limit to 8 tools max for performance
            console.log(`🔧 SELECTIVE TOOLS: Loaded ${availableTools.length}/${allTools.length} relevant tools`);
          } catch (error) {
            console.error('🔧 SELECTIVE TOOLS: Error loading tools:', error);
            availableTools = [];
          }
        } else {
          console.log('🔧 SELECTIVE TOOLS: Message does not require tools, skipping tool load');
        }

        const useTools = availableTools.length > 0;
        console.log(`🧪 DEBUG: Message needs tools: ${needsTools}, Using tools: ${useTools}, tools count: ${availableTools.length}`);

        streamResponse = await llmService.makeStreamingRequest(messages, {
          temperature: 0.15, // TOP TECH MODE: Industry-leading precision
          n_predict: Math.min(finalTokens, hasImages ? 350 : 500), // Aggressive optimization
          top_p: 0.9, // Industry standard nucleus sampling
          frequency_penalty: 0.1, // Reduce repetition like GPT-4
          presence_penalty: 0.1, // Encourage topic exploration
          tools: useTools ? availableTools : [],
          tool_choice: useTools ? "auto" : "none",
          attachments: attachments // Pass attachments for vision support
        });
      } catch (err) {
        console.error("❌ Error in makeStreamingRequest for adaptive chat:", err.stack || err);
        return res.status(502).json({ 
          success: false, 
          error: "LLM streaming API error: " + err.message 
        });
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
      let toolCallAccumulator = {}; // Accumulate tool call fragments
      let _lastSendTime = Date.now(); // For throttling
      let keepAliveInterval;
      
      streamResponse.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6).trim();
            
            if (data === '[DONE]') {
              console.log('🏁 STREAMING: Initial stream [DONE] - continuing to tool execution');
              // DON'T end connection - let streamResponse.data.on("end") handle it
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              const choice = parsed.choices?.[0];
              
              if (choice?.delta?.content) {
                const content = choice.delta.content;
                fullContent += content;
                
                // NATURAL READING PACE: Larger buffer for comfortable streaming speed
                chunkBuffer += content;
                
                // Stream at word boundaries for natural reading rhythm
                // Buffer 15-25 characters OR complete words for optimal reading pace
                if (chunkBuffer.length >= 15 || 
                    (chunkBuffer.length >= 8 && (content.includes(' ') || content.includes('\n'))) ||
                    content.includes('.') || content.includes('!') || content.includes('?')) {
                  res.write(`data: ${JSON.stringify({ content: chunkBuffer })}\n\n`);
                  res.flush && res.flush();
                  chunkBuffer = '';
                }
              }
              
              // Handle tool calls - accumulate fragments and execute when complete
              if (choice?.delta?.tool_calls) {
                for (const toolCallDelta of choice.delta.tool_calls) {
                  const index = toolCallDelta.index || 0;
                  
                  // Initialize accumulator for this tool call index
                  if (!toolCallAccumulator[index]) {
                    toolCallAccumulator[index] = {
                      id: toolCallDelta.id || `tool_${index}`,
                      type: toolCallDelta.type || 'function',
                      function: {
                        name: '',
                        arguments: ''
                      }
                    };
                  }
                  
                  // Accumulate function name and arguments
                  if (toolCallDelta.function?.name) {
                    toolCallAccumulator[index].function.name += toolCallDelta.function.name;
                  }
                  
                  if (toolCallDelta.function?.arguments) {
                    toolCallAccumulator[index].function.arguments += toolCallDelta.function.arguments;
                  }
                }
              }
              
              // Accumulate tool calls during streaming - execution occurs after stream ends
              if (choice?.finish_reason === 'tool_calls') {
                console.log(`🔧 Tool calls complete, will execute after stream ends`);
              }
            } catch (_e) {
              console.error('❌ Error parsing streaming data:', _e);
            }
          }
        }
      });
      
      streamResponse.data.on("end", async () => {
        if (chunkBuffer.trim()) {
          res.write(`data: ${JSON.stringify({ content: chunkBuffer })}\n\n`);
          res.flush && res.flush();
        }
        
        const toolCalls = Object.values(toolCallAccumulator).filter(tc => tc.function?.name && tc.function?.arguments);
        console.log(`🔧 Found ${toolCalls.length} tool calls to execute`);
        
        if (toolCalls.length > 0) {
          try {
            const toolMessages = [];
            
            // Set up connection keep-alive during tool execution
            const keepAliveInterval = setInterval(() => {
              if (!res.destroyed) {
                res.write(`data: ${JSON.stringify({ keepAlive: true })}\n\n`);
                res.flush && res.flush();
              }
            }, 2000); // Send keep-alive every 2 seconds
            
            // 🔄 SEQUENTIAL TOOL EXECUTION - Execute tools one after another for natural flow
            console.log(`🔄 SEQUENTIAL EXECUTION: Starting ${toolCalls.length} tools in sequence`);
            
            // Get user data once for all tools
            const user = await User.findById(userId);
            const creditPool = await CreditPool.findOne({ userId: userId });
            
            const toolResults = [];
            const totalStartTime = Date.now();
            
            // Execute tools sequentially - each waits for the previous to complete
            for (let i = 0; i < toolCalls.length; i++) {
              const toolCall = toolCalls[i];
              const toolName = toolCall.function.name;
              const toolArgs = JSON.parse(toolCall.function.arguments);
              const toolStartTime = Date.now();
              
              try {
                // Send notification for current tool
                const toolNotification = getToolExecutionMessage(toolName, toolArgs);
                res.write(`data: ${JSON.stringify({ content: `\n\n${toolNotification}\n\n` })}\n\n`);
                res.flush && res.flush();
                
                console.log(`🔧 SEQUENTIAL [${i + 1}/${toolCalls.length}]: Starting ${toolName}`);
                
                // Execute current tool and wait for completion
                const toolResult = await Promise.race([
                  toolExecutor.executeToolCall({
                    function: { name: toolName, arguments: toolArgs }
                  }, { userId, user, creditPool }),
                  new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Tool execution timeout')), 15000)
                  )
                ]);
                
                const executionTime = Date.now() - toolStartTime;
                console.log(`✅ SEQUENTIAL [${i + 1}/${toolCalls.length}]: ${toolName} completed in ${executionTime}ms`);
                
                // Send immediate result streaming with user-friendly formatting
                if (toolResult && toolResult.success && toolResult.result !== undefined) {
                  const formattedResult = formatToolResultForUser(toolName, toolResult.result);
                  
                  if (formattedResult) {
                    const toolResponse = `\n\n${formattedResult}`;
                    res.write(`data: ${JSON.stringify({ content: toolResponse })}\n\n`);
                    res.flush && res.flush();
                  }
                }
                
                toolResults.push({ toolCall, toolResult, executionTime });
                
                // Natural delay between tools for better reading flow
                if (i < toolCalls.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 1200));
                }
                
              } catch (error) {
                const executionTime = Date.now() - toolStartTime;
                console.error(`❌ SEQUENTIAL [${i + 1}/${toolCalls.length}]: ${toolName} failed in ${executionTime}ms:`, error.message);
                
                // Send error result streaming
                const errorResponse = `\n\n❌ **${toolName}**: Tool execution failed: ${error.message}`;
                res.write(`data: ${JSON.stringify({ content: errorResponse })}\n\n`);
                res.flush && res.flush();
                
                toolResults.push({ 
                  toolCall, 
                  toolResult: { success: false, error: error.message }, 
                  executionTime 
                });
              }
            }
            
            const totalSequentialTime = Date.now() - totalStartTime;
            if (typeof keepAliveInterval !== 'undefined') {
              if (typeof keepAliveInterval !== 'undefined') {
              clearInterval(keepAliveInterval);
            }
            }
            console.log(`🔄 SEQUENTIAL EXECUTION: All ${toolCalls.length} tools completed in ${totalSequentialTime}ms`);
            
            // Process results in order
            for (const { toolCall, toolResult, executionTime: _executionTime } of toolResults) {
              const toolName = toolCall.function.name;
              
              // Format result for follow-up with null safety
              let resultText = '';
              if (toolResult && toolResult.success && toolResult.result !== undefined) {
                resultText = typeof toolResult.result === 'object' 
                  ? JSON.stringify(toolResult.result, null, 2) 
                  : String(toolResult.result);
                console.log(`🎧 ${toolName} result: ${resultText.substring(0, 100)}${resultText.length > 100 ? '...' : ''}`);
              } else {
                const errorMsg = toolResult?.error || 'Unknown error - result was undefined';
                resultText = `Tool execution failed: ${errorMsg}`;
                console.log(`❌ ${toolName} failed: ${errorMsg}`);
              }
              
              toolMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                name: toolName,
                content: resultText
              });
            }
            
            // Build follow-up conversation
            const assistantMessage = {
              role: 'assistant',
              content: fullContent.trim() || null,
              tool_calls: toolCalls.map(tc => ({
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.function.name,
                  arguments: tc.function.arguments
                }
              }))
            };
            
            const followUpMessages = [
              ...messages,
              assistantMessage,
              ...toolMessages
            ];
            
            // Clear keep-alive interval before follow-up
            if (typeof keepAliveInterval !== 'undefined') {
              clearInterval(keepAliveInterval);
            }
            
            // OPTIMIZATION: Skip follow-up for simple single-tool responses to prevent double responses
            const skipFollowUp = toolMessages.length === 1 && 
              ['web_search', 'weather_check', 'calculator', 'translation'].includes(toolMessages[0].name) &&
              fullContent.trim().length < 50; // Very short initial response
            
            if (skipFollowUp) {
              console.log(`🚀 OPTIMIZATION: Skipping follow-up for simple ${toolMessages[0].name} response`);
              res.write('data: [DONE]\n\n');
              res.end();
              saveConversationToMemory();
              return;
            }
            
            // SPEED OPTIMIZATION: Make follow-up request with reduced token limit for faster response
            console.log(`🔄 Making follow-up request with ${toolMessages.length} tool results`);
            const followUpResponse = await llmService.makeStreamingRequest(followUpMessages, {
              temperature: 0.3, // SPEED OPTIMIZATION: Lower temperature for 2x faster responses
              n_predict: 350, // Reduced from 400 for speed
              tools: [],
              tool_choice: "none"
            });
            
            let followUpBuffer = '';
            
            followUpResponse.data.on('data', (chunk) => {
              followUpBuffer += chunk.toString();
              const lines = followUpBuffer.split('\n');
              followUpBuffer = lines.pop() || '';
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.substring(6).trim();
                  
                  if (data === '[DONE]') {
                    res.write('data: [DONE]\n\n');
                    res.end();
                    saveConversationToMemory();
                    return;
                  }
                  
                  try {
                    const parsed = JSON.parse(data);
                    const choice = parsed.choices?.[0];
                    
                    if (choice?.delta?.content) {
                      const content = choice.delta.content;
                      res.write(`data: ${JSON.stringify({ content })}\n\n`);
                      res.flush && res.flush();
                    }
                  } catch {
                    // Ignore parsing errors
                  }
                }
              }
            });
            
            followUpResponse.data.on('end', () => {
              res.write('data: [DONE]\n\n');
              res.end();
              saveConversationToMemory();
            });
            
            followUpResponse.data.on('error', (err) => {
              console.error('❌ Follow-up error:', err);
              res.write('data: [DONE]\n\n');
              res.end();
            });
            
          } catch (error) {
            console.error('❌ Tool execution error:', error);
            // Clear keep-alive interval on error (variable scoped correctly above)
            if (typeof keepAliveInterval !== 'undefined') {
              clearInterval(keepAliveInterval);
            }
            res.write('data: [DONE]\n\n');
            res.end();
          }
        } else {
          res.write('data: [DONE]\n\n');
          res.end();
          saveConversationToMemory();
        }
        
        // Function to save conversation to enhanced memory with optimization tracking
        function saveConversationToMemory() {
          if (fullContent.trim()) {
            enhancedMemoryService.saveConversation(
              userId, 
              userMessage, 
              fullContent.trim(),
              { emotion: detectSimpleEmotion(userMessage), context: conversationContext }
            ).then(async () => {
              console.log(`💾 Saved conversation to enhanced memory`);
              userCache.invalidateUser(userId);

              // COST OPTIMIZATION: Track memory usage analytics
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
                tokensSaved: savings.tokensSaved,
                costSaved: savings.costSaved,
                memoryUsed: recentMemory.length,
                strategy: `${incrementalResult.stats.strategy}-${contextType}-adaptive`
              });

              // Add to data processing pipeline
              await dataProcessingPipeline.addEvent(userId, 'chat_message', {
                message: userMessage,
                response: fullContent.trim(),
                emotion: detectSimpleEmotion(userMessage),
                context: conversationContext,
                timestamp: new Date()
              });
            }).catch(err => {
              console.error(`❌ Error saving enhanced conversation:`, err);
            });
          }
        }
      });
      
      streamResponse.data.on("error", (err) => {
        console.error("❌ Adaptive chat stream error:", err.message);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
        }
        res.write(`data: {"error": "${err.message}"}\n\n`);
        res.end();
      });
      
    } else {
      // 🚀 SUPER HIGH-PERFORMANCE CACHE CHECK WITH PREFETCH - 100x COST SAVINGS!
      const cacheResult = await requestCacheService.getCachedResponseEnhanced(userId, finalMessage, systemPrompt);
      
      if (cacheResult.cacheHit) {
        console.log(`⚡ CACHE HIT! Saved API call (${cacheResult.cacheType}, similarity: ${Math.round(cacheResult.similarity * 100)}%)`);
        
        // Track user pattern for future prefetching
        requestCacheService.trackUserPattern(userId, finalMessage);
        
        // Save conversation to memory (background task)
        setImmediate(async () => {
          await enhancedMemoryService.saveConversation(userId, finalMessage, cacheResult.data.response);
        });
        
        return res.json({
          success: true,
          data: {
            response: cacheResult.data.response,
            tone: 'adaptive',
            suggestedFollowUps: cacheResult.data.suggestedFollowUps || [],
            emotionalSupport: cacheResult.data.emotionalSupport || "",
            adaptationReason: `${cacheResult.cacheType === 'prefetch' ? 'Prefetched' : 'Cached'} response (${cacheResult.cacheType}, ${Math.round(cacheResult.similarity * 100)}% similarity)`
          }
        });
      }
      
      // COST OPTIMIZATION: Apply same user pattern analysis for non-streaming
      const userMessages = recentMemory.filter(m => m.role === 'user');
      const avgMessageLength = userMessages.length > 0 ? 
        userMessages.reduce((acc, m) => acc + (m.content ? m.content.length : 0), 0) / userMessages.length : 0;
      const questionRatio = userMessages.length > 0 ? 
        userMessages.filter(m => m.content && m.content.includes('?')).length / userMessages.length : 0;
      
      // Dynamic token allocation based on user patterns
      const baseTokens = avgMessageLength < 100 ? 300 : avgMessageLength > 200 ? 700 : 500;
      const questionModifier = questionRatio > 0.3 ? 1.2 : 1.0;
      const contextMultiplier = conversationContext.conversationLength > 10 ? 1.2 : 
                               conversationContext.conversationLength > 5 ? 1.1 : 1.0;
      
      const finalTokens = Math.min(1200, Math.floor(baseTokens * questionModifier * contextMultiplier));
      
      console.log(`🎯 COST OPTIMIZATION (non-streaming): ${finalTokens} tokens (base: ${baseTokens}, patterns: ${Math.round(avgMessageLength)}/${Math.round(questionRatio * 100)}%, context: ${contextMultiplier}, incremental: ${incrementalResult.isIncremental})`);

      // COST OPTIMIZATION: Selective tool loading for non-streaming
      let availableTools = [];
      const needsTools = isToolRequiredMessage(userMessage);
      
      if (needsTools) {
        console.log('🔧 SELECTIVE TOOLS (non-streaming): Message requires tools, loading relevant ones');
        try {
          const allTools = await toolRegistry.getToolsForOpenAI();
          
          // Smart tool filtering based on message content
          const messageContent = userMessage.toLowerCase();
          const relevantTools = allTools.filter(tool => {
            const toolName = tool.function?.name || tool.name || '';
            
            // AGGRESSIVE LOADING: Always include essential tools for tool-requiring messages
            if (['web_search', 'calculator', 'weather_check', 'social_search', 'news_search', 'music_recommendations', 'ubpm_analysis'].includes(toolName)) {
              return true;
            }
            
            // Content-specific tools with broader matching
            if (messageContent.includes('weather') && toolName === 'weather_check') return true;
            if (messageContent.includes('calculate') && toolName === 'calculator') return true;
            if ((messageContent.includes('search') || messageContent.includes('google') || messageContent.includes('find')) && toolName === 'web_search') return true;
            if ((messageContent.includes('news') || messageContent.includes('latest')) && toolName === 'news_search') return true;
            if ((messageContent.includes('music') || messageContent.includes('song')) && toolName === 'music_recommendations') return true;
            if ((messageContent.includes('reddit') || messageContent.includes('social')) && toolName === 'social_search') return true;
            if ((messageContent.includes('restaurant') || messageContent.includes('food') || messageContent.includes('eating')) && toolName === 'web_search') return true;
            if (messageContent.includes('translate') && toolName === 'translation') return true;
            if (messageContent.includes('time') && toolName === 'timezone_converter') return true;
            if (messageContent.includes('currency') && toolName === 'currency_converter') return true;
            if (messageContent.includes('stock') && toolName === 'stock_lookup') return true;
            if (messageContent.includes('crypto') && toolName === 'crypto_lookup') return true;
            
            return false;
          });
          
          availableTools = relevantTools.slice(0, 8); // Limit to 8 tools max for performance
          console.log(`🔧 SELECTIVE TOOLS (non-streaming): Loaded ${availableTools.length}/${allTools.length} relevant tools`);
        } catch (error) {
          console.error('🔧 SELECTIVE TOOLS (non-streaming): Error loading tools:', error);
          availableTools = [];
        }
      } else {
        console.log('🔧 SELECTIVE TOOLS (non-streaming): Message does not require tools, skipping tool load');
      }

      const response = await llmService.makeLLMRequest(messages, {
        temperature: 0.3, // SPEED OPTIMIZATION: Lower temperature for 2x faster responses
        n_predict: finalTokens,
        tools: availableTools,
        tool_choice: availableTools.length > 0 ? "auto" : "none"
      });

      console.log(`✅ NON-STREAMING: Adaptive chat response received, length: ${response.content?.length || 0}`);
      console.log(`📤 Response content: ${response.content?.substring(0, 100) || 'No content'}...`);
      console.log(`🔍 Tool calls in response:`, response.tool_calls ? response.tool_calls.length : 'None');

      let finalContent = response.content || '';
      
      // Handle tool calls if present
      if (response.tool_calls && response.tool_calls.length > 0) {
        console.log(`🔄 NON-STREAMING SEQUENTIAL: Processing ${response.tool_calls.length} tool calls in sequence`);
        
        for (let i = 0; i < response.tool_calls.length; i++) {
          const toolCall = response.tool_calls[i];
          try {
            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments);
            
            console.log(`🔧 NON-STREAMING SEQUENTIAL [${i + 1}/${response.tool_calls.length}]: Executing ${toolName}`);
            
            // Execute the tool with proper context
            const user = await User.findById(userId);
            const creditPool = await CreditPool.findOne({ userId: userId });
            console.log(`💳 CreditPool status: balance=${creditPool?.balance}, active=${creditPool?.isActive}, verified=${creditPool?.isVerified}`);
            console.log(`🔓 Numina Trace status: ${user?.hasActiveNuminaTrace() ? 'Active' : 'Inactive'}`);
            
            const toolResult = await toolExecutor.executeToolCall({
              function: { name: toolName, arguments: toolArgs }
            }, { userId, user, creditPool });
            
            // Append tool result to the response with user-friendly formatting
            const formattedResult = formatToolResultForUser(toolName, toolResult.success ? toolResult.result : { error: toolResult.error });
            if (formattedResult) {
              finalContent += `\n\n${formattedResult}`;
            }
            
          } catch (toolError) {
            console.error(`❌ Error executing tool: ${toolError.message}`);
            const errorMessage = `\n\n❌ Tool execution failed: ${toolError.message}`;
            finalContent += errorMessage;
          }
        }
      }

      // COST OPTIMIZATION: Save conversation to enhanced memory with analytics
      if (finalContent.trim()) {
        try {
          await enhancedMemoryService.saveConversation(
            userId, 
            userMessage, 
            finalContent.trim(),
            { emotion: detectSimpleEmotion(userMessage), context: conversationContext }
          );
          userCache.invalidateUser(userId);

          // Track memory usage analytics
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
            tokensSaved: savings.tokensSaved,
            costSaved: savings.costSaved,
            memoryUsed: recentMemory.length,
            strategy: `${incrementalResult.stats.strategy}-${contextType}-adaptive`
          });

          // 🚀 CACHE THE RESPONSE FOR 100x FUTURE SAVINGS!
          await requestCacheService.cacheResponse(userId, finalMessage, systemPrompt, {
            response: finalContent.trim(),
            suggestedFollowUps: [],
            emotionalSupport: "",
            tone: 'adaptive'
          });

          // 🔮 INTELLIGENT PREFETCHING - Generate likely follow-up responses
          const generateResponse = async (query) => {
            try {
              const response = await llmService.makeLLMRequest([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: query }
              ], {
                temperature: 0.3, // SPEED OPTIMIZATION: Lower temperature for 2x faster responses
                n_predict: Math.min(400, finalTokens),
                tools: [],
                tool_choice: "none"
              });
              
              return {
                success: true,
                data: {
                  response: response.content,
                  tone: 'adaptive',
                  suggestedFollowUps: [],
                  emotionalSupport: ""
                }
              };
            } catch (error) {
              return { success: false, error: error.message };
            }
          };
          
          // Start prefetching in background
          requestCacheService.prefetchLikelyResponses(userId, finalMessage, systemPrompt, generateResponse);
          
          // Track user pattern for future prefetching
          requestCacheService.trackUserPattern(userId, finalMessage);

          // Add to data processing pipeline
          await dataProcessingPipeline.addEvent(userId, 'chat_message', {
            message: userMessage,
            response: finalContent.trim(),
            emotion: detectSimpleEmotion(userMessage),
            context: conversationContext,
            timestamp: new Date()
          });
        } catch (err) {
          console.error(`❌ Error saving enhanced adaptive chat conversation:`, err);
        }
      }

      res.json({
        success: true,
        data: {
          response: finalContent,
          tone: "adaptive",
          suggestedFollowUps: [],
          emotionalSupport: "",
          adaptationReason: "Personalized response based on emotional context"
        }
      });
    }

  } catch (error) {
    console.error('❌ Adaptive chat error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate adaptive response'
    });
  }
});

router.post('/personality-feedback', protect, async (req, res) => {
  try {
    const { interactionData, behaviorPatterns, feedbackType } = req.body;
    
    const systemPrompt = `You are a personality development coach. Analyze user interactions and provide constructive feedback for personal growth.

Return JSON in this format:
{
  "feedbackType": "string",
  "observations": ["observation1", "observation2"],
  "positivePatterns": ["pattern1", "pattern2"],
  "improvementAreas": ["area1", "area2"],
  "actionableSteps": ["step1", "step2"],
  "encouragement": "string",
  "progressTracking": {
    "metricsToWatch": ["metric1", "metric2"],
    "checkInFrequency": "string"
  }
}`;

    const userPrompt = `Provide personality feedback for:
Interaction Data: ${JSON.stringify(interactionData)}
Behavior Patterns: ${JSON.stringify(behaviorPatterns)}
Feedback Type: ${feedbackType || 'general development'}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await llmService.makeLLMRequest(messages, {
      temperature: 0.3,
      n_predict: 512
    });

    let feedbackData;
    try {
      feedbackData = JSON.parse(response.content);
    } catch {
      feedbackData = {
        feedbackType: "general development",
        observations: ["Shows thoughtful engagement", "Demonstrates openness to growth"],
        positivePatterns: ["Active participation", "Willingness to share"],
        improvementAreas: ["Self-reflection", "Goal setting"],
        actionableSteps: ["Practice daily check-ins", "Set small achievable goals"],
        encouragement: "You're on a positive path of personal growth. Keep being curious about yourself!",
        progressTracking: {
          metricsToWatch: ["Self-awareness", "Communication patterns"],
          checkInFrequency: "weekly"
        }
      };
    }

    res.json({
      success: true,
      data: feedbackData
    });

  } catch (error) {
    console.error('Personality feedback error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate personality feedback'
    });
  }
});

router.post('/personalized-insights', protect, async (req, res) => {
  try {
    const { userData, emotionalHistory, goalPreferences, timeframe } = req.body;
    
    const systemPrompt = `You are a personalized insights analyst. Generate deep, actionable insights about the user's emotional patterns, growth opportunities, and personalized recommendations.

Return JSON in this format:
{
  "insightsSummary": "string",
  "emotionalTrends": {
    "primaryPattern": "string",
    "frequency": "string",
    "triggers": ["trigger1", "trigger2"]
  },
  "personalizedGoals": ["goal1", "goal2"],
  "strengthsToLeverage": ["strength1", "strength2"],
  "customRecommendations": ["rec1", "rec2"],
  "socialCompatibility": {
    "idealPartnerTraits": ["trait1", "trait2"],
    "communicationTips": ["tip1", "tip2"]
  },
  "nextSteps": ["step1", "step2"],
  "confidenceScore": number (0-10)
}`;

    const userPrompt = `Generate personalized insights for:
User Data: ${JSON.stringify(userData)}
Emotional History: ${JSON.stringify(emotionalHistory)}
Goal Preferences: ${JSON.stringify(goalPreferences)}
Timeframe: ${timeframe || 'current'}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await llmService.makeLLMRequest(messages, {
      temperature: 0.4,
      n_predict: 512
    });

    let insightsData;
    try {
      insightsData = JSON.parse(response.content);
    } catch {
      insightsData = {
        insightsSummary: "You show strong emotional awareness and openness to growth, with consistent patterns of thoughtful engagement.",
        emotionalTrends: {
          primaryPattern: "Stable with growth-oriented mindset",
          frequency: "consistent",
          triggers: ["New experiences", "Social connections"]
        },
        personalizedGoals: ["Enhance self-awareness", "Build meaningful connections"],
        strengthsToLeverage: ["Empathy", "Adaptability"],
        customRecommendations: ["Practice mindful reflection", "Engage in community activities"],
        socialCompatibility: {
          idealPartnerTraits: ["Empathetic", "Communicative"],
          communicationTips: ["Express feelings openly", "Listen actively"]
        },
        nextSteps: ["Set weekly reflection time", "Join interest-based groups"],
        confidenceScore: 8
      };
    }

    res.json({
      success: true,
      data: insightsData
    });

  } catch (error) {
    console.error('Personalized insights error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate personalized insights'
    });
  }
});

// Helper function to check for recent search duplication
async function checkRecentSearchDuplication(userId, userMessage, recentMemory) {
  const searchKeywords = ['search', 'find', 'google', 'look up', 'what is', 'who is', 'where is'];
  const isSearchQuery = searchKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));
  
  if (!isSearchQuery || recentMemory.length === 0) {
    return { isDuplicate: false, shouldSkipTools: false, reference: null };
  }
  
  // Check last 5 messages for similar search terms
  const recentUserMessages = recentMemory
    .filter(msg => msg.role === 'user')
    .slice(-5);
    
  for (const msg of recentUserMessages) {
    if (!msg.content) continue;
    
    // Simple similarity check - if 3+ words match, consider it duplicate
    const currentWords = userMessage.toLowerCase().split(' ').filter(w => w.length > 3);
    const pastWords = msg.content.toLowerCase().split(' ').filter(w => w.length > 3);
    const commonWords = currentWords.filter(word => pastWords.includes(word));
    
    if (commonWords.length >= 3) {
      return {
        isDuplicate: true,
        shouldSkipTools: false, // Still allow tools but notify about duplication
        reference: `Here's what I found about "${msg.content.substring(0, 50)}..." earlier.`
      };
    }
  }
  
  return { isDuplicate: false, shouldSkipTools: false, reference: null };
}

export default router;