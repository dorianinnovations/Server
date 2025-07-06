import axios from "axios";
<<<<<<< HEAD
import https from "https";
import { env } from "../config/environment.js";

// Create reusable HTTPS agent
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  rejectUnauthorized: false,
  timeout: 60000,
});

// LLM Service Configuration
const LLM_CONFIG = {
  apiUrl: env.LLAMA_CPP_API_URL,
  timeout: 30000,
  defaultParams: {
    temperature: 0.7,
    top_k: 40,
    top_p: 0.9,
    repeat_penalty: 1.1,
    frequency_penalty: 0.1,
    presence_penalty: 0.1,
  }
};

// Create LLM Service
export const createLLMService = () => {
  const makeRequest = async (prompt, params = {}) => {
    try {
      const config = {
        method: "POST",
        url: `${LLM_CONFIG.apiUrl}/completion`,
=======
import dotenv from "dotenv";

dotenv.config();

export const createLLMService = () => {
  const openRouterApiUrl = "https://openrouter.ai/api/v1/chat/completions";
  
  const makeLLMRequest = async (prompt, options = {}) => {
    const {
      stop = ["<|im_end|>", "\n<|im_start|>"],
      n_predict = 1024,
      temperature = 0.7,
    } = options;

    const llmStartTime = Date.now();

    try {
      // Convert the prompt format from chat-ml to OpenRouter's message format
      const messages = parsePromptToMessages(prompt);
      
      const response = await axios({
        method: "POST",
        url: openRouterApiUrl,
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.HTTP_REFERER || "http://localhost:3000",
          "X-Title": "Numina Server",
        },
        data: {
          model: "anthropic/claude-3-sonnet",
          messages: messages,
          max_tokens: n_predict,
          temperature: temperature,
          stop: stop,
        },
        timeout: 45000, // 45 seconds timeout
      });

      const responseTime = Date.now() - llmStartTime;
      console.log(
        `OpenRouter API Response Status: ${response.status} (${responseTime}ms)`
      );

      // Return in the same format as the original llama.cpp response
      return {
        content: response.data.choices[0].message.content,
        stop_reason: response.data.choices[0].finish_reason,
        usage: response.data.usage,
      };
    } catch (error) {
      console.error("OpenRouter API Error:", {
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
        throw new Error(`OpenRouter API error: ${error.message}`);
      }
    }
  };

  const makeStreamingRequest = async (prompt, options = {}) => {
    const {
      stop = ["<|im_end|>", "\n<|im_start|>"],
      n_predict = 1024,
      temperature = 0.7,
    } = options;

    try {
      const messages = parsePromptToMessages(prompt);
      
      const response = await axios({
        method: "POST",
        url: openRouterApiUrl,
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.HTTP_REFERER || "http://localhost:3000",
          "X-Title": "Numina Server",
        },
        data: {
          model: "anthropic/claude-3-sonnet",
          messages: messages,
          max_tokens: n_predict,
          temperature: temperature,
          stop: stop,
          stream: true,
        },
        responseType: "stream",
        timeout: 45000,
      });

      return response;
    } catch (error) {
      console.error("OpenRouter Streaming API Error:", error);
      throw error;
    }
  };

  const healthCheck = async () => {
    try {
      const testResponse = await axios({
        method: "POST",
        url: openRouterApiUrl,
>>>>>>> 3f17339 (refactor: Swap configuration for claude open router setup)
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.HTTP_REFERER || "http://localhost:3000",
          "X-Title": "Numina Server",
        },
        data: {
<<<<<<< HEAD
          prompt,
          ...LLM_CONFIG.defaultParams,
          ...params,
        },
        httpsAgent,
        timeout: LLM_CONFIG.timeout,
      };

      console.log(
        `🔗 LLM Request: ${config.url} with ${prompt.length} char prompt`
      );

      const response = await axios(config);

      console.log(
        `✅ LLM Response: ${response.status} - ${response.data?.content?.length || 0} chars`
      );

      return response.data;
    } catch (error) {
      console.error("❌ LLM Service Error:", error.message);
      throw error;
    }
  };

  const healthCheck = async () => {
    try {
      const response = await makeRequest("Hello", {
        n_predict: 5,
        temperature: 0.1,
      });
      return { healthy: true, response };
    } catch (error) {
      return { healthy: false, error: error.message };
=======
          model: "anthropic/claude-3-sonnet",
          messages: [{ role: "user", content: "Hello" }],
          max_tokens: 10,
          temperature: 0.1,
        },
        timeout: 10000,
      });

      return {
        status: "accessible",
        service: "OpenRouter (Claude 3 Sonnet)",
        responseStatus: testResponse.status,
        testResponse: testResponse.data.choices[0].message.content,
      };
    } catch (error) {
      console.error("Health check OpenRouter test failed:", error.message);
      return {
        status: "unreachable",
        service: "OpenRouter (Claude 3 Sonnet)",
        error: error.message,
      };
>>>>>>> 3f17339 (refactor: Swap configuration for claude open router setup)
    }
  };

  return {
<<<<<<< HEAD
    makeRequest,
    healthCheck,
    config: LLM_CONFIG,
  };
};

// Default export
export default createLLMService(); 
=======
    makeLLMRequest,
    makeStreamingRequest,
    healthCheck,
  };
};

// Helper function to parse the chat-ml format prompt into OpenRouter's message format
const parsePromptToMessages = (prompt) => {
  const messages = [];
  
  // Split by the chat-ml markers
  const parts = prompt.split(/<\|im_start\|>(user|assistant|system)\n?/);
  
  for (let i = 1; i < parts.length; i += 2) {
    const role = parts[i];
    const content = parts[i + 1]?.replace(/<\|im_end\|>/g, "").trim();
    
    if (!content) continue;
    
    if (role === "system" || role === "user" || role === "assistant") {
      messages.push({
        role: role,
        content: content,
      });
    }
  }
  
  // Handle the case where the prompt doesn't use chat-ml format
  if (messages.length === 0) {
    messages.push({
      role: "user",
      content: prompt,
    });
  }
  
  return messages;
}; 
>>>>>>> 3f17339 (refactor: Swap configuration for claude open router setup)
