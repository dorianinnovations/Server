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

// OPTIMIZED ADAPTIVE CHAT ENDPOINT
router.post('/adaptive-chat', protect, checkTierLimits, (req, res, next) => {
  console.log(`📱 Mobile request received - Content-Type: ${req.get('Content-Type')}`);
  console.log(`📱 Request fields: ${Object.keys(req.body).join(', ')}`);
  fileUpload.any()(req, res, next);
}, async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log(`📱 After multer - Files: ${req.files?.length || 0}, Body keys: ${Object.keys(req.body).join(', ')}`);
    const { 
      message, 
      prompt, 
      stream = true, // Default to streaming for better UX
      conversationId = 'default',
      attachments = [] 
    } = req.body;
    
    console.log(`🔍 STREAMING DEBUG: message="${message}", prompt="${prompt}", stream=${stream}, userMessage="${message || prompt}"`);
    console.log(`🔍 REQUEST BODY:`, JSON.stringify(req.body, null, 2));
    
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

    // DISABLED: All responses must use streaming for real-time UX
    // Fast path disabled - everything goes through streaming

    // DISABLED: All responses must use streaming
    // Direct data queries disabled - everything goes through streaming

    console.log(`🚀 OPTIMIZED Chat [${userTier.toUpperCase()}]: ${userId.slice(-8)} - "${userMessage.slice(0, 50)}..."`);

    // Get conversation context with optimized memory retrieval
    let conversationContext = [];
    try {
      const userContext = await enhancedMemoryService.getUserContext(userId, userTier === 'aether' ? 12 : 3);
      conversationContext = userContext.conversation?.recentMessages || [];
    } catch (memoryError) {
      console.warn('Memory service error, using fallback:', memoryError.message);
      const fallbackMemory = await ShortTermMemory.find({ userId })
        .sort({ timestamp: -1 })
        .limit(userTier === 'aether' ? 10 : 3)
        .lean();
      conversationContext = fallbackMemory.reverse().map(msg => ({
        role: msg.role,
        content: msg.content
      }));
    }

    // NOVEL FEATURE: Context injection for ambiguous queries
    let processedMessage = userMessage;
    try {
      const contextResult = await processContextInjection(userMessage, conversationContext);
      if (contextResult.wasEnriched) {
        processedMessage = contextResult.enrichedMessage;
        console.log(`🔗 CONTEXT INJECTION: Enhanced ambiguous query`);
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

    // Build optimized system prompt using cognitive engine
    const systemPrompt = await numinaContextBuilder.buildOptimizedSystemPrompt(
      userId, 
      [...conversationContext, { role: 'user', content: userMessage }]
    );
    
    // Get smart tool usage guidance
    const toolGuidance = await numinaContextBuilder.buildToolUsageGuidance(userId, userMessage);
    console.log(`🔧 Tool guidance: ${toolGuidance.shouldUseTool ? 'USE' : 'SKIP'} (${Math.round(toolGuidance.confidence * 100)}% confidence)`);
    
    // Trigger cognitive engine analysis in background (non-blocking)
    unifiedCognitiveEngine.analyzeCognitiveProfile(userId, [{ content: userMessage }])
      .then(result => {
        // Cognitive processing completed silently
      })
      .catch(error => console.warn('Cognitive engine error:', error.message));

    // Build messages with tier-appropriate context and attachment support
    const contextLimit = userTier === 'aether' ? 10 : userTier === 'pro' ? 8 : 3;
    let systemPromptWithFiles = systemPrompt;
    
    // Add text file content to system prompt if present
    if (textContent.length > 0) {
      systemPromptWithFiles += `\n\n## UPLOADED FILES:\n`;
      textContent.forEach(file => {
        systemPromptWithFiles += `\n### ${file.filename} (${file.type}, ${(file.size / 1024).toFixed(1)}KB):\n${file.content}\n`;
      });
      console.log(`📄 TEXT FILES: Processing ${textContent.length} text files totaling ${(textContent.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(1)}KB`);
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
                  detail: userTier === 'aether' ? 'high' : (userTier === 'pro' ? 'auto' : 'low')
                }
              }))
            ];
            hasVisionContent = true;
            
            console.log(`📸 Vision content prepared: ${validImages.length} images with ${userTier} quality`);
            console.log(`🔍 VISION DEBUG: First image URL preview: ${validImages[0].url.substring(0, 100)}...`);
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

    console.log(`🧠 Using ${conversationContext.length} context messages (${userTier} tier)`);
    
    // Debug vision content structure
    if (hasVisionContent) {
      console.log('🔍 VISION DEBUG: Content is array:', Array.isArray(userMessageContent));
    }

    // Simple search detection and execution - route to AI with search context
    if (/search|find|price|news|what's|latest/i.test(userMessage)) {
      return await handleSearchWithAI(res, messages, userMessage, userId, conversationId, userTier);
    }
    
    // Default: Use streaming for better UX
    console.log(`🔥 USING STREAMING: stream=${stream}, userTier=${userTier}`);
    return await handleOptimizedStreaming(res, messages, userMessage, userId, conversationId, userTier, toolGuidance);

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
    core: { n_predict: 500, temperature: 0.7, tools: [REAL_UBPM_TOOL, INSANE_SEARCH_TOOL] }, // Temporarily enabled for testing
    pro: { n_predict: 800, temperature: 0.75, tools: [REAL_UBPM_TOOL, ...(toolGuidance.shouldUseTool ? [INSANE_SEARCH_TOOL] : [])] },
    aether: { n_predict: 1200, temperature: 0.8, tools: [REAL_UBPM_TOOL, INSANE_SEARCH_TOOL] } // Aether gets everything
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
              const sourceLimit = userTier === 'aether' ? 5 : userTier === 'pro' ? 3 : 2;
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

async function handleOptimizedStreaming(res, messages, userMessage, userId, conversationId, userTier, toolGuidance) {
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
      core: { n_predict: 500, temperature: 0.7, tools: [] }, // Disabled in streaming
      pro: { n_predict: 800, temperature: 0.75, tools: [] }, // Disabled in streaming  
      aether: { n_predict: 1200, temperature: 0.8, tools: [] } // Disabled in streaming
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
              res.write(`data: ${JSON.stringify({ 
                content: choice.delta.content,
                tier: userTier,
                cognitiveEngineActive: true
              })}\n\n`);
            }

            // Tool calls disabled in streaming mode

          } catch (error) {
            // Log detailed parse error info for debugging
            console.error('Stream parse error:', {
              message: error.message,
              data: data.substring(0, 100),
              dataLength: data.length
            });
            // Continue processing other chunks instead of failing
            continue;
          }
        }
      }
    });

    streamResponse.on('end', async () => {
      // Save conversation after streaming completes
      try {
        // Ensure content is not empty to avoid MongoDB validation errors
        const finalContent = accumulatedContent.trim() || 'Response incomplete due to technical issues.';
        
        await Promise.all([
          enhancedMemoryService.saveConversation(userId, userMessage, finalContent),
          conversationService.addMessage(userId, conversationId, 'user', userMessage),
          conversationService.addMessage(userId, conversationId, 'assistant', finalContent),
          ShortTermMemory.insertMany([
            { userId, content: userMessage, role: "user", timestamp: new Date() },
            { userId, content: finalContent, role: "assistant", timestamp: new Date() }
          ])
        ]);
        console.log('💾 OPTIMIZED streaming conversation saved');
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

async function handleSearchWithAI(res, messages, userMessage, userId, conversationId, userTier) {
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
        n_predict: userTier === 'aether' ? 1200 : 800,
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