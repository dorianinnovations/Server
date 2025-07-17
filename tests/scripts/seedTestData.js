import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from '../src/models/User.js';
import ShortTermMemory from '../src/models/ShortTermMemory.js';
import dotenv from 'dotenv';

dotenv.config();

const emotions = [
  'happy',
  'excited',
  'grateful',
  'content',
  'optimistic',
  'peaceful',
  'sad',
  'anxious',
  'frustrated',
  'overwhelmed',
  'tired',
  'lonely',
  'neutral',
  'curious',
  'motivated',
  'confident',
  'relaxed',
  'energetic'
];

const conversationStarters = [
  'How are you feeling today?',
  "What's on your mind?",
  'Tell me about your day',
  'How can I help you?',
  "What's been challenging lately?",
  'What made you smile today?',
  'How are you managing stress?',
  'What are you grateful for?',
  'What goals are you working on?',
  "How's your energy level?"
];

const userResponses = [
  "I'm feeling pretty good today, thanks for asking",
  'Had a challenging morning but things are improving',
  "Work has been stressful but I'm managing",
  "Really excited about a new project I'm starting",
  'Feeling a bit overwhelmed with everything going on',
  'Had a great conversation with a friend earlier',
  'Trying to focus on the positive things in my life',
  "Been practicing meditation and it's helping",
  'Looking forward to the weekend',
  'Grateful for the support from people around me'
];

const aiResponses = [
  "It's wonderful to hear you're feeling good today. That positive energy can really influence how we approach challenges and opportunities.",
  'I hear that things started rough but are turning around. Sometimes those difficult mornings can actually help us appreciate when things improve.',
  "Work stress is so common, and it sounds like you're handling it with awareness. What strategies have been most helpful for you?",
  "There's something energizing about starting new projects! That excitement often carries us through the initial challenges.",
  'Feeling overwhelmed is completely understandable when life gets busy. Breaking things down into smaller pieces can sometimes help.',
  'Good conversations with friends can be such a source of strength. Human connection really matters for our wellbeing.',
  "Focusing on positives is a powerful practice. It doesn't mean ignoring difficulties, but rather choosing where to direct your mental energy.",
  'Meditation can be such a valuable tool for managing stress and building resilience. How long have you been practicing?',
  'Having something to look forward to can really lift our spirits. Weekends offer that natural pause and reset opportunity.',
  'Gratitude is one of the most powerful emotions for wellbeing. Recognizing support systems shows real emotional awareness.'
];

async function createTestUsers() {
  console.log('🧪 Creating test users...');

  const testUsers = [];
  const hashedPassword = await bcrypt.hash('testpass123', 12);

  for (let i = 1; i <= 5; i++) {
    const user = new User({
      email: `testuser${i}@example.com`,
      password: hashedPassword,
      profile: new Map([
        ['name', `Test User ${i}`],
        ['age', Math.floor(Math.random() * 40) + 20],
        [
          'location',
          ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'][
            Math.floor(Math.random() * 5)
          ]
        ],
        [
          'interests',
          ['meditation', 'fitness', 'reading', 'music', 'travel']
            .slice(0, Math.floor(Math.random() * 3) + 1)
            .join(', ')
        ]
      ]),
      emotionalLog: []
    });

    // Generate 2-4 weeks of emotional data
    const now = new Date();
    const daysBack = Math.floor(Math.random() * 14) + 14; // 14-28 days

    for (let day = daysBack; day >= 0; day--) {
      const logsPerDay = Math.floor(Math.random() * 3) + 1; // 1-3 logs per day

      for (let log = 0; log < logsPerDay; log++) {
        const logDate = new Date(
          now.getTime() - day * 24 * 60 * 60 * 1000 + log * 8 * 60 * 60 * 1000
        );
        const emotion = emotions[Math.floor(Math.random() * emotions.length)];

        user.emotionalLog.push({
          emotion,
          intensity: Math.floor(Math.random() * 10) + 1,
          context: `Feeling ${emotion} during daily activities`,
          timestamp: logDate
        });
      }
    }

    testUsers.push(user);
  }

  await User.insertMany(testUsers);
  console.log(`✅ Created ${testUsers.length} test users with emotional history`);
  return testUsers;
}

async function createTestConversations(users) {
  console.log('💬 Creating test conversations...');

  for (const user of users) {
    const conversationsCount = Math.floor(Math.random() * 10) + 5; // 5-15 conversations

    for (let conv = 0; conv < conversationsCount; conv++) {
      const conversationId = `conv_${user._id}_${conv}`;
      const messagesCount = Math.floor(Math.random() * 6) + 2; // 2-8 messages per conversation

      const conversationDate = new Date(
        Date.now() - Math.floor(Math.random() * 14 * 24 * 60 * 60 * 1000) // Random within last 2 weeks
      );

      for (let msg = 0; msg < messagesCount; msg++) {
        const isUserMessage = msg % 2 === 0;
        const messageDate = new Date(conversationDate.getTime() + msg * 2 * 60 * 1000); // 2 min between messages

        const memory = new ShortTermMemory({
          userId: user._id,
          role: isUserMessage ? 'user' : 'assistant',
          content: isUserMessage
            ? msg === 0
              ? conversationStarters[Math.floor(Math.random() * conversationStarters.length)]
              : userResponses[Math.floor(Math.random() * userResponses.length)]
            : aiResponses[Math.floor(Math.random() * aiResponses.length)],
          conversationId,
          timestamp: messageDate
        });

        await memory.save();
      }
    }
  }

  console.log(`✅ Created conversation history for ${users.length} users`);
}

async function testEndpoints() {
  console.log('🧪 Testing endpoints with generated data...');

  const users = await User.find().limit(2);

  for (const user of users) {
    console.log(`\n📊 Testing for user: ${user.email}`);

    // Test growth summary
    try {
      const response = await fetch(
        'http://localhost:5000/personal-insights/growth-summary?timeframe=week',
        {
          headers: {
            Authorization: `Bearer ${generateTestToken(user._id)}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log(
          `✅ Growth Summary: ${data.data.metrics.emotionalLogs} logs, ${data.data.metrics.positivityRatio}% positive`
        );
      } else {
        console.log(`❌ Growth Summary failed: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Growth Summary error: ${error.message}`);
    }

    // Test milestones
    try {
      const response = await fetch('http://localhost:5000/personal-insights/milestones', {
        headers: {
          Authorization: `Bearer ${generateTestToken(user._id)}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const achieved = data.data.milestones.filter(m => m.achieved).length;
        console.log(`✅ Milestones: ${achieved}/${data.data.milestones.length} achieved`);
      } else {
        console.log(`❌ Milestones failed: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Milestones error: ${error.message}`);
    }
  }
}

function generateTestToken(userId) {
  // Simplified token for testing - replace with actual JWT logic in production
  return Buffer.from(JSON.stringify({ userId: userId.toString() })).toString('base64');
}

async function main() {
  try {
    console.log('🚀 Starting test data generation...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing test data
    console.log('🧹 Clearing existing test data...');
    await User.deleteMany({ email: /testuser\d+@example\.com/ });
    await ShortTermMemory.deleteMany({});

    // Create test data
    const users = await createTestUsers();
    await createTestConversations(users);

    console.log('\n🎉 Test data generation complete!');
    console.log('\nTest users created:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} - ${user.emotionalLog.length} emotional logs`);
    });

    console.log('\n📝 You can now test with these credentials:');
    console.log('Email: testuser1@example.com');
    console.log('Password: testpass123');

    // Test endpoints if server is running
    console.log('\n🧪 Testing endpoints (make sure server is running on port 5000)...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a second

    await testEndpoints();
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

main();
