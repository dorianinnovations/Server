import mongoose from 'mongoose';

const EventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['wellness', 'social', 'creative', 'outdoor', 'learning', 'fitness', 'mindfulness', 'community'],
    required: true
  },
  location: {
    address: String,
    city: String,
    state: String,
    coordinates: {
      lat: Number,
      lng: Number
    },
    virtual: {
      type: Boolean,
      default: false
    },
    virtualLink: String
  },
  dateTime: {
    start: {
      type: Date,
      required: true
    },
    end: {
      type: Date,
      required: true
    },
    timezone: {
      type: String,
      default: 'UTC'
    }
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['joined', 'interested', 'declined'],
      default: 'joined'
    }
  }],
  maxParticipants: {
    type: Number,
    default: null
  },
  tags: [{
    type: String,
    trim: true
  }],
  emotionalContext: {
    targetMood: {
      type: String,
      enum: ['energizing', 'calming', 'inspiring', 'social', 'reflective', 'creative']
    },
    moodBoostPotential: {
      type: Number,
      min: 0,
      max: 10,
      default: 5
    },
    requiredEnergyLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    }
  },
  requirements: {
    experience: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'all'],
      default: 'all'
    },
    equipment: [String],
    ageRange: {
      min: Number,
      max: Number
    }
  },
  pricing: {
    type: {
      type: String,
      enum: ['free', 'paid', 'donation'],
      default: 'free'
    },
    amount: Number,
    currency: {
      type: String,
      default: 'USD'
    }
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'cancelled', 'completed'],
    default: 'published'
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  compatibilityData: {
    idealPersonalityTypes: [String],
    socialEnergyLevel: {
      type: Number,
      min: 0,
      max: 10,
      default: 5
    },
    groupSize: {
      type: String,
      enum: ['intimate', 'small', 'medium', 'large'],
      default: 'medium'
    }
  }
}, {
  timestamps: true
});

EventSchema.index({ 'dateTime.start': 1 });
EventSchema.index({ category: 1 });
EventSchema.index({ location: 1 });
EventSchema.index({ organizer: 1 });
EventSchema.index({ status: 1 });
EventSchema.index({ isPublic: 1 });

EventSchema.virtual('participantCount').get(function() {
  return this.participants.filter(p => p.status === 'joined').length;
});

EventSchema.virtual('isUpcoming').get(function() {
  return this.dateTime.start > new Date();
});

EventSchema.virtual('isActive').get(function() {
  const now = new Date();
  return now >= this.dateTime.start && now <= this.dateTime.end;
});

EventSchema.set('toJSON', { virtuals: true });
EventSchema.set('toObject', { virtuals: true });

export default mongoose.model('Event', EventSchema);