import mongoose from "mongoose";

/**
 * UserConstants - Persistent knowledge about users that should always be remembered
 * This stores key facts, preferences, and insights that persist across all conversations
 */
const userConstantsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  
  // Basic personal info user has shared
  personalInfo: {
    name: { type: String, default: null },
    preferredName: { type: String, default: null },
    age: { type: Number, default: null },
    location: { type: String, default: null },
    timezone: { type: String, default: null },
    occupation: { type: String, default: null },
    relationship: { type: String, default: null }, // single, married, etc.
    kids: { type: Boolean, default: null },
    pets: [{ type: String }], // ["dog: Max", "cat: Luna"]
  },
  
  // Communication style and preferences
  communicationStyle: {
    preferredResponseLength: { 
      type: String, 
      enum: ['short', 'medium', 'long', 'adaptive'], 
      default: 'adaptive' 
    },
    formalityLevel: { 
      type: String, 
      enum: ['very_casual', 'casual', 'neutral', 'formal'], 
      default: 'casual' 
    },
    topicsToAvoid: [{ type: String }],
    favoriteTopics: [{ type: String }],
    humorStyle: { type: String, default: null }, // sarcastic, punny, dry, etc.
    emotionalSupport: { 
      type: String, 
      enum: ['direct', 'gentle', 'analytical', 'empathetic'], 
      default: 'empathetic' 
    },
  },
  
  // Important life context that should influence responses
  lifeContext: {
    currentChallenges: [{ 
      challenge: String, 
      severity: Number, // 1-10
      addedAt: { type: Date, default: Date.now },
      resolved: { type: Boolean, default: false }
    }],
    goals: [{
      goal: String,
      category: String, // career, health, relationship, etc.
      importance: Number, // 1-10
      addedAt: { type: Date, default: Date.now },
      achieved: { type: Boolean, default: false }
    }],
    majorLifeEvents: [{
      event: String,
      impact: String, // positive, negative, neutral
      date: Date,
      addedAt: { type: Date, default: Date.now }
    }],
    supportSystem: [{ type: String }], // "supportive family", "close friend group", etc.
  },
  
  // Interests and hobbies for context
  interests: {
    hobbies: [{ type: String }],
    favoriteBooks: [{ type: String }],
    favoriteMovies: [{ type: String }],
    favoriteMusic: [{ type: String }],
    sports: [{ type: String }],
    skills: [{ type: String }],
    learningGoals: [{ type: String }],
  },
  
  // Health and wellness context (if user chooses to share)
  wellness: {
    exerciseRoutine: { type: String, default: null },
    sleepSchedule: { type: String, default: null },
    dietaryRestrictions: [{ type: String }],
    mentalHealthSupport: { type: Boolean, default: null },
    stressors: [{ type: String }],
    copingMechanisms: [{ type: String }],
  },
  
  // Work/career context
  career: {
    industry: { type: String, default: null },
    jobSatisfaction: { type: Number, min: 1, max: 10, default: null },
    careerGoals: [{ type: String }],
    workStressLevel: { type: Number, min: 1, max: 10, default: null },
    workSchedule: { type: String, default: null }, // "9-5", "nights", "flexible", etc.
  },
  
  // Key insights Numina has learned about the user
  insights: [{
    insight: String,
    confidence: { type: Number, min: 0, max: 1 }, // 0-1 confidence score
    category: String, // personality, behavior, preference, etc.
    evidenceCount: { type: Number, default: 1 }, // how many interactions support this
    lastUpdated: { type: Date, default: Date.now },
    addedAt: { type: Date, default: Date.now }
  }],
  
  // Important memories that should never be forgotten
  keyMemories: [{
    memory: String,
    importance: { type: Number, min: 1, max: 10 },
    category: String, // personal, achievement, struggle, etc.
    addedAt: { type: Date, default: Date.now },
    lastReferenced: { type: Date, default: Date.now }
  }],
  
  // Privacy and boundaries
  privacy: {
    allowEmotionalTracking: { type: Boolean, default: true },
    allowPersonalityAnalysis: { type: Boolean, default: true },
    allowMemoryStorage: { type: Boolean, default: true },
    dataRetentionPeriod: { type: Number, default: null }, // days
    sensitiveTopics: [{ type: String }],
  },
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastConversation: { type: Date, default: Date.now },
  totalInteractions: { type: Number, default: 0 },
  
  // Version for schema migrations
  version: { type: Number, default: 1 }
});

// Indexes for performance
// userId index automatically created by unique: true in schema
userConstantsSchema.index({ updatedAt: -1 });
userConstantsSchema.index({ lastConversation: -1 });

// Update timestamps on save
userConstantsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  if (this.isNew) {
    this.totalInteractions = 0;
  }
  next();
});

// Methods to manage constants
userConstantsSchema.methods.addInsight = function(insight, category, confidence = 0.7) {
  const existing = this.insights.find(i => i.insight === insight);
  if (existing) {
    existing.evidenceCount++;
    existing.confidence = Math.min(1, existing.confidence + 0.1);
    existing.lastUpdated = new Date();
  } else {
    this.insights.push({
      insight,
      category,
      confidence,
      evidenceCount: 1
    });
  }
  return this.save();
};

userConstantsSchema.methods.addKeyMemory = function(memory, importance, category) {
  this.keyMemories.push({
    memory,
    importance,
    category
  });
  return this.save();
};

userConstantsSchema.methods.updatePersonalInfo = function(field, value) {
  this.personalInfo[field] = value;
  return this.save();
};

userConstantsSchema.methods.addGoal = function(goal, category, importance = 5) {
  this.lifeContext.goals.push({
    goal,
    category,
    importance
  });
  return this.save();
};

userConstantsSchema.methods.addChallenge = function(challenge, severity = 5) {
  this.lifeContext.currentChallenges.push({
    challenge,
    severity
  });
  return this.save();
};

// Method to get context summary for prompts
userConstantsSchema.methods.getContextSummary = function() {
  const summary = {
    personal: {},
    preferences: {},
    current: {},
    insights: [],
    memories: []
  };
  
  // Personal info
  if (this.personalInfo.name) summary.personal.name = this.personalInfo.name;
  if (this.personalInfo.preferredName) summary.personal.preferredName = this.personalInfo.preferredName;
  if (this.personalInfo.occupation) summary.personal.occupation = this.personalInfo.occupation;
  if (this.personalInfo.location) summary.personal.location = this.personalInfo.location;
  if (this.personalInfo.pets && this.personalInfo.pets.length > 0) summary.personal.pets = this.personalInfo.pets;
  
  // Communication preferences
  summary.preferences.responseLength = this.communicationStyle.preferredResponseLength;
  summary.preferences.formalityLevel = this.communicationStyle.formalityLevel;
  summary.preferences.emotionalSupport = this.communicationStyle.emotionalSupport;
  if (this.communicationStyle.topicsToAvoid && this.communicationStyle.topicsToAvoid.length > 0) {
    summary.preferences.topicsToAvoid = this.communicationStyle.topicsToAvoid;
  }
  
  // Current challenges and goals
  const activeChallenges = this.lifeContext.currentChallenges.filter(c => !c.resolved);
  if (activeChallenges.length > 0) {
    summary.current.challenges = activeChallenges.map(c => ({ challenge: c.challenge, severity: c.severity }));
  }
  
  const activeGoals = this.lifeContext.goals.filter(g => !g.achieved);
  if (activeGoals.length > 0) {
    summary.current.goals = activeGoals.map(g => ({ goal: g.goal, category: g.category, importance: g.importance }));
  }
  
  // Top insights (highest confidence)
  summary.insights = this.insights
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
    .map(i => ({ insight: i.insight, category: i.category, confidence: i.confidence }));
  
  // Important memories
  summary.memories = this.keyMemories
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 3)
    .map(m => ({ memory: m.memory, importance: m.importance, category: m.category }));
  
  return summary;
};

const UserConstants = mongoose.model("UserConstants", userConstantsSchema);

console.log("✓ UserConstants schema and model defined.");

export default UserConstants;