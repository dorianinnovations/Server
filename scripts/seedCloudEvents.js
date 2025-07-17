import mongoose from 'mongoose';
import Event from '../src/models/Event.js';
import User from '../src/models/User.js';
import { env } from '../src/config/environment.js';

// Connect to MongoDB
mongoose.connect(env.MONGO_URI);

const sampleEvents = [
  {
    title: "Mindful Morning Meditation",
    description: "Start your day with guided meditation and positive energy. Perfect for anxiety relief and mental clarity.",
    category: "mindfulness",
    location: {
      address: "Central Park, Bethesda Fountain",
      city: "New York",
      state: "NY",
      coordinates: { lat: 40.7829, lng: -73.9654 }
    },
    dateTime: {
      start: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      end: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // +1 hour
      timezone: "America/New_York"
    },
    maxParticipants: 15,
    tags: ["meditation", "mindfulness", "anxiety", "morning"],
    emotionalContext: {
      targetMood: "calming",
      moodBoostPotential: 8,
      requiredEnergyLevel: "low"
    },
    requirements: {
      experience: "beginner",
      equipment: ["yoga mat"]
    },
    pricing: { type: "free" },
    status: "published",
    isPublic: true,
    compatibilityData: {
      idealPersonalityTypes: ["introvert", "anxious", "stressed"],
      socialEnergyLevel: 3,
      groupSize: "small"
    }
  },
  {
    title: "Creative Coding Workshop",
    description: "Learn to create digital art with code! Build interactive visuals and animations using p5.js.",
    category: "creative",
    location: {
      address: "WeWork Dumbo Heights",
      city: "Brooklyn",
      state: "NY",
      coordinates: { lat: 40.7033, lng: -73.9899 }
    },
    dateTime: {
      start: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Day after tomorrow
      end: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000), // +3 hours
      timezone: "America/New_York"
    },
    maxParticipants: 20,
    tags: ["coding", "creative", "art", "technology", "learning"],
    emotionalContext: {
      targetMood: "inspiring",
      moodBoostPotential: 9,
      requiredEnergyLevel: "medium"
    },
    requirements: {
      experience: "beginner",
      equipment: ["laptop"]
    },
    pricing: { type: "paid", amount: 35, currency: "USD" },
    status: "published",
    isPublic: true,
    compatibilityData: {
      idealPersonalityTypes: ["creative", "curious", "analytical"],
      socialEnergyLevel: 6,
      groupSize: "medium"
    }
  },
  {
    title: "Hiking & Nature Photography",
    description: "Explore beautiful trails while learning photography techniques. Perfect for nature lovers and outdoor enthusiasts.",
    category: "outdoor",
    location: {
      address: "Bear Mountain State Park",
      city: "Bear Mountain",
      state: "NY",
      coordinates: { lat: 41.3186, lng: -73.9876 }
    },
    dateTime: {
      start: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // In 3 days
      end: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000), // +4 hours
      timezone: "America/New_York"
    },
    maxParticipants: 12,
    tags: ["hiking", "photography", "nature", "outdoor", "exercise"],
    emotionalContext: {
      targetMood: "energizing",
      moodBoostPotential: 8,
      requiredEnergyLevel: "high"
    },
    requirements: {
      experience: "intermediate",
      equipment: ["hiking boots", "camera", "water bottle"]
    },
    pricing: { type: "free" },
    status: "published",
    isPublic: true,
    compatibilityData: {
      idealPersonalityTypes: ["adventurous", "nature-lover", "active"],
      socialEnergyLevel: 7,
      groupSize: "small"
    }
  },
  {
    title: "Community Kitchen: Cooking for Connection",
    description: "Cook together, eat together, connect together. Learn new recipes while building meaningful relationships.",
    category: "social",
    location: {
      address: "Brooklyn Community Kitchen",
      city: "Brooklyn",
      state: "NY",
      coordinates: { lat: 40.6892, lng: -73.9442 }
    },
    dateTime: {
      start: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // In 4 days
      end: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 2.5 * 60 * 60 * 1000), // +2.5 hours
      timezone: "America/New_York"
    },
    maxParticipants: 16,
    tags: ["cooking", "social", "community", "food", "connection"],
    emotionalContext: {
      targetMood: "social",
      moodBoostPotential: 9,
      requiredEnergyLevel: "medium"
    },
    requirements: {
      experience: "all",
      equipment: ["apron"]
    },
    pricing: { type: "paid", amount: 25, currency: "USD" },
    status: "published",
    isPublic: true,
    compatibilityData: {
      idealPersonalityTypes: ["social", "collaborative", "foodie"],
      socialEnergyLevel: 8,
      groupSize: "medium"
    }
  },
  {
    title: "Startup Pitch Practice & Networking",
    description: "Practice your pitch with fellow entrepreneurs and get valuable feedback. Build your professional network.",
    category: "learning",
    location: {
      address: "TechStars NYC",
      city: "New York",
      state: "NY",
      coordinates: { lat: 40.7505, lng: -73.9934 }
    },
    dateTime: {
      start: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // In 5 days
      end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // +2 hours
      timezone: "America/New_York"
    },
    maxParticipants: 25,
    tags: ["startup", "entrepreneurship", "networking", "business", "pitch"],
    emotionalContext: {
      targetMood: "inspiring",
      moodBoostPotential: 7,
      requiredEnergyLevel: "high"
    },
    requirements: {
      experience: "intermediate",
      equipment: ["business cards", "laptop"]
    },
    pricing: { type: "free" },
    status: "published",
    isPublic: true,
    compatibilityData: {
      idealPersonalityTypes: ["ambitious", "networker", "entrepreneur"],
      socialEnergyLevel: 9,
      groupSize: "large"
    }
  },
  {
    title: "Evening Yoga & Sound Bath",
    description: "Unwind with gentle yoga followed by a relaxing sound bath. Perfect for stress relief and inner peace.",
    category: "wellness",
    location: {
      address: "Yoga to the People",
      city: "New York",
      state: "NY",
      coordinates: { lat: 40.7282, lng: -73.9942 }
    },
    dateTime: {
      start: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // In 6 days
      end: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000 + 1.5 * 60 * 60 * 1000), // +1.5 hours
      timezone: "America/New_York"
    },
    maxParticipants: 20,
    tags: ["yoga", "sound bath", "relaxation", "wellness", "stress relief"],
    emotionalContext: {
      targetMood: "calming",
      moodBoostPotential: 8,
      requiredEnergyLevel: "low"
    },
    requirements: {
      experience: "beginner",
      equipment: ["yoga mat"]
    },
    pricing: { type: "donation", amount: 15, currency: "USD" },
    status: "published",
    isPublic: true,
    compatibilityData: {
      idealPersonalityTypes: ["stressed", "wellness-focused", "spiritual"],
      socialEnergyLevel: 4,
      groupSize: "medium"
    }
  }
];

async function seedEvents() {
  try {
    console.log('🌱 Seeding cloud events...');
    
    // Clear existing events
    await Event.deleteMany({});
    console.log('✅ Cleared existing events');
    
    // Find a user to be the organizer (or create one)
    let organizer = await User.findOne({ email: { $exists: true } });
    if (!organizer) {
      organizer = await User.create({
        email: 'organizer@numina.com',
        profile: {
          name: 'Event Organizer',
          bio: 'Community event organizer passionate about bringing people together'
        },
        isVerified: true
      });
      console.log('✅ Created organizer user');
    }
    
    // Add organizer to all events
    const eventsWithOrganizer = sampleEvents.map(event => ({
      ...event,
      organizer: organizer._id
    }));
    
    // Create events
    const createdEvents = await Event.insertMany(eventsWithOrganizer);
    console.log(`✅ Created ${createdEvents.length} events`);
    
    // Log the created events
    createdEvents.forEach((event, index) => {
      console.log(`${index + 1}. ${event.title} - ${event.category} - ${event.dateTime.start.toDateString()}`);
    });
    
    console.log('\n🎉 Cloud events seeded successfully!');
    console.log('🔗 Events are now available at /api/cloud/events');
    
  } catch (error) {
    console.error('❌ Error seeding events:', error);
  } finally {
    mongoose.connection.close();
  }
}

seedEvents();