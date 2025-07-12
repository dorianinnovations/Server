import mongoose from "mongoose";

const collectiveDataConsentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  consentStatus: {
    type: String,
    enum: ["granted", "denied", "pending"],
    default: "pending"
  },
  dataTypes: {
    emotions: { type: Boolean, default: false },
    intensity: { type: Boolean, default: false },
    context: { type: Boolean, default: false },
    demographics: { type: Boolean, default: false },
    activityPatterns: { type: Boolean, default: false }
  },
  consentDate: { type: Date },
  lastUpdated: { type: Date, default: Date.now },
  consentVersion: { type: String, default: "1.0" },
  ipAddress: { type: String },
  userAgent: { type: String },
  notes: { type: String }
});

// Indexes for performance
// Note: userId index is automatically created by unique: true
collectiveDataConsentSchema.index({ consentStatus: 1 });
collectiveDataConsentSchema.index({ lastUpdated: -1 });

// Pre-save hook to update timestamp
collectiveDataConsentSchema.pre("save", function (next) {
  this.lastUpdated = Date.now();
  if (this.consentStatus === "granted" && !this.consentDate) {
    this.consentDate = Date.now();
  }
  next();
});

// Method to check if user has granted consent
collectiveDataConsentSchema.methods.hasConsent = function () {
  return this.consentStatus === "granted";
};

// Method to get consent summary
collectiveDataConsentSchema.methods.getConsentSummary = function () {
  return {
    userId: this.userId,
    consentStatus: this.consentStatus,
    dataTypes: this.dataTypes,
    consentDate: this.consentDate,
    lastUpdated: this.lastUpdated
  };
};

// Static method to get users with consent
collectiveDataConsentSchema.statics.getConsentingUsers = async function () {
  return await this.find({ consentStatus: "granted" }).populate("userId");
};

// Static method to get consent statistics
collectiveDataConsentSchema.statics.getConsentStats = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: "$consentStatus",
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = {
    granted: 0,
    denied: 0,
    pending: 0,
    total: 0
  };
  
  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
  });
  
  return result;
};

const CollectiveDataConsent = mongoose.model("CollectiveDataConsent", collectiveDataConsentSchema);

console.log("✓CollectiveDataConsent schema and model defined.");

export default CollectiveDataConsent; 