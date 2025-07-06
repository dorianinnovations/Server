import axios from "axios";
import https from "https";
import dotenv from "dotenv";

dotenv.config();

// Create a singleton HTTPS agent that can be reused across requests
const globalHttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  rejectUnauthorized: false,
  timeout: 60000, // 60 seconds timeout
});

export const createLLMService = () => {
  const llamaCppApiUrl =
    process.env.LLAMA_CPP_API_URL ||
    "http://localhost:8000/completion";

  const healthCheckUrl =
    process.env.LLAMA_CPP_API_URL?.replace("/completion", "/health") ||
    "http://localhost:8000/health";

  const makeLLMRequest = async (prompt, options = {}) => {
    const {
      stop = ["<|im_end|>", "\n<|im_start|>"],
      n_predict = 1024,
      temperature = 0.3, // Reduced from 0.7 to 0.3 for better conversation quality
    } = options;

    // Optimize the parameters to improve speed with minimal quality loss
    const optimizedParams = {
      prompt,
      stop,
      n_predict,
      temperature,
      top_k: 40, // Limit vocabulary to top 40 tokens
      top_p: 0.9, // Nucleus sampling for better efficiency
      repeat_penalty: 1.1, // Slight penalty to reduce repetition
    };

    const llmStartTime = Date.now();

    try {
      const response = await axios({
        method: "POST",
        url: llamaCppApiUrl,
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
          "User-Agent": "numina-server/1.0",
          Connection: "keep-alive",
        },
        data: optimizedParams,
        httpsAgent: globalHttpsAgent,
        timeout: 45000, // 45 seconds timeout for LLM requests
      });

      const responseTime = Date.now() - llmStartTime;
      console.log(
        `LLM API Response Status: ${response.status} (${responseTime}ms)`
      );

      // Track token generation speed for monitoring
      if (response.data.timings && response.data.tokens_predicted) {
        const tokensPerSecond = response.data.timings.predicted_per_second || 0;
        console.log(
          `LLM generation speed: ${tokensPerSecond.toFixed(2)} tokens/sec`
        );
      }

      return response.data;
    } catch (error) {
      if (error.code === "ECONNABORTED") {
        console.error("LLM API request timed out after 45 seconds");
        throw new Error("LLM API request timed out. Please try again.");
      } else if (error.response) {
        // Server responded with error status
        console.error("LLM API Response Error:", {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
        });
        throw new Error(
          `LLM API error: ${error.response.status} - ${error.response.statusText} - ${error.response.data}`
        );
      } else {
        console.error("Fetch error details:", {
          name: error.name,
          message: error.message,
          code: error.code,
        });
        throw error;
      }
    }
  };

  const healthCheck = async () => {
    try {
      const testRes = await axios({
        method: "POST",
        url: healthCheckUrl,
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        data: {
          prompt: "Hello",
          n_predict: 5,
          temperature: 0.1,
        },
        httpsAgent: globalHttpsAgent,
        timeout: 10000,
      });

      return {
        status: "accessible",
        url: healthCheckUrl,
        responseStatus: testRes.status,
      };
    } catch (error) {
      console.error("Health check LLM test failed:", error.message);
      return {
        status: "unreachable",
        url: healthCheckUrl,
        error: error.message,
      };
    }
  };

  return {
    makeLLMRequest,
    healthCheck,
    globalHttpsAgent,
  };
}; 