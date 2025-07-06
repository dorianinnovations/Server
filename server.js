import express from "express";
import cors from "cors";
import helmet from "helmet";
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
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

app.use(express.json({ limit: "1mb" })); // Parse JSON request bodies with size limit
app.use(helmet()); // Apply security headers
app.use(compression()); // Enable gzip compression for responses

// Note: Rate limiting removed from main server - handled in routes

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

// --- Optimized LLM Completion Endpoint ---
app.post("/completion", protect, async (req, res) => {
  const userId = req.user.id;
  const userPrompt = req.body.prompt;
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
  const stream = req.body.stream || false; 

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

    console.log("Fast prompt constructed. Length:", fullPrompt.length);

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
        rejectUnauthorized: false,
        keepAlive: true,
        timeout: 15000, // Reduced timeout for faster response
      });

    // Start a timer to measure LLM response time
    const llmStartTime = Date.now();
    let llmRes;

    try {
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
        
        // Set streaming headers optimized for real-time
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
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
            timeout: 30000, // Reduced timeout for faster response
            responseType: 'stream',
          });
          
          let fullContent = '';
          let buffer = '';
          let tokenCount = 0;
          let streamEnded = false;
          let metadataBuffer = ''; // Buffer for metadata detection
          
          console.log('📡 Stream connected, waiting for tokens...');
          
          // Set up a timeout to prevent infinite streams (optimized for responsiveness)
          const streamTimeout = setTimeout(() => {
            if (!streamEnded) {
              console.log('⏰ Stream timeout - ending for responsiveness');
              streamEnded = true;
              res.write('data: [DONE]\n\n');
              res.end();
              if (streamResponse.data && streamResponse.data.destroy) {
                streamResponse.data.destroy();
              }
            }
          }, 45000); // 45 second timeout for faster responses
          
          streamResponse.data.on('data', (chunk) => {
            if (streamEnded) return;
            
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line for next chunk
            
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
                  
                  // Only process if there's actual content
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
                  console.error('JSON parse error in stream:', e);
                  // Skip invalid JSON
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
          
          // Handle connection errors on the response stream
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
          
          // Handle client disconnect
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
          timeout: 30000, // Reduced timeout for faster response
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
    const rawContent = llmData.content || "";

    console.log("Raw LLM response:", rawContent);

    // Fast metadata extraction
    const { inferredTask, inferredEmotion, cleanContent } = extractMetadata(rawContent);
    
    // Final cleanup
    const botReplyContent = sanitizeResponse(cleanContent);

    console.log("Cleaned Bot Reply Content:", botReplyContent);

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

    // Log results
    const summaryParts = ["✅ Data saved:"];
    summaryParts.push("memory entries");
    if (inferredEmotion?.emotion) summaryParts.push(`emotion: ${inferredEmotion.emotion}`);
    if (inferredTask?.taskType) summaryParts.push(`task: ${inferredTask.taskType}`);
    console.log(summaryParts.join(" "));

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
