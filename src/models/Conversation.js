import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  role: { 
    type: String, 
    enum: ["user", "assistant", "system"], 
    required: true 
  },
  content: { 
    type: String, 
    required: true 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  attachments: [{ 
    type: String,
    required: false 
  }],
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
});

const conversationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  title: {
    type: String,
    required: false,
    maxlength: 200
  },
  messages: [messageSchema],
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  },
  isArchived: {
    type: Boolean,
    default: false,
    index: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  summary: {
    type: String,
    maxlength: 500
  },
  messageCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound indexes for efficient queries
conversationSchema.index({ userId: 1, lastActivity: -1 });
conversationSchema.index({ userId: 1, isArchived: 1, lastActivity: -1 });
conversationSchema.index({ userId: 1, createdAt: -1 });

// Update lastActivity and messageCount on message changes
conversationSchema.pre('save', function(next) {
  if (this.isModified('messages')) {
    this.lastActivity = new Date();
    this.messageCount = this.messages.length;
    
    // Auto-generate title from first user message if not set
    if (!this.title && this.messages.length > 0) {
      const firstUserMessage = this.messages.find(msg => msg.role === 'user');
      if (firstUserMessage) {
        this.title = firstUserMessage.content.substring(0, 50).trim() + 
                    (firstUserMessage.content.length > 50 ? '...' : '');
      }
    }
  }
  next();
});

// Method to add a message
conversationSchema.methods.addMessage = function(role, content, attachments = [], metadata = {}) {
  this.messages.push({
    role,
    content,
    attachments,
    metadata,
    timestamp: new Date()
  });
  this.lastActivity = new Date();
  this.messageCount = this.messages.length;
  
  // Auto-generate title from first user message if not set
  if (!this.title && role === 'user') {
    this.title = content.substring(0, 50).trim() + (content.length > 50 ? '...' : '');
  }
};

// Method to get recent messages (for context)
conversationSchema.methods.getRecentMessages = function(limit = 20) {
  return this.messages.slice(-limit);
};

// Method to archive conversation
conversationSchema.methods.archive = function() {
  this.isArchived = true;
  this.lastActivity = new Date();
};

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;