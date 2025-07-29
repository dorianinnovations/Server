import mongoose from "mongoose";

const deletionTaskSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  taskId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    enum: ['delete_single_conversation', 'delete_all_conversations', 'clear_user_data'],
    required: true
  },
  status: {
    type: String,
    enum: ['queued', 'processing', 'completed', 'failed'],
    default: 'queued',
    index: true
  },
  priority: {
    type: Number,
    default: 1, // 1 = normal, 2 = high, 3 = urgent
    index: true
  },
  payload: {
    // For single conversation: { conversationId: "..." }
    // For bulk: { userId: "..." }
    // For user data: { userId: "...", includeSettings: true }
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  result: {
    conversationsDeleted: { type: Number, default: 0 },
    memoryEntriesDeleted: { type: Number, default: 0 },
    settingsCleared: { type: Boolean, default: false },
    error: { type: String }
  },
  attempts: {
    type: Number,
    default: 0
  },
  maxAttempts: {
    type: Number,
    default: 3
  },
  nextAttemptAt: {
    type: Date,
    default: Date.now
  },
  userMessage: {
    type: String,
    required: true
  },
  estimatedDuration: {
    type: Number,
    default: 30 // seconds
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  startedAt: Date,
  completedAt: Date,
  lastError: String
});

// Compound indexes for efficient queries
deletionTaskSchema.index({ userId: 1, status: 1 });
deletionTaskSchema.index({ status: 1, priority: -1, nextAttemptAt: 1 });
deletionTaskSchema.index({ createdAt: 1 });

// Generate human-readable task ID
deletionTaskSchema.pre('save', function(next) {
  if (!this.taskId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    this.taskId = `del_${timestamp}_${random}`;
  }
  next();
});

// Instance methods
deletionTaskSchema.methods.markAsProcessing = function() {
  this.status = 'processing';
  this.startedAt = new Date();
  this.attempts += 1;
};

deletionTaskSchema.methods.markAsCompleted = function(result) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.result = { ...this.result, ...result };
};

deletionTaskSchema.methods.markAsFailed = function(error, scheduleRetry = true) {
  this.lastError = error;
  
  if (this.attempts >= this.maxAttempts || !scheduleRetry) {
    this.status = 'failed';
    this.result.error = error;
  } else {
    this.status = 'queued';
    // Exponential backoff: 1min, 5min, 15min
    const delayMinutes = Math.pow(5, this.attempts - 1);
    this.nextAttemptAt = new Date(Date.now() + delayMinutes * 60 * 1000);
  }
};

// Static methods
deletionTaskSchema.statics.getQueuedTasks = function() {
  return this.find({
    status: 'queued',
    nextAttemptAt: { $lte: new Date() }
  }).sort({ priority: -1, createdAt: 1 });
};

deletionTaskSchema.statics.getUserTasks = function(userId) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

deletionTaskSchema.statics.getTaskStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

const DeletionTask = mongoose.model("DeletionTask", deletionTaskSchema);

export default DeletionTask;