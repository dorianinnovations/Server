# Numina AI Server - Project Structure

## Overview
Numina AI Server is a comprehensive backend infrastructure for an AI-powered mobile application featuring personalized AI, emotional analytics, collective intelligence, and tool integration capabilities.

## Directory Structure

```
numina-server/
├── src/                          # Main application source code
│   ├── config/                   # Configuration files
│   │   ├── constants.js          # Application constants
│   │   ├── database.js           # Database connection configuration
│   │   └── environment.js        # Environment variable management
│   ├── middleware/               # Express middleware
│   │   ├── auth.js              # Authentication middleware
│   │   ├── cacheMiddleware.js    # Caching middleware
│   │   ├── performanceMiddleware.js # Performance monitoring
│   │   ├── rateLimiter.js       # Rate limiting
│   │   ├── security.js          # Security middleware
│   │   └── subscriptionGate.js  # Subscription validation
│   ├── models/                   # Database models
│   │   ├── User.js              # User model
│   │   ├── Task.js              # Task management
│   │   ├── Event.js             # Event tracking
│   │   ├── ShortTermMemory.js   # AI memory system
│   │   ├── EmotionalAnalyticsSession.js # Emotional analytics
│   │   ├── CollectiveDataConsent.js # Data consent management
│   │   ├── CollectiveSnapshot.js # Collective intelligence data
│   │   ├── UserBehaviorProfile.js # User behavior tracking
│   │   ├── CreditPool.js        # Credit management
│   │   └── Tool.js              # AI tool definitions
│   ├── routes/                   # API route handlers
│   │   ├── auth.js              # Authentication routes
│   │   ├── user.js              # User management
│   │   ├── ai.js                # Core AI functionality
│   │   ├── emotions.js          # Emotional analytics
│   │   ├── personalizedAI.js    # Personalized AI features
│   │   ├── tools.js             # AI tool integration
│   │   ├── wallet.js            # Payment and wallet
│   │   ├── mobile.js            # Mobile-optimized routes
│   │   ├── sync.js              # Offline sync functionality
│   │   └── [other route files]  # Additional feature routes
│   ├── services/                 # Business logic services
│   │   ├── llmService.js        # Large language model integration
│   │   ├── websocketService.js  # Real-time communication
│   │   ├── redisService.js      # Caching and session management
│   │   ├── pushNotificationService.js # Push notifications
│   │   ├── taskScheduler.js     # Automated task execution
│   │   ├── toolRegistry.js      # AI tool management
│   │   ├── triggerSystem.js     # Automated triggers
│   │   ├── personalizationEngine.js # AI personalization
│   │   ├── connectionEngine.js  # User connection matching
│   │   ├── dataProcessingPipeline.js # Data processing
│   │   ├── offlineSyncService.js # Offline functionality
│   │   ├── analytics.js         # Analytics processing
│   │   ├── advancedAnalytics.js # Advanced analytics
│   │   ├── collectiveDataService.js # Collective intelligence
│   │   ├── snapshotAnalysisService.js # Data snapshot analysis
│   │   ├── scheduledAggregationService.js # Scheduled data processing
│   │   └── stripeService.js     # Payment processing
│   ├── tools/                    # AI tool implementations
│   │   ├── creditManagement.js  # Credit system tools
│   │   ├── itineraryGenerator.js # Travel planning tools
│   │   ├── reservationBooking.js # Booking system tools
│   │   └── spotifyPlaylist.js   # Music integration tools
│   ├── utils/                    # Utility functions
│   │   ├── logger.js            # Logging utilities
│   │   ├── errorHandler.js      # Error handling
│   │   ├── cache.js             # Cache management
│   │   ├── memory.js            # Memory management
│   │   ├── sanitize.js          # Input sanitization
│   │   ├── analyticsHelper.js   # Analytics utilities
│   │   └── collectiveDataHelper.js # Collective data utilities
│   └── server.js                 # Main application entry point
├── tests/                        # Comprehensive test suites
│   ├── integration/              # End-to-end integration tests
│   ├── unit/                     # Unit tests
│   ├── e2e/                      # End-to-end tests
│   ├── middleware/               # Middleware tests
│   ├── routes/                   # Route-specific tests
│   ├── utils/                    # Utility function tests
│   ├── scripts/                  # Test utilities and setup
│   └── README.md                 # Test documentation
├── scripts/                      # Deployment and utility scripts
│   └── deploy.sh                 # Deployment automation
├── logs/                         # Application logs
├── docs/                         # Documentation (if any)
├── package.json                  # Node.js dependencies and scripts
├── jest.config.js               # Jest testing configuration
├── babel.config.js              # Babel transpilation config
├── .env                         # Development environment variables
├── .env.production             # Production environment variables
├── .gitignore                   # Git ignore patterns
├── README.md                    # Project documentation
├── LICENSE                      # Apache 2.0 license
├── Procfile                     # Heroku deployment config
├── render.yaml                  # Render deployment config
└── railway.json                 # Railway deployment config
```

## Key Features

### AI Capabilities
- **Personalized AI**: Custom AI experiences for each user
- **Emotional Analytics**: AI that understands and responds to emotions
- **Collective Intelligence**: AI that learns from all users
- **Tool Integration**: AI that can use external tools and APIs

### Mobile Optimization
- **Offline Sync**: Works without internet connection
- **Push Notifications**: Smart notification system
- **Mobile-optimized routes**: Fast loading on mobile devices
- **Real-time WebSocket connections**: Live updates

### Performance & Security
- **Redis caching**: Fast response times
- **Memory optimization**: Efficient resource usage
- **Security middleware**: Comprehensive security measures
- **Rate limiting**: Protection against abuse
- **Input sanitization**: Protection against malicious input

### Development & Testing
- **Comprehensive test suites**: Unit, integration, and e2e tests
- **Environment configuration**: Separate dev/prod environments
- **Deployment automation**: Multiple deployment platforms supported
- **Performance monitoring**: Real-time performance tracking

## Technology Stack

- **Runtime**: Node.js with Express.js
- **Database**: MongoDB with Mongoose ODM
- **Caching**: Redis
- **Real-time**: WebSocket
- **AI Integration**: OpenRouter API
- **Testing**: Jest
- **Deployment**: Heroku, Render, Railway
- **Security**: Helmet, CORS, Rate limiting
- **Performance**: Compression, Caching, Memory optimization

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure environment variables (see `.env.example`)
4. Start development server: `npm run dev`
5. Run tests: `npm test`

## Contributing

Please refer to the main README.md for contribution guidelines and development setup instructions. 