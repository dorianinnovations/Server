import mongoose from "mongoose";

const behaviorPatternSchema = new mongoose.Schema({
  type: { 
    type: String, 
    required: true,
    enum: ['interaction', 'emotional', 'temporal', 'communication', 'preference', 'goal', 'contextual']
  },
  pattern: { type: String, required: true },
  frequency: { type: Number, default: 1 },
  intensity: { type: Number, min: 0, max: 1 },
  confidence: { type: Number, min: 0, max: 1 },
  firstObserved: { type: Date, default: Date.now },
  lastObserved: { type: Date, default: Date.now },
  metadata: { type: Map, of: mongoose.Schema.Types.Mixed }
});

const personalityTraitSchema = new mongoose.Schema({
  trait: { 
    type: String, 
    required: true,
    enum: ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism', 'curiosity', 'empathy', 'resilience', 'creativity', 'analytical']
  },
  score: { type: Number, min: 0, max: 1, required: true },
  confidence: { type: Number, min: 0, max: 1, required: true },
  evidence: [{ type: String }],
  updatedAt: { type: Date, default: Date.now }
});

const interestCategorySchema = new mongoose.Schema({
  category: { type: String, required: true },
  subcategories: [{ type: String }],
  strength: { type: Number, min: 0, max: 1 },
  growth: { type: Number, min: -1, max: 1 },
  keywords: [{ type: String }],
  discoveredThrough: [{ type: String }],
  lastInteraction: { type: Date, default: Date.now }
});

const communicationStyleSchema = new mongoose.Schema({
  preferredTone: { type: String, enum: ['formal', 'casual', 'humorous', 'empathetic', 'direct', 'supportive'] },
  responseLength: { type: String, enum: ['brief', 'moderate', 'detailed', 'comprehensive'] },
  complexityLevel: { type: String, enum: ['simple', 'intermediate', 'advanced', 'expert'] },
  preferredFormats: [{ type: String, enum: ['text', 'lists', 'examples', 'analogies', 'stories', 'data'] }],
  culturalContext: { type: String },
  languagePatterns: [{ type: String }],
  updatedAt: { type: Date, default: Date.now }
});

const lifecycleStageSchema = new mongoose.Schema({
  stage: { 
    type: String, 
    enum: ['exploration', 'growth', 'stability', 'transition', 'reflection', 'achievement'] 
  },
  confidence: { type: Number, min: 0, max: 1 },
  indicators: [{ type: String }],
  since: { type: Date, default: Date.now },
  nextPredicted: { type: String },
  transitionProbability: { type: Number, min: 0, max: 1 }
});

const userBehaviorProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  
  // Behavioral Patterns
  behaviorPatterns: [behaviorPatternSchema],
  
  // Personality Analysis
  personalityTraits: [personalityTraitSchema],
  personalitySummary: { type: String },
  
  // Interests and Preferences
  interests: [interestCategorySchema],
  preferences: {
    contentTypes: [{ type: String }],
    interactionStyles: [{ type: String }],
    feedbackTypes: [{ type: String }],
    motivationalFactors: [{ type: String }]
  },
  
  // Communication Style
  communicationStyle: communicationStyleSchema,
  
  // Temporal Patterns
  temporalPatterns: {
    mostActiveHours: [{ type: Number }],
    mostActiveDays: [{ type: String }],
    sessionDurations: {
      average: { type: Number },
      distribution: { type: Map, of: Number }
    },
    interactionFrequency: { type: String, enum: ['daily', 'weekly', 'sporadic', 'intensive'] }
  },
  
  // Emotional Patterns
  emotionalProfile: {
    baselineEmotion: { type: String },
    emotionalRange: { type: Number, min: 0, max: 1 },
    triggers: [{ 
      trigger: String, 
      emotion: String, 
      intensity: Number,
      frequency: Number 
    }],
    recoveryPatterns: [{ type: String }],
    supportNeeds: [{ type: String }]
  },
  
  // Goals and Aspirations
  goals: {
    shortTerm: [{ 
      goal: String, 
      category: String, 
      progress: Number, 
      priority: Number,
      deadline: Date,
      addedAt: { type: Date, default: Date.now }
    }],
    longTerm: [{ 
      goal: String, 
      category: String, 
      timeframe: String,
      steps: [String],
      addedAt: { type: Date, default: Date.now }
    }],
    values: [{ type: String }],
    motivations: [{ type: String }]
  },
  
  // Social and Connection Preferences
  socialProfile: {
    connectionStyle: { type: String, enum: ['collaborative', 'independent', 'supportive', 'competitive', 'mentoring'] },
    groupPreferences: [{ type: String }],
    sharingComfort: { type: Number, min: 0, max: 1 },
    supportGiving: { type: Number, min: 0, max: 1 },
    supportReceiving: { type: Number, min: 0, max: 1 },
    connectionInterests: [{ type: String }]
  },
  
  // Lifecycle and Growth Stage
  lifecycleStage: lifecycleStageSchema,
  
  // Historical Context Awareness
  historicalPatterns: {
    cycleLength: { type: Number }, // Days
    seasonalPatterns: [{ 
      season: String, 
      patterns: [String],
      emotionalTrends: [String]
    }],
    significantPeriods: [{ 
      period: String, 
      description: String, 
      impact: String,
      startDate: Date,
      endDate: Date
    }]
  },
  
  // Data Quality and Confidence
  dataQuality: {
    completeness: { type: Number, min: 0, max: 1 },
    freshness: { type: Number, min: 0, max: 1 },
    reliability: { type: Number, min: 0, max: 1 },
    sampleSize: { type: Number },
    lastFullAnalysis: { type: Date }
  },
  
  // Privacy and Sharing Settings
  privacySettings: {
    shareEmotionalData: { type: Boolean, default: false },
    shareInterests: { type: Boolean, default: true },
    shareGoals: { type: Boolean, default: false },
    allowConnections: { type: Boolean, default: true },
    analyticsLevel: { type: String, enum: ['basic', 'standard', 'comprehensive'], default: 'standard' }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for performance
userBehaviorProfileSchema.index({ userId: 1 });
userBehaviorProfileSchema.index({ 'lifecycleStage.stage': 1 });
userBehaviorProfileSchema.index({ 'interests.category': 1 });
userBehaviorProfileSchema.index({ 'personalityTraits.trait': 1 });
userBehaviorProfileSchema.index({ updatedAt: -1 });

// Pre-save hook
userBehaviorProfileSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  
  // Update data quality metrics
  this.calculateDataQuality();
  
  next();
});

// Method to calculate data quality
userBehaviorProfileSchema.methods.calculateDataQuality = function() {
  const now = new Date();
  const daysSinceCreation = (now - this.createdAt) / (1000 * 60 * 60 * 24);
  
  // Calculate completeness based on filled fields
  let filledFields = 0;
  const totalFields = 8; // Major sections
  
  if (this.behaviorPatterns.length > 0) filledFields++;
  if (this.personalityTraits.length > 0) filledFields++;
  if (this.interests.length > 0) filledFields++;
  if (this.communicationStyle.preferredTone) filledFields++;
  if (this.temporalPatterns.mostActiveHours.length > 0) filledFields++;
  if (this.emotionalProfile.baselineEmotion) filledFields++;
  if (this.goals.shortTerm.length > 0 || this.goals.longTerm.length > 0) filledFields++;
  if (this.socialProfile.connectionStyle) filledFields++;
  
  this.dataQuality.completeness = filledFields / totalFields;
  
  // Calculate freshness (higher for recent updates)
  const daysSinceUpdate = (now - this.updatedAt) / (1000 * 60 * 60 * 24);
  this.dataQuality.freshness = Math.max(0, 1 - (daysSinceUpdate / 30)); // Degrades over 30 days
  
  // Calculate reliability based on sample size and time
  const minSampleDays = 7;
  this.dataQuality.reliability = Math.min(1, daysSinceCreation / minSampleDays);
  
  this.dataQuality.sampleSize = this.behaviorPatterns.length + this.interests.length;
};

// Method to get personality summary
userBehaviorProfileSchema.methods.getPersonalitySummary = function() {
  if (this.personalityTraits.length === 0) return "Personality analysis in progress";
  
  const topTraits = this.personalityTraits
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(t => t.trait);
  
  return `Primary traits: ${topTraits.join(', ')}`;
};

// Method to get matching score with another user
userBehaviorProfileSchema.methods.getCompatibilityScore = function(otherProfile) {
  let totalScore = 0;
  let factors = 0;
  
  // Interest overlap
  if (this.interests.length > 0 && otherProfile.interests.length > 0) {
    const myInterests = this.interests.map(i => i.category);
    const theirInterests = otherProfile.interests.map(i => i.category);
    const overlap = myInterests.filter(i => theirInterests.includes(i)).length;
    const interestScore = overlap / Math.max(myInterests.length, theirInterests.length);
    totalScore += interestScore * 0.3;
    factors++;
  }
  
  // Personality compatibility
  if (this.personalityTraits.length > 0 && otherProfile.personalityTraits.length > 0) {
    const personalityScore = this.calculatePersonalityCompatibility(otherProfile);
    totalScore += personalityScore * 0.3;
    factors++;
  }
  
  // Lifecycle stage compatibility
  if (this.lifecycleStage?.stage && otherProfile.lifecycleStage?.stage) {
    const stageScore = (this.lifecycleStage?.stage || 'exploration') === (otherProfile.lifecycleStage?.stage || 'exploration') ? 1 : 0.5;
    totalScore += stageScore * 0.2;
    factors++;
  }
  
  // Communication style compatibility
  if (this.communicationStyle.preferredTone && otherProfile.communicationStyle.preferredTone) {
    const commScore = this.communicationStyle.preferredTone === otherProfile.communicationStyle.preferredTone ? 1 : 0.7;
    totalScore += commScore * 0.2;
    factors++;
  }
  
  return factors > 0 ? totalScore / factors : 0;
};

// Method to calculate personality compatibility
userBehaviorProfileSchema.methods.calculatePersonalityCompatibility = function(otherProfile) {
  const myTraits = new Map(this.personalityTraits.map(t => [t.trait, t.score]));
  const theirTraits = new Map(otherProfile.personalityTraits.map(t => [t.trait, t.score]));
  
  let compatibility = 0;
  let comparisons = 0;
  
  // Compare overlapping traits
  for (const [trait, myScore] of myTraits) {
    if (theirTraits.has(trait)) {
      const theirScore = theirTraits.get(trait);
      const difference = Math.abs(myScore - theirScore);
      compatibility += (1 - difference); // Higher similarity = higher compatibility
      comparisons++;
    }
  }
  
  return comparisons > 0 ? compatibility / comparisons : 0.5;
};

// Static method to find compatible users
userBehaviorProfileSchema.statics.findCompatibleUsers = async function(userId, limit = 10) {
  const userProfile = await this.findOne({ userId });
  if (!userProfile) return [];
  
  const otherProfiles = await this.find({ 
    userId: { $ne: userId },
    'privacySettings.allowConnections': true 
  }).limit(50);
  
  const compatibilityScores = otherProfiles.map(profile => ({
    userId: profile.userId,
    profile: profile,
    compatibilityScore: userProfile.getCompatibilityScore(profile)
  }));
  
  return compatibilityScores
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
    .slice(0, limit);
};

// Virtual for summary
userBehaviorProfileSchema.virtual('profileSummary').get(function () {
  return {
    id: this._id,
    userId: this.userId,
    personalitySummary: this.getPersonalitySummary(),
    topInterests: this.interests.slice(0, 3).map(i => i.category),
    lifecycleStage: this.lifecycleStage?.stage || 'exploration',
    communicationStyle: this.communicationStyle?.preferredTone || 'supportive',
    dataQuality: this.dataQuality,
    lastUpdated: this.updatedAt
  };
});

userBehaviorProfileSchema.set('toJSON', { virtuals: true });
userBehaviorProfileSchema.set('toObject', { virtuals: true });

const UserBehaviorProfile = mongoose.model("UserBehaviorProfile", userBehaviorProfileSchema);

console.log("✓ UserBehaviorProfile schema and model defined.");

export default UserBehaviorProfile;