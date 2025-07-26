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
      'planning': `Numina is thinking about your request...`,
      'generation': `Gathering insights for you...`, 
      'curation': `Organizing the best results...`,
      'synthesis': `Preparing your personalized response...`,
      'tool_analysis': `Numina is selecting the right tools...`,
      'default': `Numina is working on your request...`
    };

    return purposes[details.purpose] || purposes.default;
  }

  generateLLMCompleteMessage(details) {
    const query = details.query || '';
    const queryPreview = query.length > 30 ? query.substring(0, 30) + '...' : query;
    
    if (details.success) {
      return `Numina has processed your request...`;
    } else {
      return `Numina is refining the approach...`;
    }
  }

  generateToolStartMessage(details) {
    const toolMessages = {
      'web_search': `Numina initiated a web search for: ${details.parameters?.query || 'additional information'}`,
      'calculator': `Numina is calculating: ${details.parameters?.expression || 'the mathematical result'}`,
      'weather': `Numina is checking weather for: ${details.parameters?.location || 'your location'}`,
      'code_executor': 'Numina is running code to solve this',
      'news_search': `Numina is searching news for: ${details.parameters?.query || 'current events'}`,
      'academic_search': `Numina is searching academic sources for: ${details.parameters?.query || 'research'}`,
      'default': `Numina is using ${details.toolName} to help you`
    };

    return toolMessages[details.toolName] || toolMessages.default;
  }

  generateToolCompleteMessage(details) {
    const toolCompletionMessages = {
      'web_search': details.success ? 'Numina found relevant information online' : 'Numina is trying a different search approach',
      'calculator': details.success ? 'Numina completed the calculation' : 'Numina is recalculating with a different method',
      'weather': details.success ? 'Numina retrieved the weather information' : 'Numina is trying another weather source',
      'code_executor': details.success ? 'Numina successfully ran the code' : 'Numina is adjusting the code approach',
      'news_search': details.success ? 'Numina found the latest news' : 'Numina is searching alternative news sources',
      'academic_search': details.success ? 'Numina found relevant research' : 'Numina is searching additional academic sources',
      'default': details.success ? `Numina completed the ${details.toolName} task` : `Numina is trying an alternative approach`
    };

    return toolCompletionMessages[details.toolName] || toolCompletionMessages.default;
  }

  generatePhaseMessage(details) {
    const phaseMessages = {
      'planning': 'Numina is planning the best approach for you',
      'research': 'Numina is gathering information you need',
      'synthesis': 'Numina is connecting the findings', 
      'finalization': 'Numina is preparing your personalized insights',
      'default': details.description || 'Numina continues processing'
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