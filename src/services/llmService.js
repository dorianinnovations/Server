import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

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
    } = options;

    const llmStartTime = Date.now();

    try {
      // Handle both string prompts and messages array
      const messages = Array.isArray(promptOrMessages) 
        ? promptOrMessages 
        : parsePromptToMessages(promptOrMessages);
      
      const requestData = {
        model: "openai/gpt-4o",
        messages: messages,
        max_tokens: n_predict,
        temperature: temperature,
        ...(stop && { stop: stop }),
      };

      // Add tool calling parameters if tools are provided
      if (tools && tools.length > 0) {
        requestData.tools = tools;
        requestData.tool_choice = tool_choice;
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
      // Handle both string prompts and messages array
      const messages = Array.isArray(promptOrMessages) 
        ? promptOrMessages 
        : parsePromptToMessages(promptOrMessages);
      
      const requestData = {
        model: "openai/gpt-4o",
        messages: messages,
        max_tokens: n_predict,
        temperature: temperature,
        ...(stop && { stop: stop }),
        ...(tools && tools.length > 0 && { tools: tools, tool_choice: tool_choice }),
        stream: true,
      };

      console.log(`🌊 OpenRouter streaming request:`, {
        model: requestData.model,
        messagesCount: requestData.messages.length,
        max_tokens: requestData.max_tokens,
        temperature: requestData.temperature,
        toolsCount: requestData.tools?.length || 0,
        hasTools: !!requestData.tools
      });

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
      console.error("OpenRouter Streaming API Error:", {
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
  };
};

// Helper function to parse chat-ml format to OpenRouter message format
const parsePromptToMessages = (prompt) => {
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
    messages.push({
      role: "user",
      content: prompt.trim()
    });
  }
  
  return messages;
};
