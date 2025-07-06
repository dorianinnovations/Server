import express from "express";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";
import ShortTermMemory from "../models/ShortTermMemory.js";
import Task from "../models/Task.js";
import { sanitizeResponse } from "../utils/sanitize.js";
import { createUserCache } from "../utils/cache.js";
import axios from "axios";
import https from "https";

const router = express.Router();

// Create reusable HTTPS agent for better performance
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
  maxSockets: 50,
  timeout: 30000,
});

// Optimized regex for combined pattern matching
const CLEANUP_REGEX = /(?:TASK_INFERENCE|EMOTION_LOG):?\s*(?:\{[\s\S]*?\})?\s*?/g;
const METADATA_PATTERNS = {
  task: /TASK_INFERENCE:?\s*(\{[\s\S]*?\})\s*?/g,
  emotion: /EMOTION_LOG:?\s*(\{[\s\S]*?\})\s*?/g,
};

// Helper function for optimized JSON extraction
const extractJsonPattern = (regex, content, logType) => {
  const match = content.match(regex);
  if (!match || !match[1]) {
    return [null, content];
  }

  try {
    const jsonString = match[1].trim();
    const parsed = JSON.parse(jsonString);
    const newContent = content.replace(match[0], "");
    return [parsed, newContent];
  } catch (jsonError) {
    console.error(`Failed to parse ${logType} JSON:`, jsonError.message);
    return [null, content];
  }
};

// Optimized response cleaning function
const cleanResponse = (content) => {
  if (!content) return "";
  
  // Single-pass cleanup using combined regex
  let cleaned = content
    .replace(/<\|im_(start|end)\|>(assistant|user)?\n?/g, "")
    .replace(CLEANUP_REGEX, "")
    .replace(/```json[\s\S]*?```/g, "")
    .replace(/(\r?\n){2,}/g, "\n")
    .trim();
  
  // Final check for any remaining markers
  const lowerCleaned = cleaned.toLowerCase();
  if (lowerCleaned.includes("task_inference") || lowerCleaned.includes("emotion_log")) {
    cleaned = cleaned
      .split("\n")
      .filter(line => {
        const lowerLine = line.toLowerCase();
        return !lowerLine.includes("task_inference") && !lowerLine.includes("emotion_log");
      })
      .join("\n")
      .trim();
  }
  
  return cleaned || "I'm sorry, I wasn't able to provide a proper response. Please try again.";
};

// Streaming cleanup utility
const createStreamCleanup = (streamResponse, streamTimeout, res) => {
  return () => {
    if (streamTimeout) clearTimeout(streamTimeout);
    if (streamResponse?.data?.removeAllListeners) {
      streamResponse.data.removeAllListeners();
    }
    if (streamResponse?.data?.destroy) {
      streamResponse.data.destroy();
    }
    if (res && !res.headersSent) {
      res.end();
    }
  };
};

router.post("/completion", protect, async (req, res) => {
  const userId = req.user.id;
  const userPrompt = req.body.prompt;
  const stream = req.body.stream === true;
  
  // Create user-specific cache instance
  const userCache = createUserCache(userId);

  // Comprehensive stop sequences for Mistral 7B
  const stop = req.body.stop || [
    "USER:", "\nUSER:", "\nUser:", "user:", "\n\nUSER:",
    "Human:", "\nHuman:", "\nhuman:", "human:",
    "\n\nUser:", "\n\nHuman:", "\n\nuser:", "\n\nhuman:",
    "Q:", "\nQ:", "\nQuestion:", "Question:",
    "\n\n\n", "---", "***", "```",
    "</EXAMPLES>", "SYSTEM:", "\nSYSTEM:", "system:", "\nsystem:",
    "<s>", "</s>", "[INST]", "[/INST]",
    "Assistant:", "\nAssistant:", "AI:",
    "Example:", "\nExample:", "For example:",
    "...", "etc.", "and so on",
    "Note:", "Important:", "Remember:",
    "Source:", "Reference:", "According to:",
  ];
  
  const n_predict = req.body.n_predict || 500;
  const temperature = req.body.temperature || 0.3; // Reduced from 0.7 to 0.3 for better conversation quality

  if (!userPrompt || typeof userPrompt !== "string") {
    return res.status(400).json({ message: "Invalid or missing prompt." });
  }

<<<<<<< HEAD
=======
  if (stream) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }
      const userProfile = user.profile ? JSON.stringify(user.profile) : "{}";
      const recentEmotionalLogEntries = user.emotionalLog
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 3);
      const formattedEmotionalLog = recentEmotionalLogEntries
        .map((entry) => {
          const date = entry.timestamp.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
          return `On ${date}, you expressed feeling ${entry.emotion}${
            entry.intensity ? ` (intensity ${entry.intensity})` : ""
          } because: ${entry.context || "no specific context provided"}.`;
        })
        .join("\n");
      const [recentMemory] = await Promise.all([
        ShortTermMemory.find(
          { userId },
          { role: 1, content: 1, _id: 0 }
        )
          .sort({ timestamp: -1 })
          .limit(6)
          .lean(),
      ]);
      recentMemory.reverse();
      const historyBuilder = [];
      for (const mem of recentMemory) {
        historyBuilder.push(
          `${mem.role === "user" ? "user" : "assistant"}\n${mem.content}`
        );
      }
      const conversationHistory = historyBuilder.join("\n");
      const promptParts = [
        `You are Numina, an empathetic and concise AI assistant. Your goal is to provide helpful responses, acknowledge user emotions, and proactively identify tasks.`,
        `**User Profile:** ${userProfile}`,
      ];
      if (conversationHistory.length > 0) {
        promptParts.push(`**Recent Conversation:**\n${conversationHistory}`);
      }
      if (formattedEmotionalLog.length > 0) {
        promptParts.push(
          `**Your Emotional History Summary (Top 3 Recent):**\n${formattedEmotionalLog}`
        );
      }
      promptParts.push(`Instructions for your response:
- Be direct and concise, but warm, sweet, witty, and playful.
- Do not echo user's prompt or instructions.
- Emotional Logging: If the user expresses a clear emotion, identify it and the context. Format strictly as: EMOTION_LOG: {"emotion": "happy", "intensity": 7, "context": "promotion"}
- Summarizing Past Emotions: Use human-readable format, not raw JSON.
- Task Inference: If the user implies a task, format strictly as: TASK_INFERENCE: {"taskType": "summarize_emotions", "parameters": {"period": "last week"}}
- Your primary conversational response should follow any EMOTION_LOG or TASK_INFERENCE output.`);
      promptParts.push(
        `<|im_start|>user\n${userPrompt}\n<|im_end|>\n<|im_start|>assistant`
      );
      const fullPrompt = promptParts.join("\n\n");

      // Make streaming request to OpenRouter
      const llamaRes = await llmService.makeStreamingRequest(fullPrompt, {
        stop,
        n_predict,
        temperature,
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Cache-Control");
      res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

      // Handle streaming data chunk by chunk
      llamaRes.data.on('data', (chunk) => {
        res.write(chunk);
        res.flush && res.flush(); // Ensure immediate sending
      });
      llamaRes.data.on("end", () => {
        res.end();
      });
      llamaRes.data.on("error", (err) => {
        console.error("Stream error:", err.message);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
        }
        res.write(`data: {"error": "${err.message}"}\n\n`);
        res.end();
      });
    } catch (err) {
      console.error("Streaming request failed:", err.message);
      res.status(500).json({ 
        status: "error", 
        message: "Streaming failed: " + err.message
      });
    }
    return;
  }

  // --- Non-streaming mode (existing logic) ---
>>>>>>> 3f17339 (refactor: Swap configuration for claude open router setup)
  try {
    console.log(`✓Completion request received for user ${userId}.`);
    
    // Optimized user and memory query using smart caching
    const [user, recentMemory] = await Promise.all([
      userCache.getCachedUser(userId, () => 
        User.findById(userId).select('profile emotionalLog').lean()
      ),
      userCache.getCachedMemory(userId, () => 
        ShortTermMemory.find({ userId }, { role: 1, content: 1, _id: 0 })
          .sort({ timestamp: -1 })
          .limit(3)
          .lean()
      ),
    ]);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Optimized emotional log processing
    const recentEmotionalLogEntries = (user.emotionalLog || [])
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 2);

    const formattedEmotionalLog = recentEmotionalLogEntries
      .map((entry) => {
        const date = new Date(entry.timestamp).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
        return `On ${date}, you expressed feeling ${entry.emotion}${
          entry.intensity ? ` (intensity ${entry.intensity})` : ""
        } because: ${entry.context || "no specific context provided"}.`;
      })
      .join("\n");

    recentMemory.reverse();

    // Optimized conversation history building
    const conversationHistory = recentMemory
      .map(mem => `${mem.role === "user" ? "user" : "assistant"}\n${mem.content}`)
      .join("\n");

    // Optimized prompt construction
    let fullPrompt = `<s>[INST] You are a helpful, empathetic, and factual assistant. You provide thoughtful, comprehensive responses while maintaining accuracy and clarity.

RESPONSE FORMAT:
- Provide natural, conversational responses
- If you detect emotional content, format it as: EMOTION_LOG: {"emotion":"emotion_name","intensity":1-10,"context":"brief_context"}
- If you identify a task, format it as: TASK_INFERENCE: {"taskType":"task_name","parameters":{"key":"value"}}
- Keep these special markers separate from your main response

CONVERSATION EXAMPLES:`;

    if (conversationHistory.length > 0) {
      const recentExchanges = conversationHistory.split('\n').slice(-4);
      for (const exchange of recentExchanges) {
        if (exchange.startsWith('user')) {
          fullPrompt += `\nUser: ${exchange.substring(4)}`;
        } else if (exchange.startsWith('assistant')) {
          fullPrompt += `\nAssistant: ${exchange.substring(9)}`;
        }
      }
    } else {
      fullPrompt += `
User: I'm feeling anxious about tomorrow's presentation.
Assistant: EMOTION_LOG: {"emotion":"anxiety","intensity":6,"context":"upcoming presentation"}
I understand that feeling anxious about presentations is completely natural. Many people experience this, and it shows you care about doing well. What specific aspects of the presentation are making you feel most anxious? Is it the content, the audience, or perhaps the technical setup? Once we identify the main concerns, we can work on some practical strategies to help you feel more confident and prepared.

User: Can you help me organize my work schedule for next week?
Assistant: TASK_INFERENCE: {"taskType":"schedule_organization","parameters":{"scope":"weekly","context":"work"}}
I'd be happy to help you organize your work schedule for next week. To provide the most helpful guidance, could you tell me about your current workload? Are there any specific priorities, deadlines, or meetings I should know about? Also, what time management challenges are you currently facing? With this information, I can suggest a structured approach that works best for your situation.

User: Tell me about the benefits of regular exercise.
Assistant: Regular exercise offers numerous benefits for both physical and mental health. Physically, it strengthens your cardiovascular system, improves muscle tone and bone density, and helps maintain a healthy weight. It also boosts your immune system, making you less susceptible to illness. 

Mentally, exercise is a powerful mood enhancer. It releases endorphins, which are natural mood elevators, and can significantly reduce symptoms of anxiety and depression. Regular physical activity also improves cognitive function, including memory and concentration, and can help you sleep better at night.

The key is finding activities you enjoy - whether it's walking, swimming, dancing, or playing sports. Even 30 minutes of moderate exercise most days of the week can make a significant difference in your overall well-being.`;
    }

    fullPrompt += `

Remember: Provide helpful, accurate responses. Use the special markers only when relevant. Focus on being conversational and empathetic. [/INST]

${userPrompt}`;

    console.log("Full prompt constructed. Length:", fullPrompt.length);

    const llamaCppApiUrl = process.env.LLAMA_CPP_API_URL || "http://localhost:8000/completion";

    // Optimized parameters for Mistral 7B GGUF Q4
    const optimizedParams = {
      prompt: fullPrompt,
      stop: stop,
      n_predict: Math.min(n_predict, 1000),
      temperature: Math.min(temperature, 0.85),
      top_k: 50,
      top_p: 0.9,
      repeat_penalty: 1.15,
      frequency_penalty: 0.2,
      presence_penalty: 0.1,
      stream: stream,
      min_p: 0.05,
      typical_p: 0.95,
      mirostat: 2,
      mirostat_tau: 4.0,
      mirostat_eta: 0.15,
      tfs_z: 1.0,
      penalty_alpha: 0.6,
      penalty_last_n: 128,
    };

    if (stream) {
      console.log('🚀 STREAMING - Starting real-time token stream...');
      
      // Set streaming headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Accel-Buffering', 'no');

      let streamResponse;
      let streamTimeout;
      let cleanup;

      try {
        streamResponse = await axios({
          method: "POST",
          url: llamaCppApiUrl,
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
            "Accept": "text/event-stream",
          },
          data: optimizedParams,
          httpsAgent: httpsAgent,
          timeout: 60000,
          responseType: 'stream',
        });

        let fullContent = '';
        let buffer = '';
        let tokenCount = 0;
        let streamEnded = false;
        let metadataBuffer = '';
        
        // Create cleanup function
        cleanup = createStreamCleanup(streamResponse, streamTimeout, res);
        
        console.log('📡 Stream connected, waiting for tokens...');
        
        // Timeout to prevent infinite streams
        streamTimeout = setTimeout(() => {
          if (!streamEnded) {
            console.log('⏰ Stream timeout reached, ending stream');
            streamEnded = true;
            res.write('data: [DONE]\n\n');
            cleanup();
          }
        }, 120000);

        streamResponse.data.on('data', (chunk) => {
          if (streamEnded) return;
          
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ') && line.length > 6) {
              try {
                const jsonStr = line.substring(6).trim();
                
                if (jsonStr === '[DONE]') {
                  console.log('🏁 Stream ended by llama.cpp');
                  streamEnded = true;
                  break;
                }
                
                const parsed = JSON.parse(jsonStr);
                
                if (parsed.stop === true || parsed.stopped === true) {
                  console.log('🛑 Stream stopped by model');
                  streamEnded = true;
                  break;
                }
                
                if (parsed.content && parsed.content.trim()) {
                  fullContent += parsed.content;
                  metadataBuffer += parsed.content;
                  tokenCount++;
                  
                  // Check for stop sequences
                  let shouldStop = false;
                  for (const stopSeq of stop) {
                    if (metadataBuffer.includes(stopSeq) || fullContent.includes(stopSeq)) {
                      console.log(`🛑 Stop sequence detected: "${stopSeq}"`);
                      shouldStop = true;
                      streamEnded = true;
                      break;
                    }
                  }
                  
                  // Safety check for excessive tokens
                  if (tokenCount > 1000) {
                    console.log(`🚨 Token limit exceeded (${tokenCount}), stopping stream`);
                    shouldStop = true;
                    streamEnded = true;
                  }
                  
                  if (shouldStop) break;
                  
                  // Optimized metadata detection - Combined regex for better performance
                  const COMBINED_METADATA_REGEX = /(?:EMOTION_LOG|TASK_INFERENCE):?\s*(\{[^}]*\})/g;
                  const hasCompleteMetadata = metadataBuffer.match(COMBINED_METADATA_REGEX);
                  
                  if (hasCompleteMetadata) {
                    console.log('🔍 Complete metadata detected, clearing buffer');
                    metadataBuffer = '';
                  } else if (metadataBuffer.includes('EMOTION_LOG') || metadataBuffer.includes('TASK_INFERENCE')) {
                    console.log('🔍 Partial metadata detected, buffering...');
                    // Don't send this token, continue buffering
                  } else {
                    // Safe to send token
                    res.write(`data: ${JSON.stringify({ content: parsed.content })}\n\n`);
                    if (res.flush) res.flush();
                    
                    // Reset buffer periodically with sliding window for better memory management
                    const MAX_BUFFER_SIZE = 1000;
                    if (metadataBuffer.length > MAX_BUFFER_SIZE) {
                      metadataBuffer = metadataBuffer.slice(-MAX_BUFFER_SIZE);
                    }
                  }
                }
              } catch (e) {
                console.error('JSON parse error in stream:', e);
              }
            }
          }
        });

        streamResponse.data.on('end', () => {
          if (!streamEnded) {
            streamEnded = true;
            console.log(`✅ Stream complete! ${tokenCount} tokens, ${fullContent.length} chars`);
            res.write('data: [DONE]\n\n');
            cleanup();
          }
          
          if (fullContent.trim()) {
            processStreamResponse(fullContent, userPrompt, userId);
          }
        });

        streamResponse.data.on('error', (error) => {
          if (!streamEnded) {
            streamEnded = true;
            console.error('❌ Stream error:', error);
            res.write(`data: ${JSON.stringify({ 
              error: true, 
              message: "Stream connection error. Please try again.",
              recoverable: true 
            })}\n\n`);
            cleanup();
          }
        });

        res.on('error', (error) => {
          if (!streamEnded) {
            streamEnded = true;
            console.error('❌ Response stream error:', error);
            cleanup();
          }
        });

        req.on('close', () => {
          if (!streamEnded) {
            streamEnded = true;
            console.log('🔌 Client disconnected during stream');
            cleanup();
          }
        });

      } catch (error) {
        console.error('💥 Streaming failed:', error.message);
        if (cleanup) cleanup();
        res.status(500).json({ 
          status: "error", 
          message: "Streaming failed: " + error.message
        });
      }
      return;
    }

    // --- Non-streaming mode ---
    try {
      const llmRes = await axios({
        method: "POST",
        url: llamaCppApiUrl,
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
          "User-Agent": "numina-server/1.0",
          Connection: "keep-alive",
        },
        data: optimizedParams,
        httpsAgent: httpsAgent,
        timeout: 120000,
      });

      let botReplyContent = llmRes.data.content || "";
      console.log("Raw LLM response:", botReplyContent);

      // Optimized parsing and cleaning with performance tracking
      let inferredTask = null;
      let inferredEmotion = null;

      // Track emotion logging performance
      const emotionStart = Date.now();
      [inferredEmotion, botReplyContent] = extractJsonPattern(
        METADATA_PATTERNS.emotion,
        botReplyContent,
        "emotion log"
      );
      const emotionDuration = Date.now() - emotionStart;
      if (req.trackOperation) req.trackOperation('emotion_logging', emotionDuration);

      // Track task inference performance
      const taskStart = Date.now();
      [inferredTask, botReplyContent] = extractJsonPattern(
        METADATA_PATTERNS.task,
        botReplyContent,
        "task inference"
      );
      const taskDuration = Date.now() - taskStart;
      if (req.trackOperation) req.trackOperation('task_inference', taskDuration);

      // Track string sanitization performance
      const sanitizeStart = Date.now();
      botReplyContent = cleanResponse(botReplyContent);
      const sanitizeDuration = Date.now() - sanitizeStart;
      if (req.trackOperation) req.trackOperation('string_sanitization', sanitizeDuration);

      // Optimized database operations with performance tracking
      const dbStart = Date.now();
      const dbOperations = [];

      dbOperations.push(
        ShortTermMemory.insertMany([
          { userId, content: userPrompt, role: "user" },
          {
            userId,
            content: botReplyContent,
            role: "assistant",
          },
        ])
      );

      if (inferredEmotion?.emotion) {
        const emotionToLog = {
          emotion: inferredEmotion.emotion,
          context: inferredEmotion.context || userPrompt,
        };

        if (inferredEmotion.intensity >= 1 && inferredEmotion.intensity <= 10) {
          emotionToLog.intensity = inferredEmotion.intensity;
        }

        dbOperations.push(
          User.findByIdAndUpdate(userId, {
            $push: { emotionalLog: emotionToLog },
          })
        );
      }

      if (inferredTask?.taskType) {
        const taskParameters = typeof inferredTask.parameters === "object" ? inferredTask.parameters : {};

        dbOperations.push(
          Task.create({
            userId,
            taskType: inferredTask.taskType,
            parameters: taskParameters,
            status: "queued",
          })
        );
      }

      await Promise.all(dbOperations);
      const dbDuration = Date.now() - dbStart;
      if (req.trackOperation) req.trackOperation('database_operations', dbDuration);

      // Invalidate cache after database operations
      userCache.invalidateUser(userId);

      // Final safety check
      botReplyContent = sanitizeResponse(botReplyContent);

      res.json({ content: botReplyContent });

    } catch (fetchError) {
      console.error("Non-streaming LLM request failed:", fetchError.message);
      res.status(500).json({ 
        status: "error", 
        message: "LLM request failed: " + fetchError.message
      });
    }

  } catch (err) {
    console.error("Error in /completion endpoint:", err);
    res.status(500).json({
      status: "error",
      message: "Error processing LLM request. Please try again.",
    });
  }
});

// Optimized stream response processing
const processStreamResponse = async (fullContent, userPrompt, userId) => {
  try {
    console.log("Processing complete stream response for metadata...");
    
    let inferredTask = null;
    let inferredEmotion = null;

    [inferredEmotion, fullContent] = extractJsonPattern(
      METADATA_PATTERNS.emotion,
      fullContent,
      "emotion log"
    );

    [inferredTask, fullContent] = extractJsonPattern(
      METADATA_PATTERNS.task,
      fullContent,
      "task inference"
    );

    const sanitizedContent = cleanResponse(fullContent);

    // Optimized database operations
    const dbOperations = [];

    dbOperations.push(
      ShortTermMemory.insertMany([
        { userId, content: userPrompt, role: "user" },
        {
          userId,
          content: sanitizedContent,
          role: "assistant",
        },
      ])
    );

    if (inferredEmotion?.emotion) {
      const emotionToLog = {
        emotion: inferredEmotion.emotion,
        context: inferredEmotion.context || userPrompt,
      };

      if (inferredEmotion.intensity >= 1 && inferredEmotion.intensity <= 10) {
        emotionToLog.intensity = inferredEmotion.intensity;
      }

      dbOperations.push(
        User.findByIdAndUpdate(userId, {
          $push: { emotionalLog: emotionToLog },
        })
      );
    }

    if (inferredTask?.taskType) {
      const taskParameters = typeof inferredTask.parameters === "object" ? inferredTask.parameters : {};

      dbOperations.push(
        Task.create({
          userId,
          taskType: inferredTask.taskType,
          parameters: taskParameters,
          status: "queued",
        })
      );
    }

    await Promise.all(dbOperations);

    // Invalidate cache after database operations
    userCache.invalidateUser(userId);

    const summaryParts = ["Stream data saved:"];
    summaryParts.push("- 2 memory entries (user and assistant)");

    if (inferredEmotion?.emotion) {
      summaryParts.push(`- Emotion: ${inferredEmotion.emotion}`);
    }

    if (inferredTask?.taskType) {
      summaryParts.push(`- Task: ${inferredTask.taskType}`);
    }

    console.log(summaryParts.join(" "));
  } catch (error) {
    console.error('Error processing stream response:', error);
  }
};

export default router; 