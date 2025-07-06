import express from "express";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";
import ShortTermMemory from "../models/ShortTermMemory.js";
import Task from "../models/Task.js";
import { sanitizeResponse } from "../utils/sanitize.js";
import axios from "axios";
import https from "https";

const router = express.Router();

// Create reusable HTTPS agent for better performance
const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // For ngrok certificates
  keepAlive: true,
  timeout: 30000,
});

router.post("/completion", protect, async (req, res) => {
  const userId = req.user.id;
  const userPrompt = req.body.prompt;
  const stream = req.body.stream === true;
  
  // Comprehensive stop sequences for Mistral 7B - matches working server.js
  const stop = req.body.stop || [
    "USER:", "\nUSER:", "\nUser:", "user:", "\n\nUSER:",
    "Human:", "\nHuman:", "\nhuman:", "human:",
    "\n\nUser:", "\n\nHuman:", "\n\nuser:", "\n\nhuman:",
    "Q:", "\nQ:", "\nQuestion:", "Question:",
    "\n\n\n", "---", "***", "```",
    "</EXAMPLES>", "SYSTEM:", "\nSYSTEM:", "system:", "\nsystem:",
    // Mistral-specific stop sequences
    "<s>", "</s>", "[INST]", "[/INST]",
    "Assistant:", "\nAssistant:", "AI:",
    "Example:", "\nExample:", "For example:",
    "...", "etc.", "and so on",
    "Note:", "Important:", "Remember:",
    "Source:", "Reference:", "According to:",
  ];
  
  const n_predict = req.body.n_predict || 500;
  const temperature = req.body.temperature || 0.7;

  if (!userPrompt || typeof userPrompt !== "string") {
    return res.status(400).json({ message: "Invalid or missing prompt." });
  }

  try {
    console.log(`✓Completion request received for user ${userId}.`);
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const userProfile = user.profile ? JSON.stringify(user.profile) : "{}";

    // Limit emotional log to recent entries
    const recentEmotionalLogEntries = user.emotionalLog
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 2);

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

    // Get recent conversation history
    const [recentMemory] = await Promise.all([
      ShortTermMemory.find(
        { userId },
        { role: 1, content: 1, _id: 0 }
      )
        .sort({ timestamp: -1 })
        .limit(3)
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

    // --- Proper Mistral 7B Prompt Format (matches working server.js) ---
    let fullPrompt = `<s>[INST] You are a helpful, empathetic, and factual assistant. You provide thoughtful, comprehensive responses while maintaining accuracy and clarity.

RESPONSE FORMAT:
- Provide natural, conversational responses
- If you detect emotional content, format it as: EMOTION_LOG: {"emotion":"emotion_name","intensity":1-10,"context":"brief_context"}
- If you identify a task, format it as: TASK_INFERENCE: {"taskType":"task_name","parameters":{"key":"value"}}
- Keep these special markers separate from your main response

CONVERSATION EXAMPLES:`;

    // Add conversation history as examples if it exists
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
      // Default examples optimized for Mistral 7B
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
    console.log("Using LLAMA_CPP_API_URL:", llamaCppApiUrl);

    // Optimized parameters for Mistral 7B GGUF Q4 (matches working server.js)
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

      try {
        const streamResponse = await axios({
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
        
        console.log('📡 Stream connected, waiting for tokens...');
        
        // Timeout to prevent infinite streams
        const streamTimeout = setTimeout(() => {
          if (!streamEnded) {
            console.log('⏰ Stream timeout reached, ending stream');
            streamEnded = true;
            res.write('data: [DONE]\n\n');
            res.end();
            if (streamResponse.data && streamResponse.data.destroy) {
              streamResponse.data.destroy();
            }
          }
        }, 120000); // 2 minute timeout

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
                  clearTimeout(streamTimeout);
                  break;
                }
                
                const parsed = JSON.parse(jsonStr);
                
                if (parsed.stop === true || parsed.stopped === true) {
                  console.log('🛑 Stream stopped by model');
                  streamEnded = true;
                  clearTimeout(streamTimeout);
                  break;
                }
                
                if (parsed.content && parsed.content.trim()) {
                  fullContent += parsed.content;
                  metadataBuffer += parsed.content;
                  tokenCount++;
                  
                  console.log(`⚡ Token ${tokenCount}:`, JSON.stringify(parsed.content));
                  
                  // Check for stop sequences
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
                  
                  // Safety check for excessive tokens
                  if (tokenCount > 1000) {
                    console.log(`🚨 Token limit exceeded (${tokenCount}), stopping stream`);
                    shouldStop = true;
                    streamEnded = true;
                    clearTimeout(streamTimeout);
                  }
                  
                  if (shouldStop) break;
                  
                  // Simplified metadata detection - only check for complete patterns
                  const hasCompleteEmotion = metadataBuffer.match(/EMOTION_LOG:?\s*(\{[^}]*\})/);
                  const hasCompleteTask = metadataBuffer.match(/TASK_INFERENCE:?\s*(\{[^}]*\})/);
                  
                  if (hasCompleteEmotion || hasCompleteTask) {
                    console.log('🔍 Complete metadata detected, clearing buffer');
                    metadataBuffer = '';
                  } else if (metadataBuffer.includes('EMOTION_LOG') || metadataBuffer.includes('TASK_INFERENCE')) {
                    console.log('🔍 Partial metadata detected, buffering...');
                    // Don't send this token, continue buffering
                  } else {
                    // Safe to send token
                    res.write(`data: ${JSON.stringify({ content: parsed.content })}\n\n`);
                    if (res.flush) res.flush();
                    
                    // Reset buffer periodically
                    if (metadataBuffer.length > 500) {
                      metadataBuffer = metadataBuffer.slice(-200);
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
            clearTimeout(streamTimeout);
            console.log(`✅ Stream complete! ${tokenCount} tokens, ${fullContent.length} chars`);
            res.write('data: [DONE]\n\n');
            res.end();
          }
          
          if (fullContent.trim()) {
            processStreamResponse(fullContent, userPrompt, userId);
          }
        });

        streamResponse.data.on('error', (error) => {
          if (!streamEnded) {
            streamEnded = true;
            clearTimeout(streamTimeout);
            console.error('❌ Stream error:', error);
            res.write(`data: ${JSON.stringify({ 
              error: true, 
              message: "Stream connection error. Please try again.",
              recoverable: true 
            })}\n\n`);
            res.end();
          }
        });

        res.on('error', (error) => {
          if (!streamEnded) {
            streamEnded = true;
            clearTimeout(streamTimeout);
            console.error('❌ Response stream error:', error);
            if (streamResponse.data && streamResponse.data.destroy) {
              streamResponse.data.destroy();
            }
          }
        });

        req.on('close', () => {
          if (!streamEnded) {
            streamEnded = true;
            clearTimeout(streamTimeout);
            console.log('🔌 Client disconnected during stream');
            if (streamResponse.data && streamResponse.data.destroy) {
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

      // Parse and clean response (matches server.js logic)
      let inferredTask = null;
      let inferredEmotion = null;

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

      const taskInferenceRegex = /TASK_INFERENCE:?\s*(\{[\s\S]*?\})\s*?/g;
      const emotionLogRegex = /EMOTION_LOG:?\s*(\{[\s\S]*?\})\s*?/g;

      [inferredEmotion, botReplyContent] = extractJsonPattern(
        emotionLogRegex,
        botReplyContent,
        "emotion log"
      );

      [inferredTask, botReplyContent] = extractJsonPattern(
        taskInferenceRegex,
        botReplyContent,
        "task inference"
      );

      // Clean up response
      botReplyContent = botReplyContent
        .replace(/<\|im_(start|end)\|>(assistant|user)?\n?/g, "")
        .replace(/TASK_INFERENCE:?\s*(\{[\s\S]*?\})?\s*?/g, "")
        .replace(/EMOTION_LOG:?\s*(\{[\s\S]*?\})?\s*?/g, "")
        .replace(/TASK_INFERENCE:?/g, "")
        .replace(/EMOTION_LOG:?/g, "")
        .replace(/```json[\s\S]*?```/g, "")
        .replace(/(\r?\n){2,}/g, "\n")
        .trim();

      if (botReplyContent.includes("TASK_INFERENCE") || botReplyContent.includes("EMOTION_LOG")) {
        console.warn("Markers detected - applying emergency cleanup");
        botReplyContent = botReplyContent
          .split("\n")
          .filter(line => !line.includes("TASK_INFERENCE") && !line.includes("EMOTION_LOG"))
          .join("\n")
          .trim();
      }

      botReplyContent = sanitizeResponse(botReplyContent);

      // Database operations
      const dbOperations = [];

      dbOperations.push(
        ShortTermMemory.insertMany([
          { userId, content: userPrompt, role: "user" },
          {
            userId,
            content: botReplyContent || "I'm sorry, I wasn't able to provide a proper response.",
            role: "assistant",
          },
        ])
      );

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

      if (inferredTask && inferredTask.taskType) {
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

      // Final safety check
      botReplyContent = sanitizeResponse(botReplyContent);

      if (botReplyContent.includes("TASK_INFERENCE") || botReplyContent.includes("EMOTION_LOG")) {
        console.error("CRITICAL ERROR: Markers still present despite sanitization");
        botReplyContent = "I'm sorry, I wasn't able to provide a proper response. Please try again.";
      }

      res.json({ content: botReplyContent });

    } catch (fetchError) {
      console.error("Non-streaming LLM request failed:", fetchError.message);
      res.status(500).json({ 
        status: "error", 
        message: "LLM request failed: " + fetchError.message
      });
    }

  } catch (err) {
    console.error("Completion request failed:", err.message);
    res.status(500).json({ 
      status: "error", 
      message: "Completion failed: " + err.message
    });
  }
});

// Process stream response for metadata and database operations
const processStreamResponse = async (fullContent, userPrompt, userId) => {
  try {
    console.log("Processing stream response for metadata...");
    
    const extractJsonPattern = (regex, content, logType) => {
      const match = content.match(regex);
      if (!match || !match[1]) {
        return [null, content];
      }

      try {
        const jsonString = match[1].trim();
        const parsed = JSON.parse(jsonString);
        return [parsed, content];
      } catch (jsonError) {
        console.error(`Failed to parse ${logType} JSON:`, jsonError.message);
        return [null, content];
      }
    };

    const taskInferenceRegex = /TASK_INFERENCE:?\s*(\{[\s\S]*?\})\s*?/g;
    const emotionLogRegex = /EMOTION_LOG:?\s*(\{[\s\S]*?\})\s*?/g;

    const [inferredEmotion] = extractJsonPattern(emotionLogRegex, fullContent, "emotion log");
    const [inferredTask] = extractJsonPattern(taskInferenceRegex, fullContent, "task inference");

    // Clean content for storage
    let cleanContent = fullContent
      .replace(/TASK_INFERENCE:?\s*(\{[\s\S]*?\})?\s*?/g, "")
      .replace(/EMOTION_LOG:?\s*(\{[\s\S]*?\})?\s*?/g, "")
      .replace(/TASK_INFERENCE:?/g, "")
      .replace(/EMOTION_LOG:?/g, "")
      .replace(/(\r?\n){2,}/g, "\n")
      .trim();

    cleanContent = sanitizeResponse(cleanContent);

    const dbOperations = [];

    // Store conversation
    dbOperations.push(
      ShortTermMemory.insertMany([
        { userId, content: userPrompt, role: "user" },
        {
          userId,
          content: cleanContent || "I'm sorry, I wasn't able to provide a proper response.",
          role: "assistant",
        },
      ])
    );

    // Store emotion if detected
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

    // Store task if detected
    if (inferredTask && inferredTask.taskType) {
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
    console.log("Stream response processing complete");

  } catch (error) {
    console.error("Error processing stream response:", error);
  }
};

export default router; 