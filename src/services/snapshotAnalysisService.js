import CollectiveSnapshot from "../models/CollectiveSnapshot.js";
import collectiveDataService from "./collectiveDataService.js";
import { createLLMService } from "./llmService.js";
import logger from "../utils/logger.js";

class SnapshotAnalysisService {
  constructor() {
    this.llmService = createLLMService();
    this.analysisPrompt = this._getAnalysisPrompt();
  }

  /**
   * Generate a new collective snapshot using LLM analysis
   */
  async generateSnapshot(timeRange = "30d", options = {}) {
    const startTime = Date.now();
    
    try {
      // Check database connection
      const mongoose = await import("mongoose");
      if (!mongoose.default.connection || mongoose.default.connection.readyState !== 1) {
        logger.warn("Database not connected, skipping snapshot generation");
        return {
          success: false,
          message: "Database not connected",
          error: "Database connection not ready"
        };
      }

      // Get aggregated data
      const collectiveData = await collectiveDataService.getAggregatedEmotionalData({
        timeRange,
        includeIntensity: true,
        includeContext: true,
        minConsentCount: 5
      });

      if (!collectiveData.success) {
        throw new Error(`Failed to get collective data: ${collectiveData.message}`);
      }

      // Get demographic patterns
      const demographicData = await collectiveDataService.getDemographicPatterns({
        includeActivityPatterns: true
      });

      // Create snapshot document
      const snapshot = new CollectiveSnapshot({
        timestamp: new Date(),
        sampleSize: collectiveData.metadata.totalUsers,
        status: "processing"
      });

      // Prepare data for LLM analysis
      const analysisData = this._prepareAnalysisData(collectiveData, demographicData);
      
      // Generate LLM analysis
      const llmResult = await this._analyzeWithLLM(analysisData, timeRange);
      
      if (!llmResult.success) {
        throw new Error(`LLM analysis failed: ${llmResult.error}`);
      }

      // Update snapshot with LLM results
      snapshot.dominantEmotion = llmResult.dominantEmotion;
      snapshot.avgIntensity = llmResult.avgIntensity;
      snapshot.insight = llmResult.insight;
      snapshot.archetype = llmResult.archetype;
      
      // Add metadata
      snapshot.metadata = {
        timeRange,
        totalEmotions: collectiveData.metadata.dataPoints,
        emotionDistribution: this._extractEmotionDistribution(collectiveData.data),
        topEmotions: this._extractTopEmotions(collectiveData.data),
        contextThemes: llmResult.contextThemes || [],
        intensityDistribution: this._calculateIntensityDistribution(collectiveData.data),
        activityMetrics: demographicData.success ? demographicData.activityPatterns : {}
      };

      // Add analysis details
      snapshot.analysis = {
        model: llmResult.model || "gpt-4",
        promptVersion: "1.0",
        processingTime: Date.now() - startTime,
        confidence: llmResult.confidence || 0.8,
        alternativeArchetypes: llmResult.alternativeArchetypes || []
      };

      snapshot.status = "completed";
      await snapshot.save();

      logger.info("Collective snapshot generated successfully", {
        snapshotId: snapshot._id,
        sampleSize: snapshot.sampleSize,
        dominantEmotion: snapshot.dominantEmotion,
        archetype: snapshot.archetype,
        processingTime: snapshot.analysis.processingTime
      });

      return {
        success: true,
        snapshot: snapshot.getSummary(),
        processingTime: snapshot.analysis.processingTime
      };

    } catch (error) {
      logger.error("Error generating collective snapshot", {
        error: error.message,
        timeRange,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get the latest snapshot
   */
  async getLatestSnapshot(timeRange = "30d") {
    try {
      // Check database connection
      const mongoose = await import("mongoose");
      if (!mongoose.default.connection || mongoose.default.connection.readyState !== 1) {
        logger.warn("Database not connected, skipping latest snapshot fetch");
        return {
          success: false,
          message: "Database not connected",
          error: "Database connection not ready"
        };
      }

      const snapshot = await CollectiveSnapshot.getLatest(timeRange);
      
      if (!snapshot) {
        return {
          success: false,
          message: "No snapshots found for the specified time range"
        };
      }

      return {
        success: true,
        snapshot: snapshot.getSummary()
      };

    } catch (error) {
      logger.error("Error fetching latest snapshot", {
        error: error.message,
        timeRange,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get snapshot history
   */
  async getSnapshotHistory(timeRange = "30d", limit = 10) {
    try {
      // Check database connection
      const mongoose = await import("mongoose");
      if (!mongoose.default.connection || mongoose.default.connection.readyState !== 1) {
        logger.warn("Database not connected, skipping snapshot history fetch");
        return {
          success: false,
          message: "Database not connected",
          error: "Database connection not ready"
        };
      }

      const snapshots = await CollectiveSnapshot.getByTimeRange(timeRange, limit);
      
      return {
        success: true,
        snapshots: snapshots.map(snapshot => snapshot.getSummary()),
        count: snapshots.length
      };

    } catch (error) {
      logger.error("Error fetching snapshot history", {
        error: error.message,
        timeRange,
        limit,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get archetype history
   */
  async getArchetypeHistory(timeRange = "30d", limit = 20) {
    try {
      // Check database connection
      const mongoose = await import("mongoose");
      if (!mongoose.default.connection || mongoose.default.connection.readyState !== 1) {
        logger.warn("Database not connected, skipping archetype history fetch");
        return {
          success: false,
          message: "Database not connected",
          error: "Database connection not ready"
        };
      }

      const archetypes = await CollectiveSnapshot.getArchetypeHistory(timeRange, limit);
      
      return {
        success: true,
        archetypes: archetypes.map(archetype => ({
          archetype: archetype._id,
          count: archetype.count,
          lastSeen: archetype.lastSeen,
          avgIntensity: Math.round(archetype.avgIntensity * 10) / 10,
          insights: archetype.insights.slice(0, 3) // Show last 3 insights
        }))
      };

    } catch (error) {
      logger.error("Error fetching archetype history", {
        error: error.message,
        timeRange,
        limit,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get emotion trends
   */
  async getEmotionTrends(timeRange = "30d", limit = 20) {
    try {
      const emotions = await CollectiveSnapshot.getEmotionTrends(timeRange, limit);
      
      return {
        success: true,
        emotions: emotions.map(emotion => ({
          emotion: emotion._id,
          count: emotion.count,
          avgIntensity: Math.round(emotion.avgIntensity * 10) / 10,
          lastSeen: emotion.lastSeen,
          archetypes: emotion.archetypes
        }))
      };

    } catch (error) {
      logger.error("Error fetching emotion trends", {
        error: error.message,
        timeRange,
        limit,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get snapshot statistics
   */
  async getSnapshotStats() {
    try {
      const stats = await CollectiveSnapshot.getStats();
      
      return {
        success: true,
        stats
      };

    } catch (error) {
      logger.error("Error fetching snapshot stats", {
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Prepare data for LLM analysis
   */
  _prepareAnalysisData(collectiveData, demographicData) {
    const emotionTotals = {};
    let totalIntensity = 0;
    let intensityCount = 0;
    const contexts = [];

    // Aggregate emotion data
    collectiveData.data.forEach(group => {
      group.emotions.forEach(emotion => {
        if (!emotionTotals[emotion.emotion]) {
          emotionTotals[emotion.emotion] = 0;
        }
        emotionTotals[emotion.emotion] += emotion.count;
        
        if (emotion.avgIntensity) {
          totalIntensity += emotion.avgIntensity * emotion.count;
          intensityCount += emotion.count;
        }

        if (emotion.contexts) {
          contexts.push(...emotion.contexts);
        }
      });
    });

    // Get top emotions
    const topEmotions = Object.entries(emotionTotals)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([emotion, count]) => ({
        emotion,
        count,
        percentage: (count / Object.values(emotionTotals).reduce((a, b) => a + b, 0) * 100).toFixed(2)
      }));

    return {
      totalUsers: collectiveData.metadata.totalUsers,
      totalEmotions: Object.values(emotionTotals).reduce((a, b) => a + b, 0),
      avgIntensity: intensityCount > 0 ? (totalIntensity / intensityCount) : 0,
      topEmotions,
      emotionDistribution: emotionTotals,
      contexts: contexts.filter(ctx => ctx).slice(0, 20), // Limit contexts
      activityMetrics: demographicData.success ? demographicData.activityPatterns : {},
      timeRange: collectiveData.metadata.timeRange
    };
  }

  /**
   * Analyze data with LLM
   */
  async _analyzeWithLLM(data, timeRange) {
    try {
      const prompt = this._buildAnalysisPrompt(data, timeRange);
      
      const response = await this.llmService.makeLLMRequest(prompt, {
        temperature: 0.7,
        max_tokens: 500
      });

      if (!response.content) {
        throw new Error("No content received from LLM");
      }

      // Parse LLM response
      const parsed = this._parseLLMResponse(response.content);
      
      return {
        success: true,
        dominantEmotion: parsed.dominantEmotion,
        avgIntensity: parsed.avgIntensity,
        insight: parsed.insight,
        archetype: parsed.archetype,
        contextThemes: parsed.contextThemes,
        alternativeArchetypes: parsed.alternativeArchetypes,
        confidence: parsed.confidence,
        model: response.model || "gpt-4"
      };

    } catch (error) {
      logger.error("LLM analysis failed", {
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build analysis prompt for LLM
   */
  _buildAnalysisPrompt(data, timeRange) {
    const timeRangeText = {
      "10m": "the past 10 minutes",
      "7d": "the past week",
      "30d": "the past month", 
      "90d": "the past three months",
      "1y": "the past year",
      "all": "all time"
    }[timeRange] || "the past month";

    return `Analyze the collective emotional data from ${timeRangeText} and provide insights.

Data Summary:
- Total users: ${data.totalUsers}
- Total emotions logged: ${data.totalEmotions}
- Average intensity: ${data.avgIntensity.toFixed(1)}/10
- Top emotions: ${data.topEmotions.map(e => `${e.emotion} (${e.percentage}%)`).join(', ')}

Context themes: ${data.contexts.join(', ')}

Activity metrics:
- Active users: ${data.activityMetrics.activeUsers || 0}
- Engagement level: ${data.activityMetrics.engagementLevel || 0}%

Please provide:
1. Dominant emotion (single word)
2. Average intensity (1-10 scale)
3. A poetic insight about the collective emotional state (1-2 sentences)
4. An archetype that represents this collective state (e.g., "The Seeker", "The Wanderer", "The Dreamer", "The Warrior", "The Sage", "The Innocent", "The Explorer", "The Creator", "The Caregiver", "The Rebel")
5. 2-3 alternative archetypes with confidence scores
6. Key context themes (comma-separated)

Format your response as JSON:
{
  "dominantEmotion": "emotion",
  "avgIntensity": 5.5,
  "insight": "poetic insight here",
  "archetype": "The Archetype",
  "alternativeArchetypes": [
    {"archetype": "Alternative 1", "confidence": 0.8},
    {"archetype": "Alternative 2", "confidence": 0.6}
  ],
  "contextThemes": ["theme1", "theme2", "theme3"],
  "confidence": 0.85
}`;
  }

  /**
   * Parse LLM response
   */
  _parseLLMResponse(content) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          dominantEmotion: parsed.dominantEmotion || "unknown",
          avgIntensity: parseFloat(parsed.avgIntensity) || 5.0,
          insight: parsed.insight || "The collective emotional state remains mysterious.",
          archetype: parsed.archetype || "The Wanderer",
          alternativeArchetypes: parsed.alternativeArchetypes || [],
          contextThemes: parsed.contextThemes || [],
          confidence: parseFloat(parsed.confidence) || 0.8
        };
      }

      // Fallback parsing if JSON extraction fails
      return {
        dominantEmotion: "unknown",
        avgIntensity: 5.0,
        insight: "The collective emotional state remains mysterious.",
        archetype: "The Wanderer",
        alternativeArchetypes: [],
        contextThemes: [],
        confidence: 0.5
      };

    } catch (error) {
      logger.error("Error parsing LLM response", {
        error: error.message,
        content: content.substring(0, 200)
      });

      return {
        dominantEmotion: "unknown",
        avgIntensity: 5.0,
        insight: "The collective emotional state remains mysterious.",
        archetype: "The Wanderer",
        alternativeArchetypes: [],
        contextThemes: [],
        confidence: 0.3
      };
    }
  }

  /**
   * Extract emotion distribution
   */
  _extractEmotionDistribution(data) {
    const distribution = {};
    data.forEach(group => {
      group.emotions.forEach(emotion => {
        if (!distribution[emotion.emotion]) {
          distribution[emotion.emotion] = 0;
        }
        distribution[emotion.emotion] += emotion.count;
      });
    });
    return distribution;
  }

  /**
   * Extract top emotions
   */
  _extractTopEmotions(data) {
    const emotionTotals = {};
    data.forEach(group => {
      group.emotions.forEach(emotion => {
        if (!emotionTotals[emotion.emotion]) {
          emotionTotals[emotion.emotion] = 0;
        }
        emotionTotals[emotion.emotion] += emotion.count;
      });
    });

    const total = Object.values(emotionTotals).reduce((a, b) => a + b, 0);
    
    return Object.entries(emotionTotals)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([emotion, count]) => ({
        emotion,
        count,
        percentage: (count / total * 100).toFixed(2)
      }));
  }

  /**
   * Calculate intensity distribution
   */
  _calculateIntensityDistribution(data) {
    let low = 0, medium = 0, high = 0;
    
    data.forEach(group => {
      group.emotions.forEach(emotion => {
        if (emotion.avgIntensity) {
          if (emotion.avgIntensity <= 3) low += emotion.count;
          else if (emotion.avgIntensity <= 7) medium += emotion.count;
          else high += emotion.count;
        }
      });
    });

    return { low, medium, high };
  }

  /**
   * Get analysis prompt template
   */
  _getAnalysisPrompt() {
    return "You are an expert in collective psychology and emotional analysis. Analyze the provided emotional data and provide insights about the collective emotional state.";
  }
}

export default new SnapshotAnalysisService(); 