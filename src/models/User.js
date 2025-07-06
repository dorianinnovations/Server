import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: { type: String, required: true, minlength: 8 },
  
  // Enhanced profile fields
  profile: {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    displayName: { type: String, trim: true },
    avatar: { type: String },
    bio: { type: String, maxlength: 500 },
    preferences: {
      theme: { type: String, enum: ["light", "dark", "auto"], default: "auto" },
      language: { type: String, default: "en" },
      notifications: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        tasks: { type: Boolean, default: true },
      },
    },
    timezone: { type: String, default: "UTC" },
    customFields: {
      type: Map,
      of: String,
      default: {},
    },
  },
  
  // Enhanced emotional tracking
  emotionalLog: [
    {
      emotion: { type: String, required: true, trim: true },
      intensity: { type: Number, min: 1, max: 10, required: false },
      context: { type: String, required: false, trim: true },
      timestamp: { type: Date, default: Date.now },
      tags: [{ type: String, trim: true }],
      mood: { type: String, enum: ["positive", "neutral", "negative"] },
    },
  ],
  
  // User statistics
  stats: {
    totalConversations: { type: Number, default: 0 },
    totalEmotions: { type: Number, default: 0 },
    totalTasks: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now },
    streakDays: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
  },
  
  // Account status
  status: {
    type: String,
    enum: ["active", "inactive", "suspended", "pending"],
    default: "active",
  },
  
  // Security
  lastLogin: { type: Date },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

// Indexes for better performance
userSchema.index({ "stats.lastActive": -1 });
userSchema.index({ status: 1 });
userSchema.index({ "emotionalLog.timestamp": -1 }); // For recent emotions queries
userSchema.index({ email: 1 }); // Explicit email index for faster lookups
userSchema.index({ createdAt: 1 }); // For user registration analytics

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

// Method to check if account is locked
userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 },
    $set: { lastLogin: Date.now() }
  });
};

// Method to update stats
userSchema.methods.updateStats = function(type, increment = 1) {
  const update = {};
  update[`stats.${type}`] = increment;
  update["stats.lastActive"] = Date.now();
  
  return this.updateOne({ $inc: update });
};

// Method to get full name
userSchema.methods.getFullName = function() {
  if (this.profile.firstName && this.profile.lastName) {
    return `${this.profile.firstName} ${this.profile.lastName}`;
  }
  return this.profile.displayName || this.email;
};

// Method to get emotional insights
userSchema.methods.getEmotionalInsights = function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.emotionalLog
    .filter(entry => entry.timestamp >= startDate)
    .reduce((insights, entry) => {
      if (!insights[entry.emotion]) {
        insights[entry.emotion] = { count: 0, totalIntensity: 0 };
      }
      insights[entry.emotion].count++;
      insights[entry.emotion].totalIntensity += entry.intensity || 5;
      return insights;
    }, {});
};

const User = mongoose.model("User", userSchema);
console.log("✓Enhanced User schema and model defined.");

export default User; 