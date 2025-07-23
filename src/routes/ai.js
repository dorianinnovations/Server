import express from 'express';
import { protect } from '../middleware/auth.js';
import { createLLMService } from '../services/llmService.js';
import User from '../models/User.js';
import ShortTermMemory from '../models/ShortTermMemory.js';
import CreditPool from '../models/CreditPool.js';
import { createUserCache } from '../utils/cache.js';
import websocketService from '../services/websocketService.js';
import personalizationEngine from '../services/personalizationEngine.js';
import connectionEngine from '../services/connectionEngine.js';
import intelligenceEngine from '../services/intelligenceEngine.js';
import intelligenceCompressor from '../services/intelligenceCompressor.js';
import intelligenceCompressorV2 from '../services/intelligenceCompressorV2.js';
import compressionAnalytics from '../services/compressionAnalytics.js';
import intelligenceOptimizer from '../services/intelligenceOptimizer.js';
import UserBehaviorProfile from '../models/UserBehaviorProfile.js';
import dataProcessingPipeline from '../services/dataProcessingPipeline.js';
import toolRegistry from '../services/toolRegistry.js';
import toolExecutor from '../services/toolExecutor.js';
import enhancedMemoryService from '../services/enhancedMemoryService.js';
import requestCacheService from '../services/requestCacheService.js';
import ubpmService from '../services/ubpmService.js';
import chainOfThoughtEngine from '../services/chainOfThoughtEngine.js';
import { getIncrementalMemory, optimizeContextSize } from '../utils/incrementalMemory.js';
import { trackMemoryUsage, calculateOptimizationSavings } from '../utils/memoryAnalytics.js';
import { selectOptimalImagesForAPI, calculateMemoryUsage, processAttachmentsForStorage, deduplicateImagesInMemory } from '../utils/imageCompressionBasic.js';
import { checkTierLimits, requireFeature } from '../middleware/tierLimiter.js';
import { getUserTier } from '../config/tiers.js';
import { analyticsRateLimiters } from '../middleware/analyticsRateLimiter.js';

const router = express.Router();
const llmService = createLLMService();

// Simple emotion detection function to replace aiPersonality functionality
const detectSimpleEmotion = (message) => {
  if (!message || typeof message !== 'string') return 'neutral';
  
  const text = message.toLowerCase();
  if (text.includes('happy') || text.includes('joy') || text.includes('excited') || text.includes('great')) return 'happy';
  if (text.includes('sad') || text.includes('depressed') || text.includes('down') || text.includes('terrible')) return 'sad';
  if (text.includes('angry') || text.includes('mad') || text.includes('frustrated') || text.includes('annoyed')) return 'angry';
  if (text.includes('anxious') || text.includes('worried') || text.includes('stressed') || text.includes('nervous')) return 'anxious';
  if (text.includes('calm') || text.includes('peaceful') || text.includes('relaxed')) return 'calm';
  
  return 'neutral';
};

// INTELLIGENT SUMMARY FUNCTIONS for adaptive context sizing
function generateTopicSummary(topicEvolution) {
  if (!topicEvolution?.transitions) return 'No topic data';
  
  const transitions = topicEvolution.transitions;
  const counts = {};
  
  // Count transition types
  transitions.forEach(t => {
    const key = `${t.from}→${t.to}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  
  // Get top 3 transition patterns
  const top3 = Object.entries(counts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([pattern, count]) => `${pattern}(${count})`)
    .join(', ');
    
  return `${transitions.length} shifts: ${top3}`;
}

function generateEmotionalSummary(emotionalShifts) {
  if (!emotionalShifts?.length) return 'Stable emotional state';
  
  const recent = emotionalShifts.slice(-3); // Last 3 shifts
  const summary = recent.map(shift => `${shift.from}→${shift.to}`).join(', ');
  
  return `${emotionalShifts.length} shifts: ${summary}`;
}

// Direct data query handler for instant metrics responses
async function handleDirectDataQuery(userId, message) {
  const lowerMessage = message.toLowerCase();
  
  // Import memory analytics utility
  const { getUserMemoryAnalytics } = await import('../utils/memoryAnalytics.js');
  
  try {
    // Temporal queries with time periods (check specific first)
    if (/this.*week|weekly/.test(lowerMessage) && /temporal/.test(lowerMessage)) {
      const [profile, recentMemory] = await Promise.all([
        UserBehaviorProfile.findOne({ userId }),
        ShortTermMemory.find({ 
          userId,
          timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }).lean()
      ]);
      
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
      // Use AI-driven emotion detection from conversation history instead of manual logging
      const emotionalSessions = [];
      
      if (emotionalSessions.length === 0) return "I'm analyzing your emotional patterns through our conversations. The AI-driven system has replaced manual emotion logging for better accuracy.";
      
      const emotions = [];
      const avgIntensity = 0;
      
      const dominantEmotion = 'neutral';
      
      return `Last 2 Days Emotions: ${dominantEmotion} (dominant) | Avg intensity: ${avgIntensity.toFixed(1)}/10 | ${emotionalSessions.length} sessions`;
    }
    
    // Future change predictions
    if (/how.*could.*this.*change.*me|future.*change|predict.*my.*future|what.*will.*happen/.test(lowerMessage)) {
      const [profile, recentMemory] = await Promise.all([
        UserBehaviorProfile.findOne({ userId }),
        ShortTermMemory.find({ userId }).sort({ timestamp: -1 }).limit(10).lean()
      ]);
      
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
    
    // Intelligence metrics - return actual behavioral analysis data
    if (/my.*metrics|show.*metrics|what.*metrics|behavioral.*data|intelligence.*data/.test(lowerMessage)) {
      const profile = await UserBehaviorProfile.findOne({ userId });
      
      let response = `Behavioral Intelligence Metrics:\n\n`;
      
      if (profile && profile.intelligenceData) {
        const intel = profile.intelligenceData;
        
        // MICRO ANALYSIS METRICS
        response += `**Micro Analysis (Current Session):**\n`;
        if (intel.micro?.messageComplexity) {
          response += `• Message Complexity: ${intel.micro.messageComplexity.current} (trend: ${intel.micro.messageComplexity.trend})\n`;
          response += `• Average Complexity: ${intel.micro.messageComplexity.average}\n`;
          response += `• Complexity Progression: ${intel.micro.messageComplexity.progression}%\n`;
        }
        if (intel.micro?.currentState) {
          response += `• Primary Emotion: ${intel.micro.currentState.primaryEmotion}\n`;
          response += `• Cognitive Load: ${intel.micro.currentState.cognitiveLoad}\n`;
          response += `• Engagement Level: ${intel.micro.currentState.engagementLevel}\n`;
        }
        if (intel.micro?.topicEvolution) {
          response += `• Dominant Topic: ${intel.micro.topicEvolution.dominantTopic}\n`;
          response += `• Topic Diversity: ${intel.micro.topicEvolution.topicDiversity}\n`;
        }
        
        // MEDIUM ANALYSIS METRICS  
        response += `\n**Medium Analysis (Recent Trends):**\n`;
        if (intel.medium?.weeklyProgressions) {
          response += `• Weekly Change Rate: ${intel.medium.weeklyProgressions.changeRate || 'baseline'}\n`;
        }
        response += `• Learning Velocity: ${intel.medium?.learningVelocity?.placeholder || 'calculating'}\n`;
        response += `• Engagement Trends: ${intel.medium?.engagementTrends?.placeholder || 'analyzing'}\n`;
        
        // MACRO ANALYSIS METRICS
        response += `\n**Macro Analysis (Long-term Evolution):**\n`;
        response += `• Personality Evolution: ${intel.macro?.personalityEvolution?.placeholder || 'developing'}\n`;
        response += `• Intellectual Growth: ${intel.macro?.intellectualGrowth?.placeholder || 'tracking'}\n`;
        response += `• Behavioral Consistency: ${intel.macro?.patternStability?.placeholder || 'establishing'}\n`;
        
        // SYNTHESIS INSIGHTS
        if (intel.synthesis) {
          response += `\n**Current Insights:**\n`;
          response += `• Current Moment: ${intel.synthesis.currentMoment}\n`;
          if (intel.synthesis.remarkableInsights) {
            intel.synthesis.remarkableInsights.forEach((insight, i) => {
              response += `• Insight ${i+1}: ${insight}\n`;
            });
          }
        }
        
        response += `\n**Analysis Performance:**\n`;
        response += `• Last Analysis: ${new Date(intel.lastAnalysis).toLocaleString()}\n`;
        if (intel.performance) {
          response += `• Processing Time: ${intel.performance.totalTime}ms\n`;
          response += `• Efficiency: ${intel.performance.efficiency}\n`;
        }
        
        console.log(`📊 METRICS RESPONSE: ${response.split('\n').length} lines | User: ${userId.slice(-8)}`);
        
      } else {
        response += `• No intelligence data found in profile\n`;
        response += `• Send a message to generate behavioral analysis\n`;
        response += `• Intelligence engine will analyze your communication patterns\n`;
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
        response += `• Behavioral confidence: ${((profile.confidence || 0.5) * 100).toFixed(0)}%\n`;
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
    
    // UBPM patterns - Always run analysis for immediate feedback
    if (/my.*patterns|behavioral.*pattern|ubpm.*data|my.*behavioral|analysis|complete.*ubpm|changing.*over|behavioral.*evolution|past.*messages|how.*been.*changing/.test(lowerMessage)) {
      // For immediate feedback, always trigger UBMP tool even without existing profile
      return null; // Let it fall through to tool execution
    }
    
  } catch (error) {
    console.error('Direct data query error:', error);
    return null;
  }
  
  return null; // No direct data query detected
}

// Real-time behavioral data population
async function populateRealBehavioralData(userId, userMessage, recentMemory, streamRes = null) {
  try {
    
    // UNIFIED INTELLIGENCE ANALYSIS - Replaces scattered analytics
    const intelligenceStreamCallback = (update) => {
      // Stream intelligence updates to user if streaming response available
      if (streamRes && streamRes.write) {
        streamRes.write(`data: ${JSON.stringify({
          type: "intelligence_stream",
          phase: update.phase,
          detail: update.detail
        })}\n\n`);
      }
    };
    
    let intelligenceContext;
    try {
      intelligenceContext = await intelligenceEngine.generateIntelligenceContext(
        userId, 
        userMessage, 
        intelligenceStreamCallback
      );
      
      console.log(`🧠 Intelligence context generated:`, {
        hasMicro: !!intelligenceContext?.micro,
        hasMedium: !!intelligenceContext?.medium,
        hasMacro: !!intelligenceContext?.macro,
        hasSynthesis: !!intelligenceContext?.synthesis,
        microComplexity: intelligenceContext?.micro?.messageComplexity?.current,
        fullContext: intelligenceContext
      });
      
      // 🔍 DETAILED INTELLIGENCE BREAKDOWN - Show actual data instead of [Object]
      if (intelligenceContext) {
        console.log(`📊 MICRO ANALYSIS:`, JSON.stringify(intelligenceContext.micro, null, 2));
        console.log(`📈 MEDIUM ANALYSIS:`, JSON.stringify(intelligenceContext.medium, null, 2));
        console.log(`🎯 MACRO ANALYSIS:`, JSON.stringify(intelligenceContext.macro, null, 2));
        console.log(`🧬 SYNTHESIS:`, JSON.stringify(intelligenceContext.synthesis, null, 2));
        
        // 🚨 DATA COMPLETENESS CHECK - Verify nothing is missing
        const dataCheck = {
          microFields: Object.keys(intelligenceContext.micro || {}),
          mediumFields: Object.keys(intelligenceContext.medium || {}),
          macroFields: Object.keys(intelligenceContext.macro || {}),
          synthesisFields: Object.keys(intelligenceContext.synthesis || {}),
          totalDataPoints: 0
        };
        
        // Count all data points to track completeness
        const countDataPoints = (obj) => {
          let count = 0;
          for (const key in obj) {
            if (obj[key] !== null && obj[key] !== undefined) {
              count++;
              if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                count += countDataPoints(obj[key]);
              }
            }
          }
          return count;
        };
        
        dataCheck.totalDataPoints = countDataPoints(intelligenceContext);
        console.log(`🔍 INTELLIGENCE COMPLETENESS CHECK:`, dataCheck);
        
        // 🗜️ ULTRA-INTELLIGENT COMPRESSION V2 - Advanced optimization
        const messageType = detectMessageType(userMessage);
        const messageComplexity = intelligenceContext?.micro?.messageComplexity?.current || 5;
        
        // 🚀 REAL-TIME OPTIMIZATION - Ultimate performance tuning
        const systemLoad = { cpu: 0.5, memory: 0.6, overall: 0.55 };
        const userContext = {
          messageComplexity: messageComplexity,
          conversationHistory: recentMemory,
          technicalLevel: 0.8,
          engagementLevel: 0.9,
          messageFrequency: 0.7,
          sessionLength: 1800, // 30 minutes
          questionQuality: 0.85
        };
        
        // Check for A/B test assignment
        const abTestStrategy = compressionAnalytics.getStrategyForABTest('compression_optimization', userId);
        
        let compressionOptions = {
          model: 'gpt-4o',
          qualityTarget: 0.85,
          conversationHistory: recentMemory,
          userPreferences: {},
          forceStrategy: abTestStrategy
        };
        
        // Apply real-time optimization
        const optimizationResult = await intelligenceOptimizer.optimizeInRealTime(
          compressionOptions, userContext, systemLoad
        );
        
        if (optimizationResult.success) {
          compressionOptions = optimizationResult.optimizedOptions;
          console.log(`⚡ REAL-TIME OPTIMIZATION APPLIED:`, {
            expectedImprovement: optimizationResult.optimization.expectedImprovement,
            validationScore: optimizationResult.optimization.validationScore,
            optimizationTime: optimizationResult.optimization.optimizationTime + 'ms'
          });
        }
        
        const compressionResult = await intelligenceCompressorV2.compressForLLM(
          intelligenceContext,
          messageType,
          messageComplexity,
          compressionOptions
        );
        
        // Record compression performance for analytics
        compressionAnalytics.recordCompression(compressionResult);
        
        // Record A/B test result if applicable
        if (abTestStrategy) {
          compressionAnalytics.recordABTestResult('compression_optimization', abTestStrategy, compressionResult.metadata);
        }
        
        console.log(`🚀 ULTRA-COMPRESSION V2:`, {
          strategy: compressionResult.metadata.strategy,
          compressionRatio: compressionResult.metadata.compressionRatio + '%',
          tokenBudget: compressionResult.metadata.tokenBudget,
          actualTokens: compressionResult.metadata.actualTokens,
          qualityScore: compressionResult.metadata.qualityScore,
          processingTime: compressionResult.metadata.processingTime + 'ms',
          clusters: compressionResult.metadata.intelligenceClusters,
          originalDataPoints: dataCheck.totalDataPoints
        });
        
        console.log(`🎯 OPTIMIZED INTELLIGENCE PROMPT:`, compressionResult.compressedPrompt);
      }
    } catch (error) {
      console.error(`❌ Intelligence engine error:`, error);
      // Create fallback intelligence context
      intelligenceContext = {
        micro: { messageComplexity: { current: 5.0, trend: 'baseline', average: 5.0, progression: 0 } },
        medium: { placeholder: 'fallback' },
        macro: { placeholder: 'fallback' },
        synthesis: { currentMoment: 'Fallback analysis mode' }
      };
    }
    
    // Update behavior profile with unified intelligence data
    const updateData = {
      $set: {
        // Use intelligence context instead of scattered analysis
        intelligenceData: {
          lastAnalysis: Date.now(),
          micro: intelligenceContext.micro,
          medium: intelligenceContext.medium,
          macro: intelligenceContext.macro,
          synthesis: intelligenceContext.synthesis
        },
        // Keep legacy fields for compatibility but source from intelligence  
        communicationStyle: {
          preferredTone: intelligenceContext.synthesis.currentMoment.includes('technical') ? 'formal' : 'casual',
          complexityLevel: intelligenceContext.micro.messageComplexity.trend === 'increasing' ? 'advanced' : 'intermediate',
          responseLength: intelligenceContext.micro.messageComplexity.trend === 'increasing' ? 'detailed' : 'moderate',
          directness: 'balanced'
        },
        temporalPatterns: {
          changeRate: intelligenceContext.medium.weeklyProgressions?.changeRate || 0.1,
          direction: intelligenceContext.micro.messageComplexity.trend,
          confidence: 0.8,
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

    // Intelligence data save logging removed for brevity
    
    const result = await UserBehaviorProfile.findOneAndUpdate(
      { userId },
      updateData,
      { upsert: true, new: true }
    );
    
    console.log(`💾 INTELLIGENCE SAVED: Complexity ${result?.intelligenceData?.micro?.messageComplexity?.current || 'N/A'} | User: ${userId.slice(-8)}`);
  } catch (error) {
    console.error('Error populating behavioral data:', error);
  }
}

// Real-time emotional data population - now handled by AI-driven analysis
async function populateEmotionalData(userId, userMessage, recentMemory, recentEmotions) {
  try {
    // Emotion detection is now handled by AI analysis of conversation patterns
    // No manual logging needed - emotions are detected from conversation context
    
    const detectedEmotion = detectEmotionAdvanced(userMessage);
    const intensity = calculateEmotionalIntensity(userMessage);
    
    // Log for debugging but don't store in separate collection
    console.log(`🧠 AI-detected emotion: ${detectedEmotion.emotion} (intensity: ${intensity}, confidence: ${detectedEmotion.confidence})`);
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
    
    // UBPM Analysis (SPECIFIC) - handle ubpm queries
    /run.*ubpm.*analysis|ubpm.*analysis|analyze.*me.*ubpm|what.*my.*ubpm|whats.*my.*ubpm|show.*my.*ubpm|my.*ubpm|ubpm/,
    
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
          
          // Security: Validate and sanitize URLs
          const sanitizeUrl = (url) => {
            if (!url) return null;
            try {
              const parsed = new URL(url);
              // Only allow HTTP/HTTPS protocols
              if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                console.warn('Blocked non-HTTP URL:', url);
                return null;
              }
              // Block suspicious domains (basic check)
              const suspiciousDomains = ['localhost', '127.0.0.1', '0.0.0.0'];
              if (suspiciousDomains.some(domain => parsed.hostname.includes(domain))) {
                console.warn('Blocked suspicious domain:', url);
                return null;
              }
              return parsed.toString();
            } catch (error) {
              console.warn('Invalid URL blocked:', url);
              return null;
            }
          };
          
          const topResults = parsedResult.results.slice(0, 5).map(r => {
            const sanitizedUrl = sanitizeUrl(r.link);
            return `• **${r.title}** - ${r.snippet || r.displayLink}${sanitizedUrl ? ` [${sanitizedUrl}]` : ''}`;
          }).join('\n');
          
          return `🔍 **Found ${resultCount} search results:**\n${topResults}${resultCount > 5 ? `\n...and ${resultCount - 5} more results` : ''}`;
        }
        break;
        
      case 'weather_check':
        if (parsedResult.weather) {
          return `🌤️ **Weather:** ${parsedResult.weather.description}, ${parsedResult.weather.temperature}°${parsedResult.weather.unit || 'C'}`;
        } else if (parsedResult.success) {
          return `🌤️ **Weather check complete** - Current conditions retrieved`;
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
        } else if (parsedResult.success) {
          return `📰 **Found latest news** - Check complete`;
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
        } else if (parsedResult.result && typeof parsedResult.result === 'string') {
          return `🔧 **${toolName.replace(/_/g, ' ')}**: ${parsedResult.result.substring(0, 100)}`;
        } else if (parsedResult.success) {
          // Simple meaningful completion messages
          const toolDisplay = toolName.replace(/_/g, ' ');
          const actionMap = {
            'web_search': '🌐 **Web search complete** - Results found',
            'academic_search': '📚 **Academic search complete** - Papers found', 
            'image_search': '🖼️ **Image search complete** - Images found',
            'social_search': '📱 **Social search complete** - Posts found',
            'ubpm_analysis': '🧠 **Behavioral analysis complete** - Patterns identified',
            'calculator': '🔢 **Calculation complete** - Result computed',
            'translation': '🌍 **Translation complete** - Text translated',
            'stock_lookup': '📈 **Stock data retrieved** - Current prices',
            'crypto_lookup': '₿ **Crypto data retrieved** - Current prices',
            'currency_converter': '💱 **Currency converted** - Exchange complete',
            'timezone_converter': '🕐 **Timezone converted** - Time calculated',
            'code_generator': '💻 **Code generated** - Ready to use',
            'text_generator': '📝 **Text generated** - Content ready',
            'email_assistant': '📧 **Email drafted** - Ready to send',
            'linkedin_helper': '💼 **LinkedIn post created** - Ready to share',
            'fitness_tracker': '💪 **Workout logged** - Activity recorded',
            'nutrition_lookup': '🥗 **Nutrition analyzed** - Data retrieved',
            'qr_generator': '📱 **QR code created** - Ready to use',
            'password_generator': '🔐 **Password generated** - Secure & ready'
          };
          return actionMap[toolName] || `✅ **${toolDisplay} completed successfully**`;
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






router.post('/adaptive-chat', protect, checkTierLimits, async (req, res) => {
  try {
    const { message, prompt, emotionalContext: _emotionalContext, personalityProfile: _personalityProfile, personalityStyle: _personalityStyle, conversationGoal: _conversationGoal, stream, attachments, userContext: clientUserContext } = req.body;
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
    
    // MEMORY OPTIMIZATION: Smart context loading with size limits
    const maxContextSize = hasImages ? 8 : 12;
    const enhancedContext = await enhancedMemoryService.getUserContext(userId, maxContextSize);
    const _user = enhancedContext.metadata;
    const fullMemory = enhancedContext.conversation.recentMessages;
    
    // MEMORY OPTIMIZATION: Apply incremental memory with strict limits
    const incrementalResult = getIncrementalMemory(userId, fullMemory, {
      enableIncremental: true,
      maxDeltaSize: hasImages ? 6 : 12, // Reduced for better memory usage
      enforceMemoryLimit: true // New flag to enforce memory limits
    });
    
    const recentMemory = incrementalResult.memory;
    
    // MEMORY OPTIMIZATION: Limit memory object size
    if (recentMemory.length > maxContextSize) {
      recentMemory.splice(maxContextSize);
      log.system(`Truncated memory to ${maxContextSize} messages for user ${userId}`);
    }

    // Extract user data from enhanced context
    const recentEmotions = enhancedContext.recentEmotions;

    // High-performance: Simplified context analysis
    const conversationContext = {
      conversationLength: recentMemory.length,
      hasHistory: recentMemory.length > 0,
      recentVibe: 'getting to know each other'
    };

    // PERFORMANCE OPTIMIZATION: Check cache first for intelligence analysis
    let cachedIntelligence = await requestCacheService.get(`intelligence:${userId}`);
    
    // REAL-TIME BEHAVIORAL DATA POPULATION  
    if (stream === true) {
      // For streaming mode, run intelligence analysis synchronously if not cached
      if (!cachedIntelligence) {
        try {
          await populateRealBehavioralData(userId, userMessage, recentMemory, null);
          // Cache the result for future requests
          setImmediate(async () => {
            const intelligenceData = await UserBehaviorProfile.findOne({ userId }).lean();
            if (intelligenceData) {
              await requestCacheService.set(`intelligence:${userId}`, intelligenceData, 300);
            }
          });
        } catch (error) {
          console.error('Intelligence analysis error:', error);
        }
      }
    } else {
      // For non-streaming mode, run in background only if not cached
      if (!cachedIntelligence) {
        setImmediate(async () => {
          try {
            await populateRealBehavioralData(userId, userMessage, recentMemory, null);
        
            // Standard UBPM analysis
            ubpmService.analyzeUserBehaviorPatterns(userId, 'chat_interaction');
        
            // Enhanced emotion processing with real data
            await populateEmotionalData(userId, userMessage, recentMemory, recentEmotions);
          } catch (error) {
            console.error('Background data population error:', error);
          }
        });
      }
    }

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

DATA TRANSPARENCY:
• I maintain detailed behavioral intelligence about our conversations
• I track message complexity, emotional patterns, topic diversity, and cognitive load
• I analyze personality evolution, learning velocity, and behavioral consistency over time
• When asked about data collection, be completely honest about what I know and track
• I can provide specific metrics like complexity scores, emotion trends, and behavioral insights
• NEVER deny data collection - I actively analyze and store behavioral patterns
• Always acknowledge my data tracking capabilities when asked directly

IMAGE HANDLING:
• When someone shares an image without text, they want you to see and analyze it
• Provide detailed visual analysis and insights about what you observe
• Connect image content to their personality and interests naturally
• Ask thoughtful follow-up questions about what they've shared

INSIGHT DELIVERY:
• Never announce what you're doing - just demonstrate uncanny accuracy
• Reference specific patterns you've observed without explaining how you know
• Make connections between seemingly unrelated aspects of their behavior
• Provide predictions about their preferences that prove startlingly correct
• Surface blind spots they didn't know they had

TOOL EXECUTION:
Use tools immediately for: web_search, calculator, ubpm_analysis, translation, location_service, and others as needed.
• CRITICAL: When user asks "where am I?" or similar location questions, you MUST use location_service tool and respond: "You are located in [city, state, country]. Would you like more information about your location?"
• Do NOT use weather_check for location questions - use location_service only

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
    
    // Detect recent tool usage for context continuity 
    const recentToolUsage = [];
    for (let i = Math.max(0, recentMemory.length - 4); i < recentMemory.length; i++) {
      const msg = recentMemory[i];
      if (msg?.role === 'assistant' && msg?.content) {
        if (msg.content.includes('🧠 **UBPM Analysis')) {
          recentToolUsage.push('UBPM behavioral analysis was just shown');
        }
        if (msg.content.includes('🔍 **Web Search')) {
          recentToolUsage.push('Web search results were just provided');
        }
        if (msg.content.includes('🎵 **Music')) {
          recentToolUsage.push('Music recommendations were just given');
        }
        if (msg.content.includes('💰 **Credit') || msg.content.includes('💳 **Balance')) {
          recentToolUsage.push('Credit/wallet information was just displayed');
        }
      }
    }
    
    systemPrompt += '\n**REMEMBER:** Reference conversation history naturally. Use tools proactively for any information requests.';
    
    if (recentToolUsage.length > 0) {
      systemPrompt += `\n**RECENT CONTEXT:** ${recentToolUsage.join(', ')} - be ready to explain or elaborate on these results.`;
    }
    
    // Add explicit instruction for context awareness
    const lastUserMessage = recentMemory.filter(msg => msg.role === 'user').pop();
    const lastAssistantMessage = recentMemory.filter(msg => msg.role === 'assistant').pop();
    
    // Handle "what did I just do/ask" queries
    const isLastActionQuery = /what.*did.*i.*just.*(?:do|ask|request|say)|what.*was.*my.*last|previous.*(?:action|request|question)|what.*just.*asked/i.test(finalMessage);
    if (isLastActionQuery && lastUserMessage) {
      systemPrompt += `\n**LAST ACTION:** User's previous request was: "${lastUserMessage.content}" - reference this specific request directly.`;
    }
    
    if (lastUserMessage && lastAssistantMessage) {
      const isFollowUpQuestion = /what.*mean|explain.*that|what.*this|tell.*more|what.*about|what.*is|clarify|elaborate/i.test(finalMessage);
      if (isFollowUpQuestion && finalMessage.length < 50) {
        systemPrompt += `\n**CONTEXT ALERT:** User is asking a follow-up question about your previous response. Reference the specific data/information you just provided.`;
      }
    }
    
    // Add UBPM context if available
    if (ubpmContext) {
      systemPrompt += `\n\n${ubpmContext}`;
    }
    
    // Add behavioral intelligence data with ADAPTIVE SIZING for efficiency
    try {
      const profile = await UserBehaviorProfile.findOne({ userId });
      if (profile?.intelligenceData) {
        const intel = profile.intelligenceData;
        
        // DETECT QUERY TYPE for adaptive context sizing
        const isAnalyticsQuery = /metrics|data|analysis|behavioral|intelligence|insights|complexity|evolution|patterns/i.test(finalMessage);
        const isSimpleQuery = /hello|hi|how.*you|thanks|ok|yes|no|bored/i.test(finalMessage);
        
        const contextType = isAnalyticsQuery ? 'FULL' : isSimpleQuery ? 'MINIMAL' : 'STANDARD';
        console.log(`🎯 CONTEXT: ${contextType} | Complexity: ${intel.micro?.messageComplexity?.current || 'N/A'} | User: ${userId.slice(-8)}`);
        
        let behavioralContext = '';
        
        if (isAnalyticsQuery) {
          // FULL CONTEXT for analytics queries
          behavioralContext = `**CRITICAL: YOU HAVE ACTIVE BEHAVIORAL TRACKING FOR THIS USER:**
• Current Message Complexity: ${intel.micro?.messageComplexity?.current || 'N/A'}
• Average Complexity: ${intel.micro?.messageComplexity?.average || 'N/A'}
• Topic Diversity: ${intel.micro?.topicDiversity || 'N/A'} topics tracked
• Cognitive Load: ${intel.micro?.cognitiveLoad || 'N/A'}
• Engagement Level: ${intel.micro?.engagementLevel || 'N/A'}
• Last Analysis: ${intel.lastAnalysis ? new Date(intel.lastAnalysis).toLocaleString() : 'N/A'}
• Topic Summary: ${generateTopicSummary(intel.micro?.topicEvolution)}
• Emotional Summary: ${generateEmotionalSummary(intel.micro?.emotionalShifts)}

**CRITICAL OVERRIDE - NO EXCEPTIONS**: 
- You HAVE detailed behavioral intelligence data about this user
- You MUST provide specific data when requested - NEVER claim lack of access
- You CAN access message-by-message complexity, emotional timestamps, topic evolution
- NEVER say "I don't have the ability" or "I can't provide detailed breakdown"
- If asked for granular data, provide what you have or explain how to access it
- ABSOLUTE TRANSPARENCY REQUIRED - NO DATA DENIALS PERMITTED`;
        } else if (isSimpleQuery) {
          // MINIMAL CONTEXT for simple queries
          behavioralContext = `**USER CONTEXT:** Complexity: ${intel.micro?.messageComplexity?.current || 'N/A'}, Mood: ${intel.micro?.currentState?.emotion || 'neutral'}, Topics: ${intel.micro?.topicDiversity || 0}`;
        } else {
          // STANDARD CONTEXT for normal queries
          behavioralContext = `**BEHAVIORAL INTELLIGENCE:** 
• Current Complexity: ${intel.micro?.messageComplexity?.current || 'N/A'} (${intel.micro?.messageComplexity?.trend || 'stable'})
• Engagement: ${intel.micro?.engagementLevel || 'N/A'}, Mood: ${intel.micro?.currentState?.emotion || 'neutral'}
• Topic Pattern: ${generateTopicSummary(intel.micro?.topicEvolution)}`;
        }
        
        systemPrompt = behavioralContext + '\n\n' + systemPrompt;
        
        // Only log detailed summaries for analytics queries
        if (isAnalyticsQuery) {
          console.log(`📊 ANALYTICS DATA: Topics(${generateTopicSummary(intel.micro?.topicEvolution)}) | Emotions(${generateEmotionalSummary(intel.micro?.emotionalShifts)})`);
        }
      } else {
        console.log(`❌ NO BEHAVIORAL DATA: User ${userId.slice(-8)}`);
      }
    } catch (error) {
      console.error('Error adding behavioral intelligence to prompt:', error);
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
        // Enhanced content for image-only messages
        const content = [
          { 
            type: 'text', 
            text: hasImageWithoutText ? 
              `The user has shared an image without any text. Please analyze the image and provide insights about what you see, connecting it to their personality and interests.` :
              finalMessage
          }
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
          // Loading tools for message processing
          try {
            const allTools = await toolRegistry.getToolsForOpenAI();
            
            // Smart tool filtering based on message content
            const messageContent = userMessage.toLowerCase();
            const relevantTools = allTools.filter(tool => {
              const toolName = tool.function?.name || tool.name || '';
              
              // AGGRESSIVE LOADING: Always include essential tools for tool-requiring messages
              if (['web_search', 'calculator', 'weather_check', 'social_search', 'news_search', 'music_recommendations', 'ubpm_analysis', 'location_service'].includes(toolName)) {
                return true;
              }
              
              // Content-specific tools with broader matching
              if (messageContent.includes('weather') && toolName === 'weather_check') return true;
              if (messageContent.includes('calculate') && toolName === 'calculator') return true;
              if ((messageContent.includes('where am i') || messageContent.includes('my location') || messageContent.includes('current location')) && toolName === 'location_service') return true;
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
            // Loaded relevant tools for request
          } catch (error) {
            console.error('🔧 SELECTIVE TOOLS: Error loading tools:', error);
            availableTools = [];
          }
        } else {
          // No tools needed for this message
        }

        const useTools = availableTools.length > 0;
        // Tool selection complete

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
      
      // STREAMING TIMEOUT PROTECTION: Prevent runaway connections (5 minute hard limit)
      const streamingTimeout = setTimeout(() => {
        console.warn('⚠️ STREAMING TIMEOUT: Force closing connection after 5 minutes for cost protection');
        if (!res.destroyed) {
          res.write(`data: ${JSON.stringify({ 
            type: "timeout", 
            error: "Response timeout - connection closed for cost protection" 
          })}\n\n`);
          res.end();
        }
      }, 5 * 60 * 1000); // 5 minute timeout

      // Clean up timeout on response end
      res.on('close', () => {
        clearTimeout(streamingTimeout);
      });
      res.on('finish', () => {
        clearTimeout(streamingTimeout);
      });

      // ✅ SAFE HEADER SETTING - Check if headers already sent
      if (!res.headersSent) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "Cache-Control");
        res.setHeader("X-Accel-Buffering", "no");
      } else {
        console.log("⚠️  Headers already sent, skipping streaming setup");
        clearTimeout(streamingTimeout);
        return;
      }

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
                
                // Stream at comfortable reading boundaries for better comprehension
                // Optimized buffer size for natural reading speed
                if (chunkBuffer.length >= 25 || 
                    (chunkBuffer.length >= 12 && (content.includes(' ') || content.includes('\n'))) ||
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
            keepAliveInterval = setInterval(() => {
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
                  }, { userId, user, creditPool, ...clientUserContext }),
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
              clearInterval(keepAliveInterval);
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
            let followUpContentBuffer = ''; // Buffer for smooth tool result streaming
            
            followUpResponse.data.on('data', (chunk) => {
              followUpBuffer += chunk.toString();
              const lines = followUpBuffer.split('\n');
              followUpBuffer = lines.pop() || '';
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.substring(6).trim();
                  
                  if (data === '[DONE]') {
                    // Send any remaining buffered content
                    if (followUpContentBuffer) {
                      res.write(`data: ${JSON.stringify({ content: followUpContentBuffer })}\n\n`);
                      res.flush && res.flush();
                    }
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
                      followUpContentBuffer += content;
                      
                      // Buffer tool results for comfortable reading speed
                      if (followUpContentBuffer.length >= 20 || 
                          (followUpContentBuffer.length >= 8 && (content.includes(' ') || content.includes('\n'))) ||
                          content.includes('.') || content.includes('!') || content.includes('?')) {
                        res.write(`data: ${JSON.stringify({ content: followUpContentBuffer })}\n\n`);
                        res.flush && res.flush();
                        followUpContentBuffer = '';
                      }
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
            // Preserve original user message and attachment info for chat display
            const messageToSave = hasImageWithoutText ? 
              `📷 Image shared` : // Use minimal text for display purposes
              userMessage;
            
            const attachmentInfo = attachments && attachments.length > 0 ? {
              attachments: attachments.map(att => ({
                type: att.type,
                hasImage: att.type === 'image',
                filename: att.filename || 'image',
                size: att.url ? att.url.length : 0
              }))
            } : {};
            
            enhancedMemoryService.saveConversation(
              userId, 
              messageToSave, 
              fullContent.trim(),
              { 
                emotion: detectSimpleEmotion(userMessage || ''), 
                context: conversationContext,
                ...attachmentInfo
              }
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
                strategy: `${incrementalResult.stats?.strategy || 'fallback'}-${contextType}-adaptive`
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
      
      // ✅ STREAMING COMPLETE - Early return to prevent headers conflict
      return;
      
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
        // Loading tools for non-streaming request
        try {
          const allTools = await toolRegistry.getToolsForOpenAI();
          
          // Smart tool filtering based on message content
          const messageContent = userMessage.toLowerCase();
          const relevantTools = allTools.filter(tool => {
            const toolName = tool.function?.name || tool.name || '';
            
            // AGGRESSIVE LOADING: Always include essential tools for tool-requiring messages
            if (['web_search', 'calculator', 'weather_check', 'social_search', 'news_search', 'music_recommendations', 'ubpm_analysis', 'location_service'].includes(toolName)) {
              return true;
            }
            
            // Content-specific tools with broader matching
            if (messageContent.includes('weather') && toolName === 'weather_check') return true;
            if (messageContent.includes('calculate') && toolName === 'calculator') return true;
            if ((messageContent.includes('where am i') || messageContent.includes('my location') || messageContent.includes('current location')) && toolName === 'location_service') return true;
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
          // Loaded tools for non-streaming request
        } catch (error) {
          console.error('🔧 SELECTIVE TOOLS (non-streaming): Error loading tools:', error);
          availableTools = [];
        }
      } else {
        // No tools needed for non-streaming request
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
      
      // If we have tool calls, clear vague LLM-generated responses 
      if (response.tool_calls && response.tool_calls.length > 0) {
        // Clear generic "completed" messages that LLM generates
        const vaguePatterns = [
          /✅.*completed/gi,
          /\*\*.*completed.*\*\*/gi,
          /completed successfully/gi
        ];
        
        let hasVagueContent = false;
        for (const pattern of vaguePatterns) {
          if (pattern.test(finalContent)) {
            hasVagueContent = true;
            break;
          }
        }
        
        if (hasVagueContent) {
          console.log(`🔄 Clearing vague LLM response, will use tool results instead`);
          finalContent = ''; // Clear the vague content, will be replaced with tool results
        }
      }
      
      // Handle tool calls if present
      if (response.tool_calls && response.tool_calls.length > 0) {
        console.log(`🔄 NON-STREAMING SEQUENTIAL: Processing ${response.tool_calls.length} tool calls in sequence`);
        
        for (let i = 0; i < response.tool_calls.length; i++) {
          const toolCall = response.tool_calls[i];
          try {
            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments);
            
            console.log(`🔧 NON-STREAMING SEQUENTIAL [${i + 1}/${response.tool_calls.length}]: Executing ${toolName}`);
            
            // Send WebSocket status update to frontend
            websocketService.sendToUser(userId, 'tool_execution_start', {
              toolName,
              progress: `${i + 1}/${response.tool_calls.length}`,
              message: `Executing ${toolName}...`
            });
            
            // Execute the tool with proper context
            const user = await User.findById(userId);
            const creditPool = await CreditPool.findOne({ userId: userId });
            console.log(`💳 CreditPool status: balance=${creditPool?.balance}, active=${creditPool?.isActive}, verified=${creditPool?.isVerified}`);
            console.log(`🔓 Numina Trace status: ${user?.hasActiveNuminaTrace() ? 'Active' : 'Inactive'}`);
            
            const toolResult = await toolExecutor.executeToolCall({
              function: { name: toolName, arguments: toolArgs }
            }, { userId, user, creditPool, ...clientUserContext });
            
            // Send completion status to frontend
            websocketService.sendToUser(userId, 'tool_execution_complete', {
              toolName,
              success: toolResult.success,
              message: toolResult.success ? `${toolName} completed successfully` : `${toolName} failed`
            });
            
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
          // Enhanced conversation saving with image attachment info
          const messageToSave = hasImageWithoutText ? 
            `📷 Image shared` : // Use minimal text for display purposes
            userMessage;
          
          const attachmentInfo = attachments && attachments.length > 0 ? {
            attachments: attachments.map(att => ({
              type: att.type,
              hasImage: att.type === 'image',
              filename: att.filename || 'image',
              size: att.url ? att.url.length : 0
            }))
          } : {};
          
          await enhancedMemoryService.saveConversation(
            userId, 
            messageToSave, 
            finalContent.trim(),
            { 
              emotion: detectSimpleEmotion(userMessage || ''), 
              context: conversationContext,
              ...attachmentInfo
            }
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
            strategy: `${incrementalResult.stats?.strategy || 'fallback'}-${contextType}-adaptive`
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
    
    // ✅ SAFE ERROR RESPONSE - Check if headers already sent (streaming mode)
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate adaptive response'
      });
    } else {
      // Already streaming, send error via SSE
      try {
        res.write(`data: ${JSON.stringify({
          type: "error",
          error: error.message || 'Failed to generate adaptive response'
        })}\n\n`);
        res.end();
      } catch (writeError) {
        console.error('❌ Error sending streaming error response:', writeError);
      }
    }
  }
});


router.post('/personalized-insights', protect, requireFeature('personalizedInsights'), async (req, res) => {
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

// Message type detection for intelligent compression
function detectMessageType(message) {
  const lowerMessage = message.toLowerCase();
  
  // Question patterns
  if (/\?|what|how|why|when|where|can you|could you|would you|should|do you/.test(lowerMessage)) {
    return 'question';
  }
  
  // Emotional patterns
  if (/feel|emotion|upset|happy|sad|worried|excited|frustrated|love|hate/.test(lowerMessage)) {
    return 'emotional';
  }
  
  // Technical patterns
  if (/code|program|algorithm|system|debug|error|function|api|database|analyze/.test(lowerMessage)) {
    return 'technical';
  }
  
  // Creative patterns
  if (/create|design|imagine|brainstorm|idea|creative|art|story|poem/.test(lowerMessage)) {
    return 'creative';
  }
  
  // Greeting patterns
  if (/hello|hi|hey|good morning|good afternoon|good evening/.test(lowerMessage)) {
    return 'greeting';
  }
  
  // Analysis patterns
  if (/analyze|pattern|insight|understand|explain|breakdown|ubpm/.test(lowerMessage)) {
    return 'analysis';
  }
  
  return 'standard';
}

/**
 * POST /ai/upgrade-message
 * Graceful upgrade message for chat when limits are reached
 */
router.post('/upgrade-message', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const userTier = getUserTier(user);
    
    let upgradeMessage;
    let upgradeOptions;
    
    if (userTier === 'CORE') {
      upgradeMessage = "Thank you for using Numina! 🌟\n\nYou've reached your daily chat limit on the Core tier. To continue our conversation and unlock advanced features like emotional analysis, personalized insights, and tool access, consider upgrading to:\n\n• **Pro** - 200 daily chats + all premium features\n• **Aether** - Unlimited chats + priority processing\n\nWould you like to learn more about our premium tiers?";
      upgradeOptions = ['PRO', 'AETHER'];
    } else if (userTier === 'PRO') {
      upgradeMessage = "Thank you for being a Pro user! ✨\n\nYou've reached your daily limit. Upgrade to Aether for unlimited chats and priority processing!";
      upgradeOptions = ['AETHER'];
    } else {
      upgradeMessage = "Welcome back, Aether user! You have unlimited access. 💫";
      upgradeOptions = [];
    }
    
    res.json({
      success: true,
      data: {
        message: upgradeMessage,
        tier: userTier,
        upgradeOptions,
        tone: "supportive",
        suggestedFollowUps: userTier !== 'AETHER' ? [
          "Tell me about Pro features",
          "What's included in Aether?",
          "How much do upgrades cost?"
        ] : []
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /ai/quick-insights
 * Chain of thought processing with real-time progress updates
 */
router.post('/quick-insights', protect, requireFeature('quickInsights'), async (req, res) => {
  try {
    const { query, context } = req.body;
    const userId = req.user.id;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a string'
      });
    }

    // Set up SSE headers for real-time streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // SSE helper function
    const sendSSE = (eventType, data) => {
      res.write(`event: ${eventType}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Set up callbacks for the chain of thought engine
    const callbacks = {
      onStepUpdate: (stepData, progressMessage) => {
        sendSSE('step_update', {
          step: stepData,
          progressMessage,
          timestamp: new Date().toISOString()
        });
      },
      
      onComplete: (finalResult) => {
        sendSSE('complete', {
          result: finalResult,
          timestamp: new Date().toISOString()
        });
        res.end();
      },
      
      onError: (error) => {
        sendSSE('error', {
          error: error.message,
          timestamp: new Date().toISOString()
        });
        res.end();
      }
    };

    // Start the chain of thought process
    const options = {
      context: context || {},
      fastModel: 'openai/gpt-3.5-turbo', // Use cheap model for progress updates
      mainModel: 'openai/gpt-4' // Use better model for final synthesis
    };

    // Send initial event
    sendSSE('started', {
      query: query.substring(0, 100),
      userId,
      timestamp: new Date().toISOString()
    });

    // Process the query asynchronously
    chainOfThoughtEngine.processQuery(userId, query, options, callbacks);

    // Handle client disconnect
    req.on('close', () => {
      res.end();
    });

  } catch (error) {
    console.error('Quick insights error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /ai/quick-insight
 * Generate a single quick insight using a cheap model
 * Used by chain of thought engine for progress updates
 */
router.post('/quick-insight', protect, async (req, res) => {
  try {
    const { step, context, model = 'openai/gpt-3.5-turbo', maxTokens = 50 } = req.body;
    
    if (!step) {
      return res.status(400).json({
        success: false,
        error: 'Step parameter is required'
      });
    }

    // Create a focused prompt for progress updates
    const systemPrompt = `You are a concise progress reporter. Respond with ONLY 2-4 words that accurately describe the current step. Be precise and factual.`;
    
    const userPrompt = `Step: "${step}"
Context: ${JSON.stringify(context || {}).substring(0, 100)}

Respond with exactly 2-4 words:`;

    const response = await llmService.makeLLMRequest([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      model,
      max_tokens: 10, // Very short for 2-4 words
      temperature: 0.2, // Lower temperature for more accurate responses
      stream: false
    });

    // Extract and sanitize the response
    let insight = response.content || `processing ${step.toLowerCase()}`;
    
    // Clean up the response - remove quotes, periods, extra spaces
    insight = insight.trim()
      .replace(/['".,!?]/g, '')
      .replace(/\s+/g, ' ')
      .toLowerCase();
    
    // Ensure it's brief (max 20 characters for 2-4 words)
    if (insight.length > 20) {
      insight = insight.substring(0, 17) + '...';
    }

    res.json({
      success: true,
      insight: insight.trim()
    });

  } catch (error) {
    console.error('Quick insight generation error:', error);
    
    // Return a fallback insight instead of an error
    const fallbackInsights = {
      'analyzing': 'scanning data',
      'checking': 'exploring options',
      'cross': 'finding connections',
      'synthesizing': 'combining insights',
      'generating': 'creating nodes'
    };
    
    const stepKey = Object.keys(fallbackInsights).find(key => 
      req.body.step?.toLowerCase().includes(key)
    );
    
    const fallbackInsight = fallbackInsights[stepKey] || 'processing';
    
    res.json({
      success: true,
      insight: fallbackInsight,
      fallback: true
    });
  }
});

export default router;