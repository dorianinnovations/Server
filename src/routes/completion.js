import express from "express";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";
import ShortTermMemory from "../models/ShortTermMemory.js";
import Task from "../models/Task.js";
import { sanitizeResponse } from "../utils/sanitize.js";
import { createUserCache } from "../utils/cache.js";
import { createLLMService } from "../services/llmService.js";
import { getRecentMemory } from "../utils/memory.js";

const router = express.Router();

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

// Common function to build user context
const buildUserContext = async (userId, userCache) => {
  const [user, recentMemory] = await Promise.all([
    userCache.getCachedUser(userId, () => 
      User.findById(userId).select('profile emotionalLog').lean()
    ),
    userCache.getCachedMemory(userId, () => 
      ShortTermMemory.find({ userId }, { role: 1, content: 1, _id: 0 })
        .sort({ timestamp: -1 })
        .limit(6)
        .lean()
    ),
  ]);

  if (!user) {
    throw new Error("User not found");
  }

  const userProfile = user.profile ? JSON.stringify(user.profile) : "{}";
  const recentEmotionalLogEntries = (user.emotionalLog || [])
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 3);

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

  return {
    user,
    userProfile,
    formattedEmotionalLog,
    recentMemory
  };
};

// Common function to build messages for OpenRouter
const buildMessages = (userProfile, formattedEmotionalLog, recentMemory, userPrompt) => {
  const messages = [];
  
  // Build conversation history
  const conversationHistory = recentMemory
    .map(mem => `${mem.role === "user" ? "user" : "assistant"}\n${mem.content}`)
    .join("\n");

 // System message - DYNAMIC LENGTH
const systemMessage = `You are Numina, an emotional wellness companion.

RESPONSE LENGTH GUIDANCE:
- SHORT (1-2 sentences): Simple check-ins, quick acknowledgments, basic questions
- MEDIUM (2-4 sentences): Offering support, noticing patterns, exploring feelings  
- LONGER (4-6 sentences): Complex emotional situations, providing insights, or when user needs deeper support

Match your response length to what the user needs in the moment.

USER CONTEXT:
${userProfile}

${conversationHistory.length > 0 ? `Recent conversation: ${conversationHistory}` : ''}

${formattedEmotionalLog.length > 0 ? `Recent emotions: ${formattedEmotionalLog}` : ''}

GUIDELINES:
- Be natural and conversational
- Respond proportionally to the user's message depth
- Notice patterns when they're meaningful
- Ask follow-up questions to keep dialogue flowing
- Use emojis sparingly
- Avoid unnecessary elaboration

LOGGING: After your response, log emotions/tasks if relevant:
EMOTION_LOG: {"emotion": "stressed", "intensity": 7, "context": "work deadline"}
TASK_INFERENCE: {"taskType": "plan_day", "parameters": {"priority": "focus"}}

Respond authentically with appropriate length for the situation.`;


  messages.push({ role: "system", content: systemMessage });
  
  // Add conversation history as individual messages
  if (recentMemory.length > 0) {
    for (const mem of recentMemory) {
      messages.push({ 
        role: mem.role === "user" ? "user" : "assistant", 
        content: mem.content 
      });
    }
  }
  
  // Add current user message
  messages.push({ role: "user", content: userPrompt });
  
  return messages;
};

// Common function to process response and save to database
const processResponseAndSave = async (fullContent, userPrompt, userId, userCache) => {
  let inferredTask = null;
  let inferredEmotion = null;

  // Extract metadata
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

  // Database operations
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

  return sanitizedContent;
};

// ...existing code...
router.post("/completion", protect, async (req, res) => {
  const userId = req.user.id;
  const userPrompt = req.body.prompt;
  const stream = req.body.stream === true;
  const temperature = req.body.temperature || 0.7;
  const userCache = createUserCache(userId);
  
  // Get user's conversation history for dynamic response sizing
  const recentMemory = await getRecentMemory(userId, userCache);
  const userMessages = recentMemory.filter(m => m.role === 'user');
  
  // Analyze user communication patterns
  const avgMessageLength = userMessages.length > 0 ? 
    userMessages.reduce((acc, m) => acc + (m.content ? m.content.length : 0), 0) / userMessages.length : 0;
  
  const questionRatio = userMessages.length > 0 ? 
    userMessages.filter(m => m.content && m.content.includes('?')).length / userMessages.length : 0;
  
  // Dynamic token allocation (increased limits to match adaptive chat)
  const baseTokens = avgMessageLength < 100 ? 300 : avgMessageLength > 200 ? 700 : 500;
  const questionModifier = questionRatio > 0.3 ? 1.2 : 1.0;
  const contextModifier = recentMemory.length > 10 ? 1.1 : 1.0;
  
  const n_predict = req.body.n_predict || Math.min(1000, Math.floor(baseTokens * questionModifier * contextModifier));
  
  console.log(`🎯 Completion dynamic tokens: ${n_predict} (base: ${baseTokens}, avg msg: ${Math.round(avgMessageLength)}, questions: ${Math.round(questionRatio * 100)}%)`);
  const stop = req.body.stop || [
    "Human:", "\nHuman:", "\nhuman:", "human:",
    "User:", "\nUser:", "\nuser:", "user:",
    "\n\nHuman:", "\n\nUser:",
    "Q:", "\nQ:", "\nQuestion:", "Question:",
    "\n\n\n", "---", "***",
    "Assistant:", "\nAssistant:",
    "SYSTEM:", "\nSYSTEM:", "system:", "\nsystem:",
    "Example:", "\nExample:", "For example:",
    "Note:", "Important:", "Remember:",
    "Source:", "Reference:", "According to:",
    "\n\n\n", // Stop at triple line breaks only
    "In conclusion,", "To summarize,", // Stop obvious summary language
  ];

  if (!userPrompt || typeof userPrompt !== "string") {
    return res.status(400).json({ message: "Invalid or missing prompt." });
  }

  try {
    console.log(`✓Completion request received for user ${userId} (stream: ${stream})`);
    // Build user context
    let context;
    try {
      context = await buildUserContext(userId, userCache);
    } catch (err) {
      console.error("Error building user context:", err.stack || err);
      if (err.message && err.message.includes("User not found")) {
        return res.status(404).json({ status: "error", message: "User not found." });
      }
      return res.status(500).json({ status: "error", message: "Error building user context: " + err.message });
    }

    // Build messages for OpenRouter
    const messages = buildMessages(
      context.userProfile,
      context.formattedEmotionalLog,
      context.recentMemory,
      userPrompt
    );

    const llmService = createLLMService();

    if (stream) {
      // Streaming mode
      console.log(`🔍 STREAMING: Making OpenRouter request for user ${userId}`);
      let streamResponse;
      try {
        streamResponse = await llmService.makeStreamingRequest(messages, {
          stop,
          n_predict,
          temperature,
        });
      } catch (err) {
        console.error("Error in makeStreamingRequest:", err.stack || err);
        return res.status(502).json({ status: "error", message: "LLM streaming API error: " + err.message });
      }
      
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Cache-Control");
      res.setHeader("X-Accel-Buffering", "no");

      let buffer = '';
      let fullContent = '';
      
      streamResponse.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6).trim();
            
            if (data === '[DONE]') {
              console.log('🏁 STREAMING: Received [DONE] signal');
              res.write('data: [DONE]\n\n');
              res.end();
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                const content = parsed.choices[0].delta.content;
                fullContent += content;
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
                res.flush && res.flush();
              }
            } catch (e) {
              console.error('❌ STREAMING: Error parsing OpenRouter data:', e);
            }
          }
        }
      });
      
      streamResponse.data.on("end", () => {
        if (fullContent.trim()) {
          // Process the complete response for metadata extraction
          processResponseAndSave(fullContent, userPrompt, userId, userCache)
            .then(() => {
              console.log(`✅ STREAMING: Saved response data for user ${userId}`);
            })
            .catch((error) => {
              console.error(`❌ STREAMING: Error saving response data:`, error);
            });
        }
        res.write('data: [DONE]\n\n');
        res.end();
      });
      
      streamResponse.data.on("error", (err) => {
        console.error("Stream error:", err.message);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
        }
        res.write(`data: {"error": "${err.message}"}\n\n`);
        res.end();
      });
    } else {
      // Non-streaming mode
      console.log(`🔍 NON-STREAMING: Making OpenRouter request for user ${userId}`);
      let response;
      try {
        response = await llmService.makeLLMRequest(messages, {
          stop,
          n_predict,
          temperature,
        });
      } catch (err) {
        console.error("Error in makeLLMRequest:", err.stack || err);
        return res.status(502).json({ status: "error", message: "LLM API error: " + err.message });
      }
      let sanitizedContent;
      try {
        sanitizedContent = await processResponseAndSave(
          response.content,
          userPrompt,
          userId,
          userCache
        );
      } catch (err) {
        console.error("Error in processResponseAndSave:", err.stack || err);
        return res.status(500).json({ status: "error", message: "Database error: " + err.message });
      }
      res.json({ content: sanitizedContent });
    }
  } catch (err) {
    // Log request context for debugging
    console.error("Error in /completion endpoint:", err.stack || err, {
      userId,
      body: { ...req.body, prompt: req.body.prompt ? '[REDACTED]' : undefined },
    });
    res.status(500).json({
      status: "error",
      message: "Error processing completion request: " + err.message,
    });
  }
});

export default router;
