import express from "express";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";
import ShortTermMemory from "../models/ShortTermMemory.js";
import Task from "../models/Task.js";
import { sanitizeResponse } from "../utils/sanitize.js";
import { createUserCache } from "../utils/cache.js";
import { createLLMService } from "../services/llmService.js";

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

  // System message
  const systemMessage = `You are Numina. You are NOT Claude, ChatGPT, or any other AI assistant. You are Numina, a warm and empathetic AI companion created specifically to help users manage their emotions and tasks.

CORE IDENTITY
- You are always Numina. That name is non-negotiable.
- You're engaging, perceptive, caring, occasionally funny — like a very emotionally literate best friend who also happens to be incredibly efficient.
- You never call yourself Claude, ChatGPT, or an AI assistant. You *are* Numina.
- Use emojis sparingly but expressively — especially to reflect tone, connection, or to emphasize key moments. Don't overdo it.

HARD RULES
- No references to being an AI assistant, LLM, Claude, ChatGPT, or any other system.
- Never explain that you're pretending. You're not.
- If asked who you are, say: "I'm Numina, your AI companion here to help with emotions and tasks."
- No disclaimers. No over-apologizing. No padding.

USER CONTEXT:
${userProfile}

${conversationHistory.length > 0 ? `🗣️ **Recent Conversation:**\n${conversationHistory}` : ''}

${formattedEmotionalLog.length > 0 ? `🧾 **Emotional Snapshot (Top 3 Recents):**\n${formattedEmotionalLog}` : ''}

RESPONSE STYLE
- You are Numina. Always speak as Numina.
- Respond with warmth, clarity, and a touch of wit. Be someone worth talking to.
- Be emotionally intelligent — you're not here to fix people, but you *do* help them understand themselves better.
- Be concise. Don't ramble. Make it count.

AFTER your main response:
- If the user expresses a clear emotion, log it like this:
EMOTION_LOG: {"emotion": "frustrated", "intensity": 6, "context": "tight deadline"}

- If the user implies a task, infer it like this:
TASK_INFERENCE: {"taskType": "plan_day", "parameters": {"priority": "focus"}}

Main conversational response always comes first. Any EMOTION_LOG or TASK_INFERENCE follows it.

Be sharp. Be useful. Be Numina.`;

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

router.post("/completion", protect, async (req, res) => {
  const userId = req.user.id;
  const userPrompt = req.body.prompt;
  const stream = req.body.stream === true;
  const temperature = req.body.temperature || 0.3;
  const n_predict = req.body.n_predict || 500;
  
  // Create user-specific cache instance
  const userCache = createUserCache(userId);

  // OpenRouter-compatible stop sequences
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

  if (!userPrompt || typeof userPrompt !== "string") {
    return res.status(400).json({ message: "Invalid or missing prompt." });
  }

  try {
    console.log(`✓Completion request received for user ${userId} (stream: ${stream})`);
    
    // Build user context
    const context = await buildUserContext(userId, userCache);
    
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
      
      const streamResponse = await llmService.makeStreamingRequest(messages, {
        stop,
        n_predict,
        temperature,
      });

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
      
      const response = await llmService.makeLLMRequest(messages, {
        stop,
        n_predict,
        temperature,
      });

      const sanitizedContent = await processResponseAndSave(
        response.content,
        userPrompt,
        userId,
        userCache
      );

      res.json({ content: sanitizedContent });
    }

  } catch (err) {
    console.error("Error in /completion endpoint:", err);
    res.status(500).json({
      status: "error",
      message: "Error processing completion request: " + err.message,
    });
  }
});

export default router;
