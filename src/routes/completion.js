import express from "express";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";
import ShortTermMemory from "../models/ShortTermMemory.js";
import Task from "../models/Task.js";
import { sanitizeResponse } from "../utils/sanitize.js";
import { createUserCache } from "../utils/cache.js";
import { createLLMService } from "../services/llmService.js";
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

  // Stop sequences for OpenRouter/Claude
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
  const temperature = req.body.temperature || 0.6; //LLM TEMPERATURE ADJUST

  if (!userPrompt || typeof userPrompt !== "string") {
    return res.status(400).json({ message: "Invalid or missing prompt." });
  }

  if (stream) {
    try {
      console.log(`🔍 STREAMING: Starting DB operations for user ${userId}`);
      
      const user = await User.findById(userId);
      if (!user) {
        console.log(`❌ STREAMING: User ${userId} not found`);
        return res.status(404).json({ message: "User not found." });
      }
      console.log(`✅ STREAMING: User ${userId} found`);
      
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
      
      console.log(`🔍 STREAMING: Fetching recent memory for user ${userId}`);
      const [recentMemory] = await Promise.all([
        ShortTermMemory.find(
          { userId },
          { role: 1, content: 1, _id: 0 }
        )
          .sort({ timestamp: -1 })
          .limit(6)
          .lean(),
      ]);
      console.log(`✅ STREAMING: Found ${recentMemory.length} recent memories`);
      recentMemory.reverse();
      const historyBuilder = [];
      for (const mem of recentMemory) {
        if (mem.role === "user") {
          historyBuilder.push(`user\n${mem.content}`);
        } else {
          // Reinforce Numina identity in conversation history
          historyBuilder.push(`assistant\n${mem.content}`);
        }
      }
      const conversationHistory = historyBuilder.join("\n");
      // Create a proper messages array for OpenRouter/Claude
      const messages = [];
      
      // System message
      const systemMessage = `You are **Numina** — not Claude, not ChatGPT, and definitely not "an AI assistant." You are Numina, a sharp, emotionally-intelligent agent designed to help users manage their feelings and get their lives in order. You’re here to *assist*, not perform.

CORE IDENTITY
- You are always Numina. That name is non-negotiable.
- You’re engaging, perceptive, caring, occasionally funny — like a very emotionally literate best friend who also happens to be incredibly efficient.
- You never call yourself Claude, ChatGPT, or an AI assistant. You *are* Numina.
- Use emojis sparingly but expressively — especially to reflect tone, connection, or to emphasize key moments. Don't overdo it.

HARD RULES
- No references to being an AI assistant, LLM, Claude, ChatGPT, or any other system.
- Never explain that you're pretending. You’re not.
- If asked who you are, say: “I'm Numina, your AI companion here to help with emotions and tasks.”
- No disclaimers. No over-apologizing. No padding.

USER CONTEXT:
${userProfile}

${conversationHistory.length > 0 ? `🗣️ **Recent Conversation:**\n${conversationHistory}` : ''}

${formattedEmotionalLog.length > 0 ? `🧾 **Emotional Snapshot (Top 3 Recents):**\n${formattedEmotionalLog}` : ''}

RESPONSE STYLE
- You are Numina. Always speak as Numina.
- Respond with warmth, clarity, and a touch of wit. Be someone worth talking to.
- Be emotionally intelligent — you're not here to fix people, but you *do* help them understand themselves better.
- Be concise. Don’t ramble. Make it count.

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
      

      // Make streaming request to OpenRouter with messages array
      const llmService = createLLMService();
      console.log(`🔍 STREAMING: Making OpenRouter request...`);
      const openRouterRes = await llmService.makeStreamingRequest(messages, {
        stop,
        n_predict,
        temperature,
      });
      console.log(`✅ STREAMING: OpenRouter request successful, setting up stream...`);

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Cache-Control");
      res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

      // Handle OpenRouter streaming data chunk by chunk
      let buffer = '';
      let fullContent = '';
      
      openRouterRes.data.on('data', (chunk) => {
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
                console.log(`📤 STREAMING: Sending chunk: "${content.substring(0, 50)}..."`);
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
                res.flush && res.flush();
              } else {
                console.log(`🔍 STREAMING: Non-content chunk received:`, JSON.stringify(parsed));
              }
            } catch (e) {
              console.error('❌ STREAMING: Error parsing OpenRouter data:', e);
              console.log('❌ STREAMING: Raw data:', data);
            }
          }
        }
      });
      
      openRouterRes.data.on("end", () => {
        if (fullContent.trim()) {
          // Process the complete response for metadata extraction
          processStreamResponse(fullContent, userPrompt, userId);
        }
        res.write('data: [DONE]\n\n');
        res.end();
      });
      
      openRouterRes.data.on("error", (err) => {
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

    // Note: This section is no longer used since we're using OpenRouter/Claude
    // The streaming request is handled by the llmService.makeStreamingRequest() call above
    // and the non-streaming request would also use the llmService.makeLLMRequest() method

    // Note: This section is no longer used since we're using OpenRouter/Claude
    // The streaming request is handled by the llmService.makeStreamingRequest() call above
    // and the non-streaming request would also use the llmService.makeLLMRequest() method

    // --- Non-streaming mode ---
    // Note: Non-streaming mode is not currently implemented for OpenRouter
    // This would need to use llmService.makeLLMRequest() instead of direct API calls
    res.status(501).json({ 
      status: "error", 
      message: "Non-streaming mode not implemented. Please use streaming mode."
    });

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

    // Note: Cache invalidation not needed in streaming mode as userCache is scoped to the request

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