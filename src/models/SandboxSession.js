import mongoose from 'mongoose';

const sandboxNodeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true, maxlength: 100 },
  content: { type: String, required: true, maxlength: 1000 },
  position: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  },
  connections: [{ type: String }], // Array of node IDs
  personalHook: { type: String, maxlength: 200 },
  confidence: { type: Number, min: 0, max: 1, default: 0.7 },
  category: { type: String, required: true, maxlength: 50 },
  isLocked: { type: Boolean, default: false },
  lockTimestamp: { type: Date },
  deepInsights: {
    summary: { type: String, maxlength: 500 },
    keyPatterns: [{ type: String, maxlength: 100 }],
    personalizedContext: { type: String, maxlength: 300 },
    dataConnections: [{
      type: { type: String, required: true },
      value: mongoose.Schema.Types.Mixed,
      source: { type: String, required: true },
      relevanceScore: { type: Number, min: 0, max: 1 }
    }],
    relevanceScore: { type: Number, min: 0, max: 1, default: 0.5 }
  },
  userDataContext: {
    ubpmData: mongoose.Schema.Types.Mixed,
    behavioralMetrics: mongoose.Schema.Types.Mixed,
    emotionalProfile: mongoose.Schema.Types.Mixed,
    temporalPatterns: mongoose.Schema.Types.Mixed
  }
}, { _id: false });

const sandboxSessionSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  sessionId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  nodes: [sandboxNodeSchema],
  lockedNodes: [sandboxNodeSchema],
  connections: [{
    source: { type: String, required: true },
    target: { type: String, required: true },
    strength: { type: Number, min: 0, max: 1, default: 0.5 },
    type: { type: String, default: 'conceptual' }
  }],
  userQuery: { type: String, required: true, maxlength: 500 },
  selectedActions: [{ type: String, maxlength: 50 }],
  useUBPM: { type: Boolean, default: false },
  metadata: {
    completenessScore: { type: Number, min: 0, max: 1, default: 0.5 },
    dataQuality: { 
      type: String, 
      enum: ['poor', 'basic', 'fair', 'good', 'excellent'], 
      default: 'basic' 
    },
    nodeCount: { type: Number, default: 0 },
    totalConnections: { type: Number, default: 0 },
    averageConfidence: { type: Number, min: 0, max: 1, default: 0.5 },
    tags: [{ type: String, maxlength: 30 }]
  },
  isActive: { type: Boolean, default: true },
  lastAccessed: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'sandbox_sessions'
});

// Indexes for better performance
sandboxSessionSchema.index({ userId: 1, createdAt: -1 });
sandboxSessionSchema.index({ sessionId: 1 });
sandboxSessionSchema.index({ 'metadata.dataQuality': 1 });
sandboxSessionSchema.index({ isActive: 1 });

// Update lastAccessed on each query
sandboxSessionSchema.pre(/^find/, function() {
  this.set({ lastAccessed: new Date() });
});

const SandboxSession = mongoose.model('SandboxSession', sandboxSessionSchema);

export default SandboxSession;