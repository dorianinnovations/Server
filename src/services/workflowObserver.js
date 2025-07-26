import logger from '../utils/logger.js';

/**
 * Workflow-Based Observer System
 * 
 * This replaces individual tool/LLM call observations with semantic workflow progress.
 * Users see meaningful progress like "Analyzing AI trends (Step 2 of 4)" instead of 
 * technical messages like "web_search completed successfully".
 */
class WorkflowObserver {
  constructor() {
    this.activeWorkflows = new Map(); // sessionId -> workflow state
    this.userObservers = new Map();   // sessionId -> observer callbacks
    this.workflowRegistry = this.initializeWorkflowRegistry();
  }

  /**
   * Registry of predefined workflows that GPT-4o can execute
   */
  initializeWorkflowRegistry() {
    return {
      // Simple exploration workflows
      'simple_exploration': {
        name: 'Exploring your request',
        description: 'Basic exploration and insight generation',
        steps: [
          { id: 'analyze', name: 'Understanding your request', weight: 30 },
          { id: 'research', name: 'Gathering relevant information', weight: 40 },
          { id: 'synthesize', name: 'Creating your insights', weight: 30 }
        ]
      },

      // AI hobby research workflow
      'ai_hobby_research': {
        name: 'AI Hobby Research',
        description: 'Researching AI hobbies and latest findings',
        steps: [
          { id: 'trend_search', name: 'Searching for AI trends', weight: 25 },
          { id: 'academic_research', name: 'Finding latest research', weight: 25 },
          { id: 'hobby_analysis', name: 'Analyzing hobby opportunities', weight: 30 },
          { id: 'personalization', name: 'Creating your recommendations', weight: 20 }
        ]
      },

      // Productivity optimization workflow
      'productivity_optimization': {
        name: 'Productivity Analysis',
        description: 'Analyzing and optimizing productivity patterns',
        steps: [
          { id: 'pattern_analysis', name: 'Analyzing your patterns', weight: 35 },
          { id: 'best_practices', name: 'Researching best practices', weight: 25 },
          { id: 'personalized_plan', name: 'Creating your action plan', weight: 40 }
        ]
      },

      // Learning optimization workflow
      'learning_optimization': {
        name: 'Learning Strategy',
        description: 'Optimizing how you learn and retain information',
        steps: [
          { id: 'learning_assessment', name: 'Assessing your learning style', weight: 30 },
          { id: 'method_research', name: 'Finding effective methods', weight: 30 },
          { id: 'personalized_strategy', name: 'Building your learning plan', weight: 40 }
        ]
      },

      // Research and report generation
      'research_report': {
        name: 'Research Report',
        description: 'Comprehensive research and report generation',
        steps: [
          { id: 'topic_analysis', name: 'Understanding the topic', weight: 15 },
          { id: 'information_gathering', name: 'Gathering information', weight: 35 },
          { id: 'analysis', name: 'Analyzing findings', weight: 25 },
          { id: 'report_generation', name: 'Creating your report', weight: 25 }
        ]
      },

      // Default fallback workflow
      'default': {
        name: 'Processing Request',
        description: 'General request processing',
        steps: [
          { id: 'processing', name: 'Processing your request', weight: 100 }
        ]
      }
    };
  }

  /**
   * Register an observer for workflow progress updates
   */
  registerWorkflowObserver(sessionId, callbacks) {
    this.userObservers.set(sessionId, callbacks);
    logger.info('Workflow observer registered', { sessionId });
  }

  /**
   * Unregister workflow observer
   */
  unregisterWorkflowObserver(sessionId) {
    this.activeWorkflows.delete(sessionId);
    this.userObservers.delete(sessionId);
    logger.info('Workflow observer unregistered', { sessionId });
  }

  /**
   * Start a workflow for a user session
   */
  startWorkflow(sessionId, workflowId, query = '') {
    const workflow = this.workflowRegistry[workflowId] || this.workflowRegistry.default;
    
    const workflowState = {
      id: workflowId,
      name: workflow.name,
      description: workflow.description,
      steps: workflow.steps.map(step => ({ ...step, status: 'pending', progress: 0 })),
      currentStepIndex: 0,
      overallProgress: 0,
      query: query,
      startTime: Date.now()
    };

    this.activeWorkflows.set(sessionId, workflowState);
    
    // Send workflow started message
    this.sendWorkflowUpdate(sessionId, {
      type: 'workflow_started',
      workflow: {
        name: workflow.name,
        description: workflow.description,
        totalSteps: workflow.steps.length
      },
      message: `Starting ${workflow.name.toLowerCase()}...`
    });

    logger.info('Workflow started', { sessionId, workflowId, workflowName: workflow.name });
    
    return workflowState;
  }

  /**
   * Update progress for current workflow step
   */
  updateStepProgress(sessionId, stepId, progress, customMessage = null) {
    const workflowState = this.activeWorkflows.get(sessionId);
    if (!workflowState) {
      logger.warn('No active workflow for session', { sessionId });
      return;
    }

    // Find the step
    const stepIndex = workflowState.steps.findIndex(step => step.id === stepId);
    if (stepIndex === -1) {
      logger.warn('Step not found in workflow', { sessionId, stepId });
      return;
    }

    // Update step
    const step = workflowState.steps[stepIndex];
    step.progress = Math.min(100, Math.max(0, progress));
    step.status = progress >= 100 ? 'completed' : progress > 0 ? 'active' : 'pending';

    // Update current step index
    workflowState.currentStepIndex = stepIndex;

    // Calculate overall progress
    let totalWeight = 0;
    let completedWeight = 0;
    
    workflowState.steps.forEach(s => {
      totalWeight += s.weight;
      completedWeight += (s.progress / 100) * s.weight;
    });
    
    workflowState.overallProgress = Math.round((completedWeight / totalWeight) * 100);

    // Generate progress message
    const progressMessage = customMessage || this.generateStepMessage(step, progress);
    
    // Send progress update
    this.sendWorkflowUpdate(sessionId, {
      type: 'step_progress',
      currentStep: {
        id: step.id,
        name: step.name,
        progress: step.progress,
        status: step.status
      },
      overallProgress: workflowState.overallProgress,
      message: progressMessage
    });

    logger.debug('Workflow step progress updated', { 
      sessionId, 
      stepId, 
      progress, 
      overallProgress: workflowState.overallProgress 
    });
  }

  /**
   * Move to next step in workflow
   */
  moveToNextStep(sessionId, customMessage = null) {
    const workflowState = this.activeWorkflows.get(sessionId);
    if (!workflowState) return;

    const currentStep = workflowState.steps[workflowState.currentStepIndex];
    if (currentStep && currentStep.progress < 100) {
      // Complete current step first
      this.updateStepProgress(sessionId, currentStep.id, 100, customMessage);
    }

    // Move to next step
    const nextStepIndex = workflowState.currentStepIndex + 1;
    if (nextStepIndex < workflowState.steps.length) {
      workflowState.currentStepIndex = nextStepIndex;
      const nextStep = workflowState.steps[nextStepIndex];
      
      // Start next step
      this.updateStepProgress(sessionId, nextStep.id, 0, 
        customMessage || `Starting ${nextStep.name.toLowerCase()}...`);
    }
  }

  /**
   * Complete the entire workflow
   */
  completeWorkflow(sessionId, finalMessage = null) {
    const workflowState = this.activeWorkflows.get(sessionId);
    if (!workflowState) return;

    // Complete all steps
    workflowState.steps.forEach(step => {
      step.progress = 100;
      step.status = 'completed';
    });
    workflowState.overallProgress = 100;

    const completionTime = Date.now() - workflowState.startTime;
    const message = finalMessage || `${workflowState.name} completed! Your insights are ready.`;

    this.sendWorkflowUpdate(sessionId, {
      type: 'workflow_completed',
      overallProgress: 100,
      completionTime: completionTime,
      message: message
    });

    logger.info('Workflow completed', { 
      sessionId, 
      workflowId: workflowState.id,
      completionTime: completionTime + 'ms'
    });

    // Clean up after a delay
    setTimeout(() => {
      this.activeWorkflows.delete(sessionId);
    }, 5000);
  }

  /**
   * Handle workflow errors
   */
  reportWorkflowError(sessionId, error, retryable = true) {
    const workflowState = this.activeWorkflows.get(sessionId);
    if (!workflowState) return;

    const currentStep = workflowState.steps[workflowState.currentStepIndex];
    let message;
    
    if (retryable) {
      message = `Adjusting approach for ${currentStep?.name.toLowerCase() || 'current step'}...`;
    } else {
      message = `Encountered an issue. Trying an alternative approach...`;
    }

    this.sendWorkflowUpdate(sessionId, {
      type: 'step_error',
      currentStep: currentStep ? {
        id: currentStep.id,
        name: currentStep.name,
        status: 'error'
      } : null,
      message: message,
      retryable: retryable
    });

    logger.warn('Workflow error reported', { sessionId, error: error.message, retryable });
  }

  /**
   * Generate contextual step messages
   */
  generateStepMessage(step, progress) {
    const progressPhases = {
      0: 'Starting',
      25: 'Making progress on',
      50: 'Continuing with',
      75: 'Nearly finished',
      100: 'Completed'
    };

    const phase = Object.keys(progressPhases)
      .reverse()
      .find(threshold => progress >= parseInt(threshold));
    
    const action = progressPhases[phase];
    return `${action} ${step.name.toLowerCase()}...`;
  }

  /**
   * Send workflow update to user
   */
  sendWorkflowUpdate(sessionId, updateData) {
    const observer = this.userObservers.get(sessionId);
    if (!observer || !observer.onWorkflowUpdate) return;

    try {
      observer.onWorkflowUpdate(updateData);
    } catch (error) {
      logger.error('Failed to send workflow update', { sessionId, error: error.message });
    }
  }

  /**
   * Get workflow registry for external inspection
   */
  getWorkflowRegistry() {
    return this.workflowRegistry;
  }

  /**
   * Get active workflow state
   */
  getWorkflowState(sessionId) {
    return this.activeWorkflows.get(sessionId);
  }

  /**
   * Auto-detect workflow based on user query
   */
  detectWorkflowFromQuery(query) {
    const queryLower = query.toLowerCase();
    
    // AI and hobby related
    if (queryLower.includes('ai hobby') || queryLower.includes('ai finding') || 
        queryLower.includes('ai trend') || queryLower.includes('artificial intelligence hobby')) {
      return 'ai_hobby_research';
    }
    
    // Learning related
    if (queryLower.includes('learn faster') || queryLower.includes('learning') || 
        queryLower.includes('study') || queryLower.includes('remember')) {
      return 'learning_optimization';
    }
    
    // Productivity related
    if (queryLower.includes('productivity') || queryLower.includes('efficient') || 
        queryLower.includes('organize') || queryLower.includes('time management')) {
      return 'productivity_optimization';
    }
    
    // Research and report
    if (queryLower.includes('research') || queryLower.includes('report') || 
        queryLower.includes('analyze') || queryLower.includes('findings')) {
      return 'research_report';
    }
    
    // Default to simple exploration
    return 'simple_exploration';
  }

  /**
   * Add custom workflow dynamically
   */
  registerCustomWorkflow(workflowId, workflowDefinition) {
    this.workflowRegistry[workflowId] = workflowDefinition;
    logger.info('Custom workflow registered', { workflowId, name: workflowDefinition.name });
  }
}

export default new WorkflowObserver();