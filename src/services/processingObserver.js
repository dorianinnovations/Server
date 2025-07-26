import logger from '../utils/logger.js';

/**
 * Processing Observer - Watches and narrates real-time GPT-4o activity
 * This is surgically separated from actual processing - it only observes and reports
 */
class ProcessingObserver {
  constructor() {
    this.activeObservers = new Map(); // sessionId -> observer callbacks
  }

  /**
   * Register an observer for a processing session
   * @param {string} sessionId - Unique session identifier 
   * @param {Object} callbacks - { onActivity: function(message) }
   */
  registerObserver(sessionId, callbacks) {
    this.activeObservers.set(sessionId, callbacks);
    logger.info('Processing observer registered', { sessionId });
  }

  /**
   * Unregister an observer
   * @param {string} sessionId - Session to stop observing
   */
  unregisterObserver(sessionId) {
    this.activeObservers.delete(sessionId);
    logger.info('Processing observer unregistered', { sessionId });
  }

  /**
   * Observe LLM request start
   * @param {string} sessionId - Session ID
   * @param {Object} details - { model, purpose, messageCount, query, context }
   */
  observeLLMStart(sessionId, details) {
    const observer = this.activeObservers.get(sessionId);
    if (!observer) return;

    const message = this.generateLLMStartMessage(details);
    observer.onActivity(message);
    
    logger.debug('Observer: LLM start', { sessionId, message, purpose: details.purpose });
  }

  /**
   * Observe LLM request completion
   * @param {string} sessionId - Session ID  
   * @param {Object} details - { tokensUsed, duration, success }
   */
  observeLLMComplete(sessionId, details) {
    const observer = this.activeObservers.get(sessionId);
    if (!observer) return;

    const message = this.generateLLMCompleteMessage(details);
    observer.onActivity(message);
    
    logger.debug('Observer: LLM complete', { sessionId, message });
  }

  /**
   * Observe tool execution start
   * @param {string} sessionId - Session ID
   * @param {Object} details - { toolName, parameters }
   */
  observeToolStart(sessionId, details) {
    const observer = this.activeObservers.get(sessionId);
    if (!observer) return;

    const message = this.generateToolStartMessage(details);
    observer.onActivity(message);
    
    logger.debug('Observer: Tool start', { sessionId, message });
  }

  /**
   * Observe tool execution completion
   * @param {string} sessionId - Session ID
   * @param {Object} details - { toolName, success, resultSummary }
   */
  observeToolComplete(sessionId, details) {
    const observer = this.activeObservers.get(sessionId);
    if (!observer) return;

    const message = this.generateToolCompleteMessage(details);
    observer.onActivity(message);
    
    logger.debug('Observer: Tool complete', { sessionId, message });
  }

  /**
   * Observe processing phase change
   * @param {string} sessionId - Session ID
   * @param {Object} details - { phase, description }
   */
  observePhaseChange(sessionId, details) {
    const observer = this.activeObservers.get(sessionId);
    if (!observer) return;

    const message = this.generatePhaseMessage(details);
    observer.onActivity(message);
    
    logger.debug('Observer: Phase change', { sessionId, message });
  }

  // Message generators - these create human-readable narration
  generateLLMStartMessage(details) {
    const query = details.query || '';
    const queryPreview = query.length > 40 ? query.substring(0, 40) + '...' : query;
    
    const purposes = {
      'planning': `Planning approach for: ${queryPreview}`,
      'generation': `Generating insights about: ${queryPreview}`, 
      'curation': `Refining findings for: ${queryPreview}`,
      'synthesis': `Synthesizing response about: ${queryPreview}`,
      'tool_analysis': `Selecting tools to analyze: ${queryPreview}`,
      'default': `Processing request: ${queryPreview}`
    };

    return purposes[details.purpose] || purposes.default;
  }

  generateLLMCompleteMessage(details) {
    const query = details.query || '';
    const queryPreview = query.length > 30 ? query.substring(0, 30) + '...' : query;
    
    if (details.success) {
      return `Completed analysis of: ${queryPreview}`;
    } else {
      return `Retrying analysis of: ${queryPreview}`;
    }
  }

  generateToolStartMessage(details) {
    const toolMessages = {
      'web_search': `Searching the web for: ${details.parameters?.query || 'information'}`,
      'calculator': `Calculating: ${details.parameters?.expression || 'mathematical result'}`,
      'weather': `Getting weather for: ${details.parameters?.location || 'your location'}`,
      'code_executor': 'Running code to solve problem',
      'default': `Using ${details.toolName} tool`
    };

    return toolMessages[details.toolName] || toolMessages.default;
  }

  generateToolCompleteMessage(details) {
    if (details.success) {
      return `${details.toolName} completed successfully`;
    } else {
      return `${details.toolName} encountered issue, trying alternative`;
    }
  }

  generatePhaseMessage(details) {
    const phaseMessages = {
      'planning': 'Planning approach to your request',
      'research': 'Researching information you need',
      'synthesis': 'Combining findings into insights', 
      'finalization': 'Preparing final response',
      'default': details.description || 'Processing continues'
    };

    return phaseMessages[details.phase] || phaseMessages.default;
  }

  /**
   * Get active observer count for monitoring
   */
  getActiveObserverCount() {
    return this.activeObservers.size;
  }
}

export default new ProcessingObserver();