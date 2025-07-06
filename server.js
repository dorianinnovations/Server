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
  // Comprehensive stop sequences to prevent runaway generation and hallucination
  const stop = req.body.stop || [
    "USER:", "\nUSER:", "\nUser:", "user:", "\n\nUSER:",
    "Human:", "\nHuman:", "\nhuman:", "human:",
    "\n\nUser:", "\n\nHuman:", "\n\nuser:", "\n\nhuman:",
    "Q:", "\nQ:", "\nQuestion:", "Question:",
    "\n\n\n", // Prevent excessive newlines
    "---", // Common separator
    "***", // Another common separator
    "```", // Code block endings
    "</EXAMPLES>", // Ensure we don't continue past examples
    "SYSTEM:", "\nSYSTEM:", "system:", "\nsystem:",
    // Additional Mistral-specific stop sequences
    "<s>", "</s>", "[INST]", "[/INST]",
    "Assistant:", "\nAssistant:", "AI:",
    // Prevent model from continuing examples
    "Example:", "\nExample:", "For example:",
    // Prevent repetitive patterns
    "...", "etc.", "and so on",
    // Prevent breaking into meta-commentary
    "Note:", "Important:", "Remember:",
    // Prevent generating fake sources or citations
    "Source:", "Reference:", "According to:",
  ];
  const n_predict = req.body.n_predict || 500; // Increased default for longer responses 
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

    // --- Optimized Prompt Structure for Mistral 7B GGUF Q4 ---
    let fullPrompt = `<s>[INST] You are a helpful, empathetic, and factual assistant. You provide thoughtful, comprehensive responses while maintaining accuracy and clarity.

RESPONSE FORMAT:
- Provide natural, conversational responses
- If you detect emotional content, format it as: EMOTION_LOG: {"emotion":"emotion_name","intensity":1-10,"context":"brief_context"}
- If you identify a task, format it as: TASK_INFERENCE: {"taskType":"task_name","parameters":{"key":"value"}}
- Keep these special markers separate from your main response

CONVERSATION EXAMPLES:`;

    // Add conversation history as examples if it exists
    if (conversationHistory.length > 0) {
      const recentExchanges = conversationHistory.split('\n').slice(-4); // Last 2 exchanges
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
      // Optimized parameters for Mistral 7B GGUF Q4 with extended length
      const optimizedParams = {
        prompt: fullPrompt,
        stop: stop,
        n_predict: Math.min(n_predict, 1000), // Significantly increased token limit
        temperature: Math.min(temperature, 0.85), // Allow slightly higher temperature
        top_k: 50, // Increased vocabulary for better diversity
        top_p: 0.9, // More diverse sampling
        repeat_penalty: 1.15, // Reduced to allow more natural repetition
        frequency_penalty: 0.2, // Reduced for more natural flow
        presence_penalty: 0.1, // Reduced to prevent over-diversification
        stream: stream, // Add streaming parameter
        // Mistral 7B specific optimizations
        min_p: 0.05, // Lower threshold for better token diversity
        typical_p: 0.95, // Higher typical sampling for coherence
        mirostat: 2, // Enable mirostat sampling for better coherence
        mirostat_tau: 4.0, // Optimized target entropy for Mistral
        mirostat_eta: 0.15, // Higher learning rate for better adaptation
        // Additional parameters for quality control
        tfs_z: 1.0, // Tail free sampling
        penalty_alpha: 0.6, // Contrastive search penalty
        penalty_last_n: 128, // Context window for penalties
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
          let streamEnded = false;
          let metadataBuffer = ''; // Buffer for metadata detection
          
          console.log('📡 Stream connected, waiting for tokens...');
          
          // Set up a timeout to prevent infinite streams (extended for longer responses)
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
          }, 120000); // 2 minute timeout for longer responses
          
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
                  
                  // Only process if there's actual content (not just token IDs)
                  if (parsed.content && parsed.content.trim()) {
                    fullContent += parsed.content;
                    metadataBuffer += parsed.content;
                    tokenCount++;
                    
                    console.log(`⚡ Token ${tokenCount}:`, JSON.stringify(parsed.content));
                    
                                         // Check for stop sequences in the accumulated content
                     let shouldStop = false;
                     for (const stopSeq of stop) {
                       if (metadataBuffer.includes(stopSeq) || fullContent.includes(stopSeq)) {
                         console.log(`🛑 Stop sequence detected: "${stopSeq}" in buffer`);
                         shouldStop = true;
                         streamEnded = true;
                         clearTimeout(streamTimeout);
                         break;
                       }
                     }
                     
                     // Additional hallucination prevention checks
                     if (!shouldStop) {
                       // Check for repetitive patterns that might indicate hallucination
                       const words = fullContent.split(' ');
                       if (words.length > 20) {
                         const lastTenWords = words.slice(-10).join(' ');
                         const contentWithoutLast = words.slice(0, -10).join(' ');
                         if (contentWithoutLast.includes(lastTenWords)) {
                           console.log('🚨 Repetitive pattern detected, stopping stream');
                           shouldStop = true;
                           streamEnded = true;
                           clearTimeout(streamTimeout);
                         }
                       }
                       
                       // Check for excessive punctuation which might indicate confusion
                       const punctuationCount = (fullContent.match(/[.!?]{3,}/g) || []).length;
                       if (punctuationCount > 3) {
                         console.log('🚨 Excessive punctuation detected, stopping stream');
                         shouldStop = true;
                         streamEnded = true;
                         clearTimeout(streamTimeout);
                       }
                     }
                     
                     // Additional safety check for excessive token generation (increased limit)
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
          
          streamResponse.data.on('end', () => {
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
          
          streamResponse.data.on('error', (error) => {
            if (!streamEnded) {
              streamEnded = true;
              clearTimeout(streamTimeout);
              console.error('❌ Stream error:', error);
              
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
          timeout: 120000, // 2 minutes timeout for longer LLM requests
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

// Process streaming response for metadata and memory storage
const processStreamResponse = async (fullContent, userPrompt, userId) => {
  try {
    console.log("Processing complete stream response for metadata...");
    
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

    let processedContent = fullContent;

    // Process emotion first - use the first match if multiple exist
    [inferredEmotion, processedContent] = extractJsonPattern(
      emotionLogRegex,
      processedContent,
      "emotion log"
    );

    if (inferredEmotion) {
      console.log("Parsed emotion from stream:", inferredEmotion.emotion);
    }

    // Then process task - use the first match if multiple exist
    [inferredTask, processedContent] = extractJsonPattern(
      taskInferenceRegex,
      processedContent,
      "task inference"
    );

    if (inferredTask) {
      console.log("Parsed task from stream:", inferredTask.taskType);
    }

    // Sanitize the content for storage
    const sanitizedContent = sanitizeResponse(processedContent);

    // Prepare database operations to be executed in parallel
    const dbOperations = [];

    // Memory storage operations (both user and assistant messages)
    dbOperations.push(
      ShortTermMemory.insertMany([
        { userId, content: userPrompt, role: "user" },
        {
          userId,
          content: sanitizedContent || "I'm sorry, I wasn't able to provide a proper response.",
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
    const summaryParts = ["Stream data saved:"];
    summaryParts.push("- 2 memory entries (user and assistant)");

    if (inferredEmotion && inferredEmotion.emotion) {
      summaryParts.push(`- Emotion: ${inferredEmotion.emotion}`);
    }

    if (inferredTask && inferredTask.taskType) {
      summaryParts.push(`- Task: ${inferredTask.taskType}`);
    }

    console.log(summaryParts.join(" "));
  } catch (error) {
    console.error('Error processing stream response:', error);
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
