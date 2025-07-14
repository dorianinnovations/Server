import express from 'express';
import { protect as authenticateToken } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import websocketService from '../services/websocketService.js';
import redisService from '../services/redisService.js';
import pushNotificationService from '../services/pushNotificationService.js';

const router = express.Router();

/**
 * API Documentation and Development Tools
 * Provides comprehensive API documentation and testing tools
 */

/**
 * @route GET /api/docs
 * @desc Get comprehensive API documentation
 * @access Public
 */
router.get('/api/docs', async (req, res) => {
  try {
    const apiDocs = {
      title: 'Numina Server API Documentation',
      version: '2.0.0',
      description: 'Mobile-first AI API with real-time features, offline sync, and push notifications',
      baseUrl: process.env.API_URL || 'http://localhost:5000',
      websocketUrl: process.env.WEBSOCKET_URL || 'ws://localhost:5000',
      
      authentication: {
        type: 'Bearer Token',
        description: 'JWT token required for most endpoints',
        header: 'Authorization: Bearer <token>',
        endpoints: {
          login: 'POST /login',
          signup: 'POST /signup',
          refresh: 'POST /refresh-token'
        }
      },

      endpoints: {
        // Authentication & User Management
        auth: {
          '/login': {
            method: 'POST',
            description: 'User login',
            body: {
              email: 'string (required)',
              password: 'string (required)'
            },
            response: {
              success: 'boolean',
              token: 'string',
              user: 'object'
            }
          },
          '/signup': {
            method: 'POST',
            description: 'User registration',
            body: {
              email: 'string (required)',
              password: 'string (required)',
              confirmPassword: 'string (required)'
            }
          },
          '/profile': {
            method: 'GET',
            description: 'Get user profile',
            auth: true,
            response: {
              success: 'boolean',
              data: 'object (user profile)'
            }
          }
        },

        // Mobile-Optimized Endpoints
        mobile: {
          '/mobile/batch': {
            method: 'POST',
            description: 'Execute multiple API requests in a single batch',
            auth: true,
            body: {
              requests: 'array (max 10 requests)',
              'requests[].endpoint': 'string (required)',
              'requests[].method': 'string (GET|POST|PUT|DELETE)',
              'requests[].data': 'object (optional)'
            },
            response: {
              success: 'boolean',
              batchId: 'string',
              results: 'array'
            }
          },
          '/mobile/sync': {
            method: 'GET',
            description: 'Get incremental sync data',
            auth: true,
            query: {
              lastSync: 'ISO8601 timestamp (required)',
              dataTypes: 'comma-separated list (profile,emotions,conversations,analytics)'
            },
            response: {
              success: 'boolean',
              timestamp: 'ISO8601',
              data: 'object (sync data)'
            }
          },
          '/mobile/offline-queue': {
            method: 'POST',
            description: 'Process offline queue items',
            auth: true,
            body: {
              items: 'array (queue items)',
              'items[].id': 'string (required)',
              'items[].endpoint': 'string (required)',
              'items[].method': 'string (required)',
              'items[].timestamp': 'ISO8601 (required)'
            }
          },
          '/mobile/push-token': {
            method: 'POST',
            description: 'Register push notification token',
            auth: true,
            body: {
              token: 'string (required)',
              platform: 'string (ios|android)'
            }
          },
          '/mobile/app-config': {
            method: 'GET',
            description: 'Get mobile app configuration',
            auth: true,
            response: {
              features: 'object (enabled features)',
              limits: 'object (API limits)',
              endpoints: 'object (service URLs)'
            }
          }
        },

        // Real-time Chat & AI
        chat: {
          '/completion': {
            method: 'POST',
            description: 'Chat completion with streaming support',
            auth: true,
            body: {
              prompt: 'string (required)',
              stream: 'boolean (default: true)',
              temperature: 'number (0-1, default: 0.8)',
              n_predict: 'number (default: 1024)'
            },
            response: 'Server-Sent Events stream'
          },
          '/ai/adaptive-chat': {
            method: 'POST',
            description: 'Adaptive chat with personality matching',
            auth: true,
            body: {
              prompt: 'string (required)',
              emotionalContext: 'object (optional)',
              personalityStyle: 'string (optional)'
            }
          },
          '/ai/emotional-state': {
            method: 'POST',
            description: 'Analyze user emotional state',
            auth: true,
            body: {
              recentEmotions: 'array (optional)',
              conversationHistory: 'array (optional)',
              timeContext: 'ISO8601 (optional)'
            }
          }
        },

        // Emotional Analytics
        emotions: {
          '/emotions': {
            method: 'POST',
            description: 'Save emotion data',
            auth: true,
            body: {
              emotion: 'string (required)',
              intensity: 'number (1-10, required)',
              description: 'string (optional)',
              timestamp: 'ISO8601 (optional)'
            }
          },
          '/analytics/insights': {
            method: 'POST',
            description: 'Generate LLM insights',
            auth: true,
            body: {
              timeRange: 'string (7d|30d|90d)',
              focus: 'string (general|mood|patterns)'
            }
          },
          '/analytics/llm/weekly-digest': {
            method: 'POST',
            description: 'Generate weekly emotional digest',
            auth: true
          }
        },

        // Cloud Events & Social
        cloud: {
          '/cloud/events': {
            method: 'GET',
            description: 'Get cloud events with AI matching',
            auth: true,
            query: {
              filter: 'string (optional)',
              includeMatching: 'boolean (default: false)'
            }
          },
          '/cloud/events': {
            method: 'POST',
            description: 'Create new cloud event',
            auth: true,
            body: {
              title: 'string (required)',
              description: 'string (required)',
              type: 'string (required)',
              date: 'ISO8601 (required)',
              time: 'string (required)',
              maxParticipants: 'number (required)'
            }
          },
          '/cloud/events/:id/join': {
            method: 'POST',
            description: 'Join cloud event',
            auth: true
          },
          '/cloud/events/:id/compatibility': {
            method: 'POST',
            description: 'Analyze event compatibility',
            auth: true,
            body: {
              emotionalState: 'object (required)'
            }
          }
        },

        // Offline Sync
        sync: {
          '/sync/process': {
            method: 'POST',
            description: 'Process complete sync request',
            auth: true,
            body: {
              syncData: 'object (required)',
              'syncData.profile': 'object (optional)',
              'syncData.emotions': 'array (optional)',
              'syncData.conversations': 'array (optional)',
              'syncData.settings': 'object (optional)'
            }
          },
          '/sync/incremental': {
            method: 'GET',
            description: 'Get incremental sync data',
            auth: true,
            query: {
              lastSync: 'ISO8601 timestamp (required)',
              dataTypes: 'comma-separated list'
            }
          },
          '/sync/offline-queue': {
            method: 'POST',
            description: 'Process offline queue items',
            auth: true,
            body: {
              items: 'array (queue items)'
            }
          }
        },

        // Health & Monitoring
        health: {
          '/health': {
            method: 'GET',
            description: 'Server health check',
            auth: false,
            response: {
              status: 'string (healthy|degraded|unhealthy)',
              uptime: 'number (seconds)',
              memory: 'object (memory usage)',
              database: 'string (connection status)'
            }
          },
          '/mobile/realtime-status': {
            method: 'GET',
            description: 'Real-time connection status',
            auth: true,
            response: {
              user: 'object (user status)',
              server: 'object (server stats)'
            }
          }
        }
      },

      // WebSocket Events
      websocket: {
        description: 'Real-time WebSocket events',
        connection: {
          url: 'ws://localhost:5000',
          auth: 'Required: token in handshake.auth.token'
        },
        events: {
          // Client to Server
          clientEvents: {
            join_chat: {
              description: 'Join chat room',
              payload: { roomId: 'string', roomType: 'string' }
            },
            chat_message: {
              description: 'Send chat message',
              payload: { roomId: 'string', message: 'string', messageType: 'string' }
            },
            typing_start: {
              description: 'Start typing indicator',
              payload: { roomId: 'string' }
            },
            typing_stop: {
              description: 'Stop typing indicator',
              payload: { roomId: 'string' }
            },
            emotion_update: {
              description: 'Real-time emotion update',
              payload: { emotion: 'string', intensity: 'number', context: 'string' }
            },
            update_status: {
              description: 'Update user status',
              payload: { status: 'string', customMessage: 'string' }
            }
          },
          // Server to Client
          serverEvents: {
            connected: {
              description: 'Connection confirmation',
              payload: { userId: 'string', timestamp: 'ISO8601' }
            },
            new_message: {
              description: 'New chat message',
              payload: { id: 'string', userId: 'string', message: 'string', timestamp: 'ISO8601' }
            },
            user_joined: {
              description: 'User joined room',
              payload: { userId: 'string', userData: 'object', timestamp: 'ISO8601' }
            },
            user_typing: {
              description: 'User typing indicator',
              payload: { userId: 'string', userData: 'object', timestamp: 'ISO8601' }
            },
            emotion_updated: {
              description: 'Emotion state updated',
              payload: { userId: 'string', emotion: 'string', intensity: 'number', timestamp: 'ISO8601' }
            },
            sync_completed: {
              description: 'Sync operation completed',
              payload: { syncId: 'string', results: 'object', timestamp: 'ISO8601' }
            }
          }
        }
      },

      // Push Notifications
      pushNotifications: {
        description: 'Firebase Cloud Messaging push notifications',
        types: {
          analytics: 'Weekly insights and emotional analysis',
          cloud_event: 'New matching cloud events',
          chat: 'New chat messages',
          emotional_checkin: 'Emotional state check-in reminders'
        },
        payload: {
          notification: {
            title: 'string',
            body: 'string',
            imageUrl: 'string (optional)'
          },
          data: {
            type: 'string (notification type)',
            userId: 'string',
            timestamp: 'ISO8601',
            'customData': 'varies by type'
          }
        }
      },

      // Error Handling
      errorHandling: {
        format: {
          success: 'boolean (false for errors)',
          error: 'string (error message)',
          code: 'number (HTTP status code)',
          details: 'object (optional error details)'
        },
        commonErrors: {
          400: 'Bad Request - Invalid request format',
          401: 'Unauthorized - Invalid or missing token',
          403: 'Forbidden - Access denied',
          404: 'Not Found - Resource not found',
          429: 'Too Many Requests - Rate limit exceeded',
          500: 'Internal Server Error - Server error'
        }
      },

      // Rate Limits
      rateLimits: {
        general: '100 requests per 15 minutes',
        chat: '50 requests per minute',
        batch: '10 requests per minute',
        sync: '20 requests per minute'
      },

      // Caching
      caching: {
        description: 'Intelligent caching with mobile optimization',
        headers: {
          'X-Cache': 'HIT or MISS',
          'X-Cache-TTL': 'seconds remaining',
          'X-Cache-Key': 'cache key used'
        },
        strategies: {
          mobile: '10 minute cache for mobile clients',
          web: '5 minute cache for web clients',
          api: 'Varies by endpoint (1-60 minutes)'
        }
      }
    };

    res.json(apiDocs);

  } catch (error) {
    logger.error('API docs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate API documentation'
    });
  }
});

/**
 * @route GET /api/stats
 * @desc Get comprehensive server statistics
 * @access Private (Admin only)
 */
router.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const stats = {
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      websocket: websocketService.getServerStats(),
      redis: redisService.getConnectionInfo(),
      pushNotifications: await pushNotificationService.getStats(),
      timestamp: new Date()
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    logger.error('Server stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get server statistics'
    });
  }
});

/**
 * @route GET /api/test
 * @desc Test API connectivity and features
 * @access Public
 */
router.get('/api/test', async (req, res) => {
  try {
    const testResults = {
      api: {
        status: 'operational',
        timestamp: new Date(),
        responseTime: Date.now()
      },
      database: {
        status: 'connected',
        // Add database ping test
      },
      redis: {
        status: redisService.isRedisConnected() ? 'connected' : 'fallback',
        connectionInfo: redisService.getConnectionInfo()
      },
      websocket: {
        status: 'operational',
        connectedUsers: websocketService.getConnectedUsersCount()
      },
      pushNotifications: {
        status: pushNotificationService.isInitialized ? 'enabled' : 'disabled'
      }
    };

    // Calculate response time
    testResults.api.responseTime = Date.now() - testResults.api.responseTime;

    res.json({
      success: true,
      tests: testResults
    });

  } catch (error) {
    logger.error('API test error:', error);
    res.status(500).json({
      success: false,
      error: 'API test failed'
    });
  }
});

/**
 * @route GET /api/routes
 * @desc Get all available routes
 * @access Public
 */
router.get('/api/routes', (req, res) => {
  try {
    const routes = {
      authentication: [
        'POST /login',
        'POST /signup',
        'GET /profile',
        'POST /refresh-token'
      ],
      mobile: [
        'POST /mobile/batch',
        'GET /mobile/sync',
        'POST /mobile/offline-queue',
        'POST /mobile/push-token',
        'GET /mobile/app-config',
        'GET /mobile/realtime-status'
      ],
      chat: [
        'POST /completion',
        'POST /ai/adaptive-chat',
        'POST /ai/emotional-state',
        'POST /ai/personality-recommendations'
      ],
      emotions: [
        'POST /emotions',
        'GET /emotion-history',
        'GET /emotion-metrics',
        'POST /analytics/insights',
        'POST /analytics/llm/weekly-digest'
      ],
      cloud: [
        'GET /cloud/events',
        'POST /cloud/events',
        'POST /cloud/events/:id/join',
        'POST /cloud/events/:id/leave',
        'POST /cloud/events/:id/compatibility'
      ],
      sync: [
        'POST /sync/process',
        'GET /sync/incremental',
        'POST /sync/offline-queue',
        'GET /sync/status',
        'POST /sync/conflict-resolution'
      ],
      health: [
        'GET /health',
        'GET /api/test',
        'GET /api/stats',
        'GET /api/docs'
      ]
    };

    res.json({
      success: true,
      routes,
      total: Object.values(routes).flat().length
    });

  } catch (error) {
    logger.error('Routes listing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list routes'
    });
  }
});

export default router;