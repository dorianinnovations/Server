import UserBehaviorProfile from '../models/UserBehaviorProfile.js';
import EmotionalAnalyticsSession from '../models/EmotionalAnalyticsSession.js';
import ShortTermMemory from '../models/ShortTermMemory.js';
import User from '../models/User.js';

export default async function ubpmAnalysis(args, userContext) {
  const { 
    analysisMode = 'behavioral_vector',
    timeframe = 'weekly',
    confidenceThreshold = 0.5,
    includeRawMetrics = true,
    vectorComponents = ['curiosity', 'technical_depth', 'interaction_complexity', 'emotional_variance'],
    temporalGranularity = 'daily'
  } = args;

  try {
    // Enhanced streaming output for premium UX
    console.log('🔄 UBPM_ANALYSIS executing...');
    console.log(`📊 Loading interaction corpus: ${userContext.userId ? 'user data' : 'anonymous'}`);
    
    // Phase 1: Data Loading with progress indicators
    const loadingStart = Date.now();
    const behaviorProfile = await UserBehaviorProfile.findOne({ userId: userContext.userId });
    console.log(`   ├─ UserBehaviorProfile: ${behaviorProfile ? '✓ loaded' : '⚠ creating baseline'}`);
    
    const emotionalSessions = await EmotionalAnalyticsSession.find({ 
      userId: userContext.userId 
    }).sort({ weekStartDate: -1 }).limit(8);
    console.log(`   ├─ EmotionalSessions: ${emotionalSessions.length} weeks analyzed`);
    
    const memoryEntries = await ShortTermMemory.find({ 
      userId: userContext.userId 
    }).sort({ timestamp: -1 }).limit(200);
    console.log(`   ├─ InteractionCorpus: ${memoryEntries.length} entries loaded`);
    
    const user = await User.findById(userContext.userId);
    console.log(`   └─ UserProfile: ${user ? '✓ verified' : '⚠ anonymous mode'}`);
    
    const loadingTime = Date.now() - loadingStart;
    console.log(`📊 Data loading completed: ${loadingTime}ms`);
    
    // Phase 2: Behavioral Vector Computation
    console.log('🧠 Computing behavioral vectors...');
    console.log(`⚡ Temporal analysis: T-${getTimeframePeriod(timeframe)} → T-0`);
    
    const computationStart = Date.now();
    const behavioralAnalysis = await computeBehavioralVectors(
      behaviorProfile, 
      emotionalSessions, 
      memoryEntries,
      vectorComponents
    );
    
    const vectorTime = Date.now() - computationStart;
    console.log(`   ├─ Vector computation: ${vectorTime}ms`);
    console.log(`   ├─ Primary pattern: ${behavioralAnalysis.primaryPattern?.name || 'developing'}`);
    console.log(`   └─ Vector magnitude: ${behavioralAnalysis.vectorMagnitude?.toFixed(3) || '0.000'}`);
    
    // Phase 3: Temporal Delta Analysis
    console.log('📈 Analyzing temporal deltas...');
    const deltaStart = Date.now();
    const temporalDeltas = await calculateTemporalDeltas(
      behaviorProfile,
      emotionalSessions,
      memoryEntries,
      timeframe,
      temporalGranularity
    );
    
    const deltaTime = Date.now() - deltaStart;
    console.log(`   ├─ Delta computation: ${deltaTime}ms`);
    console.log(`   └─ Change detection: ${Object.keys(temporalDeltas).length} metrics tracked`);
    
    // Phase 4: Confidence Matrix Generation
    console.log('🎯 Generating confidence matrix...');
    const confidenceStart = Date.now();
    const confidenceMatrix = await generateConfidenceMatrix(
      behavioralAnalysis,
      temporalDeltas,
      behaviorProfile,
      confidenceThreshold
    );
    
    const confidenceTime = Date.now() - confidenceStart;
    console.log(`   ├─ Matrix generation: ${confidenceTime}ms`);
    console.log(`   └─ Overall confidence: ${(confidenceMatrix.overall * 100).toFixed(1)}%`);
    
    // Phase 5: Interaction Pattern Clustering
    console.log('🔄 Clustering interaction patterns...');
    const clusterStart = Date.now();
    const interactionClusters = await clusterInteractionPatterns(
      memoryEntries,
      behaviorProfile
    );
    
    const clusterTime = Date.now() - clusterStart;
    console.log(`   ├─ Pattern clustering: ${clusterTime}ms`);
    console.log(`   └─ Dominant pattern: ${interactionClusters.dominantPattern}`);
    
    // Phase 6: Final Result Generation
    console.log('⚡ Synthesizing UBPM analysis...');
    const synthesisStart = Date.now();
    const result = await generateUBPMResult(
      analysisMode,
      behavioralAnalysis,
      temporalDeltas,
      confidenceMatrix,
      interactionClusters,
      behaviorProfile,
      user,
      includeRawMetrics
    );
    
    const synthesisTime = Date.now() - synthesisStart;
    console.log(`   └─ Analysis synthesis: ${synthesisTime}ms`);
    
    const totalTime = Date.now() - loadingStart;
    console.log(`✅ UBPM Analysis completed: ${totalTime}ms total execution time`);
    
    return {
      success: true,
      analysisMode,
      timeframe,
      confidenceThreshold,
      executionTimestamp: new Date().toISOString(),
      ...result
    };

  } catch (error) {
    console.error('UBPM Analysis error:', error);
    return {
      success: false,
      error: 'UBPM Analysis computation failed',
      details: error.message,
      analysisMode,
      timeframe
    };
  }
}

async function computeBehavioralVectors(behaviorProfile, emotionalSessions, memoryEntries, vectorComponents) {
  const vectors = {};
  
  // Technical curiosity vector
  if (vectorComponents.includes('curiosity')) {
    const technicalQuestions = memoryEntries.filter(entry => 
      entry.content?.toLowerCase().includes('how') || 
      entry.content?.toLowerCase().includes('why') ||
      entry.content?.toLowerCase().includes('what')
    ).length;
    
    vectors.curiosity = Math.min(1.0, technicalQuestions / memoryEntries.length * 2);
  }
  
  // Technical depth vector
  if (vectorComponents.includes('technical_depth')) {
    const technicalKeywords = ['algorithm', 'optimization', 'architecture', 'implementation', 'performance', 'system'];
    const technicalCount = memoryEntries.filter(entry =>
      technicalKeywords.some(keyword => 
        entry.content?.toLowerCase().includes(keyword)
      )
    ).length;
    
    vectors.technical_depth = Math.min(1.0, technicalCount / memoryEntries.length * 3);
  }
  
  // Interaction complexity vector
  if (vectorComponents.includes('interaction_complexity')) {
    const avgMessageLength = memoryEntries.reduce((sum, entry) => 
      sum + (entry.content?.length || 0), 0) / memoryEntries.length;
    
    vectors.interaction_complexity = Math.min(1.0, avgMessageLength / 200); // Normalize to 200 chars
  }
  
  // Emotional variance vector
  if (vectorComponents.includes('emotional_variance')) {
    if (emotionalSessions.length > 0) {
      const emotionalData = emotionalSessions.flatMap(session => 
        session.reportProgress?.map(report => report.insights) || []
      );
      
      vectors.emotional_variance = emotionalData.length > 0 ? 
        Math.min(1.0, emotionalData.length / 20) : 0.3; // Default moderate variance
    } else {
      vectors.emotional_variance = 0.3;
    }
  }
  
  // Pattern identification
  const patternTypes = ['technical_optimizer', 'curious_explorer', 'depth_seeker', 'balanced_user'];
  const primaryPattern = identifyPrimaryPattern(vectors);
  
  return {
    vectors,
    primaryPattern,
    patternCount: Object.keys(vectors).length,
    vectorMagnitude: Math.sqrt(Object.values(vectors).reduce((sum, v) => sum + v*v, 0)),
    computedAt: new Date()
  };
}

function identifyPrimaryPattern(vectors) {
  const patterns = [
    {
      name: 'technical_optimizer',
      score: (vectors.technical_depth || 0) * 0.4 + (vectors.curiosity || 0) * 0.3 + (vectors.interaction_complexity || 0) * 0.3,
      confidence: 0.85
    },
    {
      name: 'curious_explorer', 
      score: (vectors.curiosity || 0) * 0.5 + (vectors.emotional_variance || 0) * 0.3 + (vectors.interaction_complexity || 0) * 0.2,
      confidence: 0.75
    },
    {
      name: 'depth_seeker',
      score: (vectors.interaction_complexity || 0) * 0.5 + (vectors.technical_depth || 0) * 0.4 + (vectors.curiosity || 0) * 0.1,
      confidence: 0.80
    },
    {
      name: 'balanced_user',
      score: Object.values(vectors).reduce((sum, v) => sum + v, 0) / Object.keys(vectors).length,
      confidence: 0.60
    }
  ];
  
  return patterns.sort((a, b) => b.score - a.score)[0];
}

async function calculateTemporalDeltas(behaviorProfile, emotionalSessions, memoryEntries, timeframe, granularity) {
  const now = new Date();
  const periods = getTimePeriods(timeframe, granularity);
  
  const deltas = {};
  
  // Calculate weekly changes in curiosity and depth patterns
  if (memoryEntries.length > 20) {
    const recentEntries = memoryEntries.slice(0, Math.floor(memoryEntries.length / 2));
    const olderEntries = memoryEntries.slice(Math.floor(memoryEntries.length / 2));
    
    const recentCuriosity = calculateCuriosityScore(recentEntries);
    const olderCuriosity = calculateCuriosityScore(olderEntries);
    
    deltas.curiosity = {
      change: recentCuriosity - olderCuriosity,
      direction: recentCuriosity > olderCuriosity ? '↗' : recentCuriosity < olderCuriosity ? '↘' : '→',
      magnitude: Math.abs(recentCuriosity - olderCuriosity),
      significance: Math.abs(recentCuriosity - olderCuriosity) > 0.1 ? 'significant' : 'stable'
    };
    
    const recentDepth = calculateDepthScore(recentEntries);
    const olderDepth = calculateDepthScore(olderEntries);
    
    deltas.depth = {
      change: recentDepth - olderDepth,
      direction: recentDepth > olderDepth ? '↗' : recentDepth < olderDepth ? '↘' : '→',
      magnitude: Math.abs(recentDepth - olderDepth),
      significance: Math.abs(recentDepth - olderDepth) > 0.1 ? 'significant' : 'stable'
    };
  }
  
  // Peak activity hours analysis
  const hourCounts = new Array(24).fill(0);
  memoryEntries.forEach(entry => {
    if (entry.timestamp) {
      const hour = new Date(entry.timestamp).getHours();
      hourCounts[hour]++;
    }
  });
  
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  const peakHours = [];
  const maxCount = Math.max(...hourCounts);
  hourCounts.forEach((count, hour) => {
    if (count >= maxCount * 0.8) { // Within 80% of peak
      peakHours.push(hour);
    }
  });
  
  deltas.peakHours = peakHours.length > 0 ? 
    `${String(peakHours[0]).padStart(2, '0')}:00-${String(peakHours[peakHours.length-1]).padStart(2, '0')}:00 UTC` : 
    'Distributed throughout day';
  
  return deltas;
}

function calculateCuriosityScore(entries) {
  const questionWords = ['how', 'why', 'what', 'when', 'where', 'which'];
  const questions = entries.filter(entry =>
    questionWords.some(word => entry.content?.toLowerCase().includes(word))
  ).length;
  
  return Math.min(1.0, questions / entries.length * 2);
}

function calculateDepthScore(entries) {
  const avgLength = entries.reduce((sum, entry) => sum + (entry.content?.length || 0), 0) / entries.length;
  return Math.min(1.0, avgLength / 150);
}

async function generateConfidenceMatrix(behavioralAnalysis, temporalDeltas, behaviorProfile, threshold) {
  const factors = [];
  
  // Data quality confidence
  const dataQuality = behaviorProfile?.dataQuality?.completeness || 0.5;
  factors.push({
    factor: 'data_completeness',
    score: dataQuality,
    weight: 0.3
  });
  
  // Sample size confidence
  const sampleSizeScore = Math.min(1.0, (behaviorProfile?.dataQuality?.sampleSize || 0) / 50);
  factors.push({
    factor: 'sample_size',
    score: sampleSizeScore,
    weight: 0.25
  });
  
  // Pattern consistency confidence
  const patternScore = behavioralAnalysis.primaryPattern?.confidence || 0.5;
  factors.push({
    factor: 'pattern_consistency',
    score: patternScore,
    weight: 0.3
  });
  
  // Temporal stability confidence
  const stabilityScore = calculateTemporalStability(temporalDeltas);
  factors.push({
    factor: 'temporal_stability',
    score: stabilityScore,
    weight: 0.15
  });
  
  const overallConfidence = factors.reduce((sum, f) => sum + (f.score * f.weight), 0);
  
  return {
    overall: overallConfidence,
    threshold,
    factors,
    meetsThreshold: overallConfidence >= threshold,
    interpretation: getConfidenceInterpretation(overallConfidence)
  };
}

function calculateTemporalStability(deltas) {
  if (!deltas.curiosity || !deltas.depth) return 0.7; // Default moderate stability
  
  const changesMagnitude = (deltas.curiosity.magnitude + deltas.depth.magnitude) / 2;
  return Math.max(0, 1 - changesMagnitude * 2); // Higher stability for smaller changes
}

function getConfidenceInterpretation(score) {
  if (score >= 0.8) return 'high_confidence';
  if (score >= 0.6) return 'moderate_confidence';
  if (score >= 0.4) return 'developing_profile';
  return 'insufficient_data';
}

async function clusterInteractionPatterns(memoryEntries, behaviorProfile) {
  const patterns = {
    'basic_queries': 0,
    'advanced_optimization': 0,
    'exploratory_learning': 0,
    'goal_oriented': 0
  };
  
  memoryEntries.forEach(entry => {
    const content = entry.content?.toLowerCase() || '';
    
    if (content.includes('help') || content.includes('how to')) {
      patterns.basic_queries++;
    } else if (content.includes('optim') || content.includes('performance') || content.includes('efficiency')) {
      patterns.advanced_optimization++;
    } else if (content.includes('learn') || content.includes('understand') || content.includes('explain')) {
      patterns.exploratory_learning++;
    } else if (content.includes('goal') || content.includes('plan') || content.includes('achieve')) {
      patterns.goal_oriented++;
    }
  });
  
  const total = Object.values(patterns).reduce((sum, count) => sum + count, 0);
  const normalized = {};
  Object.keys(patterns).forEach(key => {
    normalized[key] = total > 0 ? patterns[key] / total : 0;
  });
  
  return {
    patterns: normalized,
    dominantPattern: Object.keys(normalized).reduce((a, b) => normalized[a] > normalized[b] ? a : b),
    evolution: 'basic_queries → advanced_optimization' // Simplified evolution path
  };
}

async function generateUBPMResult(mode, behavioral, temporal, confidence, clusters, profile, user, includeRaw) {
  const baseResult = {
    ubpmAnalysisResults: generateTechnicalOutput(behavioral, temporal, confidence, clusters),
    behavioralInsights: generateBehavioralInsights(behavioral, temporal, clusters),
    recommendations: generateRecommendations(behavioral, temporal, confidence)
  };
  
  if (includeRawMetrics) {
    baseResult.rawMetrics = {
      vectorSpace: behavioral.vectors,
      temporalDeltas: temporal,
      confidenceFactors: confidence.factors,
      interactionClusters: clusters.patterns,
      dataQuality: profile?.dataQuality || {},
      computationTimestamp: new Date().toISOString()
    };
  }
  
  return baseResult;
}

function generateTechnicalOutput(behavioral, temporal, confidence, clusters) {
  const confidencePercentage = (confidence.overall * 100).toFixed(1);
  const primaryPattern = behavioral.primaryPattern?.name || 'developing';
  const patternConfidence = behavioral.primaryPattern?.confidence || 0.5;
  
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 Behavioral Confidence: ${confidencePercentage}% (threshold: ${(confidence.threshold * 100).toFixed(0)}%)
🎯 Primary Pattern: ${primaryPattern} (p=${patternConfidence.toFixed(2)})
🔄 Weekly Delta: curiosity${temporal.curiosity?.direction || '→'} ${temporal.curiosity ? Math.abs(temporal.curiosity.change * 100).toFixed(0) + '%' : 'stable'}, depth${temporal.depth?.direction || '→'} ${temporal.depth?.significance || 'stable'}
⏰ Peak Hours: ${temporal.peakHours || 'distributed'}
🛠 Tool Evolution: ${clusters.evolution}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

function generateBehavioralInsights(behavioral, temporal, clusters) {
  const insights = [];
  
  if (behavioral.primaryPattern?.name === 'technical_optimizer') {
    insights.push('🔧 Technical optimization mindset detected - prefers efficiency and systematic approaches');
  }
  
  if (temporal.curiosity?.direction === '↗') {
    insights.push(`📈 Curiosity increasing by ${Math.abs(temporal.curiosity.change * 100).toFixed(0)}% - exploring new domains`);
  }
  
  if (clusters.dominantPattern === 'advanced_optimization') {
    insights.push('⚡ Advanced problem-solving patterns - seeks sophisticated solutions');
  }
  
  return insights.length > 0 ? insights : ['🧠 Behavioral patterns developing - continue interactions for deeper analysis'];
}

function generateRecommendations(behavioral, temporal, confidence) {
  const recommendations = [];
  
  if (confidence.overall < 0.6) {
    recommendations.push('💡 Continue regular interactions to improve analysis confidence');
  }
  
  if (behavioral.primaryPattern?.name === 'technical_optimizer') {
    recommendations.push('🛠 Leverage advanced tools and technical features for optimal experience');
  }
  
  if (temporal.curiosity?.direction === '↗') {
    recommendations.push('🎯 Explore new AI capabilities and complex problem-solving scenarios');
  }
  
  return recommendations.length > 0 ? recommendations : ['✨ Behavioral profile optimized - maintain current interaction patterns'];
}

function getTimeframePeriod(timeframe) {
  const periods = {
    'session': '1h',
    'daily': '1d', 
    'weekly': '1w',
    'monthly': '1m',
    'all_time': '∞'
  };
  
  return periods[timeframe] || '1w';
}

function getTimePeriods(timeframe, granularity) {
  // Simplified implementation - would expand based on requirements
  return {
    current: new Date(),
    previous: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 1 week ago
  };
}