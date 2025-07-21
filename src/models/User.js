import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { SECURITY_CONFIG } from "../config/constants.js";

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: { 
    type: String, 
    required: true, 
    minlength: 8,
    select: false 
  },
  profile: {
    type: Map,
    of: String,
    default: {},
  },
  emotionalLog: [
    {
      emotion: { type: String, required: true, trim: true },
      intensity: { type: Number, min: 1, max: 10, required: false },
      context: { type: String, required: false, trim: true },
      timestamp: { type: Date, default: Date.now },
    },
  ],
  subscription: {
    pro: {
      isActive: { type: Boolean, default: false },
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
      plan: { 
        type: String, 
        enum: ['monthly', 'yearly'], 
        default: null 
      },
      paymentMethodId: { type: String, default: null },
      autoRenew: { type: Boolean, default: true },
      cancelledAt: { type: Date, default: null },
      lastPaymentDate: { type: Date, default: null },
      nextBillingDate: { type: Date, default: null }
    },
    aether: {
      isActive: { type: Boolean, default: false },
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
      plan: { 
        type: String, 
        enum: ['monthly', 'yearly'], 
        default: null 
      },
      paymentMethodId: { type: String, default: null },
      autoRenew: { type: Boolean, default: true },
      cancelledAt: { type: Date, default: null },
      lastPaymentDate: { type: Date, default: null },
      nextBillingDate: { type: Date, default: null }
    }
  },
  // Usage tracking for tier limitations
  usage: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

userSchema.index({ createdAt: -1 });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, SECURITY_CONFIG.BCRYPT_ROUNDS);
  this.updatedAt = Date.now();
  next();
});

// Method to compare passwords
userSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Method to check if user has active Pro subscription
userSchema.methods.hasActivePro = function() {
  const pro = this.subscription?.pro;
  if (!pro || !pro.isActive) return false;
  
  // Check if subscription hasn't expired
  if (pro.endDate && new Date() > pro.endDate) {
    return false;
  }
  
  // Check if it's cancelled
  if (pro.cancelledAt && new Date() > pro.cancelledAt) {
    return false;
  }
  
  return true;
};

// Method to check if user has active Aether subscription
userSchema.methods.hasActiveAether = function() {
  const aether = this.subscription?.aether;
  if (!aether || !aether.isActive) return false;
  
  // Check if subscription hasn't expired
  if (aether.endDate && new Date() > aether.endDate) {
    return false;
  }
  
  // Check if it's cancelled
  if (aether.cancelledAt && new Date() > aether.cancelledAt) {
    return false;
  }
  
  return true;
};

// Method to get user's current tier
userSchema.methods.getTier = function() {
  if (this.hasActiveAether()) return 'AETHER';
  if (this.hasActivePro()) return 'PRO';
  return 'CORE';
};

// Method to get safe user data (without password)
userSchema.methods.getSafeData = function () {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.__v;
  return userObject;
};

// Virtual for full profile
userSchema.virtual('profileData').get(function () {
  return {
    id: this._id,
    email: this.email,
    profile: this.profile,
    emotionalLogCount: this.emotionalLog ? this.emotionalLog.length : 0,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
});

// Ensure virtual fields are serialized
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

const User = mongoose.model("User", userSchema);

// User model ready

export default User; 