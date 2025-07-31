import mongoose from 'mongoose';
import UserBehaviorProfile from '../models/UserBehaviorProfile.js';

/**
 * Clean, modular service for behavioral metrics
 * Focuses on concrete data for mobile visualization
 */

/**
 * Get comprehensive behavioral metrics for a user
 * @param {string} userId - User ID
 * @returns {Object} Structured metrics for mobile visualization
 */
export async function getBehaviorMetrics(userId) {
  // Connect to test collection (production data)
  const testUri = process.env.MONGO_URI.replace('/numina', '/test');
  
  // Create separate connection for test database
  const testConnection = await mongoose.createConnection(testUri);
  const TestUserBehaviorProfile = testConnection.model('UserBehaviorProfile', UserBehaviorProfile.schema);
  
  try {
    const profile = await TestUserBehaviorProfile.findOne({ userId });
    
    if (!profile) {
      return getEmptyMetrics();
    }

    const metrics = {
      // Communication Profile (Bar Chart Ready)
      communicationProfile: buildCommunicationProfile(profile),
      
      // Emotional Patterns (Confidence Bars)
      emotionalPatterns: buildEmotionalPatterns(profile),
      
      // Temporal Activity (Time-based Charts)
      temporalPatterns: buildTemporalPatterns(profile),
      
      // Data Quality Rings
      dataQuality: buildDataQuality(profile),
      
      // Response Analysis (Text Metrics)
      responseAnalysis: buildResponseAnalysis(profile),
      
      // Confidence Scores (Progress Bars)
      confidenceScores: buildConfidenceScores(profile),
      
      // Pattern Trends (Line Chart Data)
      patternTrends: buildPatternTrends(profile),
      
      // Profile Completeness
      profileMetrics: buildProfileMetrics(profile)
    };

    return metrics;

  } finally {
    await testConnection.close();
  }
}

/**
 * Build communication profile for bar charts
 */
function buildCommunicationProfile(profile) {
  const comm = profile.communicationStyle || {};
  
  return {
    // Bar chart data
    styleMetrics: [
      { label: 'Tone', value: comm.preferredTone || 'analyzing', score: comm.preferredTone ? 100 : 0 },
      { label: 'Length', value: comm.responseLength || 'analyzing', score: comm.responseLength ? 100 : 0 },
      { label: 'Complexity', value: comm.complexityLevel || 'analyzing', score: comm.complexityLevel ? 100 : 0 }
    ],
    
    // Summary stats
    summary: {
      primaryStyle: `${comm.preferredTone || 'Adaptive'} & ${comm.responseLength || 'Balanced'}`,
      confidence: comm.preferredTone ? 100 : 0,
      lastUpdated: comm.updatedAt || profile.updatedAt
    }
  };
}

/**
 * Build emotional patterns for confidence visualization
 */
function buildEmotionalPatterns(profile) {
  const patterns = profile.behaviorPatterns?.filter(p => p.type === 'emotional') || [];
  
  return {
    // Confidence bar data
    patternBars: patterns.map(pattern => ({
      emotion: pattern.pattern.replace('_response', '').replace('_', ' '),
      confidence: Math.round(pattern.confidence * 100),
      frequency: pattern.frequency || 1,
      color: getEmotionColor(pattern.pattern),
      lastSeen: pattern.lastObserved
    })).sort((a, b) => b.confidence - a.confidence),
    
    // Summary metrics
    summary: {
      totalPatterns: patterns.length,
      dominantEmotion: patterns.length > 0 ? patterns[0].pattern.replace('_response', '') : 'analyzing',
      averageConfidence: patterns.length > 0 ? 
        Math.round(patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length * 100) : 0
    }
  };
}

/**
 * Build temporal patterns for time-based charts
 */
function buildTemporalPatterns(profile) {
  const temporal = profile.temporalPatterns || {};
  
  return {
    // Peak hours bar chart
    activityHours: Array.from({ length: 24 }, (_, hour) => ({
      hour: hour,
      displayHour: hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`,
      activity: temporal.mostActiveHours?.includes(hour) ? 100 : 0,
      isPeak: temporal.mostActiveHours?.includes(hour) || false
    })),
    
    // Weekly pattern
    weeklyPattern: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({
      day,
      activity: temporal.mostActiveDays?.some(d => d.toLowerCase().startsWith(day.toLowerCase())) ? 100 : 20,
      isPeak: temporal.mostActiveDays?.some(d => d.toLowerCase().startsWith(day.toLowerCase())) || false
    })),
    
    // Summary
    summary: {
      peakHour: temporal.mostActiveHours?.[0] ? 
        (temporal.mostActiveHours[0] === 0 ? '12am' : 
         temporal.mostActiveHours[0] < 12 ? `${temporal.mostActiveHours[0]}am` : 
         temporal.mostActiveHours[0] === 12 ? '12pm' : 
         `${temporal.mostActiveHours[0] - 12}pm`) : 'analyzing',
      peakDay: temporal.mostActiveDays?.[0] || 'analyzing',
      consistency: temporal.mostActiveHours?.length > 0 ? 85 : 0
    }
  };
}

/**
 * Build data quality metrics for ring charts
 */
function buildDataQuality(profile) {
  const quality = profile.dataQuality || {};
  
  return {
    // Ring chart data
    qualityRings: [
      {
        metric: 'Completeness',
        value: Math.round((quality.completeness || 0) * 100),
        color: '#4CAF50',
        description: 'Profile data coverage'
      },
      {
        metric: 'Freshness',
        value: Math.round((quality.freshness || 0) * 100),
        color: '#2196F3',
        description: 'Data recency'
      },
      {
        metric: 'Sample Size',
        value: Math.min(100, (quality.sampleSize || 0) * 10), // Scale to 100
        color: '#FF9800',
        description: 'Interaction volume'
      }
    ],
    
    // Overall score
    overallScore: Math.round(((quality.completeness || 0) + (quality.freshness || 0)) / 2 * 100),
    sampleCount: quality.sampleSize || 0
  };
}

/**
 * Build response analysis metrics
 */
function buildResponseAnalysis(profile) {
  return {
    metrics: [
      { label: 'Profile Completeness', value: `${Math.round((profile.dataQuality?.completeness || 0) * 100)}%` },
      { label: 'Patterns Identified', value: `${profile.behaviorPatterns?.length || 0}` },
      { label: 'Data Points', value: `${profile.dataQuality?.sampleSize || 0} interactions` },
      { label: 'Last Analysis', value: formatTimeAgo(profile.updatedAt) }
    ]
  };
}

/**
 * Build confidence scores for progress bars
 */
function buildConfidenceScores(profile) {
  const patterns = profile.behaviorPatterns || [];
  
  return {
    scores: patterns.map(pattern => ({
      category: pattern.type,
      pattern: pattern.pattern.replace('_', ' '),
      confidence: Math.round(pattern.confidence * 100),
      color: getPatternColor(pattern.type)
    })).sort((a, b) => b.confidence - a.confidence),
    
    averageConfidence: patterns.length > 0 ? 
      Math.round(patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length * 100) : 0
  };
}

/**
 * Build pattern trends (placeholder for future time-series data)
 */
function buildPatternTrends(profile) {
  return {
    trends: [],
    message: 'Trend analysis available after 2+ weeks of data'
  };
}

/**
 * Build profile completion metrics
 */
function buildProfileMetrics(profile) {
  return {
    completionPercentage: Math.round((profile.dataQuality?.completeness || 0) * 100),
    nextMilestone: getNextMilestone(profile.dataQuality?.completeness || 0),
    totalSections: 8,
    completedSections: Math.round((profile.dataQuality?.completeness || 0) * 8)
  };
}

/**
 * Helper functions
 */
function getEmptyMetrics() {
  return {
    communicationProfile: { styleMetrics: [], summary: { primaryStyle: 'Building profile...', confidence: 0 } },
    emotionalPatterns: { patternBars: [], summary: { totalPatterns: 0, dominantEmotion: 'analyzing', averageConfidence: 0 } },
    temporalPatterns: { activityHours: [], weeklyPattern: [], summary: { peakHour: 'analyzing', peakDay: 'analyzing', consistency: 0 } },
    dataQuality: { qualityRings: [], overallScore: 0, sampleCount: 0 },
    responseAnalysis: { metrics: [] },
    confidenceScores: { scores: [], averageConfidence: 0 },
    patternTrends: { trends: [], message: 'Need more interactions to show trends' },
    profileMetrics: { completionPercentage: 0, nextMilestone: 'Start chatting to build profile', totalSections: 8, completedSections: 0 }
  };
}

function getEmotionColor(emotion) {
  const colors = {
    neutral_response: '#9E9E9E',
    happy_response: '#4CAF50',
    sad_response: '#2196F3',
    angry_response: '#F44336',
    excited_response: '#FF9800'
  };
  return colors[emotion] || '#6B7280';
}

function getPatternColor(type) {
  const colors = {
    emotional: '#EC4899',
    communication: '#6366F1',
    temporal: '#10B981',
    contextual: '#F59E0B'
  };
  return colors[type] || '#6B7280';
}

function formatTimeAgo(date) {
  if (!date) return 'Never';
  const now = new Date();
  const diff = now - new Date(date);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return 'Just now';
}

function getNextMilestone(completeness) {
  if (completeness < 0.25) return 'Reach 25% profile completion';
  if (completeness < 0.5) return 'Reach 50% profile completion';
  if (completeness < 0.75) return 'Reach 75% profile completion';
  return 'Profile mastery achieved!';
}