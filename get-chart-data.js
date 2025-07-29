#!/usr/bin/env node

/**
 * Create aggregation queries for insights page chart data
 */

import mongoose from 'mongoose';
import UserBehaviorProfile from './src/models/UserBehaviorProfile.js';
import User from './src/models/User.js';
import AnalyticsInsight from './src/models/AnalyticsInsight.js';
import Conversation from './src/models/Conversation.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dorianinnovations:BFogj1Par1QzmSyy@numinacluster.li7o6uc.mongodb.net/numina?retryWrites=true&w=majority&appName=NuminaCluster';

async function getChartData() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('📊 Generating Chart Data from Real MongoDB...\n');

    // 1. BEHAVIORAL PATTERNS BREAKDOWN (For pie/donut chart)
    console.log('🧠 BEHAVIORAL PATTERNS DISTRIBUTION:');
    const patternDistribution = await UserBehaviorProfile.aggregate([
      { $unwind: '$behaviorPatterns' },
      {
        $group: {
          _id: '$behaviorPatterns.pattern',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$behaviorPatterns.confidence' },
          totalFrequency: { $sum: '$behaviorPatterns.frequency' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    patternDistribution.forEach(pattern => {
      console.log(`   ${pattern._id}: ${pattern.count} users, ${(pattern.avgConfidence * 100).toFixed(1)}% confidence, ${pattern.totalFrequency} total occurrences`);
    });

    // 2. COMMUNICATION STYLES (For bar chart)
    console.log('\n💬 COMMUNICATION STYLES:');
    const commStyles = await UserBehaviorProfile.aggregate([
      { $match: { 'communicationStyle.preferredTone': { $exists: true } } },
      {
        $group: {
          _id: '$communicationStyle.preferredTone',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    commStyles.forEach(style => {
      console.log(`   ${style._id}: ${style.count} users`);
    });

    // 3. TEMPORAL ACTIVITY PATTERNS (For line chart)
    console.log('\n⏰ TEMPORAL PATTERNS BY CONFIDENCE:');
    const temporalPatterns = await UserBehaviorProfile.aggregate([
      { $unwind: '$behaviorPatterns' },
      { $match: { 'behaviorPatterns.type': 'temporal' } },
      {
        $group: {
          _id: {
            pattern: '$behaviorPatterns.pattern',
            month: { $dateToString: { format: "%Y-%m", date: '$behaviorPatterns.lastObserved' } }
          },
          avgConfidence: { $avg: '$behaviorPatterns.confidence' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.month': 1 } }
    ]);

    temporalPatterns.forEach(temp => {
      console.log(`   ${temp._id.pattern} (${temp._id.month}): ${temp.count} users, ${(temp.avgConfidence * 100).toFixed(1)}% confidence`);
    });

    // 4. USER ENGAGEMENT METRICS (For progress bars)
    console.log('\n📈 USER ENGAGEMENT METRICS:');
    const engagementMetrics = await UserBehaviorProfile.aggregate([
      {
        $project: {
          userId: 1,
          patternCount: { $size: { $ifNull: ['$behaviorPatterns', []] } },
          avgConfidence: { $avg: '$behaviorPatterns.confidence' },
          hasComm: { $cond: [{ $ifNull: ['$communicationStyle', false] }, 1, 0] }
        }
      },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          avgPatterns: { $avg: '$patternCount' },
          avgConfidence: { $avg: '$avgConfidence' },
          withCommStyle: { $sum: '$hasComm' }
        }
      }
    ]);

    if (engagementMetrics[0]) {
      const metrics = engagementMetrics[0];
      console.log(`   Total Analyzed Users: ${metrics.totalUsers}`);
      console.log(`   Avg Patterns per User: ${metrics.avgPatterns.toFixed(1)}`);
      console.log(`   Avg Overall Confidence: ${(metrics.avgConfidence * 100).toFixed(1)}%`);
      console.log(`   Users with Communication Style: ${metrics.withCommStyle} (${(metrics.withCommStyle/metrics.totalUsers*100).toFixed(1)}%)`);
    }

    // 5. INSIGHTS CONFIDENCE OVER TIME (For area chart)
    console.log('\n🎯 ANALYTICS INSIGHTS OVER TIME:');
    const insightsByTime = await AnalyticsInsight.aggregate([
      {
        $group: {
          _id: {
            category: '$category',
            month: { $dateToString: { format: "%Y-%m", date: '$generatedAt' } }
          },
          count: { $sum: 1 },
          avgConfidence: { $avg: '$confidence' },
          avgDataPoints: { $avg: '$dataPoints' }
        }
      },
      { $sort: { '_id.month': 1, '_id.category': 1 } }
    ]);

    insightsByTime.forEach(insight => {
      console.log(`   ${insight._id.category} (${insight._id.month}): ${insight.count} insights, ${(insight.avgConfidence * 100).toFixed(1)}% confidence, ${insight.avgDataPoints.toFixed(0)} avg data points`);
    });

    // 6. CONVERSATION ACTIVITY (For sparkline/mini charts)
    console.log('\n💬 CONVERSATION PATTERNS:');
    const convActivity = await Conversation.aggregate([
      {
        $project: {
          userId: 1,
          messageCount: { $size: { $ifNull: ['$messages', []] } },
          lastActive: '$updatedAt'
        }
      },
      {
        $group: {
          _id: null,
          totalConversations: { $sum: 1 },
          totalMessages: { $sum: '$messageCount' },
          avgMessagesPerConv: { $avg: '$messageCount' }
        }
      }
    ]);

    if (convActivity[0]) {
      const conv = convActivity[0];
      console.log(`   Total Conversations: ${conv.totalConversations}`);
      console.log(`   Total Messages: ${conv.totalMessages}`);
      console.log(`   Avg Messages per Conversation: ${conv.avgMessagesPerConv.toFixed(1)}`);
    }

    // 7. GENERATE CHART-READY JSON
    console.log('\n📊 CHART-READY DATA STRUCTURES:');
    
    // Emotional Trends (7-day mock based on real patterns)
    const emotionalTrends = patternDistribution
      .filter(p => p._id.includes('response') || p._id.includes('emotional'))
      .slice(0, 7)
      .map((pattern, index) => ({
        label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index],
        value: Math.round(pattern.avgConfidence * 100)
      }));

    console.log('\n   Emotional Trends Data:');
    console.log(JSON.stringify(emotionalTrends, null, 2));

    // Growth Areas (based on communication patterns)
    const growthAreas = patternDistribution
      .filter(p => p._id.includes('learner') || p._id.includes('communicator') || p._id.includes('active'))
      .slice(0, 4)
      .map(pattern => ({
        label: pattern._id.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: Math.round(pattern.avgConfidence * 100),
        color: ['#10B981', '#F59E0B', '#3B82F6', '#8B5CF6'][Math.floor(Math.random() * 4)]
      }));

    console.log('\n   Growth Areas Data:');
    console.log(JSON.stringify(growthAreas, null, 2));

    // Weekly Activity (based on pattern frequency)
    const weeklyActivity = patternDistribution.slice(0, 4).map(pattern => ({
      label: pattern._id.split('_')[0].charAt(0).toUpperCase() + pattern._id.split('_')[0].slice(1),
      value: Math.min(pattern.totalFrequency, 100), // Cap at 100 for chart scaling
      color: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'][Math.floor(Math.random() * 4)]
    }));

    console.log('\n   Weekly Activity Data:');
    console.log(JSON.stringify(weeklyActivity, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

getChartData().catch(console.error);