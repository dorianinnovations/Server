import mongoose from "mongoose";

const shortTermMemorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  conversationId: { type: String, required: false },
  timestamp: { type: Date, default: Date.now, expires: "24h" }, 
  content: { type: String, required: true },
  role: { type: String, enum: ["user", "assistant"], required: true },
  attachments: { type: Array, required: false }, // Store image attachments for GPT-4o vision memory
});

// Performance indexes
shortTermMemorySchema.index({ userId: 1, timestamp: -1 }); // For recent memory queries
shortTermMemorySchema.index({ conversationId: 1, timestamp: -1 }); // For conversation history
shortTermMemorySchema.index({ userId: 1, role: 1, timestamp: -1 }); // For role-specific queries

const ShortTermMemory = mongoose.model(
  "ShortTermMemory",
  shortTermMemorySchema
);
console.log("✓ShortTermMemory schema and model defined.");

export default ShortTermMemory; 