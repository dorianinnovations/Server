import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { body, validationResult } from "express-validator";
import bcrypt from "bcrypt";
import axios from "axios";
import https from "https";
import compression from "compression"; 

const app = express();
dotenv.config(); // Load environment variables

// --- Security and Middleware Configuration ---

// CORS configuration for production readiness
const allowedOrigins = [
  "https://numinaai.netlify.app",
  "http://localhost:5173",
  "http://localhost:5000",
  "https://server-a7od.onrender.com",
];

app.use(
  cors({
    origin: (origin, callback) => {
      console.log(`CORS request from origin: ${origin}`);
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
        console.log(`CORS blocked: ${msg}`);
        return callback(new Error(msg), false);
      }
      console.log(`CORS allowed for origin: ${origin}`);
      return callback(null, true);
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "authorization"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Explicitly list allowed methods
  })
);

app.use(express.json({ limit: "1mb" })); // Parse JSON request bodies with size limit
app.use(helmet()); // Apply security headers
app.use(compression()); // Enable gzip compression for responses

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per 15 minutes per IP
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(limiter);

// --- Database Connection ---
mongoose
  .connect(process.env.MONGO_URI, {
    // Add optimization options for MongoDB connection
    maxPoolSize: 10, // Connection pool size for better concurrency
    serverSelectionTimeoutMS: 5000, // Faster server selection timeout
    socketTimeoutMS: 45000, // Socket timeout
    family: 4, // Use IPv4, avoid slow IPv6 lookups
  })
  .then(() => console.log("✓MongoDB connected successfully."))
  .catch((err) => {
    console.error("✗ MongoDB connection error:", err);
    process.exit(1); // Exit process if DB connection fails
  });

// --- Mongoose Schemas and Models ---

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: { type: String, required: true, minlength: 8 },
  profile: {
    type: Map,
    of: String,
    default: {},
  },
  emotionalLog: [
    {
      emotion: { type: String, required: true, trim: true },
      intensity: { type: Number, min: 1, max: 10, required: false },
      context: { type: String, required: false, trim: true },
      timestamp: { type: Date, default: Date.now },
    },
  ],
});

// Pre-save hook to hash password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Method to compare passwords
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

const User = mongoose.model("User", userSchema);
console.log("✓User schema and model defined.");

const shortTermMemorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  conversationId: { type: String, required: false, index: true }, // Add index for faster lookups
  timestamp: { type: Date, default: Date.now, expires: "24h" }, // TTL index for 24 hours
  content: { type: String, required: true },
  role: { type: String, enum: ["user", "assistant"], required: true },
});
const ShortTermMemory = mongoose.model(
  "ShortTermMemory",
  shortTermMemorySchema
);
console.log("✓ShortTermMemory schema and model defined.");

const taskSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  taskType: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ["queued", "processing", "completed", "failed"],
    default: "queued",
  },
  createdAt: { type: Date, default: Date.now },
  runAt: { type: Date, default: Date.now },
  parameters: { type: Map, of: String }, // Use Mixed type if parameters can be complex objects
  result: { type: String },
  priority: { type: Number, default: 0, min: 0, max: 10 }, // Example priority range
});

taskSchema.index({ runAt: 1, status: 1, priority: -1 }); // Compound index for efficient task retrieval
const Task = mongoose.model("Task", taskSchema);
console.log("✓Task schema and model defined.");

// --- JWT Authentication Utilities ---
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "1d", // Default to 1 day
  });
console.log("✓JWT signing function ready.");

// Middleware to protect routes
const protect = (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res
      .status(401)
      .json({ message: "You are not logged in! Please log in to get access." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach user ID to request object
    next();
  } catch (error) {
    console.error("JWT verification error:", error);
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};

// --- Authentication Routes ---

app.post(
  "/signup",
  [
    body("email").isEmail().withMessage("Valid email required."),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long."),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;
    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({ message: "Email already in use." });
      }
      const user = await User.create({ email, password });
      console.log("New user created:", user.email);

      res.status(201).json({
        status: "success",
        token: signToken(user._id),
        data: { user: { id: user._id, email: user.email } },
      });
    } catch (err) {
      console.error("Signup error:", err);
      res
        .status(500)
        .json({ status: "error", message: "Failed to create user." });
    }
  }
);

app.post(
  "/login",
  [body("email").isEmail(), body("password").notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    console.log("Login attempt for:", email);

    try {
      const user = await User.findOne({ email }).select("+password"); // Select password for comparison
      if (!user || !(await user.correctPassword(password, user.password))) {
        return res
          .status(401)
          .json({ message: "Incorrect email or password." });
      }

      res.json({
        status: "success",
        token: signToken(user._id),
        data: { user: { id: user._id, email: user.email } },
      });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ status: "error", message: "Login failed." });
    }
  }
);

// --- User Profile Route ---
app.get("/profile", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -__v"); // Exclude sensitive fields
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    res.json({ status: "success", data: { user } });
  } catch (err) {
    console.error("Error fetching user profile:", err);
    res
      .status(500)
      .json({ status: "error", message: "Failed to fetch profile." });
  }
});

// --- Health Check Endpoint ---
app.get("/health", async (req, res) => {
  try {
    const llamaCppApiUrl =
      process.env.LLAMA_CPP_API_URL ||
      "https://numina.ngrok.app/health";

    // Use the global HTTPS agent for connection reuse
    const httpsAgent =
      req.app.locals.httpsAgent ||
      new https.Agent({
        rejectUnauthorized: false, // For ngrok certificates
        timeout: 30000,
      });

    try {
      const testRes = await axios({
        method: "POST",
        url: llamaCppApiUrl,
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        data: {
          prompt: "Hello",
          n_predict: 5,
          temperature: 0.1,
        },
        httpsAgent: httpsAgent,
        timeout: 10000,
      });

      const healthStatus = {
        server: "healthy",
        database:
          mongoose.connection.readyState === 1 ? "connected" : "disconnected",
        llm_api: "accessible",
        llm_api_url: llamaCppApiUrl,
        llm_response_status: testRes.status,
      };

      res.json({ status: "success", health: healthStatus });
    } catch (testError) {
      console.error("Health check LLM test failed:", testError.message);
      res.status(503).json({
        status: "degraded",
        health: {
          server: "healthy",
          database:
            mongoose.connection.readyState === 1 ? "connected" : "disconnected",
          llm_api: "unreachable",
          llm_api_url: llamaCppApiUrl,
          error: testError.message,
        },
      });
    }
  } catch (err) {
    console.error("Health check error:", err);
    res.status(500).json({ status: "error", message: "Health check failed" });
  }
});

// --- LLM Completion Endpoint ---
app.post("/completion", protect, async (req, res) => {
  const userId = req.user.id;
  const userPrompt = req.body.prompt;
  // Sensible defaults for LLM parameters
  const stop = req.body.stop || ["<|im_end|>", "\n<|im_start|>"];
  const n_predict = req.body.n_predict || 512; 
  const temperature = req.body.temperature || 0.7;
  const stream = req.body.stream || false; 

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

    // Limit emotional log to a relevant number of recent entries to keep prompt concise
    const recentEmotionalLogEntries = user.emotionalLog
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 2); // Get most recent 2 entries only

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
        .limit(3) // Reduce to 3 messages to keep prompt smaller
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
        `**Your Emotional History Summary (Top 5 Recent):**\n${formattedEmotionalLog}`
      );
    }

    // Add instructions - using a more compact format
    promptParts.push(`Instructions:
- Be warm and helpful.
- If user shows emotion, format: EMOTION_LOG: {"emotion": "happy", "intensity": 7, "context": "reason"}
- If user implies task, format: TASK_INFERENCE: {"taskType": "task_name", "parameters": {}}`);

    // Add user query
    promptParts.push(
      `<|im_start|>user\n${userPrompt}\n<|im_end|>\n<|im_start|>assistant`
    );

    // Join with newlines for better token efficiency
    const fullPrompt = promptParts.join("\n\n");

    console.log("Full prompt constructed. Length:", fullPrompt.length);
    // console.log("Full prompt content:", fullPrompt); // Uncomment for debugging if needed

    const llamaCppApiUrl =
      process.env.LLAMA_CPP_API_URL ||
      "https://numina.ngrok.app/completion";

    console.log("Using LLAMA_CPP_API_URL:", llamaCppApiUrl);
    console.log(
      "Environment LLAMA_CPP_API_URL:",
      process.env.LLAMA_CPP_API_URL
    );

    // Use the global HTTPS agent for connection reuse
    const httpsAgent =
      req.app.locals.httpsAgent ||
      new https.Agent({
        rejectUnauthorized: false, // For ngrok certificates
        keepAlive: true, // Enable keep-alive for connection reuse
      });

    // Start a timer to measure LLM response time
    const llmStartTime = Date.now();
    let llmRes;

    try {
      // Optimize the parameters to improve speed with minimal quality loss
      const optimizedParams = {
        prompt: fullPrompt,
        stop: stop,
        n_predict: n_predict,
        temperature: temperature,
        top_k: 40, // Limit vocabulary to top 40 tokens
        top_p: 0.9, // Nucleus sampling for better efficiency
        repeat_penalty: 1.1, // Slight penalty to reduce repetition
        stream: stream, // Add streaming parameter
      };

      if (stream) {
        console.log('🚀 NGROK PRO STREAMING - Starting real-time token stream...');
        
        // Set streaming headers optimized for real-time
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
        
        try {
          const streamResponse = await axios({
            method: "POST",
            url: llamaCppApiUrl,
            headers: {
              "Content-Type": "application/json",
              "ngrok-skip-browser-warning": "true",
              "Accept": "text/event-stream",
            },
            data: optimizedParams, // includes stream: true
            httpsAgent: httpsAgent,
            timeout: 60000, // Longer timeout for streaming
            responseType: 'stream',
          });
          
          let fullContent = '';
          let buffer = '';
          let tokenCount = 0;
          
          console.log('📡 Stream connected, waiting for tokens...');
          
          streamResponse.data.on('data', (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line for next chunk
            
            for (const line of lines) {
              if (line.startsWith('data: ') && line.length > 6) {
                try {
                  const jsonStr = line.substring(6).trim();
                  if (jsonStr === '[DONE]') {
                    console.log('🏁 Stream ended by llama.cpp');
                    continue;
                  }
                  
                  const parsed = JSON.parse(jsonStr);
                  
                  if (parsed.content) {
                    fullContent += parsed.content;
                    tokenCount++;
                    
                    // Apply sanitization but keep live streaming
                    const sanitized = sanitizeResponse(fullContent);
                    
                    console.log(`⚡ Token ${tokenCount}:`, JSON.stringify(parsed.content));
                    
                    // Send immediately to frontend
                    res.write(`data: ${JSON.stringify({ content: sanitized })}\n\n`);
                    
                    // Force flush for real-time delivery
                    if (res.flush) res.flush();
                  }
                } catch (e) {
                  console.log('⚠️ Parse error:', e.message, 'Line:', line.substring(0, 50));
                }
              }
            }
          });
          
          streamResponse.data.on('end', () => {
            console.log(`✅ Stream complete! ${tokenCount} tokens, ${fullContent.length} chars`);
            res.write('data: [DONE]\n\n');
            res.end();
            
            // Save to memory
            if (fullContent.trim()) {
              Promise.all([
                ShortTermMemory.insertMany([
                  { userId, content: userPrompt, role: "user" },
                  { userId, content: sanitizeResponse(fullContent), role: "assistant" },
                ])
              ]).catch(err => console.error('Memory save error:', err));
            }
          });
          
          streamResponse.data.on('error', (error) => {
            console.error('❌ Stream error:', error);
            res.write('data: [ERROR]\n\n');
            res.end();
          });
          
          return;
        } catch (error) {
          console.error('💥 Streaming failed:', error.message);
          res.write('data: [ERROR]\n\n');
          res.end();
          return;
        }
      } else {
        // Regular non-streaming request
        llmRes = await axios({
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
          timeout: 45000, // 45 seconds timeout for LLM requests
        });
      }

      const responseTime = Date.now() - llmStartTime;
      console.log(
        `LLM API Response Status: ${llmRes.status} (${responseTime}ms)`
      );

      // Track token generation speed for monitoring
      if (llmRes.data.timings && llmRes.data.tokens_predicted) {
        const tokensPerSecond = llmRes.data.timings.predicted_per_second || 0;
        console.log(
          `LLM generation speed: ${tokensPerSecond.toFixed(2)} tokens/sec`
        );
      }
    } catch (fetchError) {
      if (fetchError.code === "ECONNABORTED") {
        console.error("LLM API request timed out after 30 seconds");
        throw new Error("LLM API request timed out. Please try again.");
      } else if (fetchError.response) {
        // Server responded with error status
        console.error("LLM API Response Error:", {
          status: fetchError.response.status,
          statusText: fetchError.response.statusText,
          data: fetchError.response.data,
        });
        throw new Error(
          `LLM API error: ${fetchError.response.status} - ${fetchError.response.statusText} - ${fetchError.response.data}`
        );
      } else {
        console.error("Fetch error details:", {
          name: fetchError.name,
          message: fetchError.message,
          code: fetchError.code,
        });
        throw fetchError;
      }
    }

    // Extract data from axios response
    const llmData = llmRes.data;

    let botReplyContent = llmData.content || ""; // Initialize as empty string

    console.log("Raw LLM Data Content (before cleaning):", botReplyContent);

    // --- Optimized Parsing and Cleaning ---
    // Strengthening the cleaning logic to completely remove TASK_INFERENCE and EMOTION_LOG markers from responses
    // --- Begin Robust Parsing and Cleaning ---
    console.log("Raw LLM response:", botReplyContent);

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

    if (inferredEmotion) {
      console.log("Parsed emotion:", inferredEmotion.emotion);
    }

    // Then process task - use the first match if multiple exist
    [inferredTask, botReplyContent] = extractJsonPattern(
      taskInferenceRegex,
      botReplyContent,
      "task inference"
    );

    if (inferredTask) {
      console.log("Parsed task:", inferredTask.taskType);
    } // Ensure ALL marker patterns are completely removed, even if parsing failed
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
      console.warn(
        "WARNING: Markers still present after cleaning. Applying emergency cleanup."
      );
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

    console.log("Cleaned Bot Reply Content (for display):", botReplyContent);
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

    // Log results after operations complete
    const summaryParts = ["Data saved:"];
    summaryParts.push("- 2 memory entries (user and assistant)");

    if (inferredEmotion && inferredEmotion.emotion) {
      summaryParts.push(`- Emotion: ${inferredEmotion.emotion}`);
    }

    if (inferredTask && inferredTask.taskType) {
      summaryParts.push(`- Task: ${inferredTask.taskType}`);
    }

    console.log(summaryParts.join(" "));

    // Final safety check before sending response to client
    botReplyContent = sanitizeResponse(botReplyContent);

    // Validate that sanitization was successful
    if (
      botReplyContent.includes("TASK_INFERENCE") ||
      botReplyContent.includes("EMOTION_LOG")
    ) {
      console.error(
        "CRITICAL ERROR: Markers still present despite sanitization"
      );
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

// --- Task Processing Endpoint ---
// This endpoint is designed to be called periodically (e.g., by a cron job or a frontend poll)
app.get("/run-tasks", protect, async (req, res) => {
  const userId = req.user.id;
  try {
    const tasksToProcess = await Task.find({
      userId,
      status: "queued",
      runAt: { $lte: new Date() },
    })
      .sort({ priority: -1, createdAt: 1 }) // Process high priority, then older tasks
      .limit(5); // Process a batch of tasks to avoid long-running requests

    if (tasksToProcess.length === 0) {
      return res
        .status(200)
        .json({ status: "success", message: "No tasks to process." });
    }

    const results = [];
    for (const task of tasksToProcess) {
      // Use findOneAndUpdate with status check to prevent race conditions
      const updatedTask = await Task.findOneAndUpdate(
        { _id: task._id, status: "queued" },
        { $set: { status: "processing" } },
        { new: true } // Return the updated document
      );

      if (!updatedTask) {
        // Task was already picked up by another process or updated
        console.log(`Task ${task._id} already processed or status changed.`);
        continue;
      }

      console.log(
        `Processing task: ${updatedTask.taskType} (ID: ${updatedTask._id}) for user ${userId}`
      );
      let taskResult = "Task completed successfully.";
      let taskStatus = "completed";

      try {
        // --- Task Execution Logic (Simulated) ---
        // In a real application, this would involve calling external services,
        // complex data processing, etc.
        switch (updatedTask.taskType) {
          case "summarize_expenses":
            await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate async work
            taskResult = `Your weekly expenses summary: Groceries $150, Utilities $80, Entertainment $50.`;
            break;
          case "send_email_summary":
            await new Promise((resolve) => setTimeout(resolve, 2500)); // Simulate async work
            taskResult = `Summary of important unread emails: Meeting reminder from John, Project update from Sarah.`;
            break;
          case "summarize_emotions":
            // Example: Fetch and summarize user's emotional log
            const userEmotions = await User.findById(userId).select(
              "emotionalLog"
            );
            if (userEmotions && userEmotions.emotionalLog.length > 0) {
              const summary = userEmotions.emotionalLog
                .slice(-5) // Last 5 emotions for example
                .map(
                  (e) => `${e.emotion} on ${e.timestamp.toLocaleDateString()}`
                )
                .join(", ");
              taskResult = `Your recent emotional trends include: ${summary}.`;
            } else {
              taskResult = "No emotional history to summarize.";
            }
            break;
          // Add more task types as your application grows
          default:
            taskResult = `Unknown task type: ${updatedTask.taskType}.`;
            taskStatus = "failed";
            console.warn(
              `Attempted to process unknown task type: ${updatedTask.taskType}`
            );
            break;
        }
        // --- End Task Execution Logic ---
      } catch (taskErr) {
        console.error(`Error processing task ${task._id}:`, taskErr);
        taskResult = `Error processing task: ${taskErr.message}`;
        taskStatus = "failed";
      }

      // Update task status and result
      await Task.updateOne(
        { _id: updatedTask._id },
        { $set: { status: taskStatus, result: taskResult } }
      );
      results.push({
        taskId: updatedTask._id,
        taskType: updatedTask.taskType,
        status: taskStatus,
        result: taskResult,
      });

      console.log(
        `Task ${updatedTask.taskType} (ID: ${updatedTask._id}) ${taskStatus}. Result: ${taskResult}`
      );
    }

    res
      .status(200)
      .json({ status: "success", message: "Tasks processed.", results });
  } catch (err) {
    console.error("Error in /run-tasks endpoint:", err);
    res
      .status(500)
      .json({ status: "error", message: "Error running background tasks." });
  }
});

// --- LLM HTTPS Agent Cache ---
// Create a singleton HTTPS agent that can be reused across requests
const globalHttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  rejectUnauthorized: false,
  timeout: 60000, // 60 seconds timeout
});

// Make it available to all requests without recreating
app.locals.httpsAgent = globalHttpsAgent;

// Simple in-memory cache for frequent requests
const cache = {
  items: new Map(),
  maxSize: 100,
  ttl: 60 * 5 * 1000, // 5 minutes

  set(key, value, customTtl) {
    // Clean cache if it's getting too large
    if (this.items.size >= this.maxSize) {
      // Delete oldest items
      const keysToDelete = [...this.items.keys()].slice(0, 20);
      keysToDelete.forEach((k) => this.items.delete(k));
    }

    this.items.set(key, {
      value,
      expires: Date.now() + (customTtl || this.ttl),
    });
  },

  get(key) {
    const item = this.items.get(key);
    if (!item) return null;

    if (Date.now() > item.expires) {
      this.items.delete(key);
      return null;
    }

    return item.value;
  },
};

app.locals.cache = cache;

// Add simple memory monitoring
setInterval(() => {
  const memUsage = process.memoryUsage();
  console.log(
    `Memory usage: ${Math.round(
      memUsage.rss / 1024 / 1024
    )}MB RSS, ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB Heap`
  );

  // Add GC hint if memory usage is high
  if (memUsage.heapUsed > 200 * 1024 * 1024) {
    // 200MB
    console.log("High memory usage detected, suggesting garbage collection");
    if (global.gc) {
      console.log("Running garbage collection");
      global.gc();
    }
  }
}, 60 * 1000); // Check every minute

// --- Helper Functions ---

// Helper function to ensure all special markers are removed from text
const sanitizeResponse = (text) => {
  if (!text) return "";

  // Initial regex-based cleaning with case-insensitive matching
  let sanitized = text
    // Remove all variations of TASK_INFERENCE with case insensitivity
    .replace(/TASK_INFERENCE:?\s*(\{[\s\S]*?\})?\s*?/gi, "")
    .replace(/TASK_INFERENCE:?/gi, "")
    // Remove all variations of EMOTION_LOG with case insensitivity
    .replace(/EMOTION_LOG:?\s*(\{[\s\S]*?\})?\s*?/gi, "")
    .replace(/EMOTION_LOG:?/gi, "")
    // Also clean up any formatting artifacts
    .replace(/(\r?\n){2,}/g, "\n")
    .trim();

  // Case-insensitive check for remaining markers
  const lowerSanitized = sanitized.toLowerCase();
  if (
    lowerSanitized.includes("task_inference") ||
    lowerSanitized.includes("emotion_log")
  ) {
    // Secondary line-by-line filtering with case insensitivity
    sanitized = sanitized
      .split("\n")
      .filter((line) => {
        const lowerLine = line.toLowerCase();
        return (
          !lowerLine.includes("task_inference") &&
          !lowerLine.includes("emotion_log")
        );
      })
      .join("\n")
      .trim();
  }

  return (
    sanitized ||
    "I'm sorry, I wasn't able to provide a proper response. Please try again."
  );
};

// Export for testing
export { sanitizeResponse };

// --- Server Start ---
const PORT = process.env.PORT || 5000; // Use port from .env or default to 5000
app.listen(PORT, () => {
  console.log(`✓API running → http://localhost:${PORT}`);
  console.log(
    `✓Memory optimization enabled, initial RSS: ${Math.round(
      process.memoryUsage().rss / 1024 / 1024
    )}MB`
  );
});
