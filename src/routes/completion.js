import express from "express";
import { protect } from "../middleware/auth.js";
import { completionRateLimiter } from "../middleware/security.js";
import User from "../models/User.js";
import ShortTermMemory from "../models/ShortTermMemory.js";
import Task from "../models/Task.js";
import { sanitizeResponse } from "../utils/sanitize.js";
import axios from "axios";
import https from "https";

const router = express.Router();

// Create reusable HTTPS agent for better performance
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
  timeout: 15000, // Reduced timeout for faster response
  maxSockets: 5,
});

// Optimized metadata extraction function
const extractMetadata = (content) => {
  let inferredTask = null;
  let inferredEmotion = null;
  let cleanContent = content;

  // Single-pass regex extraction for better performance
  const emotionMatch = content.match(/EMOTION_LOG:?\s*(\{[^}]*\})/);
  if (emotionMatch) {
    try {
      inferredEmotion = JSON.parse(emotionMatch[1]);
      cleanContent = cleanContent.replace(emotionMatch[0], '');
    } catch (e) {
      console.error('Failed to parse emotion JSON:', e.message);
    }
  }

  const taskMatch = content.match(/TASK_INFERENCE:?\s*(\{[^}]*\})/);
  if (taskMatch) {
    try {
      inferredTask = JSON.parse(taskMatch[1]);
      cleanContent = cleanContent.replace(taskMatch[0], '');
    } catch (e) {
      console.error('Failed to parse task JSON:', e.message);
    }
  }

  // Fast cleanup - single regex pass
  cleanContent = cleanContent
    .replace(/(?:EMOTION_LOG|TASK_INFERENCE):?[^\n]*/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();

  return { inferredTask, inferredEmotion, cleanContent };
};

// Apply completion-specific rate limiting
router.post("/completion", completionRateLimiter, protect, async (req, res) => {
  const userId = req.user.id;
  const userPrompt = req.body.prompt;
  const stream = req.body.stream === true;
  
  // Optimized stop sequences - reduced set for better performance
  const stop = req.body.stop || [
    "USER:", "\nUSER:", "\nUser:", 
    "Human:", "\nHuman:",
    "\n\n\n", "---", 
    "<s>", "</s>", "[INST]", "[/INST]",
    "Assistant:", "\nAssistant:",
    "...", "etc.",
  ];
  
  const n_predict = Math.min(req.body.n_predict || 500, 1000);
  const temperature = Math.min(req.body.temperature || 0.7, 0.85);

  if (!userPrompt || typeof userPrompt !== "string") {
    return res.status(400).json({ message: "Invalid or missing prompt." });
  }

  try {
    console.log(`⚡ Fast completion request for user ${userId}`);
    
    // Parallel data fetching for better performance
    const [user, recentMemory] = await Promise.all([
      User.findById(userId),
      ShortTermMemory.find({ userId }, { role: 1, content: 1, _id: 0 })
        .sort({ timestamp: -1 })
        .limit(2) // Reduced to 2 for faster processing
        .lean()
    ]);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Simplified prompt construction for faster processing
    const conversationHistory = recentMemory.reverse()
      .map(mem => `${mem.role}: ${mem.content}`)
      .join('\n');

    // Streamlined prompt - removed complex examples for faster processing
    const fullPrompt = `<s>[INST] You are a helpful assistant. Provide natural responses.

If emotional content: EMOTION_LOG: {"emotion":"name","intensity":1-10,"context":"brief"}
If task needed: TASK_INFERENCE: {"taskType":"name","parameters":{}}

${conversationHistory ? `Recent conversation:\n${conversationHistory}\n\n` : ''}

User: ${userPrompt} [/INST]`;

    const llamaCppApiUrl = process.env.LLAMA_CPP_API_URL || "http://localhost:8000/completion";

    // Optimized parameters for faster response
    const optimizedParams = {
      prompt: fullPrompt,
      stop: stop,
      n_predict: n_predict,
      temperature: temperature,
      top_k: 40, // Reduced for faster sampling
      top_p: 0.9,
      repeat_penalty: 1.1, // Reduced for faster generation
      stream: stream,
      // Removed complex parameters for faster processing
    };

    if (stream) {
      console.log('🚀 OPTIMIZED STREAMING - Starting...');
      
      // Optimized streaming headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      try {
        const streamResponse = await axios({
          method: "POST",
          url: llamaCppApiUrl,
          headers: {
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
          },
          data: optimizedParams,
          httpsAgent: httpsAgent,
          timeout: 30000, // Reduced timeout for faster response
          responseType: 'stream',
        });

        let fullContent = '';
        let buffer = '';
        let tokenCount = 0;
        let streamEnded = false;
        
        // Faster timeout for better responsiveness
        const streamTimeout = setTimeout(() => {
          if (!streamEnded) {
            console.log('⏰ Stream timeout - ending for responsiveness');
            streamEnded = true;
            res.write('data: [DONE]\n\n');
            res.end();
          }
        }, 45000); // Reduced to 45 seconds

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
                  streamEnded = true;
                  clearTimeout(streamTimeout);
                  break;
                }
                
                const parsed = JSON.parse(jsonStr);
                
                if (parsed.content && parsed.content.trim()) {
                  fullContent += parsed.content;
                  tokenCount++;
                  
                  // Fast stop sequence check
                  let shouldStop = false;
                  for (const stopSeq of stop) {
                    if (fullContent.includes(stopSeq)) {
                      shouldStop = true;
                      streamEnded = true;
                      clearTimeout(streamTimeout);
                      break;
                    }
                  }
                  
                  // Quick token limit check
                  if (tokenCount > 800) { // Reduced for faster responses
                    shouldStop = true;
                    streamEnded = true;
                    clearTimeout(streamTimeout);
                  }
                  
                  if (shouldStop) break;
                  
                  // Simplified metadata detection - don't buffer, just check
                  if (parsed.content.includes('EMOTION_LOG') || parsed.content.includes('TASK_INFERENCE')) {
                    // Skip sending metadata tokens
                    continue;
                  }
                  
                  // Send token immediately for faster response
                  res.write(`data: ${JSON.stringify({ content: parsed.content })}\n\n`);
                  if (res.flush) res.flush();
                }
              } catch (e) {
                console.error('JSON parse error:', e.message);
              }
            }
          }
        });

        streamResponse.data.on('end', () => {
          if (!streamEnded) {
            streamEnded = true;
            clearTimeout(streamTimeout);
            console.log(`✅ Stream complete! ${tokenCount} tokens`);
            res.write('data: [DONE]\n\n');
            res.end();
          }
          
          // Process metadata asynchronously for better performance
          if (fullContent.trim()) {
            setImmediate(() => processStreamResponse(fullContent, userPrompt, userId));
          }
        });

        streamResponse.data.on('error', (error) => {
          if (!streamEnded) {
            streamEnded = true;
            clearTimeout(streamTimeout);
            console.error('❌ Stream error:', error.message);
            res.write(`data: ${JSON.stringify({ 
              error: true, 
              message: "Stream error. Please try again."
            })}\n\n`);
            res.end();
          }
        });

        // Handle client disconnect
        req.on('close', () => {
          if (!streamEnded) {
            streamEnded = true;
            clearTimeout(streamTimeout);
            console.log('🔌 Client disconnected');
            if (streamResponse.data?.destroy) {
              streamResponse.data.destroy();
            }
          }
        });

      } catch (error) {
        console.error('💥 Streaming failed:', error.message);
        res.status(500).json({ 
          status: "error", 
          message: "Streaming failed: " + error.message
        });
      }
      return;
    }

    // --- Optimized Non-streaming mode ---
    try {
      const llmRes = await axios({
        method: "POST",
        url: llamaCppApiUrl,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "numina-server/1.0",
        },
        data: optimizedParams,
        httpsAgent: httpsAgent,
        timeout: 30000, // Reduced timeout for faster response
      });

      const rawContent = llmRes.data.content || "";
      
      // Fast metadata extraction
      const { inferredTask, inferredEmotion, cleanContent } = extractMetadata(rawContent);
      
      // Final cleanup
      const botReplyContent = sanitizeResponse(cleanContent);

      // Parallel database operations
      const dbOperations = [
        ShortTermMemory.insertMany([
          { userId, content: userPrompt, role: "user" },
          { userId, content: botReplyContent, role: "assistant" }
        ])
      ];

      if (inferredEmotion?.emotion) {
        dbOperations.push(
          User.findByIdAndUpdate(userId, {
            $push: { 
              emotionalLog: {
                emotion: inferredEmotion.emotion,
                intensity: inferredEmotion.intensity,
                context: inferredEmotion.context || userPrompt
              }
            },
          })
        );
      }

      if (inferredTask?.taskType) {
        dbOperations.push(
          Task.create({
            userId,
            taskType: inferredTask.taskType,
            parameters: inferredTask.parameters || {},
            status: "queued",
          })
        );
      }

      // Execute all database operations in parallel
      await Promise.all(dbOperations);

      res.json({ content: botReplyContent });

    } catch (fetchError) {
      console.error("LLM request failed:", fetchError.message);
      res.status(500).json({ 
        status: "error", 
        message: "Request failed: " + fetchError.message
      });
    }

  } catch (err) {
    console.error("Completion error:", err.message);
    res.status(500).json({
      status: "error",
      message: "Error processing request. Please try again.",
    });
  }
});

// Optimized stream processing function
const processStreamResponse = async (fullContent, userPrompt, userId) => {
  try {
    const { inferredTask, inferredEmotion, cleanContent } = extractMetadata(fullContent);
    const sanitizedContent = sanitizeResponse(cleanContent);

    const dbOperations = [
      ShortTermMemory.insertMany([
        { userId, content: userPrompt, role: "user" },
        { userId, content: sanitizedContent, role: "assistant" }
      ])
    ];

    if (inferredEmotion?.emotion) {
      dbOperations.push(
        User.findByIdAndUpdate(userId, {
          $push: { 
            emotionalLog: {
              emotion: inferredEmotion.emotion,
              intensity: inferredEmotion.intensity,
              context: inferredEmotion.context || userPrompt
            }
          },
        })
      );
    }

    if (inferredTask?.taskType) {
      dbOperations.push(
        Task.create({
          userId,
          taskType: inferredTask.taskType,
          parameters: inferredTask.parameters || {},
          status: "queued",
        })
      );
    }

    await Promise.all(dbOperations);
    console.log('✅ Stream metadata processed successfully');
  } catch (error) {
    console.error('❌ Stream processing error:', error.message);
  }
};

export default router; 