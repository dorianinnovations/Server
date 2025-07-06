import axios from "axios";
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
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        data: {
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
    }
  };

  return {
    makeRequest,
    healthCheck,
    config: LLM_CONFIG,
  };
};

// Default export
export default createLLMService(); 