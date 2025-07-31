import ubpmCognitiveEngine from '../services/ubpmCognitiveEngine.js';

/**
 * Real UBPM Analysis Tool - Queries actual cognitive engine data
 * No bullshit fake percentages, just real behavioral analysis
 */
export default async function realUBPMAnalysis(args, userContext) {
  const { 
    type = 'full',
    includeRawData = true
  } = args;

  try {
    const userId = userContext.userId;
    
    if (type === 'cognitive') {
      // Get raw cognitive analysis with real confidence scores
      const cognitiveData = await ubpmCognitiveEngine.analyzeCognitivePatterns(userId, []);
      
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

    if (type === 'full') {  
      // Get formatted user analysis
      const userAnalysis = await ubpmCognitiveEngine.getUserAnalysis(userId);
      
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
      error: 'Invalid analysis type. Use "cognitive" or "full"'
    };

  } catch (error) {
    console.error('Real UBPM Analysis error:', error);
    return {
      success: false,
      error: 'UBPM analysis failed',
      details: error.message
    };
  }
}