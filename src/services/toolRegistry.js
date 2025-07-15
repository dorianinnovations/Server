import Tool from '../models/Tool.js';
import toolExecutor from './toolExecutor.js';

const defaultTools = [
  {
    name: 'reservation_booking',
    description: 'Book restaurant reservations based on user preferences and availability',
    category: 'booking',
    schema: {
      type: 'object',
      properties: {
        restaurantName: {
          type: 'string',
          description: 'Name of the restaurant to book',
        },
        date: {
          type: 'string',
          format: 'date',
          description: 'Date for the reservation (YYYY-MM-DD)',
        },
        time: {
          type: 'string',
          description: 'Time for the reservation (HH:MM format)',
        },
        partySize: {
          type: 'number',
          description: 'Number of people for the reservation',
          minimum: 1,
          maximum: 20,
        },
        specialRequests: {
          type: 'string',
          description: 'Any special requests or dietary restrictions',
        },
        phone: {
          type: 'string',
          description: 'Contact phone number',
        },
        email: {
          type: 'string',
          description: 'Contact email address',
        },
      },
      required: ['restaurantName', 'date', 'time', 'partySize'],
    },
    implementation: 'reservationBooking',
    enabled: true,
    requiresAuth: true,
    requiresPayment: true,
    costPerExecution: 2.50,
    permissions: ['write', 'execute'],
    triggers: [
      {
        eventType: 'user_preference_change',
        conditions: {
          'data.preference': 'dining_preference',
          'data.value.type': 'restaurant_interest',
        },
        priority: 7,
      },
      {
        eventType: 'user_action',
        conditions: {
          'data.action': 'mention_restaurant',
          'data.context.intent': 'booking',
        },
        priority: 8,
      },
    ],
  },
  {
    name: 'spotify_playlist',
    description: 'Create personalized Spotify playlists based on mood, genre, or specific tracks',
    category: 'entertainment',
    schema: {
      type: 'object',
      properties: {
        playlistName: {
          type: 'string',
          description: 'Name for the new playlist',
        },
        description: {
          type: 'string',
          description: 'Description for the playlist',
        },
        tracks: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Array of track IDs or URIs to add',
        },
        mood: {
          type: 'string',
          enum: ['happy', 'sad', 'energetic', 'calm', 'focus', 'workout'],
          description: 'Mood for automatic track selection',
        },
        genre: {
          type: 'string',
          description: 'Genre preference for automatic track selection',
        },
        isPublic: {
          type: 'boolean',
          description: 'Whether the playlist should be public',
          default: false,
        },
      },
      required: ['playlistName'],
    },
    implementation: 'spotifyPlaylist',
    enabled: true,
    requiresAuth: true,
    requiresPayment: true,
    costPerExecution: 1.00,
    permissions: ['write', 'execute'],
    triggers: [
      {
        eventType: 'user_behavior_pattern',
        conditions: {
          'data.pattern': 'music_listening',
          'data.confidence': { '$gte': 0.8 },
        },
        priority: 6,
      },
      {
        eventType: 'user_action',
        conditions: {
          'data.action': 'music_request',
          'data.context.platform': 'spotify',
        },
        priority: 8,
      },
    ],
  },
  {
    name: 'credit_management',
    description: 'Manage user credit pool, spending limits, and payment methods',
    category: 'finance',
    schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'check_balance',
            'add_funds',
            'add_funds_stripe',
            'setup_stripe_customer',
            'create_payment_intent',
            'add_payment_method',
            'list_payment_methods',
            'remove_payment_method',
            'check_spending',
            'set_limit',
            'get_transactions',
            'enable_auto_recharge',
            'disable_auto_recharge',
            'verify_account'
          ],
          description: 'Action to perform',
        },
        amount: {
          type: 'number',
          description: 'Amount for financial operations',
          minimum: 0,
        },
        description: {
          type: 'string',
          description: 'Description for the transaction',
        },
        paymentMethodId: {
          type: 'string',
          description: 'Payment method ID for transactions',
        },
        spendingLimit: {
          type: 'number',
          description: 'New spending limit amount',
          minimum: 0,
        },
        limitType: {
          type: 'string',
          enum: ['daily', 'weekly', 'monthly', 'perTransaction'],
          description: 'Type of spending limit',
        },
      },
      required: ['action'],
    },
    implementation: 'creditManagement',
    enabled: true,
    requiresAuth: true,
    requiresPayment: false,
    costPerExecution: 0,
    permissions: ['read', 'write', 'financial'],
    triggers: [
      {
        eventType: 'user_action',
        conditions: {
          'data.action': 'low_balance_warning',
        },
        priority: 9,
      },
      {
        eventType: 'user_data_update',
        conditions: {
          'data.dataType': 'payment_method',
        },
        priority: 7,
      },
    ],
  },
  {
    name: 'itinerary_generator',
    description: 'Generate comprehensive travel itineraries including flights, accommodation, activities, and restaurants',
    category: 'productivity',
    schema: {
      type: 'object',
      properties: {
        destination: {
          type: 'string',
          description: 'Travel destination (city or country)',
        },
        duration: {
          type: 'number',
          description: 'Duration of trip in days',
          minimum: 1,
          maximum: 30,
        },
        budget: {
          type: 'number',
          description: 'Total budget for the trip in USD',
          minimum: 100,
        },
        interests: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['culture', 'adventure', 'food', 'nature', 'history', 'nightlife', 'shopping', 'relaxation'],
          },
          description: 'Areas of interest for activities',
        },
        travelType: {
          type: 'string',
          enum: ['leisure', 'business', 'romantic', 'family', 'solo', 'group'],
          description: 'Type of travel',
          default: 'leisure',
        },
        groupSize: {
          type: 'number',
          description: 'Number of travelers',
          minimum: 1,
          maximum: 10,
          default: 1,
        },
        startDate: {
          type: 'string',
          format: 'date',
          description: 'Start date of the trip (YYYY-MM-DD)',
        },
        includeFlights: {
          type: 'boolean',
          description: 'Include flight bookings',
          default: false,
        },
        includeAccommodation: {
          type: 'boolean',
          description: 'Include accommodation bookings',
          default: false,
        },
        includeActivities: {
          type: 'boolean',
          description: 'Include activity recommendations',
          default: true,
        },
        includeRestaurants: {
          type: 'boolean',
          description: 'Include restaurant recommendations',
          default: true,
        },
        dietaryRestrictions: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['vegetarian', 'vegan', 'gluten-free', 'halal', 'kosher', 'dairy-free'],
          },
          description: 'Dietary restrictions for restaurant selection',
        },
        accessibility: {
          type: 'boolean',
          description: 'Filter for accessibility-friendly options',
          default: false,
        },
      },
      required: ['destination', 'duration', 'budget', 'startDate'],
    },
    implementation: 'itineraryGenerator',
    enabled: true,
    requiresAuth: true,
    requiresPayment: true,
    costPerExecution: 5.00,
    permissions: ['read', 'write', 'execute'],
    triggers: [
      {
        eventType: 'user_action',
        conditions: {
          'data.action': 'travel_planning',
          'data.context.intent': 'itinerary',
        },
        priority: 8,
      },
      {
        eventType: 'user_preference_change',
        conditions: {
          'data.preference': 'travel_preference',
        },
        priority: 6,
      },
    ],
  },
  {
    name: 'web_search',
    description: 'Search the internet for real-time information including restaurants, businesses, events, and current data',
    category: 'utility',
    schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for finding information on the internet',
        },
        searchType: {
          type: 'string',
          enum: ['general', 'restaurants', 'businesses', 'events', 'news', 'places'],
          description: 'Type of search to perform',
          default: 'general',
        },
        location: {
          type: 'string',
          description: 'Location context for local searches (city, address, coordinates)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return',
          minimum: 1,
          maximum: 20,
          default: 10,
        },
      },
      required: ['query'],
    },
    implementation: 'webSearch',
    enabled: true,
    requiresAuth: true,
    requiresPayment: false,
    costPerExecution: 0,
    permissions: ['read'],
    triggers: [
      {
        eventType: 'user_action',
        conditions: {
          'data.action': 'search_request',
          'data.context.needsRealTime': true,
        },
        priority: 9,
      },
    ],
  },
  {
    name: 'music_recommendations',
    description: 'Get music recommendations and track suggestions based on mood, genre, or artist preferences without requiring Spotify',
    category: 'entertainment',
    schema: {
      type: 'object',
      properties: {
        mood: {
          type: 'string',
          enum: ['happy', 'sad', 'energetic', 'calm', 'focus', 'workout', 'romantic', 'chill'],
          description: 'Mood for music recommendations',
        },
        genre: {
          type: 'string',
          description: 'Music genre preference (e.g., pop, rock, jazz, electronic)',
        },
        artist: {
          type: 'string',
          description: 'Similar artists or specific artist to base recommendations on',
        },
        playlistName: {
          type: 'string',
          description: 'Name for the recommended playlist',
        },
        trackCount: {
          type: 'number',
          description: 'Number of track recommendations to provide',
          minimum: 5,
          maximum: 50,
          default: 20,
        },
      },
      required: [],
    },
    implementation: 'musicRecommendations',
    enabled: true,
    requiresAuth: true,
    requiresPayment: false,
    costPerExecution: 0,
    permissions: ['read'],
    triggers: [
      {
        eventType: 'user_action',
        conditions: {
          'data.action': 'music_request',
          'data.context.noSpotify': true,
        },
        priority: 7,
      },
    ],
  },
];

class ToolRegistry {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      console.log('Initializing tool registry...');
      
      // Wait for database connection to be ready
      const mongoose = await import('mongoose');
      while (mongoose.default.connection.readyState !== 1) {
        console.log('Waiting for database connection...');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      for (const toolConfig of defaultTools) {
        await this.registerOrUpdateTool(toolConfig);
      }

      await toolExecutor.loadTools();
      
      this.initialized = true;
      console.log('Tool registry initialized successfully');
    } catch (error) {
      console.error('Error initializing tool registry:', error);
      throw error;
    }
  }

  async registerOrUpdateTool(toolConfig) {
    try {
      const existingTool = await Tool.findOne({ name: toolConfig.name });
      
      if (existingTool) {
        // Update using findOneAndUpdate to avoid direct property manipulation
        await Tool.findOneAndUpdate(
          { name: toolConfig.name },
          {
            description: toolConfig.description,
            category: toolConfig.category,
            schema: toolConfig.schema,
            implementation: toolConfig.implementation,
            enabled: toolConfig.enabled,
            requiresAuth: toolConfig.requiresAuth,
            requiresPayment: toolConfig.requiresPayment,
            costPerExecution: toolConfig.costPerExecution,
            permissions: toolConfig.permissions,
            triggers: toolConfig.triggers,
            'meta.lastUpdated': new Date()
          }
        );
        console.log(`Updated tool: ${toolConfig.name}`);
      } else {
        const tool = new Tool(toolConfig);
        await tool.save();
        console.log(`Registered new tool: ${toolConfig.name}`);
      }
    } catch (error) {
      console.error(`Error registering tool ${toolConfig.name}:`, error);
      throw error;
    }
  }

  async getAllTools() {
    return await Tool.find().sort({ name: 1 });
  }

  async getEnabledTools() {
    return await Tool.find({ enabled: true }).sort({ name: 1 });
  }

  async getToolsForOpenAI() {
    const tools = await this.getEnabledTools();
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.schema
      }
    }));
  }

  async getToolsByCategory(category) {
    return await Tool.find({ category: category, enabled: true }).sort({ name: 1 });
  }

  async enableTool(toolName) {
    await Tool.findOneAndUpdate(
      { name: toolName },
      { enabled: true, 'meta.lastUpdated': new Date() }
    );
    await toolExecutor.loadTools();
  }

  async disableTool(toolName) {
    await Tool.findOneAndUpdate(
      { name: toolName },
      { enabled: false, 'meta.lastUpdated': new Date() }
    );
    await toolExecutor.loadTools();
  }

  async updateToolCost(toolName, newCost) {
    await Tool.findOneAndUpdate(
      { name: toolName },
      { costPerExecution: newCost, 'meta.lastUpdated': new Date() }
    );
    await toolExecutor.loadTools();
  }

  async getToolStats() {
    const tools = await Tool.find();
    
    const stats = {
      total: tools.length,
      enabled: tools.filter(t => t.enabled).length,
      disabled: tools.filter(t => !t.enabled).length,
      categories: {},
      totalExecutions: 0,
      averageSuccessRate: 0,
    };

    for (const tool of tools) {
      if (!stats.categories[tool.category]) {
        stats.categories[tool.category] = 0;
      }
      stats.categories[tool.category]++;
      stats.totalExecutions += tool.meta.executionCount;
    }

    const enabledTools = tools.filter(t => t.enabled);
    if (enabledTools.length > 0) {
      stats.averageSuccessRate = enabledTools.reduce((sum, t) => sum + t.meta.successRate, 0) / enabledTools.length;
    }

    return stats;
  }
}

export default new ToolRegistry();