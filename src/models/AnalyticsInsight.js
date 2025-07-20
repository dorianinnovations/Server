import mongoose from "mongoose";

const analyticsInsightSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: ['communication', 'personality', 'behavioral', 'emotional', 'growth'],
    required: true,
    index: true
  },
  insight: {
    type: String,
    required: true,
    maxlength: 1000
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    required: true,
    default: 0.8
  },
  evidence: [{
    type: String,
    maxlength: 200
  }],
  dataFingerprint: {
    type: String,
    required: true
  },
  dataPoints: {
    type: Number,
    required: true,
    default: 0
  },
  sourceData: {
    totalMessages: Number,
    daysSinceFirstChat: Number,
    mostActiveTimeOfDay: String,
    communicationStyle: String
  },
  generatedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days TTL
    index: { expireAfterSeconds: 0 }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  apiModel: {
    type: String,
    default: 'openai/gpt-4o'
  },
  processingTimeMs: {
    type: Number
  }
});

// Compound indexes for efficient queries
analyticsInsightSchema.index({ userId: 1, category: 1, generatedAt: -1 });
analyticsInsightSchema.index({ userId: 1, isActive: 1, generatedAt: -1 });
analyticsInsightSchema.index({ dataFingerprint: 1 });

// Pre-save validation
analyticsInsightSchema.pre('save', function(next) {
  // Ensure evidence array doesn't exceed 5 items
  if (this.evidence.length > 5) {
    this.evidence = this.evidence.slice(0, 5);
  }
  
  // Validate confidence score
  if (this.confidence < 0 || this.confidence > 1) {
    this.confidence = Math.max(0, Math.min(1, this.confidence));
  }
  
  next();
});

// Instance method to check if insight is stale
analyticsInsightSchema.methods.isStale = function() {
  const now = new Date();
  const daysSinceGenerated = (now - this.generatedAt) / (1000 * 60 * 60 * 24);
  return daysSinceGenerated > 7; // Insights older than 7 days are stale
};

// Instance method to get formatted confidence
analyticsInsightSchema.methods.getConfidencePercentage = function() {
  return Math.round(this.confidence * 100);
};

// Static method to get latest insight for category
analyticsInsightSchema.statics.getLatestInsight = async function(userId, category) {
  return await this.findOne({
    userId,
    category,
    isActive: true
  }).sort({ generatedAt: -1 });
};

// Static method to get all active insights for user
analyticsInsightSchema.statics.getUserInsights = async function(userId, limit = 10) {
  return await this.find({
    userId,
    isActive: true
  })
  .sort({ generatedAt: -1 })
  .limit(limit)
  .select('-dataFingerprint -sourceData');
};

// Static method to deactivate old insights for category
analyticsInsightSchema.statics.deactivateOldInsights = async function(userId, category) {
  return await this.updateMany(
    { userId, category, isActive: true },
    { $set: { isActive: false } }
  );
};

// Virtual for formatted timestamp
analyticsInsightSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diff = now - this.generatedAt;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
});

analyticsInsightSchema.set('toJSON', { virtuals: true });
analyticsInsightSchema.set('toObject', { virtuals: true });

const AnalyticsInsight = mongoose.model("AnalyticsInsight", analyticsInsightSchema);

export default AnalyticsInsight;