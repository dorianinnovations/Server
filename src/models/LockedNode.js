import mongoose from 'mongoose';

const lockedNodeSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  nodeId: { 
    type: String, 
    required: true,
    index: true 
  },
  title: { type: String, required: true, maxlength: 100 },
  content: { type: String, required: true, maxlength: 1000 },
  category: { type: String, required: true, maxlength: 50 },
  personalHook: { type: String, maxlength: 200 },
  confidence: { type: Number, min: 0, max: 1, default: 0.7 },
  lockData: {
    reason: { type: String, maxlength: 200 },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    tags: [{ type: String, maxlength: 30 }],
    relatedSessions: [{ type: String }] // sessionIds where this node was used
  },
  contextualData: {
    originalQuery: { type: String, maxlength: 500 },
    relatedNodes: [{ type: String }], // nodeIds that connect to this
    userContext: mongoose.Schema.Types.Mixed,
    enhancementData: {
      personalizedContext: { type: String, maxlength: 300 },
      dataConnections: [{
        type: { type: String, required: true },
        value: mongoose.Schema.Types.Mixed,
        source: { type: String, required: true },
        relevanceScore: { type: Number, min: 0, max: 1 }
      }],
      suggestedConnections: [{ type: String, maxlength: 50 }]
    }
  },
  usageStats: {
    timesUsed: { type: Number, default: 1 },
    lastUsed: { type: Date, default: Date.now },
    sessionsIncluded: { type: Number, default: 0 },
    averageRelevance: { type: Number, min: 0, max: 1, default: 0.5 }
  },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true,
  collection: 'locked_nodes'
});

// Compound index for efficient queries
lockedNodeSchema.index({ userId: 1, isActive: 1, createdAt: -1 });
// nodeId and userId indexes already defined in schema with 'index: true'

// Update usage stats when accessed
lockedNodeSchema.methods.updateUsage = function(sessionId) {
  this.usageStats.timesUsed += 1;
  this.usageStats.lastUsed = new Date();
  if (sessionId && !this.lockData.relatedSessions.includes(sessionId)) {
    this.lockData.relatedSessions.push(sessionId);
    this.usageStats.sessionsIncluded += 1;
  }
  return this.save();
};

const LockedNode = mongoose.model('LockedNode', lockedNodeSchema);

export default LockedNode;