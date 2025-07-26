import { createLLMService } from './llmService.js';
import toolRegistry from './toolRegistry.js';
import toolExecutor from './toolExecutor.js';
import processingObserver from './processingObserver.js';
import logger from '../utils/logger.js';

class ChainOfThoughtEngine {
  constructor() {
    this.llmService = createLLMService();
  }

  /**
   * Process a query through chain of thought reasoning with AI transparency
   * Houses the observer bridge that watches real node generation
   * @param {string} userId - User ID for personalization
   * @param {string} query - User's query/prompt
   * @param {Object} options - Processing options (includes aiActivityMonitor)
   * @param {Object} callbacks - Event callbacks for streaming
   */
  async processQuery(userId, query, options, callbacks) {
    const sessionId = `cot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let stepCounter = 0;
    let currentSteps = [];
    let isProcessingComplete = false;

    logger.info('Dynamic chain of thought housing observer bridge', { userId, sessionId });

    // Register observer bridge to watch real processing with dynamic steps
    processingObserver.registerObserver(sessionId, {
      onActivity: (message) => {
        stepCounter++;
        const stepId = stepCounter.toString();
        
        // Mark previous step as completed if it exists
        const existingStepIndex = currentSteps.findIndex(s => s.status === 'active');
        if (existingStepIndex >= 0) {
          currentSteps[existingStepIndex].status = 'completed';
        }
        
        // Add new active step dynamically - no predefined limit
        const newStep = {
          id: stepId,
          title: message,
          status: 'active'
        };
        currentSteps.push(newStep);

        // Stream to frontend with current progress
        callbacks.onStepUpdate({
          id: stepId,
          allSteps: [...currentSteps],
          totalSteps: currentSteps.length, // Dynamic total
          isComplete: false
        }, message);

        logger.info('🔍 Dynamic chain of thought streaming:', { 
          userId, 
          stepId, 
          message, 
          totalSteps: currentSteps.length 
        });
      }
    });

    try {
      // Call real node generation with observer watching
      const nodeResult = await this.generateNodesWithObserver(userId, query, options, sessionId);
      
      // Mark final step as completed and set processing as complete
      if (currentSteps.length > 0) {
        const lastStep = currentSteps[currentSteps.length - 1];
        if (lastStep.status === 'active') {
          lastStep.status = 'completed';
        }
      }
      
      isProcessingComplete = true;
      
      // Send final update with completion status
      callbacks.onStepUpdate({
        id: 'final',
        allSteps: [...currentSteps],
        totalSteps: currentSteps.length,
        isComplete: true
      }, 'Processing complete');
      
      // Unregister observer
      processingObserver.unregisterObserver(sessionId);
      
      // Return the actual nodes with dynamic step count
      callbacks.onComplete({
        nodes: nodeResult.nodes,
        sessionId,
        originalQuery: query,
        completed: true,
        totalStepsProcessed: currentSteps.length,
        dynamicSteps: true,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      // Mark any active step as failed
      if (currentSteps.length > 0) {
        const activeStep = currentSteps.find(s => s.status === 'active');
        if (activeStep) {
          activeStep.status = 'failed';
          activeStep.title = `Error: ${error.message.substring(0, 50)}`;
        }
      }
      
      processingObserver.unregisterObserver(sessionId);
      logger.error('Dynamic chain of thought housing observer failed', { 
        userId, 
        error: error.message,
        stepsCompleted: currentSteps.length
      });
      callbacks.onError(error);
    }
  }

  /**
   * Generate nodes with observer watching - integrates with sandbox logic
   */
  async generateNodesWithObserver(userId, query, options, observerSessionId) {
    // Basic setup for node generation with observer
    const selectedActions = ['research', 'analyze']; // Default actions
    
    // Simple LLM call with observer watching
    const nodePrompt = `Generate 2-3 discovery nodes for: "${query}"
    
Each node should be a JSON object with:
- title: Brief, specific title (max 60 chars)
- content: Informative content (2-3 sentences)
- category: Relevant category
- confidence: 0.7-1.0

Return as JSON array.`;

    logger.info('🎯 Generating nodes with observer watching', { userId, observerSessionId });

    const response = await this.llmService.makeLLMRequest([
      { role: 'system', content: 'Generate discovery nodes as JSON array. Respond ONLY with valid JSON.' },
      { role: 'user', content: nodePrompt }
    ], {
      model: 'openai/gpt-4o',
      max_tokens: 1000,
      temperature: 0.7,
      observerSessionId,
      observerPurpose: 'generation',
      response_format: { type: "json_object" }
    });

    // Parse response into nodes
    let nodes = [];
    try {
      const cleanResponse = response.content.trim().replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanResponse);
      nodes = Array.isArray(parsed) ? parsed : (parsed.nodes || []);
    } catch (parseError) {
      logger.warn('Failed to parse generated nodes', { error: parseError.message });
      nodes = [{
        id: `fallback_${Date.now()}`,
        title: 'Processing Complete',
        content: `Analysis completed for: ${query}`,
        category: 'General',
        confidence: 0.7
      }];
    }

    // Format nodes properly
    const validNodes = nodes.slice(0, 3).map((node, index) => ({
      id: `observed_${Date.now()}_${index}`,
      title: String(node.title || `Node ${index + 1}`).substring(0, 100),
      content: String(node.content || 'Generated content').substring(0, 500),
      category: String(node.category || 'Discovery').substring(0, 50),
      confidence: Math.min(1.0, Math.max(0.0, parseFloat(node.confidence) || 0.7)),
      position: {
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200
      },
      connections: [],
      isLocked: false
    }));

    logger.info('✅ Nodes generated with observer', { 
      userId, 
      nodeCount: validNodes.length,
      observerSessionId 
    });

    return { nodes: validNodes };
  }

  /**
   * Generate simple narration message
   * @param {string} stepTitle - Current step being processed
   * @param {string} query - Original user query
   * @param {string} model - LLM model to use (cheap one)
   * @returns {string} Narration message
   */
  async getNarrationMessage(stepTitle, query, model = 'meta-llama/llama-3.1-8b-instruct') {
    try {
      // Simple prompt for narration only
      const systemPrompt = `You are an observer. Your job is to briefly describe what's happening in one simple sentence.

Examples:
- "Analyzing the request"
- "Selecting tools"
- "Processing response"`;
      
      const userPrompt = `Step: "${stepTitle}"
User asked: "${query.substring(0, 40)}"

What's happening right now?`;

      const response = await this.llmService.makeLLMRequest([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        model,
        max_tokens: 40, // Very concise
        temperature: 0.3, // Focused
        stream: false
      });

      let message = response.content || this.getFallbackNarration(stepTitle);
      
      // Clean up response
      message = message.trim()
        .replace(/\s+/g, ' ')
        .replace(/^["']|["']$/g, '')
        .trim();
      
      // Validate and return
      if (message.length > 10 && message.length <= 100) {
        return message.charAt(0).toUpperCase() + message.slice(1);
      } else {
        return this.getFallbackNarration(stepTitle);
      }

    } catch (error) {
      logger.warn('Narration failed, using fallback', { 
        stepTitle, 
        error: error.message 
      });
      
      return this.getFallbackNarration(stepTitle);
    }
  }

  /**
   * Get simple fallback narration when LLAMA is unavailable
   * @param {string} stepTitle - Current step title
   * @returns {string} Fallback narration message
   */
  getFallbackNarration(stepTitle) {
    const fallbackMessages = {
      'Observing GPT-4o analysis': [
        'Watching GPT-4o understand your request',
        'Observing initial analysis process',
        'Monitoring GPT-4o\'s thinking'
      ],
      'Monitoring tool execution': [
        'Watching tool selection and execution',
        'Observing GPT-4o use available tools',
        'Monitoring tool processing'
      ],
      'Watching synthesis process': [
        'Observing response synthesis',
        'Watching GPT-4o combine information',
        'Monitoring final processing'
      ],
      'Reporting completion': [
        'Watching final preparation',
        'Observing completion process',
        'Monitoring final checks'
      ]
    };

    const messages = fallbackMessages[stepTitle] || [
      'Observing AI processing',
      'Watching GPT-4o work',
      'Monitoring progress'
    ];

    return messages[Math.floor(Math.random() * messages.length)];
  }

}

export default new ChainOfThoughtEngine();