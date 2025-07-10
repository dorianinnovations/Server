import mongoose from "mongoose";

const taskSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  taskType: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ["queued", "processing", "completed", "failed"],
    default: "queued",
  },
  createdAt: { type: Date, default: Date.now },
  runAt: { type: Date, default: Date.now },
  parameters: { type: Map, of: mongoose.Schema.Types.Mixed },
  result: { type: String },
  priority: { type: Number, default: 0, min: 0, max: 10 },
});

// Performance indexes
taskSchema.index({ runAt: 1, status: 1, priority: -1 }); // Existing index
taskSchema.index({ userId: 1, status: 1, priority: -1, runAt: 1 }); // Compound for user task processing
taskSchema.index({ userId: 1, taskType: 1, status: 1 }); // For task type queries

const Task = mongoose.model("Task", taskSchema);
console.log("✓Task schema and model defined.");

export default Task; 