import unifiedCognitiveEngine from '../services/unifiedCognitiveEngine.js';
import UserBehaviorProfile from '../models/UserBehaviorProfile.js';
import enhancedMemoryService from '../services/enhancedMemoryService.js';

/**
 * Consolidated UBPM Analysis Tool
 * Combines real cognitive engine data with behavioral analysis
 * Replaces both ubpmAnalysis.js and realUBPMAnalysis.js
 */
export default async function ubpmAnalysis(args, userContext) {
  const { 
    type = 'full',
    analysisMode = 'behavioral_vector',
    includeRawData = true,
    includeRawMetrics = true,
    confidenceThreshold = 0.7
  } = args;

  try {
    const userId = userContext.userId;
    
    // Real-time cognitive analysis (from realUBPMAnalysis.js)
    if (type === 'cognitive') {
      const cognitiveData = await unifiedCognitiveEngine.analyzeCognitiveProfile(userId, []);
      
      if (!cognitiveData) {
        return {
          success: false,
          error: 'No cognitive data available yet - continue conversations to build profile'
        };
      }

      return {
        success: true,
        analysis: `## 🧠 Real Cognitive Analysis

**Decision Making**: ${cognitiveData.cognitiveProfile?.decisionMaking?.primary || 'developing'} (${((cognitiveData.cognitiveProfile?.decisionMaking?.confidence || 0) * 100).toFixed(1)}% confidence)

**Communication**: ${cognitiveData.cognitiveProfile?.communication?.primary || 'developing'} style, avg ${cognitiveData.cognitiveProfile?.communication?.avgMessageLength || 0} chars

**Learning Velocity**: ${cognitiveData.cognitiveProfile?.learningVelocity?.velocity || 0} (${cognitiveData.cognitiveProfile?.learningVelocity?.trend || 'developing'})

**Processing Time**: ${cognitiveData.processingTime}ms
**Overall Confidence**: ${((cognitiveData.confidence || 0) * 100).toFixed(1)}%

${includeRawData ? '**Raw Scores**: ' + JSON.stringify(cognitiveData.cognitiveProfile?.decisionMaking?.scores || {}, null, 2) : ''}`,
        rawData: includeRawData ? cognitiveData : null,
        processingTime: cognitiveData.processingTime
      };
    }

    // Behavioral vector analysis (simplified from old ubpmAnalysis.js)
    if (type === 'behavioral' || analysisMode === 'behavioral_vector') {
      const behaviorProfile = await UserBehaviorProfile.findOne({ userId });
      const enhancedContext = await enhancedMemoryService.getUserContext(userId, 50);
      const memoryEntries = enhancedContext.conversation.recentMessages || [];

      if (memoryEntries.length < 3) {
        return {
          success: true,
          analysis: `## 📊 Behavioral Analysis (Limited Data)

**Status**: Building behavioral profile...
**Messages Analyzed**: ${memoryEntries.length}
**Recommendation**: Continue conversations to unlock detailed analysis

**Initial Patterns**:
- Engagement: ${memoryEntries.length > 0 ? 'Active' : 'Starting'}
- Communication: ${memoryEntries.length > 1 ? 'Developing' : 'Initial'}`,
          rawData: includeRawData ? { messagesCount: memoryEntries.length, behaviorProfile } : null
        };
      }

      // Calculate real behavioral vectors
      const vectors = await calculateBehavioralVectors(memoryEntries);
      const overallConfidence = Object.values(vectors).reduce((sum, v) => sum + v.confidence, 0) / Object.keys(vectors).length;

      return {
        success: true,
        analysis: `## 📊 Behavioral Vector Analysis

**Curiosity Vector**: ${vectors.curiosity.score.toFixed(2)} (${(vectors.curiosity.confidence * 100).toFixed(0)}% confidence)
**Technical Depth**: ${vectors.technical_depth.score.toFixed(2)} (${(vectors.technical_depth.confidence * 100).toFixed(0)}% confidence)
**Communication Complexity**: ${vectors.communication.score.toFixed(2)} (${(vectors.communication.confidence * 100).toFixed(0)}% confidence)

**Overall Confidence**: ${(overallConfidence * 100).toFixed(1)}%
**Messages Analyzed**: ${memoryEntries.length}`,
        vectors,
        overallConfidence,
        rawData: includeRawData ? { behaviorProfile, memoryEntries: memoryEntries.length } : null
      };
    }

    // Full comprehensive analysis (from realUBPMAnalysis.js)
    if (type === 'full') {  
      const userAnalysis = await unifiedCognitiveEngine.getUserAnalysis(userId);
      
      return {
        success: true,
        analysis: `## 📊 Complete UBPM Profile

**Behavior Profile**:
- Engagement: ${userAnalysis.behaviorProfile?.engagementLevel || 'developing'}
- Learning Style: ${userAnalysis.behaviorProfile?.learningStyle || 'developing'}  
- Communication: ${userAnalysis.behaviorProfile?.communicationPreference || 'developing'}
- Decision Speed: ${userAnalysis.behaviorProfile?.decisionMakingSpeed || 'developing'}

**Cognitive Patterns**:
- Information Processing: ${userAnalysis.cognitivePatterns?.informationProcessing || 'developing'}
- Complexity Preference: ${userAnalysis.cognitivePatterns?.complexityPreference || 'developing'}
- Questioning Style: ${userAnalysis.cognitivePatterns?.questioningStyle || 'developing'}
- Adaptability: ${((userAnalysis.cognitivePatterns?.adaptability || 0) * 100).toFixed(0)}%

**Communication Style**:
- Tone: ${userAnalysis.communicationStyle?.tone || 'developing'}
- Directness: ${((userAnalysis.communicationStyle?.directness || 0) * 100).toFixed(0)}%
- Response Length: ${userAnalysis.communicationStyle?.responseLength || 'developing'}`,
        
        rawData: includeRawData ? userAnalysis : null
      };
    }

    return {
      success: false,
      error: 'Invalid analysis type. Use "cognitive", "behavioral", or "full"'
    };

  } catch (error) {
    console.error('UBPM Analysis error:', error);
    return {
      success: false,
      error: 'UBPM analysis failed',
      details: error.message
    };
  }
}

/**
 * Calculate real behavioral vectors from conversation data
 */
async function calculateBehavioralVectors(memoryEntries) {
  const vectors = {};
  
  // Curiosity vector - based on question patterns
  const questionCount = memoryEntries.filter(entry => 
    entry.content?.includes('?') || 
    /\b(how|why|what|when|where|can|could|would|should)\b/i.test(entry.content || '')
  ).length;
  
  vectors.curiosity = {
    score: Math.min(1.0, questionCount / memoryEntries.length * 2),
    confidence: Math.min(1.0, memoryEntries.length / 10) // Higher confidence with more data
  };
  
  // Technical depth - based on technical keywords
  const technicalKeywords = ['algorithm', 'optimization', 'architecture', 'implementation', 'performance', 'system', 'code', 'function', 'api'];
  const technicalCount = memoryEntries.filter(entry =>
    technicalKeywords.some(keyword => 
      entry.content?.toLowerCase().includes(keyword)
    )
  ).length;
  
  vectors.technical_depth = {
    score: Math.min(1.0, technicalCount / memoryEntries.length * 3),
    confidence: Math.min(1.0, memoryEntries.length / 15)
  };
  
  // Communication complexity - based on message length and vocabulary
  const avgMessageLength = memoryEntries.reduce((sum, entry) => 
    sum + (entry.content?.length || 0), 0) / memoryEntries.length;
  
  vectors.communication = {
    score: Math.min(1.0, avgMessageLength / 200), // Normalize to typical message length
    confidence: Math.min(1.0, memoryEntries.length / 8)
  };
  
  return vectors;
}