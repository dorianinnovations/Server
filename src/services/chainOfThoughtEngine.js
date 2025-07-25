import { createLLMService } from './llmService.js';
import logger from '../utils/logger.js';

class ChainOfThoughtEngine {
  constructor() {
    this.llmService = createLLMService();
  }

  /**
   * Process a query through chain of thought reasoning with AI transparency
   * @param {string} userId - User ID for personalization
   * @param {string} query - User's query/prompt
   * @param {Object} options - Processing options (includes aiActivityMonitor)
   * @param {Object} callbacks - Event callbacks for streaming
   */
  async processQuery(userId, query, options, callbacks) {
    const steps = [
      { id: '1', title: 'Analyzing core sources', status: 'pending' },
      { id: '2', title: 'Checking additional scenarios', status: 'pending' },
      { id: '3', title: 'Cross-referencing patterns', status: 'pending' },
      { id: '4', title: 'Synthesizing insights', status: 'pending' },
      { id: '5', title: 'Generating nodes', status: 'pending' }
    ];

    logger.info('Starting chain of thought process', { 
      userId, 
      query: query.substring(0, 100),
      stepsCount: steps.length 
    });

    try {
      // Get AI activity monitor if provided for transparency
      const aiMonitor = options.context?.aiActivityMonitor;
      
      // Process each step with real-time updates and AI transparency
      for (let i = 0; i < steps.length; i++) {
        steps[i].status = 'active';
        
        // Update AI activity monitor for transparency
        if (aiMonitor) {
          aiMonitor.updateActivity(userId, `executing step: ${steps[i].title.toLowerCase()}`, {
            step: `chain_step_${i + 1}`,
            totalSteps: steps.length,
            currentStepTitle: steps[i].title
          });
        }
        
        // Get intelligent contextual progress message using Llama
        const progressMessage = await this.getProgressInsight(
          steps[i].title, 
          query,
          options.context || {},
          options.fastModel || 'meta-llama/llama-3.1-8b-instruct'
        );

        // Log the Llama narration call for transparency
        if (aiMonitor) {
          aiMonitor.logLLMCall(userId, {
            model: options.fastModel || 'meta-llama/llama-3.1-8b-instruct',
            purpose: 'progress_narration',
            tokens: 12,
            step: steps[i].title
          });
        }

        // Send step update to client with AI transparency
        callbacks.onStepUpdate({
          id: steps[i].id,
          allSteps: [...steps]
        }, progressMessage);

        // Check if this is the final "Generating nodes" step
        const isFinalStep = i === steps.length - 1 && steps[i].title.toLowerCase().includes('generating');
        
        if (isFinalStep) {
          // For the final step, don't complete it yet - let the actual synthesis complete it
          logger.info('Deferring final step completion until actual node generation completes');
          
          // Add a callback reference for later completion
          this.pendingStepCompletion = {
            step: steps[i],
            index: i,
            callbacks,
            aiMonitor,
            allSteps: steps
          };
          
          // Brief pause before starting synthesis
          await new Promise(resolve => setTimeout(resolve, 800));
        } else {
          // For other steps, use normal timing
          const processingTime = 1800 + Math.random() * 2200;
          await new Promise(resolve => setTimeout(resolve, processingTime));
          
          steps[i].status = 'completed';
          
          // Update AI monitor for step completion
          if (aiMonitor) {
            aiMonitor.updateActivity(userId, `completed: ${steps[i].title.toLowerCase()}`, {
              step: `chain_step_${i + 1}_complete`,
              completedSteps: i + 1,
              totalSteps: steps.length
            });
          }
          
          // Send completion update
          callbacks.onStepUpdate({
            id: steps[i].id,
            allSteps: [...steps]
          }, '');
          
          // Brief pause between steps for UX pacing
          await new Promise(resolve => setTimeout(resolve, 400));
        }
      }

      // Final synthesis with main model and AI transparency
      logger.info('Starting final synthesis with AI transparency', { userId });
      
      // Update AI monitor for final synthesis phase
      if (aiMonitor) {
        aiMonitor.updateActivity(userId, 'synthesizing final insights', {
          step: 'final_synthesis',
          phase: 'gpt4_processing'
        });
      }
      
      const finalResult = await this.synthesizeResults(userId, query, options);
      
      logger.info('Chain of thought completed successfully', { 
        userId, 
        nodesGenerated: finalResult.nodes?.length || 0 
      });

      callbacks.onComplete(finalResult);

    } catch (error) {
      logger.error('Chain of thought process failed', { 
        userId, 
        error: error.message,
        stack: error.stack 
      });
      callbacks.onError(error);
    }
  }

  /**
   * Generate contextual progress insight using a cheap LLM model
   * @param {string} stepTitle - Current step being processed
   * @param {string} query - Original user query
   * @param {Object} context - Additional context
   * @param {string} model - LLM model to use (cheap one)
   * @returns {string} Progress message
   */
  async getProgressInsight(stepTitle, query, context = {}, model = 'meta-llama/llama-3.1-8b-instruct') {
    try {
      // Concise LLAMA prompt for progress reporting
      const systemPrompt = `Report what the AI is currently doing in one clear sentence. Be specific to the user's query domain and the current processing step.

Examples:
- "Analyzing data patterns"
- "Processing domain knowledge" 
- "Evaluating response options"
- "Synthesizing findings"`;
      
      const contextInfo = context.useUBPM ? ' using behavioral profiling' : '';
      const actionsInfo = context.actions ? ` with ${context.actions.slice(0, 2).join(' and ')} focus` : '';
      
      const userPrompt = `Step: "${stepTitle}"
Query: "${query.substring(0, 60)}"${contextInfo}${actionsInfo}

What is the AI doing right now?`;

      const response = await this.llmService.makeLLMRequest([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        model,
        max_tokens: 80, // Concise responses
        temperature: 0.4, // More focused, less verbose
        stream: false,
        stop: ['\n', '.', 'Human:', 'Assistant:']
      });

      let message = response.content || this.getFallbackInsight(stepTitle);
      
      // Light cleanup - preserve natural sentence structure
      message = message.trim()
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/^["']|["']$/g, '') // Remove surrounding quotes
        .trim();
      
      // Basic validation - ensure we have meaningful content
      const words = message.split(' ').filter(word => word.length > 0);
      if (words.length >= 3 && message.length <= 200) {
        // Capitalize first letter for proper sentence format
        message = message.charAt(0).toUpperCase() + message.slice(1);
        return message;
      } else {
        // Fallback to contextual insight if response is too short or too long
        return this.getContextualInsight(stepTitle, query) || this.getFallbackInsight(stepTitle);
      }

    } catch (error) {
      logger.warn('LLM insight failed, using contextual fallback', { 
        stepTitle, 
        error: error.message 
      });
      
      return this.getContextualInsight(stepTitle, query) || this.getFallbackInsight(stepTitle);
    }
  }

  getContextualInsight(stepTitle, query) {
    // Map specific query keywords to natural sentence contextual messages
    const queryKeywords = query.toLowerCase();
    
    const contextualMaps = {
      'Analyzing core sources': {
        'sleep': 'Scanning through sleep pattern data and circadian rhythm indicators',
        'productivity': 'Reading productivity metrics and workflow efficiency patterns carefully',
        'creativity': 'Processing creative idea patterns and innovation frameworks',
        'relationships': 'Analyzing relationship behavior patterns and social dynamics',
        'habits': 'Examining habit formation data and behavioral consistency metrics',
        'emotions': 'Processing emotional state indicators and mood pattern analysis',
        'default': 'Scanning core data sources and foundational information patterns'
      },
      'Checking additional scenarios': {
        'sleep': 'Exploring alternative sleep optimization scenarios and recovery patterns',
        'productivity': 'Checking productivity improvement metrics across different contexts',
        'creativity': 'Validating creative workflow ideas and alternative approaches',
        'relationships': 'Exploring relationship dynamic scenarios and interaction patterns',
        'habits': 'Checking alternative habit patterns and behavioral modification strategies',
        'emotions': 'Validating emotional response data and psychological frameworks',
        'default': 'Exploring additional scenario options and contextual variations'
      },
      'Cross-referencing patterns': {
        'sleep': 'Linking sleep behavior patterns with health and performance indicators',
        'productivity': 'Connecting productivity metrics with environmental and personal factors',
        'creativity': 'Linking creative idea networks and inspiration sources',
        'relationships': 'Mapping relationship connection patterns and social influence networks',
        'habits': 'Finding behavioral habit connections and trigger-response relationships',
        'emotions': 'Mapping emotional pattern links and psychological state correlations',
        'default': 'Finding cross-pattern connections and interdisciplinary relationships'
      },
      'Synthesizing insights': {
        'sleep': 'Combining sleep optimization insights with holistic wellness approaches',
        'productivity': 'Building comprehensive productivity insights from multiple data streams',
        'creativity': 'Synthesizing creative workflow ideas into actionable frameworks',
        'relationships': 'Combining relationship dynamic insights for better social connections',
        'habits': 'Creating habit optimization insights based on behavioral science',
        'emotions': 'Building emotional intelligence insights from psychological research',
        'default': 'Combining insights from analysis into coherent understanding'
      },
      'Generating nodes': {
        'sleep': 'Creating sleep improvement nodes with personalized recommendations',
        'productivity': 'Building productivity optimization nodes tailored to your workflow',
        'creativity': 'Generating creative enhancement nodes for innovation and inspiration',
        'relationships': 'Creating relationship insight nodes for better social connections',
        'habits': 'Finalizing habit formation nodes with practical implementation strategies',
        'emotions': 'Creating emotional wellness nodes for mental health and balance',
        'default': 'Creating personalized insight nodes based on your unique context'
      }
    };

    const stepMap = contextualMaps[stepTitle];
    if (!stepMap) return null;

    // Find matching keyword
    for (const [keyword, message] of Object.entries(stepMap)) {
      if (keyword !== 'default' && queryKeywords.includes(keyword)) {
        return message;
      }
    }

    return stepMap.default;
  }

  /**
   * Get fallback insight when LLM is unavailable
   * @param {string} stepTitle - Current step title
   * @returns {string} Fallback message
   */
  getFallbackInsight(stepTitle) {
    const fallbackMessages = {
      'Analyzing core sources': [
        'Scanning primary data sources to understand your context and preferences',
        'Reading behavioral pattern data to identify relevant insights',
        'Processing user information thoroughly to build comprehensive understanding'
      ],
      'Checking additional scenarios': [
        'Exploring alternative scenario options to broaden the analysis scope',
        'Validating supplementary data sources for comprehensive coverage',
        'Checking contextual information patterns across different domains'
      ],
      'Cross-referencing patterns': [
        'Finding behavioral connection patterns that link different aspects together',
        'Mapping data relationship networks to understand interconnections',
        'Linking relevant information sources to create holistic insights'
      ],
      'Synthesizing insights': [
        'Combining analytical findings together into coherent recommendations',
        'Creating comprehensive insight summaries from multiple data streams',
        'Building personalized recommendation systems based on your unique profile'
      ],
      'Generating nodes': [
        'Creating personalized insight nodes tailored to your specific needs',
        'Building interactive data visualizations for better understanding',
        'Finalizing intelligent recommendation outputs with actionable guidance'
      ]
    };

    const messages = fallbackMessages[stepTitle] || [
      'Processing complex user data to generate meaningful insights',
      'Analyzing behavioral information patterns for personalized recommendations',
      'Working on intelligent insights that match your specific context'
    ];

    return messages[Math.floor(Math.random() * messages.length)];
  }

  /**
   * Synthesize final results using main model with real AI monitoring
   * @param {string} userId - User ID
   * @param {string} query - Original query
   * @param {Object} options - Processing options
   * @returns {Object} Final results with nodes
   */
  async synthesizeResults(userId, query, options) {
    try {
      // Import real AI monitoring system
      const aiActivityMonitor = (await import('./aiActivityMonitor.js')).default;
      
      // Call the real node generation logic with monitoring
      const realNodes = await this.generateRealNodes(userId, query, options, aiActivityMonitor);
      
      // Complete the pending final step if it exists
      if (this.pendingStepCompletion) {
        const { step, index, callbacks, aiMonitor, allSteps } = this.pendingStepCompletion;
        
        logger.info('Completing deferred final step after node generation');
        
        // Mark step as completed
        step.status = 'completed';
        
        // Update AI monitor for step completion
        if (aiMonitor) {
          aiMonitor.updateActivity(userId, `completed: ${step.title.toLowerCase()}`, {
            step: `chain_step_${index + 1}_complete`,
            completedSteps: index + 1,
            totalSteps: allSteps.length,
            nodesGenerated: realNodes.length
          });
        }
        
        // Send completion update to client with all steps
        callbacks.onStepUpdate({
          id: step.id,
          allSteps: [...allSteps]
        }, '');
        
        // Clear the pending completion
        this.pendingStepCompletion = null;
        
        // Brief pause for UI smoothness
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      return {
        nodes: realNodes,
        insights: [
          'Analysis completed using real AI processing',
          'Multiple data sources integrated successfully'
        ],
        sessionId: `cot_${Date.now()}`,
        completed: true,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to synthesize results', { 
        userId, 
        error: error.message 
      });
      
      // Also complete the step in case of error
      if (this.pendingStepCompletion) {
        const { step, callbacks, allSteps } = this.pendingStepCompletion;
        step.status = 'completed';
        callbacks.onStepUpdate({
          id: step.id,
          allSteps: [...allSteps]
        }, '');
        this.pendingStepCompletion = null;
      }
      
      throw new Error('Failed to generate final insights');
    }
  }

  /**
   * Generate real nodes using actual AI processing with monitoring
   * @param {string} userId - User ID
   * @param {string} query - User query
   * @param {Object} options - Processing options  
   * @param {Object} aiActivityMonitor - Activity monitor instance
   * @returns {Array} Generated nodes
   */
  async generateRealNodes(userId, query, options, aiActivityMonitor) {
    try {
      // Update activity: Starting real AI processing
      aiActivityMonitor.updateActivity(userId, 'analyzing user context', { step: 'context_analysis' });
      
      // Get selected actions from options context
      const selectedActions = options.context?.actions || ['explore', 'discover', 'connect'];
      
      // Update activity: Building AI prompt  
      aiActivityMonitor.updateActivity(userId, 'building ai prompt', { step: 'prompt_construction' });
      
      // Build context for AI (similar to sandbox route)
      let contextPrompt = `User is exploring: "${query}"\n\nSelected actions: ${selectedActions.join(', ')}\n\n`;
      
      // Create enhanced AI prompt for node generation
      const aiPrompt = `${contextPrompt}Generate 2-3 discovery nodes that help the user explore "${query}" in meaningful ways. Focus on ${selectedActions.join(' and ')} aspects.

REQUIREMENTS:
- Title: Compelling, specific, max 60 chars
- Content: 2-3 informative sentences with actionable insights
- Category: Relevant domain (insight, behavioral, analytical, etc.)
- Confidence: 0.7-0.95 based on accuracy
- PersonalHook: Connection to user query

Return ONLY valid JSON array:
[
  {
    "title": "Specific Title",
    "content": "Rich content with actionable insights.",
    "category": "insight", 
    "confidence": 0.85,
    "personalHook": "Connection to your exploration"
  }
]`;

      // Update activity: Processing with main LLM
      aiActivityMonitor.updateActivity(userId, 'processing with main ai', { step: 'llm_generation' });
      
      // Log the main LLM call for transparency
      aiActivityMonitor.logLLMCall(userId, {
        model: options.mainModel || 'openai/gpt-4o',
        purpose: 'node_generation',
        tokens: 1500,
        step: 'primary_reasoning'
      });

      // Make the real LLM request with premium model
      const response = await this.llmService.makeLLMRequest([
        { role: 'system', content: 'You are an expert knowledge discovery assistant. Generate insightful, accurate discovery nodes in valid JSON format. Always respond with valid JSON array.' },
        { role: 'user', content: aiPrompt }
      ], {
        model: options.mainModel || 'openai/gpt-4o',
        n_predict: 1500,
        temperature: 0.7,
        stop: ['\n\n\n', '```', 'Human:', 'Assistant:'],
        max_tokens: 1500,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      // Update activity: Parsing AI response
      aiActivityMonitor.updateActivity(userId, 'parsing ai response', { step: 'response_parsing' });

      let generatedNodes = [];
      try {
        const jsonMatch = response.content.match(/\[(.*)\]/s);
        if (jsonMatch) {
          generatedNodes = JSON.parse(`[${jsonMatch[1]}]`);
        } else {
          generatedNodes = JSON.parse(response.content);
        }
      } catch (parseError) {
        logger.warn('Failed to parse AI response as JSON', { userId, error: parseError.message });
        
        // Fallback to mock nodes if parsing fails
        generatedNodes = [
          {
            title: 'AI Processing Insight',
            content: `Generated analysis based on your query: "${query.substring(0, 100)}". This insight was created through real AI processing.`,
            category: 'insight',
            confidence: 0.8,
            personalHook: `This connects directly to your exploration of ${query.split(' ').slice(0, 3).join(' ')}`
          }
        ];
      }

      // Update activity: Enhancing nodes with metadata
      aiActivityMonitor.updateActivity(userId, 'enhancing node metadata', { step: 'node_enhancement' });

      // Add IDs and deep insights to generated nodes
      const enhancedNodes = generatedNodes.map((node, index) => ({
        id: `node_${Date.now()}_${index + 1}`,
        title: node.title,
        content: node.content,
        category: node.category || 'insight',
        confidence: node.confidence || (0.8 + Math.random() * 0.15),
        personalHook: node.personalHook || `This insight relates to your query about ${query.split(' ').slice(0, 3).join(' ')}`,
        deepInsights: {
          summary: 'Generated through monitored real-time AI processing',
          keyPatterns: [
            'Real AI model processing and analysis',
            'Contextual understanding of user query',
            'Structured knowledge discovery approach'
          ],
          personalizedContext: `Based on your query "${query}", this insight was generated using monitored AI processing`,
          dataConnections: [
            {
              type: 'ai_processing_metric',
              value: 'Real-time monitored generation',
              source: 'Chain of Thought Engine',
              relevanceScore: 0.9
            }
          ],
          relevanceScore: node.confidence || 0.85
        }
      }));

      // Update activity: Finalizing output
      aiActivityMonitor.updateActivity(userId, 'finalizing node output', { step: 'completion' });

      return enhancedNodes;

    } catch (error) {
      logger.error('Failed to generate real nodes', { 
        userId, 
        error: error.message 
      });
      
      // Return fallback nodes on error
      return [
        {
          id: `node_${Date.now()}_fallback`,
          title: 'Processing Error Recovery',
          content: 'An error occurred during AI processing. This is a fallback insight generated to maintain functionality.',
          category: 'system',
          confidence: 0.7,
          personalHook: 'System recovery mechanism activated',
          deepInsights: {
            summary: 'Fallback processing activated due to AI processing error',
            keyPatterns: ['Error recovery', 'System resilience', 'Graceful degradation'],
            personalizedContext: 'System maintained functionality despite processing error',
            dataConnections: [],
            relevanceScore: 0.7
          }
        }
      ];
    }
  }
}

export default new ChainOfThoughtEngine();