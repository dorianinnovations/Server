import mongoose from "mongoose";

const insightCooldownSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: ['communication', 'personality', 'behavioral', 'emotional', 'growth'],
    required: true
  },
  lastGeneratedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  cooldownUntil: {
    type: Date,
    required: true,
    index: true
  },
  cooldownPeriodHours: {
    type: Number,
    required: true,
    enum: [3, 6, 12, 24, 48] // Valid cooldown periods
  },
  dataFingerprint: {
    type: String,
    required: true
  },
  attemptCount: {
    type: Number,
    default: 1,
    min: 1
  },
  lastAttemptAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound indexes for efficient cooldown checks
insightCooldownSchema.index({ userId: 1, category: 1 }, { unique: true });
insightCooldownSchema.index({ userId: 1, cooldownUntil: 1 });

// Default cooldown periods per category (in hours)
const COOLDOWN_PERIODS = {
  communication: 6,    // 6 hours
  personality: 24,     // 24 hours  
  behavioral: 12,      // 12 hours
  emotional: 3,        // 3 hours
  growth: 48          // 48 hours
};

// Pre-save hook to calculate cooldownUntil
insightCooldownSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('lastGeneratedAt') || this.isModified('cooldownPeriodHours')) {
    const cooldownMs = this.cooldownPeriodHours * 60 * 60 * 1000;
    this.cooldownUntil = new Date(this.lastGeneratedAt.getTime() + cooldownMs);
  }
  next();
});

// Instance method to check if cooldown is active
insightCooldownSchema.methods.isActive = function() {
  if (!this.cooldownUntil) return false;
  return new Date() < this.cooldownUntil;
};

// Instance method to get remaining cooldown time in milliseconds
insightCooldownSchema.methods.getRemainingTime = function() {
  if (!this.cooldownUntil) return 0;
  const now = new Date();
  const remaining = this.cooldownUntil.getTime() - now.getTime();
  return Math.max(0, remaining);
};

// Instance method to get remaining time in human readable format
insightCooldownSchema.methods.getRemainingTimeFormatted = function() {
  const remainingMs = this.getRemainingTime();
  if (remainingMs <= 0) return 'Ready';
  
  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

// Instance method to update for new generation
insightCooldownSchema.methods.updateForNewGeneration = function(dataFingerprint) {
  this.lastGeneratedAt = new Date();
  this.dataFingerprint = dataFingerprint;
  this.attemptCount += 1;
  this.lastAttemptAt = new Date();
  
  // Recalculate cooldownUntil in pre-save hook
  return this.save();
};

// Static method to check if user can generate insight for category
insightCooldownSchema.statics.canGenerateInsight = async function(userId, category, currentDataFingerprint) {
  const cooldown = await this.findOne({ userId, category });
  
  if (!cooldown) {
    return { allowed: true, reason: 'first_generation' };
  }
  
  // Check if data has changed significantly
  if (cooldown.dataFingerprint !== currentDataFingerprint) {
    return { allowed: true, reason: 'data_changed' };
  }
  
  // Check if cooldown period has expired
  if (!cooldown.isActive()) {
    return { allowed: true, reason: 'cooldown_expired' };
  }
  
  return { 
    allowed: false, 
    reason: 'cooldown_active',
    remainingTime: cooldown.getRemainingTime(),
    remainingFormatted: cooldown.getRemainingTimeFormatted()
  };
};

// Static method to create or update cooldown
insightCooldownSchema.statics.createOrUpdateCooldown = async function(userId, category, dataFingerprint) {
  const cooldownPeriodHours = COOLDOWN_PERIODS[category] || COOLDOWN_PERIODS.communication;
  const now = new Date();
  const cooldownUntil = new Date(now.getTime() + (cooldownPeriodHours * 60 * 60 * 1000));
  
  const cooldown = await this.findOneAndUpdate(
    { userId, category },
    {
      $set: {
        lastGeneratedAt: now,
        cooldownPeriodHours,
        cooldownUntil,
        dataFingerprint,
        lastAttemptAt: now
      },
      $inc: { attemptCount: 1 },
      $setOnInsert: { createdAt: now }
    },
    { 
      upsert: true, 
      new: true,
      runValidators: true
    }
  );
  
  return cooldown;
};

// Static method to get all user cooldowns
insightCooldownSchema.statics.getUserCooldowns = async function(userId) {
  const cooldowns = await this.find({ userId });
  
  const result = {};
  for (const cooldown of cooldowns) {
    result[cooldown.category] = {
      isActive: cooldown.isActive(),
      remainingTime: cooldown.getRemainingTime(),
      remainingFormatted: cooldown.getRemainingTimeFormatted(),
      lastGenerated: cooldown.lastGeneratedAt,
      attemptCount: cooldown.attemptCount
    };
  }
  
  return result;
};

// Static method to clear expired cooldowns (cleanup)
insightCooldownSchema.statics.clearExpiredCooldowns = async function() {
  const result = await this.deleteMany({
    cooldownUntil: { $lt: new Date() },
    lastGeneratedAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Older than 30 days
  });
  
  return result.deletedCount;
};

// Virtual for cooldown status
insightCooldownSchema.virtual('status').get(function() {
  return {
    active: this.isActive(),
    remaining: this.getRemainingTime(),
    remainingFormatted: this.getRemainingTimeFormatted(),
    category: this.category,
    lastGenerated: this.lastGeneratedAt,
    attempts: this.attemptCount
  };
});

insightCooldownSchema.set('toJSON', { virtuals: true });
insightCooldownSchema.set('toObject', { virtuals: true });

const InsightCooldown = mongoose.model("InsightCooldown", insightCooldownSchema);

export { COOLDOWN_PERIODS };
export default InsightCooldown;