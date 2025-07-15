import mongoose from 'mongoose';

const UserEventSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'user_action',
      'user_data_update',
      'user_preference_change',
      'user_behavior_pattern',
      'user_login',
      'user_logout',
      'tool_execution',
      'system_notification',
      'custom_event'
    ]
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  source: {
    type: String,
    default: 'system'
  },
  processed: {
    type: Boolean,
    default: false
  },
  triggerExecutions: [{
    toolName: {
      type: String,
      required: true
    },
    triggerType: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['success', 'error', 'pending'],
      required: true
    },
    result: {
      type: mongoose.Schema.Types.Mixed
    },
    errorMessage: {
      type: String
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

UserEventSchema.index({ userId: 1 });
UserEventSchema.index({ type: 1 });
UserEventSchema.index({ timestamp: -1 });
UserEventSchema.index({ processed: 1 });

export default mongoose.model('UserEvent', UserEventSchema);