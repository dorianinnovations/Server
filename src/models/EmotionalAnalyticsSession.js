import mongoose from "mongoose";

const reportProgressSchema = new mongoose.Schema({
  day: { type: Number, required: true, min: 1, max: 7 }, // Day of the week (1-7)
  date: { type: Date, required: true },
  insights: {
    moodPatterns: { type: String },
    emotionClusters: { type: String },
    externalFactors: { type: String },
    intensityTrends: { type: String },
    contextualThemes: { type: String },
  },
  processedAt: { type: Date, default: Date.now },
  emotionCount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ["pending", "processed", "failed"],
    default: "pending"
  }
});

const emotionalAnalyticsSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  weekStartDate: { type: Date, required: true },
  weekEndDate: { type: Date, required: true },
  weekNumber: { type: Number, required: true }, // Week number in year
  year: { type: Number, required: true },
  status: {
    type: String,
    enum: ["active", "in_progress", "completed", "failed"],
    default: "active",
  },
  reportProgress: [reportProgressSchema],
  finalReport: {
    summary: { type: String },
    keyInsights: [{ type: String }],
    emotionalJourney: { type: String },
    recommendations: [{ type: String }],
    weeklyStats: {
      totalEmotions: { type: Number, default: 0 },
      avgIntensity: { type: Number },
      mostFrequentEmotion: { type: String },
      emotionDistribution: { type: Map, of: Number },
    },
    generatedAt: { type: Date }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Indexes for performance
emotionalAnalyticsSessionSchema.index({ userId: 1, weekStartDate: -1 });
emotionalAnalyticsSessionSchema.index({ userId: 1, status: 1 });
emotionalAnalyticsSessionSchema.index({ weekStartDate: 1, weekEndDate: 1 });

// Pre-save hook to update timestamp
emotionalAnalyticsSessionSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Method to get current progress percentage
emotionalAnalyticsSessionSchema.methods.getProgressPercentage = function () {
  const processedDays = this.reportProgress.filter(p => p.status === "processed").length;
  if (this.status === "completed") return 100;
  return Math.round((processedDays / 7) * 100);
};

// Method to get next day to process
emotionalAnalyticsSessionSchema.methods.getNextDayToProcess = function () {
  const processedDays = this.reportProgress
    .filter(p => p.status === "processed")
    .map(p => p.day);
  
  for (let day = 1; day <= 7; day++) {
    if (!processedDays.includes(day)) {
      return day;
    }
  }
  return null; // All days processed
};

// Method to check if week is complete and ready for final report
emotionalAnalyticsSessionSchema.methods.isReadyForFinalReport = function () {
  const processedDays = this.reportProgress.filter(p => p.status === "processed").length;
  const currentDate = new Date();
  const weekPassed = currentDate > this.weekEndDate;
  
  return processedDays === 7 || (weekPassed && processedDays > 0);
};

// Static method to get or create current session for user
emotionalAnalyticsSessionSchema.statics.getCurrentSession = async function (userId) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // End of current week (Saturday)
  weekEnd.setHours(23, 59, 59, 999);
  
  // Check if there's already a session for this week
  let session = await this.findOne({
    userId,
    weekStartDate: { $gte: weekStart, $lt: new Date(weekStart.getTime() + 24 * 60 * 60 * 1000) }
  });
  
  if (!session) {
    // Create new session
    const weekNumber = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    
    session = new this({
      userId,
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      weekNumber,
      year: now.getFullYear(),
      reportProgress: []
    });
    
    await session.save();
  }
  
  return session;
};

// Virtual for session summary
emotionalAnalyticsSessionSchema.virtual('sessionSummary').get(function () {
  return {
    id: this._id,
    weekStartDate: this.weekStartDate,
    weekEndDate: this.weekEndDate,
    status: this.status,
    progress: this.getProgressPercentage(),
    daysProcessed: this.reportProgress.filter(p => p.status === "processed").length,
    totalDays: 7,
    hasFinalReport: !!this.finalReport.summary
  };
});

// Ensure virtual fields are serialized
emotionalAnalyticsSessionSchema.set('toJSON', { virtuals: true });
emotionalAnalyticsSessionSchema.set('toObject', { virtuals: true });

const EmotionalAnalyticsSession = mongoose.model("EmotionalAnalyticsSession", emotionalAnalyticsSessionSchema);

// Model ready

export default EmotionalAnalyticsSession; 