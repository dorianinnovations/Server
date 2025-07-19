import logger from "./logger.js";

console.log("📊 Initializing collective data helper utilities...");

/**
 * Compresses and formats collective data for efficient transmission
 */
export class CollectiveDataFormatter {
  constructor() {
    console.log("✓Creating collective data formatter instance");
    this.compressionThreshold = 1000; // Compress if data size > 1KB
    console.log("✓Collective data formatter instance created");
  }

  /**
   * Compress emotional data for efficient transmission
   */
  compressEmotionalData(data) {
    try {
      if (!data || !Array.isArray(data)) {
        throw new Error("Invalid data format");
      }

      const compressed = {
        m: data.length, // metadata count
        d: data.map(group => ({
          t: group.timeGroup, // timeGroup
          e: group.totalEntries, // totalEntries
          em: group.emotions.map(emotion => ({
            n: emotion.emotion, // name
            c: emotion.count, // count
            p: emotion.percentage, // percentage
            i: emotion.avgIntensity || null // intensity
          }))
        }))
      };

      // Add context if present
      if (data[0]?.emotions[0]?.contexts) {
        compressed.d = compressed.d.map(group => ({
          ...group,
          em: group.em.map((emotion, index) => ({
            ...emotion,
            ctx: data[group.t]?.emotions[index]?.contexts || []
          }))
        }));
      }

      return {
        success: true,
        compressed: true,
        originalSize: JSON.stringify(data).length,
        compressedSize: JSON.stringify(compressed).length,
        data: compressed
      };

    } catch (error) {
      logger.error("Error compressing emotional data", {
        error: error.message,
        stack: error.stack
      });
      return {
        success: false,
        error: error.message,
        data: data // Return original data if compression fails
      };
    }
  }

  /**
   * Decompress emotional data back to original format
   */
  decompressEmotionalData(compressedData) {
    try {
      if (!compressedData || !compressedData.d) {
        throw new Error("Invalid compressed data format");
      }

      const decompressed = compressedData.d.map(group => ({
        timeGroup: group.t,
        totalEntries: group.e,
        emotions: group.em.map(emotion => ({
          emotion: emotion.n,
          count: emotion.c,
          percentage: emotion.p,
          avgIntensity: emotion.i,
          contexts: emotion.ctx || []
        }))
      }));

      return {
        success: true,
        data: decompressed
      };

    } catch (error) {
      logger.error("Error decompressing emotional data", {
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
   * Format data for different visualization types
   */
  formatForVisualization(data, visualizationType = "chart") {
    try {
      // Validate input data
      if (!data || !Array.isArray(data)) {
        logger.warn("Invalid data format for visualization", { dataType: typeof data });
        return {
          success: false,
          error: "Invalid data format - expected array",
          data: []
        };
      }

      if (data.length === 0) {
        logger.info("Empty data provided for visualization");
        return {
          success: true,
          type: visualizationType,
          data: [],
          metadata: { isEmpty: true }
        };
      }

      switch (visualizationType) {
        case "heatmap":
          return this._formatForHeatmap(data);
        case "timeline":
          return this._formatForTimeline(data);
        case "pie":
          return this._formatForPieChart(data);
        case "bar":
          return this._formatForBarChart(data);
        case "line":
          return this._formatForLineChart(data);
        default:
          return this._formatForGenericChart(data);
      }
    } catch (error) {
      logger.error("Error formatting data for visualization", {
        error: error.message,
        visualizationType,
        stack: error.stack
      });
      return {
        success: false,
        error: error.message,
        data: data || []
      };
    }
  }

  /**
   * Format data for heatmap visualization
   */
  _formatForHeatmap(data) {
    const heatmapData = [];
    const emotions = new Set();
    const timeGroups = new Set();

    // Collect all unique emotions and time groups
    data.forEach(group => {
      timeGroups.add(group.timeGroup);
      group.emotions.forEach(emotion => {
        emotions.add(emotion.emotion);
      });
    });

    // Create heatmap matrix
    Array.from(timeGroups).forEach(timeGroup => {
      Array.from(emotions).forEach(emotion => {
        const group = data.find(g => g.timeGroup === timeGroup);
        const emotionData = group?.emotions.find(e => e.emotion === emotion);
        
        heatmapData.push({
          x: timeGroup,
          y: emotion,
          value: emotionData?.count || 0,
          intensity: emotionData?.avgIntensity || 0
        });
      });
    });

    return {
      success: true,
      type: "heatmap",
      data: heatmapData,
      metadata: {
        emotions: Array.from(emotions),
        timeGroups: Array.from(timeGroups),
        maxValue: Math.max(...heatmapData.map(d => d.value))
      }
    };
  }

  /**
   * Format data for timeline visualization
   */
  _formatForTimeline(data) {
    const timelineData = data.map(group => ({
      date: group.timeGroup,
      total: group.totalEntries,
      emotions: group.emotions.map(emotion => ({
        name: emotion.emotion,
        count: emotion.count,
        percentage: emotion.percentage
      }))
    }));

    return {
      success: true,
      type: "timeline",
      data: timelineData,
      metadata: {
        timeRange: {
          start: timelineData[0]?.date,
          end: timelineData[timelineData.length - 1]?.date
        },
        totalEntries: timelineData.reduce((sum, item) => sum + item.total, 0)
      }
    };
  }

  /**
   * Format data for pie chart visualization
   */
  _formatForPieChart(data) {
    const emotionTotals = {};
    
    data.forEach(group => {
      group.emotions.forEach(emotion => {
        if (!emotionTotals[emotion.emotion]) {
          emotionTotals[emotion.emotion] = 0;
        }
        emotionTotals[emotion.emotion] += emotion.count;
      });
    });

    const pieData = Object.entries(emotionTotals).map(([emotion, count]) => ({
      name: emotion,
      value: count,
      percentage: (count / Object.values(emotionTotals).reduce((a, b) => a + b, 0) * 100).toFixed(2)
    }));

    return {
      success: true,
      type: "pie",
      data: pieData,
      metadata: {
        totalEntries: Object.values(emotionTotals).reduce((a, b) => a + b, 0),
        uniqueEmotions: Object.keys(emotionTotals).length
      }
    };
  }

  /**
   * Format data for bar chart visualization
   */
  _formatForBarChart(data) {
    const barData = data.map(group => ({
      timeGroup: group.timeGroup,
      emotions: group.emotions.map(emotion => ({
        emotion: emotion.emotion,
        count: emotion.count,
        percentage: emotion.percentage
      }))
    }));

    return {
      success: true,
      type: "bar",
      data: barData,
      metadata: {
        timeGroups: barData.length,
        maxCount: Math.max(...barData.flatMap(group => group.emotions.map(e => e.count)))
      }
    };
  }

  /**
   * Format data for line chart visualization
   */
  _formatForLineChart(data) {
    const emotions = new Set();
    data.forEach(group => {
      group.emotions.forEach(emotion => emotions.add(emotion.emotion));
    });

    const lineData = Array.from(emotions).map(emotion => ({
      name: emotion,
      data: data.map(group => {
        const emotionData = group.emotions.find(e => e.emotion === emotion);
        return {
          timeGroup: group.timeGroup,
          count: emotionData?.count || 0,
          percentage: emotionData?.percentage || 0
        };
      })
    }));

    return {
      success: true,
      type: "line",
      data: lineData,
      metadata: {
        emotions: Array.from(emotions),
        timePoints: data.length
      }
    };
  }

  /**
   * Format data for generic chart visualization
   */
  _formatForGenericChart(data) {
    return {
      success: true,
      type: "generic",
      data: data,
      metadata: {
        dataPoints: data.length,
        totalEntries: data.reduce((sum, group) => sum + group.totalEntries, 0),
        uniqueEmotions: new Set(data.flatMap(group => group.emotions.map(e => e.emotion))).size
      }
    };
  }

  /**
   * Generate summary statistics for collective data
   */
  generateSummaryStats(data) {
    try {
      if (!data || !Array.isArray(data)) {
        throw new Error("Invalid data format");
      }

      const allEmotions = data.flatMap(group => group.emotions);
      const emotionCounts = {};
      let totalEntries = 0;
      let totalIntensity = 0;
      let intensityCount = 0;

      allEmotions.forEach(emotion => {
        if (!emotionCounts[emotion.emotion]) {
          emotionCounts[emotion.emotion] = 0;
        }
        emotionCounts[emotion.emotion] += emotion.count;
        totalEntries += emotion.count;
        
        if (emotion.avgIntensity) {
          totalIntensity += emotion.avgIntensity * emotion.count;
          intensityCount += emotion.count;
        }
      });

      const topEmotions = Object.entries(emotionCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([emotion, count]) => ({
          emotion,
          count,
          percentage: (count / totalEntries * 100).toFixed(2)
        }));

      const stats = {
        success: true,
        summary: {
          totalEntries,
          uniqueEmotions: Object.keys(emotionCounts).length,
          timeRange: {
            start: data[0]?.timeGroup,
            end: data[data.length - 1]?.timeGroup,
            duration: data.length
          },
          avgIntensity: intensityCount > 0 ? (totalIntensity / intensityCount).toFixed(2) : null,
          topEmotions,
          emotionDistribution: emotionCounts
        }
      };

      return stats;

    } catch (error) {
      logger.error("Error generating summary stats", {
        error: error.message,
        stack: error.stack
      });
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export const collectiveDataFormatter = new CollectiveDataFormatter();

// Component ready