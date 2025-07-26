import logger from '../utils/logger.js';
import { createLLMService } from './llmService.js';
import toolRegistry from './toolRegistry.js';
import toolExecutor from './toolExecutor.js';

class PillButtonService {
  constructor() {
    this.llmService = createLLMService();
    this.actionDefinitions = {
      write: {
        id: 'write',
        label: 'write',
        icon: 'edit-3',
        color: '#3B82F6',
        description: 'Express thoughts and ideas creatively',
        capabilities: ['creative_expression', 'narrative_flow', 'personal_voice'],
        temperature: 0.8,
        systemPrompt: 'You are a creative writing assistant focused on helping users express their thoughts clearly and engagingly.'
      },
      think: {
        id: 'think',
        label: 'think',
        icon: 'zap',
        color: '#8B5CF6',
        description: 'Deep analytical processing',
        capabilities: ['logical_analysis', 'problem_solving', 'critical_thinking'],
        temperature: 0.3,
        systemPrompt: 'You are an analytical thinking partner focused on deep reasoning and structured problem-solving.'
      },
      find: {
        id: 'find',
        label: 'find',
        icon: 'search',
        color: '#10B981',
        description: 'Discover connections and information',
        capabilities: ['information_discovery', 'source_verification', 'data_synthesis'],
        temperature: 0.5,
        tools: ['web_search', 'academic_search'],
        systemPrompt: 'You are a research assistant focused on finding accurate, relevant information from multiple sources.'
      },
      imagine: {
        id: 'imagine',
        label: 'imagine',
        icon: 'aperture',
        color: '#F59E0B',
        description: 'Creative exploration and ideation',
        capabilities: ['creative_ideation', 'innovative_thinking', 'possibility_exploration'],
        temperature: 0.9,
        systemPrompt: 'You are a creative ideation partner focused on exploring possibilities and generating innovative ideas.'
      },
      connect: {
        id: 'connect',
        label: 'connect',
        icon: 'link',
        color: '#EC4899',
        description: 'Find relationships between concepts',
        capabilities: ['relationship_mapping', 'pattern_recognition', 'interdisciplinary_links'],
        temperature: 0.6,
        systemPrompt: 'You are a connection specialist focused on finding relationships and patterns between ideas, concepts, and domains.'
      },
      explore: {
        id: 'explore',
        label: 'explore',
        icon: 'compass',
        color: '#06B6D4',
        description: 'Venture into unknown territories',
        capabilities: ['knowledge_expansion', 'curiosity_driven_research', 'broad_discovery'],
        temperature: 0.7,
        tools: ['web_search', 'news_search'],
        systemPrompt: 'You are an exploration guide focused on broadening understanding and discovering new knowledge territories.'
      },
      ubpm: {
        id: 'ubpm',
        label: 'SynthUBPM',
        icon: 'user',
        color: '#8B5CF6',
        description: 'Use behavioral profile for personalization',
        capabilities: ['behavioral_analysis', 'personalized_insights', 'user_pattern_recognition'],
        temperature: 0.4,
        requiresUBPM: true,
        systemPrompt: 'You are a personalization expert focused on tailoring responses based on user behavioral patterns and preferences.'
      }
    };

    this.synergyCombinations = {
      'find+think': { score: 0.95, description: 'Research with analytical depth' },
      'write+imagine': { score: 0.93, description: 'Creative expression with ideation' },
      'connect+explore': { score: 0.90, description: 'Relationship discovery through exploration' },
      'think+connect': { score: 0.88, description: 'Analytical pattern recognition' },
      'ubpm+write': { score: 0.92, description: 'Personalized creative expression' },
      'find+explore': { score: 0.87, description: 'Comprehensive information discovery' }
    };
  }

  /**
   * Process selected pill actions and return configuration
   */
  async processPillActions(selectedActions, userId, context = {}) {
    try {
      logger.debug('Processing pill actions', { 
        selectedActions, 
        userId, 
        contextKeys: Object.keys(context) 
      });

      // Handle various input formats
      if (!selectedActions) {
        throw new Error('No pill actions provided - selectedActions is null/undefined');
      }
      
      // Ensure selectedActions is an array
      const actionsArray = Array.isArray(selectedActions) ? selectedActions : [selectedActions];
      
      if (actionsArray.length === 0) {
        throw new Error('No pill actions provided - empty array');
      }

      const processedActions = [];
      const combinedConfig = {
        temperature: 0.6,
        maxTokens: 1500,
        capabilities: new Set(),
        tools: new Set(),
        systemPrompts: [],
        requiresUBPM: false,
        colors: [],
        icons: []
      };

      // Process each selected action
      for (const actionId of actionsArray) {
        const actionDef = this.actionDefinitions[actionId];
        if (actionDef) {
          processedActions.push(actionDef);

          // Combine configurations
          actionDef.capabilities?.forEach(cap => combinedConfig.capabilities.add(cap));
          actionDef.tools?.forEach(tool => combinedConfig.tools.add(tool));
          combinedConfig.systemPrompts.push(actionDef.systemPrompt);
          
          if (actionDef.requiresUBPM) {
            combinedConfig.requiresUBPM = true;
          }

          combinedConfig.colors.push(actionDef.color);
          combinedConfig.icons.push(actionDef.icon);

          // Weighted average temperature
          combinedConfig.temperature = (combinedConfig.temperature + actionDef.temperature) / 2;
        }
      }

      // Calculate synergy score
      const synergyKey = selectedActions.sort().join('+');
      const synergy = this.synergyCombinations[synergyKey] || { 
        score: 0.75, 
        description: 'Custom combination' 
      };

      const result = {
        selectedActions,
        processedActions,
        combinedConfig: {
          ...combinedConfig,
          capabilities: Array.from(combinedConfig.capabilities),
          tools: Array.from(combinedConfig.tools)
        },
        synergy,
        timestamp: new Date().toISOString()
      };

      logger.info('Pill actions processed successfully', { 
        userId,
        actionsCount: processedActions.length,
        synergyScore: synergy.score,
        requiresUBPM: combinedConfig.requiresUBPM
      });

      return result;

    } catch (error) {
      logger.error('Error processing pill actions', { 
        userId, 
        selectedActions,
        selectedActionsType: typeof selectedActions,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Generate pill-optimized response based on configuration
   */
  async generatePillResponse(query, pillConfig, userId, options = {}) {
    try {
      logger.debug('Generating pill-optimized response', { 
        userId, 
        query: query?.substring(0, 100),
        pillActions: pillConfig.selectedActions,
        synergyScore: pillConfig.synergy.score
      });

      // Build enhanced prompt based on pill configuration
      const systemPrompt = this.buildSystemPrompt(pillConfig);
      const userPrompt = this.buildUserPrompt(query, pillConfig, options);

      // Prepare tools if needed
      let tools = [];
      if (pillConfig.combinedConfig.tools.length > 0) {
        try {
          const allTools = await toolRegistry.getToolsForOpenAI();
          tools = allTools.filter(tool => 
            pillConfig.combinedConfig.tools.includes(tool.function?.name)
          ).slice(0, 3); // Limit to 3 tools for performance
        } catch (error) {
          logger.warn('Failed to load tools for pill response', { error: error.message });
        }
      }

      // Generate response with pill-optimized settings
      const response = await this.llmService.makeLLMRequest([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        temperature: pillConfig.combinedConfig.temperature,
        max_tokens: pillConfig.combinedConfig.maxTokens,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined
      });

      // Handle tool calls if present
      if (response.tool_calls && response.tool_calls.length > 0) {
        const toolResults = [];
        
        for (const toolCall of response.tool_calls) {
          try {
            const toolResult = await toolExecutor.executeToolCall(toolCall, { userId });
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              content: JSON.stringify(toolResult)
            });
          } catch (toolError) {
            logger.warn('Tool execution failed in pill response', { 
              toolName: toolCall.function?.name,
              error: toolError.message 
            });
          }
        }

        // Get final response with tool results
        if (toolResults.length > 0) {
          const finalResponse = await this.llmService.makeLLMRequest([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
            { role: 'assistant', content: '', tool_calls: response.tool_calls },
            ...toolResults
          ], {
            temperature: pillConfig.combinedConfig.temperature,
            max_tokens: pillConfig.combinedConfig.maxTokens
          });

          return {
            success: true,
            response: finalResponse.content,
            pillConfig,
            toolsUsed: response.tool_calls.map(tc => tc.function?.name),
            timestamp: new Date().toISOString()
          };
        }
      }

      return {
        success: true,
        response: response.content,
        pillConfig,
        toolsUsed: [],
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error generating pill response', { 
        userId, 
        error: error.message,
        pillActions: pillConfig.selectedActions 
      });
      throw error;
    }
  }

  /**
   * Build system prompt based on pill configuration
   */
  buildSystemPrompt(pillConfig) {
    const basePrompt = 'You are an AI assistant with specialized capabilities based on user selection.';
    
    if (pillConfig.combinedConfig.systemPrompts.length === 1) {
      return pillConfig.combinedConfig.systemPrompts[0];
    }

    if (pillConfig.combinedConfig.systemPrompts.length > 1) {
      return `${basePrompt} You combine multiple approaches: ${pillConfig.combinedConfig.systemPrompts.join(' Additionally, ')}\n\nFocus on: ${pillConfig.combinedConfig.capabilities.join(', ')}.`;
    }

    return basePrompt;
  }

  /**
   * Build user prompt with pill context
   */
  buildUserPrompt(query, pillConfig, options = {}) {
    let prompt = `User Query: "${query}"\n\n`;
    
    prompt += `Selected Capabilities: ${pillConfig.selectedActions.join(', ')}\n`;
    prompt += `Focus Areas: ${pillConfig.combinedConfig.capabilities.join(', ')}\n`;
    
    if (pillConfig.synergy.score > 0.85) {
      prompt += `High Synergy Mode (${pillConfig.synergy.score.toFixed(2)}): ${pillConfig.synergy.description}\n`;
    }

    if (options.context) {
      prompt += `\nAdditional Context: ${options.context}\n`;
    }

    prompt += '\nProvide a comprehensive response that leverages the selected capabilities effectively.';

    return prompt;
  }

  /**
   * Get pill recommendations based on query analysis
   */
  async getPillRecommendations(query, currentPills = []) {
    try {
      const recommendations = [];
      const queryLower = query.toLowerCase();

      // Analyze query for capability requirements
      const queryAnalysis = {
        needsAnalysis: /how|why|explain|analyze|understand|reason/i.test(query),
        needsCreativity: /creative|imagine|idea|innovative|brainstorm/i.test(query),
        needsResearch: /find|search|research|look up|information/i.test(query),
        needsConnections: /connect|relate|relationship|between|link/i.test(query),
        needsExploration: /explore|discover|learn about|tell me about/i.test(query),
        needsPersonalization: /my|personal|for me|tailored/i.test(query)
      };

      // Generate recommendations based on analysis
      if (queryAnalysis.needsAnalysis && !currentPills.includes('think')) {
        recommendations.push({
          pill: 'think',
          reason: 'Query requires analytical processing',
          confidence: 0.85
        });
      }

      if (queryAnalysis.needsCreativity && !currentPills.includes('imagine')) {
        recommendations.push({
          pill: 'imagine',
          reason: 'Query indicates creative ideation needed',
          confidence: 0.88
        });
      }

      if (queryAnalysis.needsResearch && !currentPills.includes('find')) {
        recommendations.push({
          pill: 'find',
          reason: 'Query requires information discovery',
          confidence: 0.90
        });
      }

      if (queryAnalysis.needsConnections && !currentPills.includes('connect')) {
        recommendations.push({
          pill: 'connect',
          reason: 'Query involves relationship analysis',
          confidence: 0.87
        });
      }

      if (queryAnalysis.needsExploration && !currentPills.includes('explore')) {
        recommendations.push({
          pill: 'explore',
          reason: 'Query suggests exploratory approach',
          confidence: 0.83
        });
      }

      if (queryAnalysis.needsPersonalization && !currentPills.includes('ubpm')) {
        recommendations.push({
          pill: 'ubpm',
          reason: 'Query benefits from personalization',
          confidence: 0.86
        });
      }

      // Sort by confidence and return top 3
      return recommendations
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);

    } catch (error) {
      logger.error('Error generating pill recommendations', { error: error.message });
      return [];
    }
  }

  /**
   * Get available pill actions
   */
  getAvailableActions() {
    return Object.values(this.actionDefinitions);
  }

  /**
   * Get synergy information for pill combinations
   */
  getSynergyInfo(pillActions) {
    const key = pillActions.sort().join('+');
    return this.synergyCombinations[key] || { 
      score: 0.75, 
      description: 'Custom combination' 
    };
  }
}

// Export singleton instance
const pillButtonService = new PillButtonService();
export default pillButtonService;