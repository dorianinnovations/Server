import express from "express";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";
import ShortTermMemory from "../models/ShortTermMemory.js";
import Task from "../models/Task.js";
import { createLLMService } from "../services/llmService.js";
import { sanitizeResponse } from "../utils/sanitize.js";
import axios from "axios";

const router = express.Router();
const llmService = createLLMService();

router.post("/completion", protect, async (req, res) => {
  const userId = req.user.id;
  const userPrompt = req.body.prompt;
  const stream = req.body.stream === true;
  // Sensible defaults fr LLM parameters
  const stop = req.body.stop || ["<|im_end|>", "\n<|im_start|>"];
  const n_predict = req.body.n_predict || 1024;
  const temperature = req.body.temperature || 0.7;

  if (!userPrompt || typeof userPrompt !== "string") {
    return res.status(400).json({ message: "Invalid or missing prompt." });
  }

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

      console.log('🚀 STREAMING - Starting real-time token stream...');
      
      // Set streaming headers optimized for real-time
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // Make streaming request to llama.cpp
      const llamaRes = await axios({
        method: "POST",
        url: process.env.LLAMA_CPP_API_URL || "http://localhost:8000/completion",
        data: {
          prompt: fullPrompt,
          stop,
          n_predict,
          temperature,
          stream: true,
        },
        responseType: "stream",
        timeout: 60000, // 1 minute timeout
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        }
      });

      let fullContent = '';
      let buffer = '';
      let tokenCount = 0;
      let streamEnded = false;
      let metadataBuffer = ''; // Buffer for metadata detection
      
      console.log('📡 Stream connected, waiting for tokens...');
      
      // Set up a timeout to prevent infinite streams
      const streamTimeout = setTimeout(() => {
        if (!streamEnded) {
          console.log('⏰ Stream timeout reached, ending stream');
          streamEnded = true;
          res.write('data: [DONE]\n\n');
          res.end();
          if (llamaRes.data && llamaRes.data.destroy) {
            llamaRes.data.destroy();
          }
        }
      }, 60000); // 1 minute timeout

      // Handle streaming data chunk by chunk
      llamaRes.data.on('data', (chunk) => {
        if (streamEnded) return;
        
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line for next chunk
        
        for (const line of lines) {
          if (line.startsWith('data: ') && line.length > 6) {
            try {
              const jsonStr = line.substring(6).trim();
              
              if (jsonStr === '[DONE]') {
                console.log('🏁 Stream ended by llama.cpp');
                streamEnded = true;
                clearTimeout(streamTimeout);
                break;
              }
              
              const parsed = JSON.parse(jsonStr);
              
              // Check if stream should stop based on parsed data
              if (parsed.stop === true || parsed.stopped === true) {
                console.log('🛑 Stream stopped by model');
                streamEnded = true;
                clearTimeout(streamTimeout);
                break;
              }
              
              // Only process if there's actual content
              if (parsed.content && parsed.content.trim()) {
                fullContent += parsed.content;
                metadataBuffer += parsed.content;
                tokenCount++;
                
                console.log(`⚡ Token ${tokenCount}:`, JSON.stringify(parsed.content));
                
                // Check for stop sequences in the accumulated content
                let shouldStop = false;
                for (const stopSeq of stop) {
                  if (metadataBuffer.includes(stopSeq) || fullContent.includes(stopSeq)) {
                    console.log(`🛑 Stop sequence detected: "${stopSeq}"`);
                    shouldStop = true;
                    streamEnded = true;
                    clearTimeout(streamTimeout);
                    break;
                  }
                }
                
                // Additional safety check for excessive token generation
                if (tokenCount > 1000) {
                  console.log(`🚨 Token limit exceeded (${tokenCount}), stopping stream`);
                  shouldStop = true;
                  streamEnded = true;
                  clearTimeout(streamTimeout);
                }
                
                if (shouldStop) break;
                
                // Look for metadata markers in accumulated buffer
                const hasMetadataStart = metadataBuffer.includes('EMOTION_LOG') || 
                                       metadataBuffer.includes('TASK_INFERENCE');
                
                // If we detect metadata, don't send this token but continue collecting
                if (hasMetadataStart) {
                  // Check if we have a complete JSON object
                  const emotionMatch = metadataBuffer.match(/EMOTION_LOG:?\s*(\{[^}]*\})/);
                  const taskMatch = metadataBuffer.match(/TASK_INFERENCE:?\s*(\{[^}]*\})/);
                  
                  if (emotionMatch || taskMatch) {
                    // We have complete metadata, clear the buffer but don't send
                    console.log('🔍 Complete metadata detected:', emotionMatch ? 'EMOTION_LOG' : 'TASK_INFERENCE');
                    metadataBuffer = '';
                  } else {
                    console.log('🔍 Partial metadata detected, buffering...');
                  }
                  // If incomplete metadata, just continue buffering
                } else {
                  // No metadata detected, safe to send
                  res.write(`data: ${JSON.stringify({ content: parsed.content })}\n\n`);
                  
                  // Force flush for real-time delivery
                  if (res.flush) res.flush();
                  
                  // Reset metadata buffer periodically to prevent overflow
                  if (metadataBuffer.length > 500) {
                    metadataBuffer = metadataBuffer.slice(-200);
                    console.log('📝 Metadata buffer reset to prevent overflow');
                  }
                }
              }
            } catch (e) {
              console.error('JSON parse error in stream:', e);
              // Skip invalid JSON
            }
          }
        }
      });

      llamaRes.data.on("end", () => {
        if (!streamEnded) {
          streamEnded = true;
          clearTimeout(streamTimeout);
          console.log(`✅ Stream complete! ${tokenCount} tokens, ${fullContent.length} chars`);
          res.write('data: [DONE]\n\n');
          res.end();
        }
        
        // Process the complete response for metadata and save to memory
        if (fullContent.trim()) {
          processStreamResponse(fullContent, userPrompt, userId);
        }
      });

      llamaRes.data.on("error", (err) => {
        if (!streamEnded) {
          streamEnded = true;
          clearTimeout(streamTimeout);
          console.error('❌ Stream error:', err);
          
          // Send a proper error response that client can handle
          res.write(`data: ${JSON.stringify({ 
            error: true, 
            message: "Stream connection error. Please try again.",
            recoverable: true 
          })}\n\n`);
          res.end();
        }
      });

      // Handle connection errors on the response stream
      res.on('error', (error) => {
        if (!streamEnded) {
          streamEnded = true;
          clearTimeout(streamTimeout);
          console.error('❌ Response stream error:', error);
          if (llamaRes.data && llamaRes.data.destroy) {
            llamaRes.data.destroy();
          }
        }
      });
      
      // Handle client disconnect
      req.on('close', () => {
        if (!streamEnded) {
          streamEnded = true;
          clearTimeout(streamTimeout);
          console.log('🔌 Client disconnected during stream');
          if (llamaRes.data && llamaRes.data.destroy) {
            llamaRes.data.destroy();
          }
        }
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
  try {
    console.log(`✓Completion request received for user ${userId}.`);
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const userProfile = user.profile ? JSON.stringify(user.profile) : "{}";

    // Limit emotional log to a relevant number of recent entries to keep prompt concise
    const recentEmotionalLogEntries = user.emotionalLog
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 3); // Get most recent 3 entries

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

    // Use memory and user data in parallel with Promise.all for efficiency
    const [recentMemory] = await Promise.all([
      ShortTermMemory.find(
        { userId },
        { role: 1, content: 1, _id: 0 } // Project only needed fields
      )
        .sort({ timestamp: -1 })
        .limit(6)
        .lean(),
    ]);

    // Process in reverse chronological order without another array operation
    recentMemory.reverse();

    // Pre-allocate approximate size for string builder pattern (more efficient than join)
    const historyBuilder = [];
    for (const mem of recentMemory) {
      historyBuilder.push(
        `${mem.role === "user" ? "user" : "assistant"}\n${mem.content}`
      );
    }
    const conversationHistory = historyBuilder.join("\n");

    // --- Streamlined LLM Prompt ---
    // Optimize by constructing prompt conditionally - only include what's needed
    const promptParts = [
      `You are Numina, an empathetic and concise AI assistant. Your goal is to provide helpful responses, acknowledge user emotions, and proactively identify tasks.`,
      `**User Profile:** ${userProfile}`,
    ];

    // Only include conversation history if it exists
    if (conversationHistory.length > 0) {
      promptParts.push(`**Recent Conversation:**\n${conversationHistory}`);
    }

    // Only include emotional log if it exists
    if (formattedEmotionalLog.length > 0) {
      promptParts.push(
        `**Your Emotional History Summary (Top 3 Recent):**\n${formattedEmotionalLog}`
      );
    }

    // Add instructions - using a more compact format
    promptParts.push(`Instructions for your response:
- Be direct and concise, but warm, sweet, witty, and playful.
- Do not echo user's prompt or instructions.
- Emotional Logging: If the user expresses a clear emotion, identify it and the context. Format strictly as: EMOTION_LOG: {"emotion": "happy", "intensity": 7, "context": "promotion"}
- Summarizing Past Emotions: Use human-readable format, not raw JSON.
- Task Inference: If the user implies a task, format strictly as: TASK_INFERENCE: {"taskType": "summarize_emotions", "parameters": {"period": "last week"}}
- Your primary conversational response should follow any EMOTION_LOG or TASK_INFERENCE output.`);

    // Add user query
    promptParts.push(
      `<|im_start|>user\n${userPrompt}\n<|im_end|>\n<|im_start|>assistant`
    );

    // Join with newlines for better token efficiency
    const fullPrompt = promptParts.join("\n\n");

    // Make LLM request
    const llmData = await llmService.makeLLMRequest(fullPrompt, {
      stop,
      n_predict,
      temperature,
    });

    let botReplyContent = llmData.content || ""; // Initialize as empty string

    // --- Begin Robust Parsing and Cleaning ---

    // Declare variables to store parsed information
    let inferredTask = null;
    let inferredEmotion = null;

    // Helper function for JSON extraction with error handling
    const extractJsonPattern = (regex, content, logType) => {
      const match = content.match(regex);
      if (!match || !match[1]) {
        return [null, content];
      }

      try {
        // Extract JSON and remove the match from content
        const jsonString = match[1].trim();
        const parsed = JSON.parse(jsonString);
        // Remove the entire pattern (marker + JSON)
        const newContent = content.replace(match[0], "");

        return [parsed, newContent];
      } catch (jsonError) {
        console.error(`Failed to parse ${logType} JSON:`, jsonError.message);
        return [null, content];
      }
    };

    // Extract and remove patterns with comprehensive patterns to catch all variations
    const taskInferenceRegex = /TASK_INFERENCE:?\s*(\{[\s\S]*?\})\s*?/g;
    const emotionLogRegex = /EMOTION_LOG:?\s*(\{[\s\S]*?\})\s*?/g;

    // Process emotion first - use the first match if multiple exist
    [inferredEmotion, botReplyContent] = extractJsonPattern(
      emotionLogRegex,
      botReplyContent,
      "emotion log"
    );

    // Then process task - use the first match if multiple exist
    [inferredTask, botReplyContent] = extractJsonPattern(
      taskInferenceRegex,
      botReplyContent,
      "task inference"
    );

    // Ensure ALL marker patterns are completely removed, even if parsing failed
    // This is a more aggressive approach to ensure no markers leak to the UI
    botReplyContent = botReplyContent
      // Remove model tokens
      .replace(/<\|im_(start|end)\|>(assistant|user)?\n?/g, "")
      // Aggressively remove any marker patterns, even incomplete ones
      .replace(/TASK_INFERENCE:?\s*(\{[\s\S]*?\})?\s*?/g, "")
      .replace(/EMOTION_LOG:?\s*(\{[\s\S]*?\})?\s*?/g, "")
      // Remove even just the marker names without JSON
      .replace(/TASK_INFERENCE:?/g, "")
      .replace(/EMOTION_LOG:?/g, "")
      // Remove code blocks that might contain markers
      .replace(/```json[\s\S]*?```/g, "")
      // Normalize newlines
      .replace(/(\r?\n){2,}/g, "\n")
      .trim();

    // Double check for any remaining marker patterns
    if (
      botReplyContent.includes("TASK_INFERENCE") ||
      botReplyContent.includes("EMOTION_LOG")
    ) {
      console.warn("Markers detected - applying emergency cleanup");
      // Emergency fallback: split by lines and filter out any line containing markers
      botReplyContent = botReplyContent
        .split("\n")
        .filter(
          (line) =>
            !line.includes("TASK_INFERENCE") && !line.includes("EMOTION_LOG")
        )
        .join("\n")
        .trim();
    }

    // Use the dedicated sanitizer for a final pass
    botReplyContent = sanitizeResponse(botReplyContent);
    // --- End Robust Parsing and Cleaning ---

    // Prepare database operations to be executed in parallel
    const dbOperations = [];

    // Memory storage operations (both user and assistant messages)
    dbOperations.push(
      ShortTermMemory.insertMany([
        { userId, content: userPrompt, role: "user" },
        // Ensure content is never empty for the assistant's response
        {
          userId,
          content:
            botReplyContent ||
            "I'm sorry, I wasn't able to provide a proper response.",
          role: "assistant",
        },
      ])
    );

    // Process inferred emotion if present
    if (inferredEmotion && inferredEmotion.emotion) {
      const emotionToLog = {
        emotion: inferredEmotion.emotion,
        context: inferredEmotion.context || userPrompt,
      };

      // Add intensity if valid
      if (inferredEmotion.intensity >= 1 && inferredEmotion.intensity <= 10) {
        emotionToLog.intensity = inferredEmotion.intensity;
      }

      // Queue the emotion update
      dbOperations.push(
        User.findByIdAndUpdate(userId, {
          $push: { emotionalLog: emotionToLog },
        })
      );
    }

    // Process inferred task if present
    if (inferredTask && inferredTask.taskType) {
      const taskParameters =
        typeof inferredTask.parameters === "object"
          ? inferredTask.parameters
          : {};

      // Queue the task creation
      dbOperations.push(
        Task.create({
          userId,
          taskType: inferredTask.taskType,
          parameters: taskParameters,
          status: "queued",
        })
      );
    }

    // Execute all database operations in parallel
    await Promise.all(dbOperations);

    // Database operations completed successfully

    // Final safety check before sending response to client
    botReplyContent = sanitizeResponse(botReplyContent);

    // Validate that sanitization was successful
    if (
      botReplyContent.includes("TASK_INFERENCE") ||
      botReplyContent.includes("EMOTION_LOG")
    ) {
      console.error("Response sanitization failed - markers still present");
      botReplyContent =
        "I'm sorry, I wasn't able to provide a proper response. Please try again.";
    }

    res.json({ content: botReplyContent });
  } catch (err) {
    console.error("Error in /completion endpoint:", err);
    res.status(500).json({
      status: "error",
      message: "Error processing LLM request. Please try again.",
    });
  }
});

// Process streaming response for metadata and memory storage
const processStreamResponse = async (fullContent, userPrompt, userId) => {
  try {
    console.log("Processing complete stream response for metadata...");
    
    // Helper function for JSON extraction with error handling
    const extractJsonPattern = (regex, content, logType) => {
      const match = content.match(regex);
      if (!match || !match[1]) {
        return [null, content];
      }

      try {
        // Extract JSON and remove the match from content
        const jsonString = match[1].trim();
        const parsed = JSON.parse(jsonString);
        // Remove the entire pattern (marker + JSON)
        const newContent = content.replace(match[0], "");

        return [parsed, newContent];
      } catch (jsonError) {
        console.error(`Failed to parse ${logType} JSON:`, jsonError.message);
        return [null, content];
      }
    };

    // Extract metadata from full content
    const taskInferenceRegex = /TASK_INFERENCE:?\s*(\{[\s\S]*?\})\s*?/g;
    const emotionLogRegex = /EMOTION_LOG:?\s*(\{[\s\S]*?\})\s*?/g;

    let inferredEmotion = null;
    let inferredTask = null;
    let processedContent = fullContent;

    // Process emotion first
    [inferredEmotion, processedContent] = extractJsonPattern(
      emotionLogRegex,
      processedContent,
      "emotion log"
    );

    // Then process task
    [inferredTask, processedContent] = extractJsonPattern(
      taskInferenceRegex,
      processedContent,
      "task inference"
    );

    // Clean up the content
    processedContent = sanitizeResponse(processedContent);

    // Prepare database operations
    const dbOperations = [];

    // Memory storage operations
    dbOperations.push(
      ShortTermMemory.insertMany([
        { userId, content: userPrompt, role: "user" },
        {
          userId,
          content: processedContent || "Stream response processed.",
          role: "assistant",
        },
      ])
    );

    // Process inferred emotion if present
    if (inferredEmotion && inferredEmotion.emotion) {
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

    // Process inferred task if present
    if (inferredTask && inferredTask.taskType) {
      const taskParameters =
        typeof inferredTask.parameters === "object"
          ? inferredTask.parameters
          : {};

      dbOperations.push(
        Task.create({
          userId,
          taskType: inferredTask.taskType,
          parameters: taskParameters,
          status: "queued",
        })
      );
    }

    // Execute all database operations in parallel
    await Promise.all(dbOperations);

    console.log("Stream response processing completed successfully");
  } catch (error) {
    console.error('Error processing stream response:', error);
  }
};

export default router; 