import mongoose from "mongoose";

const toolSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: [
      'booking', 
      'entertainment', 
      'finance', 
      'communication', 
      'productivity', 
      'utility',
      'information',     // news_search, academic_search
      'social',          // social_search
      'research',        // academic_search  
      'media',           // image_search
      'creative',        // text_generator, code_generator
      'development',     // code_generator
      'health',          // fitness_tracker, nutrition_lookup
      'professional',    // linkedin_helper
      'security'         // password_generator
    ],
  },
  schema: {
    type: Object,
    required: true,
  },
  implementation: {
    type: String,
    required: true,
  },
  enabled: {
    type: Boolean,
    default: true,
  },
  requiresAuth: {
    type: Boolean,
    default: false,
  },
  requiresPayment: {
    type: Boolean,
    default: false,
  },
  costPerExecution: {
    type: Number,
    default: 0,
  },
  permissions: [{
    type: String,
    enum: ['read', 'write', 'execute', 'financial'],
  }],
  triggers: [{
    eventType: {
      type: String,
      required: true,
    },
    conditions: {
      type: Object,
      default: {},
    },
    priority: {
      type: Number,
      default: 5,
      min: 1,
      max: 10,
    },
  }],
  meta: {
    version: {
      type: String,
      default: '1.0.0',
    },
    author: {
      type: String,
      default: 'Numina System',
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    executionCount: {
      type: Number,
      default: 0,
    },
    successRate: {
      type: Number,
      default: 0,
    },
  },
}, {
  timestamps: true,
});

// Name index automatically created by unique: true in schema
toolSchema.index({ category: 1 });
toolSchema.index({ enabled: 1 });

export default mongoose.model("Tool", toolSchema);