import mongoose from "mongoose";

const collectiveSnapshotSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  sampleSize: {
    type: Number,
    required: true,
    min: 1
  },
  dominantEmotion: {
    type: String,
    required: true,
    trim: true
  },
  avgIntensity: {
    type: Number,
    required: true,
    min: 0,
    max: 10
  },
  insight: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  archetype: {
    type: String,
    required: true,
    trim: true
  },
  // Additional metadata for richer analysis
  metadata: {
    timeRange: {
      type: String,
      enum: ["7d", "30d", "90d", "1y", "all"],
      default: "30d"
    },
    totalEmotions: {
      type: Number,
      default: 0
    },
    emotionDistribution: {
      type: Map,
      of: Number,
      default: {}
    },
    topEmotions: [{
      emotion: { type: String, required: true },
      count: { type: Number, required: true },
      percentage: { type: Number, required: true }
    }],
    contextThemes: [{
      theme: { type: String, required: true },
      frequency: { type: Number, required: true }
    }],
    intensityDistribution: {
      low: { type: Number, default: 0 }, // 1-3
      medium: { type: Number, default: 0 }, // 4-7
      high: { type: Number, default: 0 } // 8-10
    },
    activityMetrics: {
      activeUsers: { type: Number, default: 0 },
      newUsers: { type: Number, default: 0 },
      engagementLevel: { type: Number, default: 0 }
    }
  },
  // LLM analysis details
  analysis: {
    model: {
      type: String,
      default: "gpt-4"
    },
    promptVersion: {
      type: String,
      default: "1.0"
    },
    processingTime: {
      type: Number, // milliseconds
      default: 0
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    alternativeArchetypes: [{
      archetype: { type: String, required: true },
      confidence: { type: Number, required: true }
    }]
  },
  // Status tracking
  status: {
    type: String,
    enum: ["processing", "completed", "failed"],
    default: "processing"
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for performance
collectiveSnapshotSchema.index({ timestamp: -1 });
collectiveSnapshotSchema.index({ dominantEmotion: 1 });
collectiveSnapshotSchema.index({ archetype: 1 });
collectiveSnapshotSchema.index({ status: 1 });
collectiveSnapshotSchema.index({ "metadata.timeRange": 1 });

// Pre-save hook to update timestamp
collectiveSnapshotSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Method to get snapshot summary
collectiveSnapshotSchema.methods.getSummary = function () {
  return {
    id: this._id,
    timestamp: this.timestamp,
    sampleSize: this.sampleSize,
    dominantEmotion: this.dominantEmotion,
    avgIntensity: this.avgIntensity,
    insight: this.insight,
    archetype: this.archetype,
    status: this.status,
    timeRange: this.metadata.timeRange
  };
};

// Method to get detailed snapshot
collectiveSnapshotSchema.methods.getDetailed = function () {
  return {
    id: this._id,
    timestamp: this.timestamp,
    sampleSize: this.sampleSize,
    dominantEmotion: this.dominantEmotion,
    avgIntensity: this.avgIntensity,
    insight: this.insight,
    archetype: this.archetype,
    metadata: this.metadata,
    analysis: this.analysis,
    status: this.status,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// Static method to get latest snapshot
collectiveSnapshotSchema.statics.getLatest = async function (timeRange = "30d") {
  return await this.findOne({
    status: "completed",
    "metadata.timeRange": timeRange
  }).sort({ timestamp: -1 });
};

// Static method to get snapshots by time range
collectiveSnapshotSchema.statics.getByTimeRange = async function (timeRange, limit = 10) {
  return await this.find({
    status: "completed",
    "metadata.timeRange": timeRange
  })
  .sort({ timestamp: -1 })
  .limit(limit);
};

// Static method to get archetype history
collectiveSnapshotSchema.statics.getArchetypeHistory = async function (timeRange = "30d", limit = 20) {
  return await this.aggregate([
    {
      $match: {
        status: "completed",
        "metadata.timeRange": timeRange
      }
    },
    {
      $group: {
        _id: "$archetype",
        count: { $sum: 1 },
        lastSeen: { $max: "$timestamp" },
        avgIntensity: { $avg: "$avgIntensity" },
        insights: { $push: "$insight" }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: limit
    }
  ]);
};

// Static method to get emotion trends
collectiveSnapshotSchema.statics.getEmotionTrends = async function (timeRange = "30d", limit = 20) {
  return await this.aggregate([
    {
      $match: {
        status: "completed",
        "metadata.timeRange": timeRange
      }
    },
    {
      $group: {
        _id: "$dominantEmotion",
        count: { $sum: 1 },
        avgIntensity: { $avg: "$avgIntensity" },
        lastSeen: { $max: "$timestamp" },
        archetypes: { $addToSet: "$archetype" }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: limit
    }
  ]);
};

// Static method to get statistics
collectiveSnapshotSchema.statics.getStats = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalSnapshots: { $sum: 1 },
        avgSampleSize: { $avg: "$sampleSize" },
        avgIntensity: { $avg: "$avgIntensity" },
        uniqueArchetypes: { $addToSet: "$archetype" },
        uniqueEmotions: { $addToSet: "$dominantEmotion" }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      totalSnapshots: 0,
      avgSampleSize: 0,
      avgIntensity: 0,
      uniqueArchetypes: 0,
      uniqueEmotions: 0
    };
  }

  const stat = stats[0];
  return {
    totalSnapshots: stat.totalSnapshots,
    avgSampleSize: Math.round(stat.avgSampleSize || 0),
    avgIntensity: Math.round((stat.avgIntensity || 0) * 10) / 10,
    uniqueArchetypes: stat.uniqueArchetypes.length,
    uniqueEmotions: stat.uniqueEmotions.length
  };
};

// Virtual for time since creation
collectiveSnapshotSchema.virtual('ageInHours').get(function () {
  return Math.floor((Date.now() - this.timestamp.getTime()) / (1000 * 60 * 60));
});

// Ensure virtual fields are serialized
collectiveSnapshotSchema.set('toJSON', { virtuals: true });
collectiveSnapshotSchema.set('toObject', { virtuals: true });

const CollectiveSnapshot = mongoose.model("CollectiveSnapshot", collectiveSnapshotSchema);

console.log("✓CollectiveSnapshot schema and model defined.");

export default CollectiveSnapshot; 