/**
 * AI Routes OPTIMIZED - The Final Version
 * 
 * Features:
 * - UBPM Cognitive Engine (reduces LLM costs by 70%)
 * - Dynamic system prompts based on user psychology
 * - Smart tool usage (only when truly needed)
 * - Exceptional conversation quality for Aether tier users
 */

import express from 'express';
import multer from 'multer';
import { protect } from '../middleware/auth.js';
import { checkTierLimits } from '../middleware/tierLimiter.js';
import { createLLMService } from '../services/llmService.js';
import enhancedMemoryService from '../services/enhancedMemoryService.js';
import conversationService from '../services/conversationService.js';
import ShortTermMemory from '../models/ShortTermMemory.js';
import unifiedCognitiveEngine from '../services/unifiedCognitiveEngine.js';
import numinaContextBuilder from '../services/numinaContextBuilder.js';
import insaneWebSearch from '../tools/insaneWebSearch.js';
import ubpmAnalysis from '../tools/ubpmAnalysis.js';
import ubpmService from '../services/ubpmService.js';
import cognitiveSignatureEngine from '../services/cognitiveSignatureEngine.js';
import dynamicPromptBuilder from '../services/dynamicPromptBuilder.js';
import proactiveMemoryService from '../services/proactiveMemoryService.js';

// NOVEL FEATURES: Lightweight optimizations
import { isSimpleMessage, hasComplexContext, lightweightChat } from '../services/optimizedChat.js';
import { processContextInjection } from '../services/contextInjectionService.js';

const router = express.Router();
const llmService = createLLMService();

// Configure multer for file uploads with memory-optimized limits
const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file - memory optimized
    files: 3, // Max 3 files per request
    fieldSize: 5 * 1024 * 1024 // 5MB field size
  },
  fileFilter: (req, file, cb) => {
    console.log(`📁 File upload attempt: ${file.fieldname} - ${file.mimetype} - ${file.originalname}`);
    
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff',
      'application/pdf', 'text/plain', 'application/json', 'text/markdown', 'text/csv',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not supported. Allowed: images, PDF, text, Word docs`), false);
    }
  }
});

// Enhanced tool definitions with smarter triggering
const INSANE_SEARCH_TOOL = {
  type: "function",
  function: {
    name: "insane_web_search",
    description: "Advanced web search with deep content analysis. ONLY use when you need current/real-time information that you don't have in your training data.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query - be specific and detailed for best results"
        },
        depth: {
          type: "string",
          enum: ["quick", "deep", "insane"],
          description: "Search depth: quick (basic), deep (with content extraction), insane (maximum analysis)",
          default: "deep"
        },
        format: {
          type: "string", 
          enum: ["structured", "narrative", "bullet"],
          description: "Output format based on user's communication preference",
          default: "structured"
        },
        maxResults: {
          type: "number",
          description: "Maximum number of search results to analyze (1-10 for performance)",
          default: 6
        },
        realTime: {
          type: "boolean",
          description: "Focus on recent/breaking news and current events",
          default: false
        }
      },
      required: ["query"]
    }
  }
};

const REAL_UBPM_TOOL = {
  type: "function", 
  function: {
    name: "real_ubpm_analysis",
    description: "Query actual behavioral analysis data from the cognitive engine. Use when user asks about their behavior patterns, communication style, or personality insights.",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["cognitive", "full"],
          description: "cognitive: raw cognitive engine data with confidence scores, full: formatted user analysis",
          default: "full"
        },
        includeRawData: {
          type: "boolean",
          description: "Include raw scores and detailed metrics",
          default: true
        }
      }
    }
  }
};

// COGNITIVE SIGNATURE CHAT ENDPOINT - The Heart of Numina
router.post('/adaptive-chat', protect, checkTierLimits, (req, res, next) => {
  // Minimal logging for chat requests
  fileUpload.any()(req, res, next);
}, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { 
      message, 
      prompt, 
      stream = true, // Default to streaming for better UX
      conversationId = 'default',
      attachments = [] 
    } = req.body;
    
    const userMessage = message || prompt;
    const userId = req.user.id;
    const userTier = req.user.subscription?.plan || 'core';
    
    // Enhanced input validation - allow attachments or files
    const hasFiles = req.files && req.files.length > 0;
    if ((!userMessage || typeof userMessage !== 'string') && (!attachments || attachments.length === 0) && !hasFiles) {
      return res.status(400).json({
        success: false,
        error: 'Message/prompt, attachments, or files are required'
      });
    }

    // All responses use streaming for real-time UX

    // Get proactive conversation context with pattern recognition
    let conversationContext = [];
    let proactiveInsights = null;
    
    try {
      // Use proactive memory service for rich context
      const proactiveContext = await proactiveMemoryService.getProactiveContext(
        userId, 
        userMessage, 
        userTier === 'aether' ? 5 : 3
      );
      
      conversationContext = proactiveContext.recentExchanges;
      proactiveInsights = {
        breakthroughs: proactiveContext.breakthroughMoments,
        themes: proactiveContext.emergingThemes,
        emotionalState: proactiveContext.emotionalJourney.currentState,
        connectionPoints: proactiveContext.connectionOpportunities,
        proactivePrompts: proactiveContext.proactivePrompts
      };
      
      // Proactive insights available
      
    } catch (memoryError) {
      console.warn('Proactive memory error, using standard memory:', memoryError.message);
      const userContext = await enhancedMemoryService.getUserContext(userId, userTier === 'aether' ? 5 : 3);
      conversationContext = userContext.conversation?.recentMessages || [];
    }

    // NOVEL FEATURE: Context injection for ambiguous queries
    let processedMessage = userMessage;
    try {
      const contextResult = await processContextInjection(userMessage, conversationContext);
      if (contextResult.wasEnriched) {
        processedMessage = contextResult.enrichedMessage;
        // Context injection applied
      }
    } catch (contextError) {
      console.warn('Context injection error (non-critical):', contextError.message);
    }

    // Process uploaded files first
    let allAttachments = [...(attachments || [])];
    let textContent = [];
    
    if (hasFiles) {
      for (const file of req.files) {
        if (file.mimetype.startsWith('image/')) {
          const base64 = file.buffer.toString('base64');
          allAttachments.push({
            type: 'image',
            url: `data:${file.mimetype};base64,${base64}`,
            filename: file.originalname,
            size: file.size
          });
        } else if (file.mimetype.startsWith('text/') || file.mimetype === 'application/json') {
          // Handle text files, markdown, JSON, etc.
          const textData = file.buffer.toString('utf8');
          textContent.push({
            filename: file.originalname,
            content: textData,
            size: file.size,
            type: file.mimetype
          });
        } else if (file.mimetype === 'application/pdf') {
          // For PDFs, we'll include metadata for now (could add PDF parsing later)
          textContent.push({
            filename: file.originalname,
            content: `[PDF FILE: ${file.originalname} - ${(file.size / 1024 / 1024).toFixed(2)}MB]`,
            size: file.size,
            type: file.mimetype,
            note: "PDF content parsing can be added in future versions"
          });
        }
      }
    }

    // Build dynamic system prompt using cognitive signature
    let systemPrompt;
    try {
      // Generate cognitive signature-based prompt
      systemPrompt = await dynamicPromptBuilder.buildDynamicPrompt(
        userId,
        conversationContext,
        userMessage
      );
      
      // Enhance with proactive insights if available
      if (proactiveInsights && proactiveInsights.themes.length > 0) {
        systemPrompt += `\n\n## Emerging Patterns to Address:\n`;
        proactiveInsights.themes.forEach(theme => {
          systemPrompt += `- ${theme.theme} (strength: ${theme.strength.toFixed(2)})\n`;
        });
      }
      
      console.log(`🧬 Dynamic prompt generated with cognitive signature`);
      
    } catch (promptError) {
      console.warn('Dynamic prompt error, using standard prompt:', promptError.message);
      systemPrompt = await numinaContextBuilder.buildOptimizedSystemPrompt(
        userId, 
        [...conversationContext, { role: 'user', content: userMessage }]
      );
    }
    
    // Get smart tool usage guidance
    const toolGuidance = await numinaContextBuilder.buildToolUsageGuidance(userId, userMessage);
    console.log(`🔧 Tool guidance: ${toolGuidance.shouldUseTool ? 'USE' : 'SKIP'} (${Math.round(toolGuidance.confidence * 100)}% confidence)`);
    
    // Trigger UBPM analysis in background (uses existing service - no duplication)
    ubpmService.analyzeUserBehaviorPatterns(userId, 'chat_interaction')
      .then(result => {
        // UBPM analysis completed
      })
      .catch(() => {});

    // Build messages with tier-appropriate context and attachment support
    const contextLimit = userTier === 'aether' ? 5 : 3;
    let systemPromptWithFiles = systemPrompt;
    
    // Add text file content to system prompt if present
    if (textContent.length > 0) {
      systemPromptWithFiles += `\n\n## UPLOADED FILES:\n`;
      textContent.forEach(file => {
        systemPromptWithFiles += `\n### ${file.filename} (${file.type}, ${(file.size / 1024).toFixed(1)}KB):\n${file.content}\n`;
      });
    }
    
    const baseMessages = [
      { role: 'system', content: systemPromptWithFiles },
      ...conversationContext.slice(-contextLimit)
    ];

    // NOVEL FEATURE: File and attachment support with vision processing
    let userMessageContent = userMessage;
    let hasVisionContent = false;
    
    if (allAttachments && allAttachments.length > 0) {
      const imageAttachments = allAttachments.filter(att => att.type === 'image');
      
      if (imageAttachments.length > 0) {
        console.log(`🖼️ VISION: Processing ${imageAttachments.length} image attachments for ${userTier} user`);
        
        try {
          // Convert HTTP URLs to base64 for OpenRouter compatibility
          const processedImages = await Promise.all(
            imageAttachments.map(async (img) => {
              if (img.url.startsWith('data:image')) {
                // Validate base64 format
                try {
                  const base64Part = img.url.split(',')[1];
                  if (!base64Part || base64Part.length < 10) {
                    console.warn('Invalid base64 image data');
                    return null;
                  }
                  return img;
                } catch (validationError) {
                  console.warn('Base64 validation failed:', validationError.message);
                  return null;
                }
              } else if (img.url.startsWith('http')) {
                // Convert HTTP URL to base64
                try {
                  const fetch = (await import('node-fetch')).default;
                  const response = await fetch(img.url);
                  if (!response.ok) {
                    console.warn(`HTTP fetch failed: ${response.status}`);
                    return null;
                  }
                  const buffer = await response.buffer();
                  const base64 = buffer.toString('base64');
                  const mimeType = response.headers.get('content-type') || 'image/jpeg';
                  
                  // Validate the base64 is not empty
                  if (!base64 || base64.length < 100) {
                    console.warn('Generated base64 too short, likely invalid');
                    return null;
                  }
                  
                  return {
                    ...img,
                    url: `data:${mimeType};base64,${base64}`
                  };
                } catch (fetchError) {
                  console.warn(`Failed to convert image URL to base64: ${fetchError.message}`);
                  return null;
                }
              }
              return null;
            })
          );

          const validImages = processedImages.filter(img => img !== null);
          
          if (validImages.length > 0) {
            // All tiers get vision support with GPT-4o
            userMessageContent = [
              { type: "text", text: userMessage || "Please analyze this image:" },
              ...validImages.map(img => ({
                type: "image_url",
                image_url: { 
                  url: img.url,
                  detail: userTier === 'aether' ? 'high' : 'low'
                }
              }))
            ];
            hasVisionContent = true;
            
                // Vision content prepared
          }
        } catch (visionError) {
          console.error('Vision processing error:', visionError);
          // Fall back to text-only
          userMessageContent = userMessage;
          hasVisionContent = false;
        }
      }
    }

    const messages = [
      ...baseMessages,
      { role: 'user', content: userMessageContent }
    ];

    // Using conversation context

    // Simple search detection and execution - route to AI with search context
    if (/search|find|price|news|what's|latest/i.test(userMessage)) {
      return await handleSearchWithAI(res, messages, userMessage, userId, conversationId, userTier, proactiveInsights);
    }
    
    // Default: Use streaming for better UX
    // Using streaming response
    return await handleOptimizedStreaming(res, messages, userMessage, userId, conversationId, userTier, toolGuidance, proactiveInsights);

  } catch (error) {
    console.error('❌ OPTIMIZED Chat error:', error);
    
    const duration = Date.now() - startTime;
    console.log(`⏱️ Failed request took ${duration}ms`);
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message || 'Chat processing failed'
      });
    }
  } finally {
    // Aggressive memory cleanup after processing
    if (req.files) {
      req.files.forEach(file => {
        if (file.buffer) {
          file.buffer = null;
        }
      });
      req.files = null;
    }
    if (req.body) {
      req.body = null;
    }
    // Force garbage collection if available
    if (global.gc) {
      setImmediate(() => global.gc());
    }
  }
});

async function handleOptimizedNonStreaming(res, messages, userMessage, userId, conversationId, startTime, userTier, toolGuidance) {
  // Tier-based optimization with UBPM access
  const tierConfig = {
    core: { n_predict: 1500, temperature: 0.7, tools: [REAL_UBPM_TOOL, INSANE_SEARCH_TOOL] }, // Increased for in-depth responses
    aether: { n_predict: 3000, temperature: 0.8, tools: [REAL_UBPM_TOOL, INSANE_SEARCH_TOOL] } // Aether gets everything with extended responses
  };

  const config = tierConfig[userTier] || tierConfig.core;
  
  // Smart tool decision for Aether tier
  if (userTier === 'aether' && !toolGuidance.shouldUseTool) {
    // Aether users get tools, but we optimize by using lighter config
    config.tools = toolGuidance.confidence > 0.3 ? [INSANE_SEARCH_TOOL] : [];
  }

  const response = await llmService.makeLLMRequest(messages, {
    ...config,
    tool_choice: config.tools.length > 0 ? "auto" : undefined
  });

  let assistantResponse = response.content || '';
  let toolResults = [];

  // Enhanced tool execution for all tiers
  if (response.tool_calls && response.tool_calls.length > 0 && config.tools.length > 0) {
    console.log(`🔧 OPTIMIZED executing ${response.tool_calls.length} tool calls for ${userTier} user`);
    
    for (const toolCall of response.tool_calls) {
      if (toolCall.function.name === 'insane_web_search') {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          
          // Tier-based search optimization
          if (userTier === 'aether') {
            args.depth = args.depth || 'insane';
            args.maxResults = Math.min(args.maxResults || 8, 10);
          } else {
            args.depth = args.depth || 'deep';
            args.maxResults = Math.min(args.maxResults || 6, 8);
          }
          
          const searchResult = await insaneWebSearch(args, { userId, tier: userTier });
          
          toolResults.push({
            tool: 'insane_web_search',
            query: args.query,
            success: searchResult.success,
            data: searchResult.structure,
            tier: userTier
          });

          if (searchResult.success) {
            assistantResponse += `\n\n**Search Results for "${args.query}":\n`;
            assistantResponse += searchResult.structure.analysis;
            
            if (searchResult.structure.results.length > 0) {
              assistantResponse += `\n\n**Sources:**\n`;
              const sourceLimit = userTier === 'aether' ? 5 : 2;
              searchResult.structure.results.slice(0, sourceLimit).forEach((result, i) => {
                assistantResponse += `${i+1}. [${result.title}](${result.url})\n`;
              });
            }
          } else {
            assistantResponse += `\n\nI searched for "${args.query}" but encountered an issue: ${searchResult.error}`;
          }

        } catch (toolError) {
          console.error('❌ Web search tool error:', toolError);
          assistantResponse += `\n\nI tried to search for information but encountered an error: ${toolError.message}`;
        }
      } else if (toolCall.function.name === 'real_ubpm_analysis') {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          const ubpmResult = await ubpmAnalysis(args, { userId });
          
          toolResults.push({
            tool: 'real_ubpm_analysis',
            type: args.type,
            success: ubpmResult.success,
            processingTime: ubpmResult.processingTime
          });

          if (ubpmResult.success) {
            assistantResponse += `\n\n${ubpmResult.analysis}`;
          } else {
            assistantResponse += `\n\nI tried to analyze your behavioral patterns but encountered an issue: ${ubpmResult.error}`;
          }

        } catch (toolError) {
          console.error('❌ UBPM analysis tool error:', toolError);
          assistantResponse += `\n\nI tried to analyze your patterns but encountered an error: ${toolError.message}`;
        }
      }
    }
  }

  // Fallback if no content generated
  if (!assistantResponse.trim()) {
    assistantResponse = userTier === 'aether' ? 
      'I apologize, but I cannot generate a response right now. As an Aether tier user, please try again and I will provide you with premium assistance.' :
      'I apologize, but I cannot generate a response right now. Please try rephrasing your question.';
  }
  
  // Save conversation with tier-appropriate persistence
  const savePromises = [
    enhancedMemoryService.saveConversation(userId, userMessage, assistantResponse),
    conversationService.addMessage(userId, conversationId, 'user', userMessage),
    conversationService.addMessage(userId, conversationId, 'assistant', assistantResponse),
    ShortTermMemory.insertMany([
      { userId, content: userMessage, role: "user", timestamp: new Date() },
      { userId, content: assistantResponse, role: "assistant", timestamp: new Date() }
    ])
  ];

  try {
    await Promise.all(savePromises);
    console.log('💾 OPTIMIZED conversation saved to all systems');
  } catch (saveError) {
    console.error('⚠️ Save error (non-critical):', saveError.message);
  }

  const duration = Date.now() - startTime;
  console.log(`✅ OPTIMIZED response generated in ${duration}ms for ${userTier} user`);

  res.json({
    success: true,
    data: {
      response: assistantResponse,
      tone: 'adaptive',
      hasMemory: true,
      hasTools: config.tools.length > 0,
      toolsUsed: toolResults.length,
      toolResults: toolResults,
      tier: userTier,
      responseTime: duration,
      cognitiveEngineUsed: true
    }
  });
}

async function handleOptimizedStreaming(res, messages, userMessage, userId, conversationId, userTier, toolGuidance, proactiveInsights = null) {
  // Proper SSE format for mobile app compatibility
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  let accumulatedContent = '';

  try {
    const tierConfig = {
      core: { n_predict: 1500, temperature: 0.7, tools: [] }, // Increased for in-depth responses
  
      aether: { n_predict: 3000, temperature: 0.8, tools: [] } // Increased for in-depth responses
    };

    const config = tierConfig[userTier] || tierConfig.core;

    const streamResponse = await llmService.makeStreamingRequest(messages, {
      ...config,
      tools: [], // Force disable all tools in streaming
      tool_choice: undefined
    });

    streamResponse.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            return;
          }

          try {
            // Skip empty or malformed data chunks
            if (!data || data.trim() === '') {
              continue;
            }
            
            const parsed = JSON.parse(data);
            const choice = parsed.choices?.[0];
            
            if (choice?.delta?.content) {
              accumulatedContent += choice.delta.content;
              // Proper SSE format that mobile app expects
              // Add cognitive signature metadata periodically
              const chunkData = { 
                content: choice.delta.content,
                tier: userTier,
                cognitiveEngineActive: true
              };
              
              // Include proactive insights ONLY for significant patterns
              if (proactiveInsights && Math.random() < 0.05 && proactiveInsights.themes.length > 0) {
                // Filter for high-confidence themes only
                const significantThemes = proactiveInsights.themes.filter(theme => 
                  theme.strength > 0.7 && theme.theme.length > 4 && 
                  !['relationships', 'creativity'].includes(theme.theme) // Remove overly generic themes
                );
                
                if (significantThemes.length > 0) {
                  chunkData.insight = {
                    type: 'emerging_theme',
                    theme: significantThemes[0].theme,
                    confidence: significantThemes[0].strength
                  };
                }
              }
              
              res.write(`data: ${JSON.stringify(chunkData)}\n\n`);
            }

            // Tool calls not supported in streaming mode

          } catch (error) {
            // Handle incomplete JSON gracefully - this is normal for streaming
            if (error.message.includes('Unexpected end of JSON input') || 
                error.message.includes('Unterminated string in JSON')) {
              // This is expected for incomplete chunks, just continue
              continue;
            }
            
            // Log only truly unexpected parsing errors
            if (!error.message.includes('position')) {
              console.warn('Stream parse warning:', {
                message: error.message,
                data: data.substring(0, 50),
                dataLength: data.length
              });
            }
            continue;
          }
        }
      }
    });

    streamResponse.on('end', async () => {
      // Save conversation with proactive pattern analysis
      try {
        // Ensure content is not empty to avoid MongoDB validation errors
        const finalContent = accumulatedContent.trim() || 'Response incomplete due to technical issues.';
        
        // Use proactive memory service for pattern-aware saving
        const saveResult = await proactiveMemoryService.saveWithPatternAnalysis(
          userId,
          userMessage,
          finalContent
        );
        
        // Standard saves for compatibility
        await Promise.all([
          conversationService.addMessage(userId, conversationId, 'user', userMessage),
          conversationService.addMessage(userId, conversationId, 'assistant', finalContent)
        ]);
        
        if (saveResult.patterns && saveResult.triggers.length > 0) {
          console.log(`🎯 Pattern triggers detected: ${saveResult.triggers.map(t => t.type).join(', ')}`);
        }
        
        console.log('💾 Cognitive conversation saved with pattern analysis');
      } catch (saveError) {
        console.error('⚠️ Streaming save error:', saveError.message);
      }
      
      res.write('data: [DONE]\n\n');
      res.end();
    });

    streamResponse.on('error', (err) => {
      console.error('❌ Streaming error:', err);
      res.write('data: [DONE]\n\n');
      res.end();
    });

  } catch (error) {
    console.error('❌ Streaming setup error:', error);
    res.write(`data: ${JSON.stringify({ error: 'Streaming failed' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

async function handleSearchWithAI(res, messages, userMessage, userId, conversationId, userTier, proactiveInsights = null) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  try {
    const query = userMessage.replace(/search for|find|price of|what's|latest/i, '').trim();
    
    // Skip fetching message - go straight to results

    // Get search results
    const searchResult = await insaneWebSearch({ query }, { userId, userTier });
    
    if (searchResult.success && searchResult.structure?.results) {
      // Create context with search results for AI
      const searchContext = searchResult.structure.results.map(r => 
        `${r.title}: ${r.snippet} (${r.link})`
      ).join('\n\n');
      
      const enhancedMessages = [
        ...messages,
        { 
          role: 'system', 
          content: `SEARCH RESULTS for "${query}":\n\n${searchContext}\n\nUse these search results to provide a comprehensive, informative answer to the user's question. Summarize key information, include relevant details, and reference sources when helpful. Do not include links or URLs in your response - they will be provided separately.`
        }
      ];
      
      // Stream AI response with search context
      const streamResponse = await llmService.makeStreamingRequest(enhancedMessages, {
        n_predict: userTier === 'aether' ? 3000 : 1500,
        temperature: 0.7,
        tools: []
      });

      let accumulatedContent = '';
      
      streamResponse.on('data', (chunk) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = line.slice(6);
              if (data === '[DONE]') return;
              
              // Skip empty or malformed data chunks
              if (!data || data.trim() === '') {
                continue;
              }
              
              const parsed = JSON.parse(data);
              const choice = parsed.choices?.[0];
              
              if (choice?.delta?.content) {
                const content = choice.delta.content;
                accumulatedContent += content;
                
                res.write(`data: ${JSON.stringify({ 
                  content: content,
                  tier: userTier,
                  metadata: { 
                    searchResults: true, 
                    query: query,
                    sources: searchResult.structure.results.slice(0, 3).map(r => ({
                      title: r.title,
                      url: r.link,
                      domain: new URL(r.link).hostname.replace('www.', '')
                    }))
                  }
                })}\n\n`);
              }
            } catch (error) {
              console.error('Stream parse error:', {
                message: error.message,
                data: data.substring(0, 100),
                dataLength: data.length
              });
              continue;
            }
          }
        }
      });

      streamResponse.on('end', () => {
        res.write('data: [DONE]\n\n');
        res.end();
      });

      streamResponse.on('error', (error) => {
        console.error('Search streaming error:', error);
        res.write(`data: ${JSON.stringify({ 
          content: "\n\nError processing your search request.",
          tier: userTier
        })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      });
      
    } else {
      res.write(`data: ${JSON.stringify({ 
        content: "\n\nSorry, I couldn't find search results for that query.",
        tier: userTier
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }

  } catch (error) {
    console.error('Search error:', error);
    res.write(`data: ${JSON.stringify({ 
      content: "\n\nSearch encountered an error. Please try again.",
      tier: userTier
    })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

export default router;