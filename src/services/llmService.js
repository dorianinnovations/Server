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

  return {
    makeLLMRequest,
    makeStreamingRequest,
    healthCheck,
    buildMultiModalMessage, // Export for direct use in routes
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
