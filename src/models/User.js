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

console.log("✓Enhanced User schema and model defined.");

export default User; 