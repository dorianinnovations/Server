import Tool from '../models/Tool.js';
import toolExecutor from './toolExecutor.js';

const defaultTools = [
  {
    name: 'location_service',
    description: 'Get user current location when asked "where am I" or similar location questions',
    category: 'utility',
    schema: {
      type: 'object',
      properties: {
        action: { 
          type: 'string', 
          enum: ['get_location', 'geocode', 'reverse_geocode'], 
          default: 'get_location',
          description: 'Location service action to perform'
        }
      }
    },
    implementation: 'locationService',
    enabled: true,
    requiresAuth: true,
    requiresPayment: false,
    costPerExecution: 0,
    permissions: ['read']
  },
  {
    name: 'ubpm_analysis',
    description: 'User Behavior Pattern Modeling - Advanced temporal analysis of interaction vectors, behavioral deltas, and confidence matrices for deep behavioral insights',
    category: 'utility',
    schema: {
      type: 'object',
      properties: {
        analysisMode: {
          type: 'string',
          enum: ['temporal_delta', 'pattern_confidence', 'behavioral_vector', 'interaction_clustering', 'comprehensive'],
          description: 'Type of UBPM analysis to perform',
          default: 'behavioral_vector'
        },
        timeframe: {
          type: 'string',
          enum: ['session', 'daily', 'weekly', 'monthly', 'all_time'],
          description: 'Temporal scope for behavioral analysis',
          default: 'weekly'
        },
        confidenceThreshold: {
          type: 'number',
          minimum: 0.1,
          maximum: 1.0,
          description: 'Minimum confidence threshold for pattern validation',
          default: 0.5
        },
        includeRawMetrics: {
          type: 'boolean',
          description: 'Include raw computational metrics and vector spaces',
          default: true
        },
        vectorComponents: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['curiosity', 'technical_depth', 'interaction_complexity', 'emotional_variance', 'goal_orientation']
          },
          description: 'Behavioral vector components to compute',
          default: ['curiosity', 'technical_depth', 'interaction_complexity', 'emotional_variance']
        },
        temporalGranularity: {
          type: 'string',
          enum: ['hourly', 'daily', 'weekly'],
          description: 'Granularity for temporal delta calculations',
          default: 'daily'
        }
      },
      required: []
    },
    implementation: 'ubpmAnalysis',
    enabled: true,
    requiresAuth: true,
    requiresPayment: false,
    costPerExecution: 0,
    permissions: ['read', 'execute'],
    triggers: [
      {
        eventType: 'user_action',
        conditions: {
          'data.action': 'behavioral_analysis_request',
          'data.context.type': 'self_analysis'
        },
        priority: 10
      },
      {
        eventType: 'user_behavior_pattern',
        conditions: {
          'data.pattern': 'introspection',
          'data.confidence': { '$gte': 0.7 }
        },
        priority: 9
      },
      {
        eventType: 'user_data_update',
        conditions: {
          'data.dataType': 'behavioral_profile',
          'data.significance': 'high'
        },
        priority: 8
      }
    ]
  },
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
  // FAST SEARCH VARIANTS
  {
    name: 'news_search',
    description: 'Search for latest news articles and breaking news on any topic',
    category: 'information',
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'News search query' },
        timeRange: { type: 'string', enum: ['hour', 'day', 'week', 'month'], default: 'day' },
        source: { type: 'string', description: 'Specific news source (optional)' },
        category: { type: 'string', enum: ['general', 'business', 'tech', 'sports', 'entertainment'] }
      },
      required: ['query']
    },
    implementation: 'newsSearch',
    enabled: true,
    requiresAuth: true,
    requiresPayment: false,
    costPerExecution: 0,
    permissions: ['read']
  },
  {
    name: 'social_search',
    description: 'Search social media platforms for trending topics and discussions',
    category: 'social',
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Social media search query' },
        platform: { type: 'string', enum: ['twitter', 'reddit', 'linkedin', 'all'], default: 'all' },
        timeRange: { type: 'string', enum: ['hour', 'day', 'week'], default: 'day' }
      },
      required: ['query']
    },
    implementation: 'socialSearch',
    enabled: true,
    requiresAuth: true,
    requiresPayment: false,
    costPerExecution: 0,
    permissions: ['read']
  },
  {
    name: 'academic_search',
    description: 'Search academic papers, research articles, and scholarly content',
    category: 'research',
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Academic search query' },
        field: { type: 'string', description: 'Academic field or discipline' },
        yearRange: { type: 'string', description: 'Year range (e.g., 2020-2024)' }
      },
      required: ['query']
    },
    implementation: 'academicSearch',
    enabled: true,
    requiresAuth: true,
    requiresPayment: false,
    costPerExecution: 0,
    permissions: ['read']
  },
  {
    name: 'image_search',
    description: 'Search for images based on descriptions or keywords',
    category: 'media',
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Image search query' },
        size: { type: 'string', enum: ['small', 'medium', 'large'], default: 'medium' },
        color: { type: 'string', description: 'Dominant color filter' },
        type: { type: 'string', enum: ['photo', 'illustration', 'vector'], default: 'photo' }
      },
      required: ['query']
    },
    implementation: 'imageSearch',
    enabled: true,
    requiresAuth: true,
    requiresPayment: false,
    costPerExecution: 0,
    permissions: ['read']
  },

  // QUICK UTILITY TOOLS
  {
    name: 'weather_check',
    description: 'Get current weather and forecast for a specific location. Only use when user asks about weather, temperature, or forecast. Do NOT use for general location questions.',
    category: 'utility',
    schema: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City, address, or coordinates' },
        days: { type: 'number', minimum: 1, maximum: 7, default: 1, description: 'Forecast days' },
        units: { type: 'string', enum: ['metric', 'imperial'], default: 'metric' }
      },
      required: ['location']
    },
    implementation: 'weatherCheck',
    enabled: false,
    requiresAuth: true,
    requiresPayment: false,
    costPerExecution: 0,
    permissions: ['read']
  },
  {
    name: 'timezone_converter',
    description: 'Convert time between different time zones',
    category: 'utility',
    schema: {
      type: 'object',
      properties: {
        time: { type: 'string', description: 'Time to convert (HH:MM or full datetime)' },
        fromTimezone: { type: 'string', description: 'Source timezone (e.g., EST, PST, UTC)' },
        toTimezone: { type: 'string', description: 'Target timezone' },
        date: { type: 'string', description: 'Date for conversion (YYYY-MM-DD)' }
      },
      required: ['time', 'fromTimezone', 'toTimezone']
    },
    implementation: 'timezoneConverter',
    enabled: true,
    requiresAuth: true,
    requiresPayment: false,
    costPerExecution: 0,
    permissions: ['read']
  },
  {
    name: 'calculator',
    description: 'Perform mathematical calculations and conversions',
    category: 'utility',
    schema: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'Mathematical expression to calculate' },
        type: { type: 'string', enum: ['basic', 'scientific', 'unit_conversion'], default: 'basic' },
        fromUnit: { type: 'string', description: 'Unit to convert from (for conversions)' },
        toUnit: { type: 'string', description: 'Unit to convert to (for conversions)' }
      },
      required: ['expression']
    },
    implementation: 'calculator',
    enabled: true,
    requiresAuth: true,
    requiresPayment: false,
    costPerExecution: 0,
    permissions: ['read']
  },

  // FINANCIAL TOOLS
  {
    name: 'stock_lookup',
    description: 'Get real-time stock prices, market data, and financial information',
    category: 'finance',
    schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Stock ticker symbol (e.g., AAPL, GOOGL)' },
        timeRange: { type: 'string', enum: ['1d', '1w', '1m', '1y'], default: '1d' },
        includeNews: { type: 'boolean', default: false, description: 'Include recent news about the stock' }
      },
      required: ['symbol']
    },
    implementation: 'stockLookup',
    enabled: true,
    requiresAuth: true,
    requiresPayment: false,
    costPerExecution: 0,
    permissions: ['read']
  },
  {
    name: 'crypto_lookup',
    description: 'Get cryptocurrency prices, market cap, and trading data',
    category: 'finance',
    schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Crypto symbol (e.g., BTC, ETH, DOGE)' },
        currency: { type: 'string', default: 'USD', description: 'Base currency for prices' },
        timeRange: { type: 'string', enum: ['1h', '24h', '7d', '30d'], default: '24h' }
      },
      required: ['symbol']
    },
    implementation: 'cryptoLookup',
    enabled: true,
    requiresAuth: true,
    requiresPayment: false,
    costPerExecution: 0,
    permissions: ['read']
  },
  {
    name: 'currency_converter',
    description: 'Convert between different currencies with live exchange rates',
    category: 'finance',
    schema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Amount to convert' },
        fromCurrency: { type: 'string', description: 'Source currency code (e.g., USD, EUR)' },
        toCurrency: { type: 'string', description: 'Target currency code' }
      },
      required: ['amount', 'fromCurrency', 'toCurrency']
    },
    implementation: 'currencyConverter',
    enabled: true,
    requiresAuth: true,
    requiresPayment: false,
    costPerExecution: 0,
    permissions: ['read']
  },

  // CREATIVE TOOLS
  {
    name: 'text_generator',
    description: 'Generate creative text content like emails, posts, stories, and marketing copy',
    category: 'creative',
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['email', 'social_post', 'blog_post', 'story', 'marketing_copy', 'poem'] },
        topic: { type: 'string', description: 'Topic or subject for the content' },
        tone: { type: 'string', enum: ['professional', 'casual', 'funny', 'formal', 'creative'], default: 'professional' },
        length: { type: 'string', enum: ['short', 'medium', 'long'], default: 'medium' },
        targetAudience: { type: 'string', description: 'Target audience for the content' }
      },
      required: ['type', 'topic']
    },
    implementation: 'textGenerator',
    enabled: true,
    requiresAuth: true,
    requiresPayment: true,
    costPerExecution: 0.50,
    permissions: ['read', 'execute']
  },
  {
    name: 'code_generator',
    description: 'Generate code snippets, functions, and programming solutions',
    category: 'development',
    schema: {
      type: 'object',
      properties: {
        language: { type: 'string', description: 'Programming language (e.g., JavaScript, Python, Java)' },
        description: { type: 'string', description: 'Description of what the code should do' },
        framework: { type: 'string', description: 'Framework or library to use (optional)' },
        complexity: { type: 'string', enum: ['simple', 'intermediate', 'advanced'], default: 'simple' }
      },
      required: ['language', 'description']
    },
    implementation: 'codeGenerator',
    enabled: true,
    requiresAuth: true,
    requiresPayment: true,
    costPerExecution: 1.00,
    permissions: ['read', 'execute']
  },

  // HEALTH & WELLNESS
  {
    name: 'fitness_tracker',
    description: 'Track workouts, set fitness goals, and get exercise recommendations',
    category: 'health',
    schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['log_workout', 'get_recommendation', 'track_progress'] },
        workoutType: { type: 'string', description: 'Type of workout (cardio, strength, yoga, etc.)' },
        duration: { type: 'number', description: 'Workout duration in minutes' },
        intensity: { type: 'string', enum: ['low', 'medium', 'high'] },
        goal: { type: 'string', description: 'Fitness goal (weight loss, muscle gain, endurance)' }
      },
      required: ['action']
    },
    implementation: 'fitnessTracker',
    enabled: true,
    requiresAuth: true,
    requiresPayment: false,
    costPerExecution: 0,
    permissions: ['read', 'write']
  },
  {
    name: 'nutrition_lookup',
    description: 'Get nutritional information for foods and meal planning',
    category: 'health',
    schema: {
      type: 'object',
      properties: {
        food: { type: 'string', description: 'Food item or meal to look up' },
        quantity: { type: 'string', description: 'Quantity or serving size' },
        includeAlternatives: { type: 'boolean', default: false, description: 'Include healthier alternatives' }
      },
      required: ['food']
    },
    implementation: 'nutritionLookup',
    enabled: true,
    requiresAuth: true,
    requiresPayment: false,
    costPerExecution: 0,
    permissions: ['read']
  },

  // SOCIAL & COMMUNICATION
  {
    name: 'linkedin_helper',
    description: 'Generate LinkedIn posts, connection messages, and professional content',
    category: 'professional',
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['post', 'connection_message', 'comment', 'article_idea'] },
        topic: { type: 'string', description: 'Topic or theme for the content' },
        industry: { type: 'string', description: 'Industry context' },
        tone: { type: 'string', enum: ['professional', 'thought_leadership', 'inspirational'], default: 'professional' }
      },
      required: ['type', 'topic']
    },
    implementation: 'linkedinHelper',
    enabled: true,
    requiresAuth: true,
    requiresPayment: true,
    costPerExecution: 0.25,
    permissions: ['read', 'execute']
  },
  {
    name: 'email_assistant',
    description: 'Draft, reply to, and manage emails with AI assistance',
    category: 'productivity',
    schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['draft', 'reply', 'summarize', 'schedule'] },
        subject: { type: 'string', description: 'Email subject' },
        recipient: { type: 'string', description: 'Recipient name or context' },
        tone: { type: 'string', enum: ['formal', 'casual', 'friendly', 'urgent'], default: 'professional' },
        content: { type: 'string', description: 'Email content or original message to reply to' }
      },
      required: ['action']
    },
    implementation: 'emailAssistant',
    enabled: true,
    requiresAuth: true,
    requiresPayment: true,
    costPerExecution: 0.25,
    permissions: ['read', 'write', 'execute']
  },

  // QUICK LOOKUPS
  {
    name: 'translation',
    description: 'Translate text between languages instantly',
    category: 'utility',
    schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to translate' },
        fromLanguage: { type: 'string', description: 'Source language (auto-detect if not specified)' },
        toLanguage: { type: 'string', description: 'Target language' },
        includePhonetic: { type: 'boolean', default: false, description: 'Include phonetic pronunciation' }
      },
      required: ['text', 'toLanguage']
    },
    implementation: 'translation',
    enabled: true,
    requiresAuth: true,
    requiresPayment: false,
    costPerExecution: 0,
    permissions: ['read']
  },
  {
    name: 'qr_generator',
    description: 'Generate QR codes for URLs, text, contact info, and more',
    category: 'utility',
    schema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Content to encode in QR code' },
        type: { type: 'string', enum: ['url', 'text', 'email', 'phone', 'wifi'], default: 'text' },
        size: { type: 'string', enum: ['small', 'medium', 'large'], default: 'medium' }
      },
      required: ['content']
    },
    implementation: 'qrGenerator',
    enabled: true,
    requiresAuth: true,
    requiresPayment: false,
    costPerExecution: 0,
    permissions: ['read']
  },
  {
    name: 'password_generator',
    description: 'Generate secure passwords and check password strength',
    category: 'security',
    schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['generate', 'check_strength'], default: 'generate' },
        length: { type: 'number', minimum: 8, maximum: 64, default: 16 },
        includeSymbols: { type: 'boolean', default: true },
        includeNumbers: { type: 'boolean', default: true },
        password: { type: 'string', description: 'Password to check strength (for check_strength action)' }
      }
    },
    implementation: 'passwordGenerator',
    enabled: true,
    requiresAuth: true,
    requiresPayment: false,
    costPerExecution: 0,
    permissions: ['read']
  }
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
      console.log('🔧 TOOL REGISTRY: Ready');
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
        // Tool updated silently
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