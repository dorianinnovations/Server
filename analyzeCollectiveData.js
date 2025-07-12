import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from './src/models/User.js';
import CollectiveDataConsent from './src/models/CollectiveDataConsent.js';
import collectiveDataService from './src/services/collectiveDataService.js';
import snapshotAnalysisService from './src/services/snapshotAnalysisService.js';

async function main() {
  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const users = [
    new User({
      email: 'alice@example.com',
      password: 'password1',
      emotionalLog: [
        { emotion: 'happy', intensity: 8, context: 'won a prize', timestamp: new Date() },
        { emotion: 'sad', intensity: 3, context: 'missed train', timestamp: new Date(Date.now() - 86400000) }
      ]
    }),
    new User({
      email: 'bob@example.com',
      password: 'password2',
      emotionalLog: [
        { emotion: 'joy', intensity: 7, context: 'sunny day', timestamp: new Date() },
        { emotion: 'fear', intensity: 4, context: 'spider', timestamp: new Date() }
      ]
    })
  ];

  for (const user of users) {
    await user.save();
    await new CollectiveDataConsent({
      userId: user._id,
      consentStatus: 'granted',
      dataTypes: { emotions: true, intensity: true, context: true }
    }).save();
  }

  const data = await collectiveDataService.getAggregatedEmotionalData({
    timeRange: '30d',
    groupBy: 'day',
    includeIntensity: true,
    includeContext: true,
    minConsentCount: 1
  });

  console.log('Aggregated Emotional Data:\n', JSON.stringify(data, null, 2));

  const snapshotResult = await snapshotAnalysisService.generateSnapshot('30d');
  console.log('\nSnapshot Analysis:\n', JSON.stringify(snapshotResult, null, 2));

  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
}

main().catch(err => {
  console.error('Error running analysis:', err);
  process.exit(1);
});
