import axios from "axios";
import dotenv from "dotenv";
import https from "https";
import http from "http";

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
    } = options;

    const llmStartTime = Date.now();

    try {
      // Handle both string prompts and messages array with vision support
      const messages = Array.isArray(promptOrMessages) 
        ? promptOrMessages 
        : parsePromptToMessages(promptOrMessages, attachments);
      
      const requestData = {
        model: "openai/gpt-4o",
        messages: messages,
        max_tokens: n_predict,
        temperature: temperature,
        ...(stop && { stop: stop }),
        ...(options.top_p && { top_p: options.top_p }),
        ...(options.frequency_penalty && { frequency_penalty: options.frequency_penalty }),
        ...(options.presence_penalty && { presence_penalty: options.presence_penalty }),
      };

      // Add tool calling parameters if tools are provided
      if (tools && tools.length > 0) {
        // Debug log the tools being sent
        console.log(`🔧 Sending ${tools.length} tools to OpenRouter:`, tools.map(t => t.function?.name || t.name).join(', '));
        
        // Validate tool structure before sending - check for OpenAI function calling format
        const validTools = tools.filter(tool => {
          if (!tool.type || tool.type !== 'function' || !tool.function || !tool.function.name || !tool.function.description) {
            console.warn(`⚠️ Invalid tool structure - missing required OpenAI function format:`, {
              type: tool.type,
              hasFunction: !!tool.function,
              functionName: tool.function?.name,
              functionDescription: tool.function?.description
            });
            return false;
          }
          return true;
        });
        
        if (validTools.length !== tools.length) {
          console.warn(`⚠️ Filtered ${tools.length - validTools.length} invalid tools`);
        }
        
        requestData.tools = validTools;
        requestData.tool_choice = tool_choice;
        
        console.log(`🔧 Final tool count sent to OpenRouter: ${validTools.length}`);
      }
      
      const response = await axios({
        method: "POST",
        url: openRouterApiUrl,
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "Referer": getRefererUrl(),
          "X-Title": "Numina Server",
        },
        data: requestData,
        timeout: 45000, // 45 seconds timeout
      });

      const responseTime = Date.now() - llmStartTime;
      console.log(
        `OpenRouter API Response Status: ${response.status} (${responseTime}ms)`
      );

      const choice = response.data.choices[0];
      
      // Return response in consistent format with tool calls support
      return {
        content: choice.message.content,
        stop_reason: choice.finish_reason,
        usage: response.data.usage,
        tool_calls: choice.message.tool_calls || null,
      };
    } catch (error) {
      console.error("OpenRouter API Error:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
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
      
      const requestData = {
        model: "openai/gpt-4o",
        messages: messages,
        max_tokens: n_predict,
        temperature: temperature,
        ...(stop && { stop: stop }),
        ...(tools && tools.length > 0 && { tools: tools, tool_choice: tool_choice }),
        stream: true,
      };

      const requestSizeKB = Math.round(JSON.stringify(requestData).length / 1024);
      console.log(`🌊 OpenRouter streaming request:`, {
        model: requestData.model,
        messagesCount: requestData.messages.length,
        max_tokens: requestData.max_tokens,
        temperature: requestData.temperature,
        toolsCount: requestData.tools?.length || 0,
        hasTools: !!requestData.tools,
        requestSizeKB: requestSizeKB
      });

      // Check if request is too large (OpenRouter limit is around 200KB)
      if (requestSizeKB > 200) {
        console.warn(`⚠️ Large request detected: ${requestSizeKB}KB - truncating messages`);
        
        // Keep system message and last 5 messages to stay under limit
        const systemMessages = requestData.messages.filter(m => m.role === 'system');
        const otherMessages = requestData.messages.filter(m => m.role !== 'system');
        const recentMessages = otherMessages.slice(-5);
        
        requestData.messages = [...systemMessages, ...recentMessages];
        
        const newSizeKB = Math.round(JSON.stringify(requestData).length / 1024);
        console.log(`📉 Truncated request: ${requestSizeKB}KB → ${newSizeKB}KB`);
      }

      const response = await axios({
        method: "POST",
        url: openRouterApiUrl,
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "Referer": getRefererUrl(),
          "X-Title": "Numina Server",
        },
        data: requestData,
        responseType: "stream",
        timeout: 45000,
      });

      return response;
    } catch (error) {
      // Log the actual error response body for debugging
      let errorDetails = '';
      if (error.response?.data) {
        try {
          if (typeof error.response.data === 'string') {
            errorDetails = error.response.data;
          } else if (error.response.data.read) {
            // Handle streaming response
            const chunks = [];
            for await (const chunk of error.response.data) {
              chunks.push(chunk);
            }
            errorDetails = Buffer.concat(chunks).toString();
          }
        } catch (parseError) {
          errorDetails = 'Could not parse error response';
        }
      }
      
      console.error("OpenRouter Streaming API Error:", {
        name: error.name,
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        errorDetails: errorDetails,
        requestSize: JSON.stringify(requestData).length
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

  const healthCheck = async () => {
    try {
      const testResponse = await axios({
        method: "POST",
        url: openRouterApiUrl,
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "Referer": getRefererUrl(),
          "X-Title": "Numina Server",
        },
        data: {
          model: "openai/gpt-4o",
          messages: [{ role: "user", content: "Hello" }],
          max_tokens: 10,
          temperature: 0.1,
        },
        timeout: 10000,
      });

      return {
        status: "accessible",
        service: "OpenRouter (GPT-4o)",
        responseStatus: testResponse.status,
      };
    } catch (error) {
      console.error("OpenRouter Health Check Error:", error.message);
      return {
        status: "unreachable",
        service: "OpenRouter (GPT-4o)",
        error: error.message,
      };
    }
  };

  /**
   * Handle Window Query - Orchestrates the research workflow for Node Windows
   * User Query -> Web Search -> Academic Search -> LLM Synthesis
   */
  const handleWindowQuery = async (nodeContext, userQuery, options = {}) => {
    try {
      console.log('🔬 Starting Window Query research workflow');
      console.log('📝 Node Context:', nodeContext.title?.substring(0, 50));
      console.log('❓ User Query:', userQuery?.substring(0, 100));

      const results = {
        userQuery,
        nodeContext,
        webSearchResults: null,
        academicSearchResults: null,
        synthesis: null,
        tidBits: [],
        timestamp: new Date().toISOString()
      };

      // Step 1: Web Search for current information
      try {
        const webSearchTool = (await import('../tools/webSearch.js')).default;
        const webSearchArgs = {
          query: `${userQuery} ${nodeContext.title}`,
          searchType: 'general',
          limit: 8
        };
        
        results.webSearchResults = await webSearchTool(webSearchArgs, {});
        console.log('🌐 Web search completed:', results.webSearchResults?.success ? 'Success' : 'Failed');
      } catch (error) {
        console.warn('⚠️ Web search failed:', error.message);
        results.webSearchResults = { success: false, error: error.message };
      }

      // Step 2: Academic Search for scholarly information
      try {
        const academicSearchTool = (await import('../tools/academicSearch.js')).default;
        const academicSearchArgs = {
          query: `${userQuery} ${nodeContext.title}`,
          field: nodeContext.category || undefined
        };
        
        results.academicSearchResults = await academicSearchTool(academicSearchArgs, {});
        console.log('🎓 Academic search completed:', results.academicSearchResults?.success ? 'Success' : 'Failed');
      } catch (error) {
        console.warn('⚠️ Academic search failed:', error.message);
        results.academicSearchResults = { success: false, error: error.message };
      }

      // Step 3: LLM Synthesis of all research
      try {
        console.log('🧠 Starting LLM synthesis...');
        
        // Build synthesis prompt with all research data
        const synthesisPrompt = buildSynthesisPrompt(nodeContext, userQuery, results);
        
        const synthesisResponse = await makeLLMRequest([
          { 
            role: 'system', 
            content: 'You are a research synthesis expert. Your job is to analyze research data and extract meaningful, actionable insights that directly answer the user\'s question while connecting to their node context.' 
          },
          { role: 'user', content: synthesisPrompt }
        ], {
          temperature: 0.7,
          n_predict: 1000
        });

        results.synthesis = synthesisResponse.content;
        
        // Extract tid-bits from synthesis
        results.tidBits = extractTidBits(synthesisResponse.content);
        
        console.log('✅ Window Query research workflow completed successfully');
        console.log('📊 Generated', results.tidBits.length, 'tid-bits for attachment');

      } catch (error) {
        console.error('❌ LLM synthesis failed:', error);
        results.synthesis = `Research synthesis failed: ${error.message}`;
        results.tidBits = [];
      }

      return {
        success: true,
        data: results
      };

    } catch (error) {
      console.error('❌ Window Query workflow failed:', error);
      return {
        success: false,
        error: error.message,
        userQuery,
        nodeContext
      };
    }
  };

  /**
   * EPIC 2: Discover Hidden Patterns - The Master Pattern Recognition Engine
   * Analyzes user's complete data landscape for synchronicities and meaningful connections
   */
  const discoverHiddenPatterns = async (analysisRequest) => {
    try {
      console.log('🔮 Starting hidden pattern discovery for user:', analysisRequest.userId);
      console.log('🎯 Trigger type:', analysisRequest.triggerContext.triggerType);

      const { userData, triggerContext } = analysisRequest;
      
      // Build comprehensive pattern analysis prompt
      const patternPrompt = buildPatternAnalysisPrompt(userData, triggerContext);
      
      console.log('🧠 Invoking master pattern recognition...');
      
      const patternResponse = await makeLLMRequest([
        { 
          role: 'system', 
          content: 'You are the Master Pattern Recognition Engine for the Numina AI system. Your purpose is to analyze the disparate data points of a user\'s life and reveal hidden patterns, synchronicities, and meaningful connections that they might have missed. You do not provide definitive answers - you present fascinating possibilities for the user to explore and evaluate.' 
        },
        { role: 'user', content: patternPrompt }
      ], {
        temperature: 0.8, // Higher creativity for pattern recognition
        n_predict: 1500   // Allow for detailed pattern analysis
      });

      // Parse and structure the discovered patterns
      const discoveredPatterns = parsePatternResponse(patternResponse.content, triggerContext);
      
      if (discoveredPatterns.length > 0) {
        console.log('✨ Pattern discovery completed successfully');
        console.log('🔍 Discovered', discoveredPatterns.length, 'potential patterns');
        
        return {
          success: true,
          patterns: discoveredPatterns,
          triggerType: triggerContext.triggerType,
          timestamp: new Date().toISOString(),
          dataRichness: userData.dataRichness
        };
      } else {
        console.log('📭 No significant patterns discovered in current dataset');
        return {
          success: false,
          reason: 'Insufficient data or no significant patterns detected',
          dataRichness: userData.dataRichness
        };
      }

    } catch (error) {
      console.error('❌ Hidden pattern discovery failed:', error);
      return {
        success: false,
        error: error.message,
        triggerType: analysisRequest.triggerContext?.triggerType
      };
    }
  };

  return {
    makeLLMRequest,
    makeStreamingRequest,
    healthCheck,
    buildMultiModalMessage, // Export for direct use in routes
    handleWindowQuery, // New Window Query orchestration
    discoverHiddenPatterns, // Master Pattern Recognition Engine
  };
};

// Helper function to parse chat-ml format to OpenRouter message format with vision support
const parsePromptToMessages = (prompt, attachments = []) => {
  const messages = [];
  
  // Split by the chat-ml markers
  const sections = prompt.split(/(<\|im_start\|>|<\|im_end\|>)/).filter(Boolean);
  
  let currentRole = null;
  let currentContent = "";
  
  for (const section of sections) {
    if (section === "<|im_start|>") {
      continue;
    } else if (section === "<|im_end|>") {
      if (currentRole && currentContent.trim()) {
        messages.push({
          role: currentRole,
          content: currentContent.trim()
        });
      }
      currentRole = null;
      currentContent = "";
    } else if (section.startsWith("user\n") || section.startsWith("assistant\n") || section.startsWith("system\n")) {
      const lines = section.split('\n');
      currentRole = lines[0];
      currentContent = lines.slice(1).join('\n');
    } else {
      currentContent += section;
    }
  }
  
  // Handle the last message if it doesn't end with <|im_end|>
  if (currentRole && currentContent.trim()) {
    messages.push({
      role: currentRole,
      content: currentContent.trim()
    });
  }
  
  // If no chat-ml format detected, treat the entire prompt as a user message
  if (messages.length === 0) {
    // Check if we have image attachments - use multi-modal format
    if (attachments && attachments.length > 0) {
      const imageAttachments = attachments.filter(att => 
        att.type === 'image' && att.url && att.url.startsWith('data:image')
      );
      
      if (imageAttachments.length > 0) {
        // Create multi-modal message with text and images
        const content = [
          { type: 'text', text: prompt.trim() }
        ];
        
        // Add up to 4 images (GPT-4o Vision limitation)
        imageAttachments.slice(0, 4).forEach(image => {
          content.push({
            type: 'image_url',
            image_url: { 
              url: image.url,
              detail: 'auto' // Can be 'low', 'high', or 'auto'
            }
          });
        });
        
        messages.push({
          role: "user",
          content: content
        });
        
        console.log('🖼️ GPT-4o VISION: Created multi-modal message with', imageAttachments.length, 'images');
        console.log('🖼️ GPT-4o VISION: Image details:', imageAttachments.map(img => ({
          type: img.type,
          size: img.url?.length || 0,
          format: img.url?.substring(5, 15) // data:image/...
        })));
      } else {
        // No valid images, use text-only
        messages.push({
          role: "user",
          content: prompt.trim()
        });
      }
    } else {
      // No attachments, use text-only
      messages.push({
        role: "user",
        content: prompt.trim()
      });
    }
  }
  
  return messages;
};

// Helper function to build multi-modal messages from text and attachments
const buildMultiModalMessage = (text, attachments = []) => {
  const imageAttachments = attachments.filter(att => 
    att.type === 'image' && att.url && 
    (att.url.startsWith('data:image') || att.url.startsWith('http'))
  );
  
  if (imageAttachments.length === 0) {
    // No images, return simple text message
    return { role: 'user', content: text };
  }
  
  // Build multi-modal content array
  const content = [
    { type: 'text', text: text || 'Please analyze these images.' }
  ];
  
  // Add images (limit to 4 for GPT-4o Vision)
  imageAttachments.slice(0, 4).forEach(image => {
    content.push({
      type: 'image_url',
      image_url: { 
        url: image.url,
        detail: 'auto' // Balances cost and performance
      }
    });
  });
  
  console.log(`🖼️ Built multi-modal message with ${imageAttachments.length} images`);
  return { role: 'user', content: content };
};

/**
 * Build synthesis prompt for Window Query research
 */
function buildSynthesisPrompt(nodeContext, userQuery, results) {
  let prompt = `# Research Synthesis Task

## Context
**Node Title:** ${nodeContext.title}
**Node Content:** ${nodeContext.content}
**Node Category:** ${nodeContext.category || 'General'}
**User's Research Question:** ${userQuery}

## Research Data Collected

`;

  // Add web search results
  if (results.webSearchResults?.success && results.webSearchResults.results?.length > 0) {
    prompt += `### Web Search Results (${results.webSearchResults.results.length} sources):\n`;
    results.webSearchResults.results.slice(0, 5).forEach((result, index) => {
      prompt += `${index + 1}. **${result.title}**\n   Source: ${result.displayLink}\n   ${result.snippet}\n\n`;
    });
  } else {
    prompt += `### Web Search Results: No reliable web results found\n\n`;
  }

  // Add academic search results
  if (results.academicSearchResults?.success && results.academicSearchResults.data?.papers?.length > 0) {
    prompt += `### Academic Research (${results.academicSearchResults.data.papers.length} papers):\n`;
    results.academicSearchResults.data.papers.slice(0, 3).forEach((paper, index) => {
      prompt += `${index + 1}. **${paper.title}** (${paper.year})\n   ${paper.abstract}\n   Source: ${paper.source}\n\n`;
    });
  } else {
    prompt += `### Academic Research: No academic papers found\n\n`;
  }

  prompt += `## Your Task

Based on the research data above, provide a comprehensive synthesis that:

1. **Directly answers the user's question**: "${userQuery}"
2. **Connects to their node context**: How does this relate to "${nodeContext.title}"?
3. **Highlights the most valuable insights** from the research
4. **Identifies key facts, numbers, dates, or references** that could be attached to the node
5. **Suggests connections** to other potential research areas

## Output Format

Provide your response in this structure:

**DIRECT ANSWER:**
[Clear, direct response to the user's question]

**CONNECTION TO YOUR NODE:**
[How this research enriches or expands their existing node]

**KEY FINDINGS:**
• [Specific fact/insight #1]
• [Specific fact/insight #2] 
• [Specific fact/insight #3]

**RESEARCH EVIDENCE:**
• [Source citation with key detail]
• [Date/number/reference with context]
• [Academic finding with implications]

**NEXT RESEARCH DIRECTIONS:**
• [Suggested follow-up question #1]
• [Suggested follow-up question #2]

Focus on actionable insights that can deepen their understanding and provide specific details they can attach to their node.`;

  return prompt;
}

/**
 * Extract tid-bits from synthesis response
 */
function extractTidBits(synthesisContent) {
  const tidBits = [];
  
  try {
    // Extract key findings
    const keyFindingsMatch = synthesisContent.match(/\*\*KEY FINDINGS:\*\*(.*?)(?=\*\*[A-Z\s]+:|$)/s);
    if (keyFindingsMatch) {
      const findings = keyFindingsMatch[1].split('•').filter(item => item.trim());
      findings.forEach(finding => {
        const cleanFinding = finding.trim();
        if (cleanFinding) {
          tidBits.push({
            type: 'key_finding',
            content: cleanFinding,
            attachable: true
          });
        }
      });
    }

    // Extract research evidence
    const evidenceMatch = synthesisContent.match(/\*\*RESEARCH EVIDENCE:\*\*(.*?)(?=\*\*[A-Z\s]+:|$)/s);
    if (evidenceMatch) {
      const evidence = evidenceMatch[1].split('•').filter(item => item.trim());
      evidence.forEach(item => {
        const cleanEvidence = item.trim();
        if (cleanEvidence) {
          tidBits.push({
            type: 'research_evidence',
            content: cleanEvidence,
            attachable: true
          });
        }
      });
    }

    // Extract numbers, dates, and specific references
    const numberMatches = synthesisContent.match(/\b(\d{4}|\d+%|\$[\d,]+|\d+[.,]\d+)\b/g);
    if (numberMatches) {
      numberMatches.slice(0, 3).forEach(number => {
        tidBits.push({
          type: 'data_point',
          content: number,
          attachable: true
        });
      });
    }

  } catch (error) {
    console.warn('⚠️ Failed to extract tid-bits:', error.message);
  }

  return tidBits.slice(0, 8); // Limit to 8 tid-bits
}

/**
 * Build comprehensive pattern analysis prompt for the Master Pattern Engine
 */
function buildPatternAnalysisPrompt(userData, triggerContext) {
  let prompt = `# MASTER PATTERN ANALYSIS REQUEST

## TRIGGER CONTEXT
**Trigger Type:** ${triggerContext.triggerType}
**Trigger Time:** ${triggerContext.timestamp}

`;

  // Add trigger-specific context
  if (triggerContext.triggerType === 'category_clustering') {
    prompt += `**Pattern Trigger:** User has locked 3+ nodes in the "${triggerContext.triggerContext.category}" category, suggesting deep focus on this domain.\n\n`;
  } else if (triggerContext.triggerType === 'semantic_resonance') {
    prompt += `**Pattern Trigger:** User's current exploration shows high similarity (${(triggerContext.triggerContext.similarity * 100).toFixed(1)}%) to a node from ${triggerContext.triggerContext.monthsApart} months ago.\n\n`;
  } else if (triggerContext.triggerType === 'significant_date') {
    prompt += `**Pattern Trigger:** Approaching significant date (${triggerContext.triggerContext.dateType}) in ${triggerContext.triggerContext.daysUntil} days.\n\n`;
  }

  // Add user profile data
  prompt += `## USER PROFILE DATA\n`;
  if (userData.user) {
    prompt += `**Email:** ${userData.user.email}\n`;
    prompt += `**Account Created:** ${userData.user.createdAt}\n`;
    if (userData.user.profile && Object.keys(userData.user.profile).length > 0) {
      prompt += `**Profile Data:** ${JSON.stringify(userData.user.profile, null, 2)}\n`;
    }
  }

  // Add locked nodes (critical for pattern recognition)
  prompt += `\n## LOCKED NODES (Persistent Discoveries)\n`;
  if (userData.lockedNodes && userData.lockedNodes.length > 0) {
    userData.lockedNodes.forEach((node, index) => {
      prompt += `### Node ${index + 1}: "${node.title}" (${node.category})\n`;
      prompt += `**Created:** ${node.createdAt}\n`;
      prompt += `**Content:** ${node.content}\n`;
      if (node.personalHook) prompt += `**Personal Hook:** ${node.personalHook}\n`;
      if (node.lockData?.reason) prompt += `**Lock Reason:** ${node.lockData.reason}\n`;
      prompt += `\n`;
    });
  } else {
    prompt += `No locked nodes available.\n\n`;
  }

  // Add sandbox exploration history
  prompt += `## SANDBOX EXPLORATION HISTORY\n`;
  if (userData.sandboxSessions && userData.sandboxSessions.length > 0) {
    userData.sandboxSessions.forEach((session, index) => {
      prompt += `### Session ${index + 1}: "${session.userQuery}"\n`;
      prompt += `**Timestamp:** ${session.timestamp}\n`;
      prompt += `**Node Count:** ${session.nodes?.length || 0}\n`;
      if (session.metadata) prompt += `**Metadata:** ${JSON.stringify(session.metadata)}\n`;
      prompt += `\n`;
    });
  } else {
    prompt += `No sandbox sessions available.\n\n`;
  }

  // Add behavioral data (UBPM)
  prompt += `## BEHAVIORAL ANALYSIS (UBPM)\n`;
  if (userData.ubpmProfile) {
    prompt += `**Behavioral Patterns:** ${JSON.stringify(userData.ubpmProfile.behaviorPatterns || [], null, 2)}\n`;
    prompt += `**Preferences:** ${JSON.stringify(userData.ubpmProfile.preferences || {}, null, 2)}\n`;
    prompt += `**Behavior Metrics:** ${JSON.stringify(userData.ubpmProfile.behaviorMetrics || {}, null, 2)}\n`;
  } else {
    prompt += `No behavioral profile data available.\n`;
  }

  // Add emotional/memory context
  prompt += `\n## EMOTIONAL & MEMORY CONTEXT\n`;
  if (userData.emotionalHistory && userData.emotionalHistory.length > 0) {
    userData.emotionalHistory.slice(0, 5).forEach((memory, index) => {
      prompt += `**Memory ${index + 1}:** ${memory.content} (${memory.timestamp})\n`;
      if (memory.emotionalContext) prompt += `  Emotional Context: ${memory.emotionalContext}\n`;
    });
  } else {
    prompt += `No emotional/memory data available.\n`;
  }

  // Add data richness assessment
  prompt += `\n## DATA RICHNESS ASSESSMENT\n`;
  prompt += `**Overall Score:** ${(userData.dataRichness.total * 100).toFixed(1)}%\n`;
  prompt += `**Locked Nodes:** ${userData.dataRichness.lockedNodes}\n`;
  prompt += `**Sessions:** ${userData.dataRichness.sessions}\n`;
  prompt += `**Behavioral Data:** ${userData.dataRichness.behavioralDataPoints}\n`;
  prompt += `**Emotional Data Points:** ${userData.dataRichness.emotionalDataPoints}\n`;

  // Core analysis instructions
  prompt += `\n## YOUR PATTERN ANALYSIS MISSION

Analyze ALL the data above for hidden patterns, synchronicities, and meaningful connections that the user might have missed. Look for:

1. **TEMPORAL PATTERNS**: Dates, numbers, time intervals that repeat or form sequences
2. **THEMATIC CONVERGENCES**: Similar concepts appearing across different contexts/times  
3. **NUMERICAL SYNCHRONICITIES**: Recurring numbers, mathematical relationships
4. **CATEGORICAL CLUSTERING**: Hidden connections between seemingly unrelated locked nodes
5. **BEHAVIORAL ECHOES**: Past exploration patterns that mirror current interests
6. **LIFE CYCLE CORRELATIONS**: How timing of discoveries relates to personal growth phases
7. **SEMANTIC RESONANCE**: Deep conceptual connections across time periods

## CRITICAL REQUIREMENTS

- Focus on NON-OBVIOUS connections (not surface-level similarities)
- Present patterns as intriguing POSSIBILITIES, not definitive facts
- Include specific data points and dates as evidence
- Suggest what deeper meaning these patterns might reveal
- Connect to universal human experiences and archetypal patterns
- Be specific about numbers, dates, time intervals, and sequences

## OUTPUT FORMAT

For each pattern you discover, provide:

**PATTERN:** [One-line description]
**EVIDENCE:** [Specific data points, dates, numbers that support this pattern]
**SIGNIFICANCE:** [What this might mean for the user's journey]
**ARCHETYPE:** [Universal human pattern this connects to]
**EXPLORATION:** [Questions for the user to consider]

Only present patterns that genuinely emerge from the data. If insufficient data exists for meaningful pattern recognition, state this clearly.`;

  return prompt;
}

/**
 * Parse pattern response into structured format
 */
function parsePatternResponse(responseContent, triggerContext) {
  const patterns = [];
  
  try {
    // Split response into pattern blocks
    const patternBlocks = responseContent.split(/\*\*PATTERN:\*\*/);
    
    for (let i = 1; i < patternBlocks.length; i++) {
      const block = patternBlocks[i];
      
      // Extract pattern components
      const patternMatch = block.match(/^([^\n]+)/);
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
