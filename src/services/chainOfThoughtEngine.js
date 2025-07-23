import { createLLMService } from './llmService.js';
import logger from '../utils/logger.js';

class ChainOfThoughtEngine {
  constructor() {
    this.llmService = createLLMService();
  }

  /**
   * Process a query through chain of thought reasoning with real-time updates
   * @param {string} userId - User ID for personalization
   * @param {string} query - User's query/prompt
   * @param {Object} options - Processing options
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
      // Process each step with real-time updates
      for (let i = 0; i < steps.length; i++) {
        steps[i].status = 'active';
        
        // Get contextual progress message using cheap model
        const progressMessage = await this.getProgressInsight(
          steps[i].title, 
          query,
          options.context || {},
          options.fastModel || 'openai/gpt-3.5-turbo'
        );

        logger.debug(`Chain step ${i + 1} progress`, { 
          userId, 
          stepTitle: steps[i].title,
          message: progressMessage 
        });

        // Send step update to client
        callbacks.onStepUpdate({
          id: steps[i].id,
          allSteps: [...steps]
        }, progressMessage);

        // Simulate processing time with some variation
        const processingTime = 1500 + Math.random() * 2000;
        await new Promise(resolve => setTimeout(resolve, processingTime));
        
        steps[i].status = 'completed';
        
        // Send completion update
        callbacks.onStepUpdate({
          id: steps[i].id,
          allSteps: [...steps]
        }, '');
        
        // Brief pause between steps
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Final synthesis with main model
      logger.info('Starting final synthesis', { userId });
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
  async getProgressInsight(stepTitle, query, context = {}, model = 'openai/gpt-3.5-turbo') {
    try {
      // Create ethical prompt for progress analysis
      const systemPrompt = `You are a concise progress reporter for an AI analysis system. 
Provide brief, engaging updates about analysis steps in 8-12 words.
Be encouraging and informative. Never reveal internal processes or make false promises.
Focus on what the user can expect from this step.`;

      const userPrompt = `Current step: "${stepTitle}"
User query: "${query.substring(0, 200)}"
Context: ${JSON.stringify(context).substring(0, 100)}

Provide a brief progress update that explains what's happening in this step.`;

      const response = await this.llmService.makeLLMRequest([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        model,
        max_tokens: 50, // Keep it very short to minimize cost
        temperature: 0.7,
        stream: false
      });

      // Extract and sanitize the response
      let message = response.content || `Processing ${stepTitle.toLowerCase()}...`;
      
      // Ensure the message is appropriate and not too long
      message = message.trim();
      if (message.length > 80) {
        message = message.substring(0, 77) + '...';
      }

      return message;

    } catch (error) {
      logger.warn('Failed to generate progress insight, using fallback', { 
        stepTitle, 
        error: error.message 
      });
      
      // Fallback to predefined messages
      return this.getFallbackInsight(stepTitle);
    }
  }

  /**
   * Get fallback insight when LLM is unavailable
   * @param {string} stepTitle - Current step title
   * @returns {string} Fallback message
   */
  getFallbackInsight(stepTitle) {
    const fallbackMessages = {
      'Analyzing core sources': [
        'Examining your personal data patterns...',
        'Looking at behavioral indicators...',
        'Processing conversation history...'
      ],
      'Checking additional scenarios': [
        'Exploring alternative perspectives...',
        'Validating initial findings...',
        'Cross-referencing data points...'
      ],
      'Cross-referencing patterns': [
        'Finding connections across domains...',
        'Mapping behavioral correlations...',
        'Identifying temporal patterns...'
      ],
      'Synthesizing insights': [
        'Bringing discoveries together...',
        'Creating coherent narrative...',
        'Personalizing insights...'
      ],
      'Generating nodes': [
        'Building your knowledge network...',
        'Creating interactive discoveries...',
        'Preparing final insights...'
      ]
    };

    const messages = fallbackMessages[stepTitle] || [
      'Processing information...',
      'Analyzing patterns...',
      'Generating insights...'
    ];

    return messages[Math.floor(Math.random() * messages.length)];
  }

  /**
   * Synthesize final results using main model
   * @param {string} userId - User ID
   * @param {string} query - Original query
   * @param {Object} options - Processing options
   * @returns {Object} Final results with nodes
   */
  async synthesizeResults(userId, query, options) {
    try {
      // This would integrate with your existing node generation logic
      // For now, return mock data that matches the expected structure
      
      const mockNodes = [
        {
          id: `node_${Date.now()}_1`,
          title: 'Personal Growth Insight',
          content: `Analysis of your development patterns based on "${query.substring(0, 50)}..."`,
          category: 'insight',
          confidence: 0.85 + Math.random() * 0.15,
          personalHook: `This discovery relates to your query about ${query.split(' ').slice(0, 3).join(' ')}`,
          deepInsights: {
            summary: 'Comprehensive analysis of your behavioral patterns and growth trajectory',
            keyPatterns: [
              'Consistent engagement with growth-oriented content',
              'Preference for analytical thinking approaches',
              'Strong correlation with self-reflection activities'
            ],
            personalizedContext: `Based on your query "${query}", this insight connects to your unique journey`,
            dataConnections: [
              {
                type: 'behavioral_metric',
                value: 'High curiosity score',
                source: 'UBPM Analytics',
                relevanceScore: 0.9
              },
              {
                type: 'conversation_pattern',
                value: 'Growth-focused discussions',
                source: 'Chat History',
                relevanceScore: 0.85
              }
            ],
            relevanceScore: 0.88
          }
        },
        {
          id: `node_${Date.now()}_2`,
          title: 'Behavioral Pattern',
          content: 'Your unique approach to processing and applying information',
          category: 'behavioral',
          confidence: 0.78 + Math.random() * 0.15,
          personalHook: 'This pattern emerges from your interaction style',
          deepInsights: {
            summary: 'Analysis of how you engage with different types of content and ideas',
            keyPatterns: [
              'Systematic approach to learning',
              'Preference for detailed exploration',
              'Integration of multiple perspectives'
            ],
            personalizedContext: 'Your behavioral signature shows thoughtful engagement',
            dataConnections: [
              {
                type: 'engagement_metric',
                value: 'Deep processing style',
                source: 'Interaction Analytics',
                relevanceScore: 0.82
              }
            ],
            relevanceScore: 0.79
          }
        }
      ];

      return {
        nodes: mockNodes,
        insights: [
          'Your query reveals strong analytical thinking patterns',
          'Multiple data sources confirm consistent growth orientation'
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
      
      throw new Error('Failed to generate final insights');
    }
  }
}

export default new ChainOfThoughtEngine();