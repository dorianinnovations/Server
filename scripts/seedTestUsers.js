import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from '../src/models/User.js';
import { env } from '../src/config/environment.js';

// Connect to MongoDB
mongoose.connect(env.MONGO_URI);

const testUsers = [
  {
    email: 'alice@example.com',
    password: 'password123',
    profile: new Map([
      ['name', 'Alice Chen'],
      ['bio', 'Tech enthusiast and yoga lover. Always looking for new adventures and meaningful connections.'],
      ['interests', 'technology, yoga, hiking, photography'],
      ['personality', 'creative, introspective, adventurous'],
      ['age', '28'],
      ['location', 'New York, NY']
    ]),
    emotionalLog: [
      {
        emotion: 'curious',
        intensity: 7,
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        context: 'Exploring new technologies'
      },
      {
        emotion: 'calm',
        intensity: 6,
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        context: 'Evening meditation session'
      }
    ],
    isVerified: true
  },
  {
    email: 'bob@example.com',
    password: 'password123',
    profile: new Map([
      ['name', 'Bob Martinez'],
      ['bio', 'Entrepreneur and fitness enthusiast. Love connecting with like-minded people and building community.'],
      ['interests', 'entrepreneurship, fitness, networking, cooking'],
      ['personality', 'ambitious, social, energetic'],
      ['age', '32'],
      ['location', 'Brooklyn, NY']
    ]),
    emotionalLog: [
      {
        emotion: 'motivated',
        intensity: 8,
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
        context: 'Working on startup pitch'
      },
      {
        emotion: 'social',
        intensity: 9,
        timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000), // 36 hours ago
        context: 'Networking event'
      }
    ],
    isVerified: true
  },
  {
    email: 'charlie@example.com',
    password: 'password123',
    profile: new Map([
      ['name', 'Charlie Wong'],
      ['bio', 'Artist and nature lover. Seeking creative inspiration and peaceful moments in a busy world.'],
      ['interests', 'art, nature, meditation, music'],
      ['personality', 'artistic, peaceful, intuitive'],
      ['age', '26'],
      ['location', 'Manhattan, NY']
    ]),
    emotionalLog: [
      {
        emotion: 'inspired',
        intensity: 7,
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        context: 'Working on new art piece'
      },
      {
        emotion: 'peaceful',
        intensity: 5,
        timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000), // 18 hours ago
        context: 'Morning walk in Central Park'
      }
    ],
    isVerified: true
  },
  {
    email: 'diana@example.com',
    password: 'password123',
    profile: new Map([
      ['name', 'Diana Park'],
      ['bio', 'Data scientist and wellness advocate. Passionate about using technology for good and mindful living.'],
      ['interests', 'data science, wellness, reading, travel'],
      ['personality', 'analytical, mindful, curious'],
      ['age', '29'],
      ['location', 'Queens, NY']
    ]),
    emotionalLog: [
      {
        emotion: 'focused',
        intensity: 8,
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        context: 'Deep work session'
      },
      {
        emotion: 'reflective',
        intensity: 6,
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        context: 'Evening journaling'
      }
    ],
    isVerified: true
  },
  {
    email: 'ethan@example.com',
    password: 'password123',
    profile: new Map([
      ['name', 'Ethan Rodriguez'],
      ['bio', 'Outdoor enthusiast and community organizer. Love bringing people together for adventures and social causes.'],
      ['interests', 'hiking, community, environment, photography'],
      ['personality', 'outgoing, leader, passionate'],
      ['age', '31'],
      ['location', 'Bronx, NY']
    ]),
    emotionalLog: [
      {
        emotion: 'energetic',
        intensity: 9,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        context: 'Planning weekend hike'
      },
      {
        emotion: 'satisfied',
        intensity: 8,
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
        context: 'Successful community event'
      }
    ],
    isVerified: true
  }
];

async function seedTestUsers() {
  try {
    console.log('👥 Seeding test users...');
    
    // Clear existing test users
    await User.deleteMany({ email: { $in: testUsers.map(u => u.email) } });
    console.log('✅ Cleared existing test users');
    
    // Hash passwords and create users
    const usersWithHashedPasswords = await Promise.all(
      testUsers.map(async (user) => {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        return {
          ...user,
          password: hashedPassword
        };
      })
    );
    
    // Create users
    const createdUsers = await User.insertMany(usersWithHashedPasswords);
    console.log(`✅ Created ${createdUsers.length} test users`);
    
    // Log the created users
    createdUsers.forEach((user, index) => {
      const name = user.profile.get('name') || 'Unknown';
      const personality = user.profile.get('personality') || 'Unknown';
      console.log(`${index + 1}. ${name} (${user.email}) - ${personality}`);
    });
    
    console.log('\n🎉 Test users seeded successfully!');
    console.log('🔗 Users available for compatibility matching via /api/cloud/compatibility/users');
    console.log('🔐 Password for all test users: password123');
    
  } catch (error) {
    console.error('❌ Error seeding test users:', error);
  } finally {
    mongoose.connection.close();
  }
}

seedTestUsers();