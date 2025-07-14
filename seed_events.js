import mongoose from 'mongoose';
import Event from './src/models/Event.js';
import User from './src/models/User.js';
import './src/config/environment.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/numina';

const sampleEvents = [
  {
    title: 'Morning Meditation Circle',
    description: 'Start your day with peaceful meditation and mindfulness practices',
    category: 'mindfulness',
    location: {
      address: '123 Zen Street',
      city: 'San Francisco',
      state: 'CA',
      virtual: false
    },
    dateTime: {
      start: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      end: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000) // +1 hour
    },
    tags: ['meditation', 'mindfulness', 'peace', 'morning'],
    emotionalContext: {
      targetMood: 'calming',
      moodBoostPotential: 8,
      requiredEnergyLevel: 'low'
    },
    compatibilityData: {
      idealPersonalityTypes: ['thoughtful', 'introspective'],
      socialEnergyLevel: 3,
      groupSize: 'small'
    },
    maxParticipants: 12
  },
  {
    title: 'Creative Art Workshop',
    description: 'Express yourself through painting and creative arts',
    category: 'creative',
    location: {
      address: '456 Artist Lane',
      city: 'Los Angeles',
      state: 'CA',
      virtual: false
    },
    dateTime: {
      start: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Day after tomorrow
      end: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000) // +3 hours
    },
    tags: ['art', 'creativity', 'expression', 'painting'],
    emotionalContext: {
      targetMood: 'inspiring',
      moodBoostPotential: 9,
      requiredEnergyLevel: 'medium'
    },
    compatibilityData: {
      idealPersonalityTypes: ['creative', 'expressive'],
      socialEnergyLevel: 6,
      groupSize: 'medium'
    },
    maxParticipants: 20
  },
  {
    title: 'Social Wellness Meetup',
    description: 'Connect with like-minded people focused on personal growth',
    category: 'social',
    location: {
      address: '789 Community Center',
      city: 'Seattle',
      state: 'WA',
      virtual: false
    },
    dateTime: {
      start: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      end: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000) // +2 hours
    },
    tags: ['social', 'networking', 'wellness', 'growth'],
    emotionalContext: {
      targetMood: 'social',
      moodBoostPotential: 7,
      requiredEnergyLevel: 'medium'
    },
    compatibilityData: {
      idealPersonalityTypes: ['social', 'growth-oriented'],
      socialEnergyLevel: 8,
      groupSize: 'medium'
    },
    maxParticipants: 30
  },
  {
    title: 'Virtual Fitness Challenge',
    description: 'Join an energizing online fitness session',
    category: 'fitness',
    location: {
      virtual: true,
      virtualLink: 'https://zoom.us/j/example'
    },
    dateTime: {
      start: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
      end: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000) // +1 hour
    },
    tags: ['fitness', 'energy', 'virtual', 'challenge'],
    emotionalContext: {
      targetMood: 'energizing',
      moodBoostPotential: 8,
      requiredEnergyLevel: 'high'
    },
    compatibilityData: {
      idealPersonalityTypes: ['energetic', 'goal-oriented'],
      socialEnergyLevel: 7,
      groupSize: 'large'
    },
    maxParticipants: 50
  },
  {
    title: 'Nature Photography Walk',
    description: 'Explore the outdoors while learning photography techniques',
    category: 'outdoor',
    location: {
      address: 'Golden Gate Park',
      city: 'San Francisco',
      state: 'CA',
      virtual: false
    },
    dateTime: {
      start: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000) // +3 hours
    },
    tags: ['photography', 'nature', 'outdoor', 'learning'],
    emotionalContext: {
      targetMood: 'reflective',
      moodBoostPotential: 7,
      requiredEnergyLevel: 'medium'
    },
    compatibilityData: {
      idealPersonalityTypes: ['artistic', 'nature-loving'],
      socialEnergyLevel: 5,
      groupSize: 'small'
    },
    maxParticipants: 15
  }
];

async function seedEvents() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find a test user to be the organizer (or create one)
    let testUser = await User.findOne({ email: 'test@example.com' });
    
    if (!testUser) {
      console.log('🔍 Creating test user for event organization...');
      testUser = new User({
        email: 'test@example.com',
        password: 'hashedpassword' // This would normally be hashed
      });
      await testUser.save();
    }
    
    // Clear existing events
    await Event.deleteMany({});
    console.log('🗑️ Cleared existing events');
    
    // Create events with the test user as organizer
    const eventsWithOrganizer = sampleEvents.map(event => ({
      ...event,
      organizer: testUser._id
    }));
    
    const createdEvents = await Event.insertMany(eventsWithOrganizer);
    console.log(`🎉 Created ${createdEvents.length} sample events`);
    
    // Display created events
    console.log('\n📅 Sample Events Created:');
    createdEvents.forEach((event, index) => {
      console.log(`${index + 1}. ${event.title} (${event.category})`);
      console.log(`   📅 ${event.dateTime.start.toDateString()}`);
      console.log(`   📍 ${event.location.virtual ? 'Virtual' : event.location.city + ', ' + event.location.state}`);
      console.log(`   🎯 Mood: ${event.emotionalContext.targetMood}`);
      console.log('');
    });
    
    console.log('✅ Event seeding complete!');
    
  } catch (error) {
    console.error('❌ Error seeding events:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedEvents();