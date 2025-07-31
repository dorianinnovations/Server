import axios from "axios";
import dotenv from "dotenv";
import https from "https";
import http from "http";
// Removed archived services - processingObserver and workflowObserver

dotenv.config();

// HIGH-PERFORMANCE CONNECTION POOLING
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000, // 30 seconds
  maxSockets: 50, // Max concurrent connections
  maxFreeSockets: 10, // Keep 10 connections open
  timeout: 45000, // 45 second timeout
});

const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 45000,
});

// Configure axios defaults for connection pooling
axios.defaults.httpsAgent = httpsAgent;
axios.defaults.httpAgent = httpAgent;

// Helper function to get a clean referer URL
const getRefererUrl = () => {
  const referer = process.env.HTTP_REFERER || "http://localhost:3000";
  // Remove any potentially problematic characters
  return referer.replace(/[^\w\-.:\/]/g, '');
};

export const createLLMService = () => {
  const openRouterApiUrl = "https://openrouter.ai/api/v1/chat/completions";
  
  const makeLLMRequest = async (promptOrMessages, options = {}) => {
    const {
      stop = null,
      n_predict = 500,
      temperature = 0.8,
      tools = null,
      tool_choice = "auto",
      attachments = null,
      observerSessionId = null, // NEW: for observer bridge
      observerPurpose = 'default', // NEW: what this LLM call is for
      workflowStepId = null, // NEW: for workflow progress
      requiresGPT4 = false, // NEW: force GPT-4 usage
      cacheResponse = false, // NEW: whether to cache this response
      chatContext = null, // NEW: chat context for memory
      userId = null // NEW: user ID for tracking
    } = options;

    // Model selection with fallback hierarchy
    let selectedModel = "openai/gpt-4o-mini";
    
    if (requiresGPT4 || (tools && tools.length > 0)) {
      selectedModel = "openai/gpt-4o";
    }
    
    // Force GPT-4 for vision requests
    if (attachments && attachments.length > 0) {
      selectedModel = "openai/gpt-4o";
    }

    console.log(`🤖 LLM REQUEST: ${selectedModel} | Tools: ${tools ? tools.length : 0} | Attachments: ${attachments ? attachments.length : 0}`);

    // Start timing
    const llmStartTime = Date.now();

    try {
      // Handle both string prompts and messages array with vision support
      const messages = Array.isArray(promptOrMessages) 
        ? promptOrMessages 
        : parsePromptToMessages(promptOrMessages, attachments);

      const requestBody = {
        model: selectedModel,
        messages: messages,
        temperature: temperature,
        max_tokens: n_predict,
        stream: false,
      };

      // Add stop sequences if provided
      if (stop) {
        requestBody.stop = Array.isArray(stop) ? stop : [stop];
      }

      // Add tools if provided
      if (tools && Array.isArray(tools) && tools.length > 0) {
        requestBody.tools = tools;
        requestBody.tool_choice = tool_choice;
        
        console.log(`🔧 LLM SERVICE - Adding ${tools.length} tools to request`);
      }

      const config = {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": getRefererUrl(),
          "X-Title": "Numina Server",
        },
        timeout: 180000, // 3 minutes timeout
        httpsAgent: httpsAgent, // Use persistent connection
      };

      // Make the API request with high-performance connection pooling
      const response = await axios.post(openRouterApiUrl, requestBody, config);

      const responseTime = Date.now() - llmStartTime;
      console.log(
        `OpenRouter API Response Status: ${response.status} (${responseTime}ms)`
      );

      // Debug: Log the full response structure to trace empty content issues
      console.log('🔍 LLM Response Debug:', {
        status: response.status,
        hasData: !!response.data,
        hasChoices: !!response.data?.choices,
        choicesLength: response.data?.choices?.length,
        firstChoice: response.data?.choices?.[0] ? {
          hasMessage: !!response.data.choices[0].message,
          messageContent: response.data.choices[0].message?.content || '[EMPTY]',
          contentLength: response.data.choices[0].message?.content?.length || 0,
          finishReason: response.data.choices[0].finish_reason
        } : null
      });

      const choice = response.data.choices[0];
      
      // Check for empty content and log warning
      if (!choice.message.content || choice.message.content.trim() === '') {
        console.warn('⚠️ LLM returned empty content!', {
          finishReason: choice.finish_reason,
          fullChoice: JSON.stringify(choice, null, 2)
        });
      }
      
      // Debug tool calls structure
      if (choice.message.tool_calls) {
        console.log(`🔧 LLM SERVICE - Raw tool calls:`, JSON.stringify(choice.message.tool_calls, null, 2));
      }
      
      // Notify observer that LLM request completed successfully
      if (observerSessionId) {
        const duration = Date.now() - llmStartTime;
        const messages = Array.isArray(promptOrMessages) ? promptOrMessages : [{ content: promptOrMessages }];
        const userMessage = messages.find(m => m.role === 'user')?.content || messages[messages.length - 1]?.content || '';
        const queryContext = userMessage.length > 100 ? userMessage.substring(0, 100) : userMessage;
        
        // Processing observer removed - LLM complete tracking disabled
      }

      // Return response in consistent format with tool calls support
      return {
        content: choice.message.content,
        stop_reason: choice.finish_reason,
        usage: response.data.usage,
        tool_calls: choice.message.tool_calls || null,
        choice: choice, // Include full choice for tool call handling
      };
    } catch (error) {
      // Observer removed - error tracking disabled

      console.error("OpenRouter API Error:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });

      // For vision errors, log the problematic request structure
      if (error.response?.status === 400) {
        console.error("🖼️ VISION ERROR - 400 Bad Request detected");
      }
      
      // LOG THE EXACT ERROR RESPONSE
      if (error.response?.data) {
        console.error("🔥 EXACT OPENROUTER ERROR:", JSON.stringify(error.response.data, null, 2));
      }
      
      if (error.response?.status === 401) {
        throw new Error("Invalid OpenRouter API key. Please check your OPENROUTER_API_KEY environment variable.");
      } else if (error.response?.status === 429) {
        throw new Error("OpenRouter API rate limit exceeded. Please try again later.");
      } else if (error.response?.status === 402) {
        throw new Error("OpenRouter API insufficient credits. Please check your account balance.");
      } else {
        throw new Error(`OpenRouter API error: ${error.message}`);
      }
    }
  };

  const makeStreamingRequest = async (promptOrMessages, options = {}) => {
    const {
      stop = null,
      n_predict = 500,
      temperature = 0.8,
      tools = null,
      tool_choice = "auto",
    } = options;

    try {
      // Handle both string prompts and messages array with vision support
      const messages = Array.isArray(promptOrMessages) 
        ? promptOrMessages 
        : parsePromptToMessages(promptOrMessages, attachments);

      const requestBody = {
        model: "openai/gpt-4o-mini",
        messages: messages,
        temperature: temperature,
        max_tokens: n_predict,
        stream: true,
      };

      // Add stop sequences if provided
      if (stop) {
        requestBody.stop = Array.isArray(stop) ? stop : [stop];
      }

      // Add tools if provided
      if (tools && Array.isArray(tools) && tools.length > 0) {
        requestBody.tools = tools;
        requestBody.tool_choice = tool_choice;
      }

      const config = {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": getRefererUrl(),
          "X-Title": "Numina Server",
        },
        responseType: "stream",
        timeout: 180000,
        httpsAgent: httpsAgent,
      };

      console.log("Making streaming request to OpenRouter API");
      const response = await axios.post(openRouterApiUrl, requestBody, config);

      console.log(`OpenRouter Streaming API Response Status: ${response.status}`);
      return response.data;
    } catch (error) {
      console.error("OpenRouter Streaming API Error:", {
        name: error.name,
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });

      if (error.response?.status === 401) {
        throw new Error("Invalid OpenRouter API key. Please check your OPENROUTER_API_KEY environment variable.");
      } else if (error.response?.status === 429) {
        throw new Error("OpenRouter API rate limit exceeded. Please try again later.");
      } else if (error.response?.status === 402) {
        throw new Error("OpenRouter API insufficient credits. Please check your account balance.");
      } else {
        throw new Error(`OpenRouter Streaming API error: ${error.message}`);
      }
    }
  };

  return {
    makeLLMRequest,
    makeStreamingRequest,
  };
};

/**
 * VISION-OPTIMIZED MESSAGE PARSER
 * Converts string prompts + attachments to OpenAI message format with proper vision support
 */
function parsePromptToMessages(prompt, attachments = null) {
  // If it's already a messages array, return as-is
  if (Array.isArray(prompt)) {
    return prompt;
  }

  const messages = [];

  // Handle attachments (images)
  if (attachments && attachments.length > 0) {
    const imageAttachments = attachments.filter(att => att.type === 'image');
    
    if (imageAttachments.length > 0) {
      // Create a message with text + images
      const content = [
        {
          type: "text",
          text: prompt || "Please analyze this image."
        }
      ];

      // Add each image
      imageAttachments.forEach(attachment => {
        if (attachment.data) {
          content.push({
            type: "image_url",
            image_url: {
              url: attachment.data // Should be a data URL or base64
            }
          });
        }
      });

      messages.push({
        role: "user",
        content: content
      });
    } else {
      // No image attachments, just text
      messages.push({
        role: "user", 
        content: prompt
      });
    }
  } else {
    // No attachments, just text
    messages.push({
      role: "user",
      content: prompt
    });
  }

  return messages;
}

/**
 * ADVANCED HIDDEN PATTERN ANALYSIS ENGINE
 * Processes LLM responses to extract hidden behavioral patterns using cognitive triggers
 */

// Cognitive trigger patterns that reveal hidden user psychology  
const triggerPatterns = {
  temporal: {
    patterns: [
      /\b(?:years?|months?|weeks?|days?)\s+(?:ago|later|before|after|since)\b/gi,
      /\b(?:when|while|during|throughout|until|since)\s+(?:i|you|we|they)\b/gi,
      /\b(?:first|last|next|previous|recent|current|future|past)\s+(?:time|year|month|week|day)\b/gi,
      /\b(?:always|never|sometimes|often|rarely|frequently|occasionally)\b/gi,
      /\b(?:used to|would often|tend to|have been|will be|going to)\b/gi
    ],
    weight: 0.85,
    triggerType: 'temporal_awareness'
  },
  numerical: {
    patterns: [
      /\b(?:\d+\.?\d*)\s*(?:%|percent|percentage|times?|occasions?|instances?)\b/gi,
      /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:times?|ways?|methods?|approaches?)\b/gi,
      /\b(?:first|second|third|fourth|fifth|primary|secondary)\s+(?:reason|factor|element|aspect)\b/gi,
      /\b(?:more|less|fewer|greater|smaller|higher|lower|increased|decreased)\s+(?:than|compared to)\b/gi
    ],
    weight: 0.75,
    triggerType: 'quantitative_thinking'
  },
  certainty: {
    patterns: [
      /\b(?:definitely|certainly|absolutely|positively|undoubtedly|without question)\b/gi,
      /\b(?:maybe|perhaps|possibly|probably|likely|might|could|seems?|appears?)\b/gi,
      /\b(?:i think|i believe|i feel|i guess|i suppose|it seems|it appears)\b/gi,
      /\b(?:confident|sure|certain|convinced|doubtful|uncertain|unsure)\b/gi
    ],
    weight: 0.70,
    triggerType: 'confidence_calibration'
  },
  selfReference: {
    patterns: [
      /\b(?:i am|i'm|i have|i've|i do|i don't|i can|i can't|i will|i won't)\b/gi,
      /\b(?:my|mine|myself|me|i)\s+(?:experience|approach|method|style|way|preference)\b/gi,
      /\b(?:personally|for me|in my case|from my perspective)\b/gi,
      /\b(?:i notice|i find|i discover|i realize|i understand|i see)\b/gi
    ],
    weight: 0.80,
    triggerType: 'self_awareness'
  },
  emotional: {
    patterns: [
      /\b(?:feel|feeling|felt|emotion|emotional|emotionally)\b/gi,
      /\b(?:excited|anxious|worried|confident|frustrated|satisfied|disappointed|pleased)\b/gi,
      /\b(?:love|hate|like|dislike|enjoy|prefer|appreciate|value)\b/gi,
      /\b(?:hope|fear|worry|concern|excitement|anticipation|dread)\b/gi
    ],
    weight: 0.65,
    triggerType: 'emotional_expression'
  },
  problemSolving: {
    patterns: [
      /\b(?:problem|solution|challenge|issue|difficulty|obstacle|barrier)\b/gi,
      /\b(?:solve|fix|resolve|address|tackle|handle|deal with|overcome)\b/gi,
      /\b(?:strategy|approach|method|technique|way|process|system)\b/gi,
      /\b(?:works?|doesn't work|effective|ineffective|successful|failed)\b/gi
    ],
    weight: 0.90,
    triggerType: 'analytical_processing'
  }
};

/**
 * Analyzes text for hidden patterns using cognitive triggers
 */
function analyzeHiddenPatterns(responseContent, context = {}) {
  if (!responseContent || typeof responseContent !== 'string') {
    return [];
  }
  
  const patterns = [];
  let totalTriggerScore = 0;
  let maxCategoryScore = 0;
  let dominantTriggerType = 'general';
  
  // Analyze each trigger category
  for (const [category, config] of Object.entries(triggerPatterns)) {
    let categoryScore = 0;
    let categoryMatches = [];
    
    // Check each pattern in the category
    for (const pattern of config.patterns) {
      const matches = responseContent.match(pattern) || [];
      categoryMatches = categoryMatches.concat(matches);
      categoryScore += matches.length * config.weight;
    }
    
    totalTriggerScore += categoryScore;
    
    // Track dominant trigger type
    if (categoryScore > maxCategoryScore) {
      maxCategoryScore = categoryScore;
      dominantTriggerType = config.triggerType;
    }
    
    // If significant matches found, create a pattern entry
    if (categoryMatches.length > 0 && categoryScore > 0.5) {
      const evidenceText = categoryMatches.slice(0, 3).join(', ');
      const confidenceScore = Math.min(0.95, categoryScore / (categoryMatches.length + 2));
      
      patterns.push({
        category,
        triggerType: config.triggerType,
        matches: categoryMatches.length,
        evidence: evidenceText,
        confidence: confidenceScore,
        weight: config.weight,
        score: categoryScore
      });
    }
  }
  
  // Only proceed with pattern generation if meaningful triggers detected
  if (totalTriggerScore < 1.0) {
    return [];
  }
  
  // Generate interpretive patterns using the dominant trigger context
  const triggerContext = {
    dominantType: dominantTriggerType,
    totalScore: totalTriggerScore,
    triggerType: dominantTriggerType,
    confidenceLevel: Math.min(0.90, totalTriggerScore / 10)
  };
  
  return extractCognitivePatterns(responseContent, triggerContext);
}

/**
 * Extracts cognitive patterns from response using trigger analysis
 */
function extractCognitivePatterns(responseContent, triggerContext) {
  const patterns = [];
  
  // Split response into analyzable blocks
  const blocks = responseContent.split(/\n\s*\n/).filter(block => block.trim().length > 20);
  
  for (let i = 0; i < Math.min(blocks.length, 3); i++) {
    const block = blocks[i].trim();
    
    try {
      // Look for structured pattern markers in the response
      const patternMatch = block.match(/\*\*PATTERN:\*\*(.*?)(?=\*\*[A-Z]+:|$)/s);
      const evidenceMatch = block.match(/\*\*EVIDENCE:\*\*(.*?)(?=\*\*[A-Z]+:|$)/s);
      const significanceMatch = block.match(/\*\*SIGNIFICANCE:\*\*(.*?)(?=\*\*[A-Z]+:|$)/s);
      const archetypeMatch = block.match(/\*\*ARCHETYPE:\*\*(.*?)(?=\*\*[A-Z]+:|$)/s);
      const explorationMatch = block.match(/\*\*EXPLORATION:\*\*(.*?)(?=\*\*[A-Z]+:|$)/s);
      
      if (patternMatch) {
        patterns.push({
          id: `pattern_${Date.now()}_${i}`,
          title: patternMatch[1].trim(),
          evidence: evidenceMatch ? evidenceMatch[1].trim() : '',
          significance: significanceMatch ? significanceMatch[1].trim() : '',
          archetype: archetypeMatch ? archetypeMatch[1].trim() : '',
          exploration: explorationMatch ? explorationMatch[1].trim() : '',
          triggerType: triggerContext.triggerType,
          discoveryTimestamp: new Date().toISOString(),
          confidence: calculatePatternConfidence(patternMatch[1], evidenceMatch?.[1] || ''),
          type: classifyPatternType(patternMatch[1])
        });
      }
    }
    
  } catch (error) {
    console.warn('⚠️ Failed to parse pattern response:', error.message);
    
    // Fallback: create a single pattern from the entire response
    if (responseContent && responseContent.length > 50) {
      patterns.push({
        id: `pattern_${Date.now()}_fallback`,
        title: 'Hidden Pattern Detected',
        evidence: responseContent.substring(0, 200) + '...',
        significance: 'This pattern requires further exploration to understand its full meaning.',
        archetype: 'Unknown',
        exploration: 'Consider what connections might exist between your recent discoveries.',
        triggerType: triggerContext.triggerType,
        discoveryTimestamp: new Date().toISOString(),
        confidence: 0.5,
        type: 'general'
      });
    }
  }
  
  return patterns.slice(0, 3); // Limit to 3 patterns per analysis
}

/**
 * Calculate confidence score for discovered pattern
 */
function calculatePatternConfidence(title, evidence) {
  let confidence = 0.5; // Base confidence
  
  // Boost confidence for specific evidence
  if (evidence) {
    if (evidence.includes('date') || evidence.includes('number')) confidence += 0.2;
    if (evidence.includes('months') || evidence.includes('years')) confidence += 0.1;
    if (evidence.includes('locked') || evidence.includes('session')) confidence += 0.1;
    if (evidence.length > 100) confidence += 0.1;
  }
  
  // Boost confidence for specific pattern types
  if (title.toLowerCase().includes('temporal') || title.toLowerCase().includes('timing')) confidence += 0.1;
  if (title.toLowerCase().includes('numerical') || title.toLowerCase().includes('sequence')) confidence += 0.1;
  
  return Math.min(0.95, confidence);
}

/**
 * Classify pattern type for organization
 */
function classifyPatternType(title) {
  const titleLower = title.toLowerCase();
  
  if (titleLower.includes('temporal') || titleLower.includes('time') || titleLower.includes('date')) return 'temporal';
  if (titleLower.includes('numerical') || titleLower.includes('number') || titleLower.includes('sequence')) return 'numerical';
  if (titleLower.includes('thematic') || titleLower.includes('concept') || titleLower.includes('theme')) return 'thematic';
  if (titleLower.includes('behavioral') || titleLower.includes('pattern') || titleLower.includes('habit')) return 'behavioral';
  if (titleLower.includes('emotional') || titleLower.includes('feeling') || titleLower.includes('mood')) return 'emotional';
  
  return 'general';
}