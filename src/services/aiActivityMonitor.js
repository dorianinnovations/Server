import { createLLMService } from './llmService.js';
import logger from '../utils/logger.js';

class AIActivityMonitor {
  constructor() {
    this.llmService = createLLMService();
    this.activeProcesses = new Map(); // userId -> process info
    this.activityDescriber = new Map(); // processId -> activity details
  }

  /**
   * Start monitoring an AI process
   * @param {string} userId - User ID
   * @param {string} processId - Unique process identifier
   * @param {string} query - User query being processed
   */
  startProcess(userId, processId, query) {
    const processInfo = {
      id: processId,
      userId,
      query,
      startTime: Date.now(),
      currentActivity: 'initializing',
      currentStep: 'preparation',
      activities: [],
      llmCalls: []
    };

    this.activeProcesses.set(userId, processInfo);
    this.activityDescriber.set(processId, processInfo);

    logger.info('AI process monitoring started', { userId, processId, query: query.substring(0, 50) });
    return processInfo;
  }

  /**
   * Update the current activity of an AI process
   * @param {string} userId - User ID
   * @param {string} activity - Current activity description
   * @param {Object} details - Additional details about the activity
   */
  updateActivity(userId, activity, details = {}) {
    const process = this.activeProcesses.get(userId);
    if (!process) return;

    const timestamp = Date.now();
    const activityInfo = {
      activity,
      details,
      timestamp,
      duration: timestamp - (process.lastUpdate || process.startTime)
    };

    process.currentActivity = activity;
    process.currentStep = details.step || process.currentStep;
    process.activities.push(activityInfo);
    process.lastUpdate = timestamp;

  }

  /**
   * Log an LLM call for monitoring
   * @param {string} userId - User ID  
   * @param {Object} llmCall - LLM call details
   */
  logLLMCall(userId, llmCall) {
    const process = this.activeProcesses.get(userId);
    if (!process) return;

    const callInfo = {
      ...llmCall,
      timestamp: Date.now()
    };

    process.llmCalls.push(callInfo);
    
    // Update activity based on LLM call
    this.updateActivity(userId, `processing with ${llmCall.model}`, {
      step: llmCall.purpose || 'reasoning',
      tokensUsed: llmCall.tokens
    });
  }

  /**
   * Get current status of an AI process
   * @param {string} userId - User ID
   * @returns {Object|null} Current process status
   */
  getCurrentStatus(userId) {
    const process = this.activeProcesses.get(userId);
    if (!process) return null;

    const recentActivity = process.activities.slice(-1)[0];
    const currentDuration = Date.now() - process.startTime;

    return {
      processId: process.id,
      currentActivity: process.currentActivity,
      currentStep: process.currentStep,
      duration: currentDuration,
      recentActivity,
      activeLLMCalls: process.llmCalls.filter(call => 
        Date.now() - call.timestamp < 5000 // Active in last 5 seconds
      ),
      totalActivities: process.activities.length
    };
  }

  /**
   * Get brief description of current AI activity using cheap LLM
   * @param {Object} status - Current AI status
   * @returns {string} Brief activity description
   */
  async describeActivity(status) {
    try {
      // Use very cheap model to describe what's happening
      const systemPrompt = `Describe the AI's current activity in exactly 2 words. Be precise and technical.`;
      
      const userPrompt = `AI is currently: ${status.currentActivity}
Step: ${status.currentStep}
Duration: ${Math.round(status.duration / 1000)}s

2 words describing this:`;

      const response = await this.llmService.makeLLMRequest([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        model: 'meta-llama/llama-3.1-8b-instruct',
        max_tokens: 4,
        temperature: 0.1,
        stream: false
      });

      let description = response.content || this.getFallbackDescription(status.currentActivity);
      
      // Clean and validate
      description = description.trim()
        .replace(/[^a-zA-Z\s]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ');
        
      const words = description.split(' ').filter(w => w.length > 0);
      if (words.length >= 2) {
        return words.slice(0, 2).join(' ');
      }

      return this.getFallbackDescription(status.currentActivity);

    } catch (error) {
      logger.warn('Failed to describe activity', { error: error.message });
      return this.getFallbackDescription(status.currentActivity);
    }
  }

  /**
   * Get fallback description for AI activity
   * @param {string} activity - Current activity
   * @returns {string} Fallback description
   */
  getFallbackDescription(activity) {
    const descriptions = {
      'initializing': 'starting process',
      'processing': 'analyzing input',
      'generating': 'creating content',
      'validating': 'checking results',
      'synthesizing': 'combining data',
      'reasoning': 'thinking deeply',
      'retrieving': 'fetching data',
      'calculating': 'computing results',
      'formatting': 'preparing output'
    };

    // Find matching key
    const key = Object.keys(descriptions).find(k => 
      activity.toLowerCase().includes(k)
    );

    return descriptions[key] || 'processing data';
  }

  /**
   * Complete and cleanup a process
   * @param {string} userId - User ID
   */
  completeProcess(userId) {
    const process = this.activeProcesses.get(userId);
    if (!process) return;

    this.updateActivity(userId, 'completed', { 
      step: 'finished',
      totalDuration: Date.now() - process.startTime
    });

    logger.info('AI process completed', { 
      userId, 
      processId: process.id,
      totalDuration: Date.now() - process.startTime,
      totalActivities: process.activities.length,
      llmCalls: process.llmCalls.length
    });

    // Cleanup after a delay
    setTimeout(() => {
      this.activeProcesses.delete(userId);
      this.activityDescriber.delete(process.id);
    }, 5000);
  }

  /**
   * Handle process error
   * @param {string} userId - User ID
   * @param {Error} error - Error that occurred
   */
  handleProcessError(userId, error) {
    const process = this.activeProcesses.get(userId);
    if (!process) return;

    this.updateActivity(userId, 'error', {
      step: 'failed',
      error: error.message
    });

    logger.error('AI process failed', { 
      userId, 
      processId: process.id,
      error: error.message
    });

    // Cleanup after error
    setTimeout(() => {
      this.activeProcesses.delete(userId);
      this.activityDescriber.delete(process.id);
    }, 1000);
  }

  /**
   * Get all active processes (for debugging)
   * @returns {Array} List of active processes
   */
  getActiveProcesses() {
    return Array.from(this.activeProcesses.values());
  }
}

export default new AIActivityMonitor();