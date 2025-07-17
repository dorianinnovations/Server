# Numina AI Server

A comprehensive Express.js backend API for the Numina AI platform, featuring personalized AI experiences, emotional analytics, collective intelligence, and advanced tool integration with 25+ specialized AI tools.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables (see .env.example)
cp .env.example .env

# Start development server
npm run dev

# Run tests
npm test

# Run linting
npm run lint
```

## 📁 Project Structure

```
numina-server/
├── src/
│   ├── config/                   # App configuration
│   │   ├── constants.js          # HTTP status codes & messages
│   │   ├── database.js           # MongoDB connection
│   │   └── environment.js        # Environment variable management
│   ├── models/                   # Mongoose schemas
│   │   ├── User.js                    # User auth & profile
│   │   ├── UserBehaviorProfile.js     # Behavioral analytics
│   │   ├── EmotionalAnalyticsSession.js # Emotion tracking
│   │   ├── ShortTermMemory.js         # Conversation memory
│   │   ├── CollectiveDataConsent.js   # Privacy consent
│   │   ├── CollectiveSnapshot.js      # Collective insights
│   │   ├── CreditPool.js              # Credit system
│   │   ├── Task.js                    # Background tasks
│   │   ├── Tool.js                    # AI tool definitions
│   │   ├── Event.js                   # Event tracking
│   │   ├── UserConstants.js           # User preferences
│   │   └── UserEvent.js               # User events
│   ├── routes/                   # API endpoints
│   │   ├── auth.js                    # Authentication
│   │   ├── ai.js                      # AI chat & completions
│   │   ├── mobile.js                  # Mobile endpoints & file upload
│   │   ├── health.js                  # Health checks
│   │   ├── analytics.js               # Analytics endpoints
│   │   ├── emotions.js                # Emotional analytics
│   │   ├── tools.js                   # AI tool execution
│   │   ├── subscription.js            # Stripe subscriptions
│   │   ├── wallet.js                  # Credit management
│   │   ├── cloud.js                   # Social features
│   │   ├── personalInsights.js        # Personal analytics
│   │   ├── personalizedAI.js          # AI personalization
│   │   ├── collectiveData.js          # Collective insights
│   │   ├── user.js                    # User management
│   │   ├── sync.js                    # Data sync
│   │   ├── tasks.js                   # Task management
│   │   ├── debug.js                   # Debug endpoints
│   │   ├── docs.js                    # API documentation
│   │   └── testGPT4o.js               # GPT-4o testing
│   ├── services/                 # Business logic
│   │   ├── llmService.js              # OpenRouter LLM integration
│   │   ├── websocketService.js        # Real-time WebSocket
│   │   ├── redisService.js            # Redis caching
│   │   ├── personalizationEngine.js   # AI personalization
│   │   ├── advancedAnalytics.js       # Deep analytics engine
│   │   ├── collectiveDataService.js   # Collective intelligence
│   │   ├── connectionEngine.js        # Social connections
│   │   ├── stripeService.js           # Payment processing
│   │   ├── pushNotificationService.js # Push notifications
│   │   ├── taskScheduler.js           # Background tasks
│   │   ├── toolExecutor.js            # Tool execution
│   │   ├── toolRegistry.js            # Tool management
│   │   ├── offlineSyncService.js      # Offline sync
│   │   ├── dataProcessingPipeline.js  # Data processing
│   │   ├── enhancedMemoryService.js   # Memory management
│   │   ├── snapshotAnalysisService.js # Snapshot analysis
│   │   ├── scheduledAggregationService.js # Scheduled tasks
│   │   ├── requestCacheService.js     # Request caching
│   │   ├── triggerSystem.js           # Event triggers
│   │   └── analytics.js               # Basic analytics
│   ├── middleware/               # Express middleware
│   │   ├── auth.js                    # JWT authentication
│   │   ├── security.js                # CORS & security headers
│   │   ├── rateLimiter.js             # Rate limiting
│   │   ├── cacheMiddleware.js         # Response caching
│   │   ├── performanceMiddleware.js   # Performance monitoring
│   │   └── subscriptionGate.js        # Subscription validation
│   ├── tools/                    # 25+ AI tools
│   │   ├── webSearch.js               # Web search
│   │   ├── weatherCheck.js            # Weather information
│   │   ├── calculator.js              # Math calculations
│   │   ├── academicSearch.js          # Academic research
│   │   ├── codeGenerator.js           # Code generation
│   │   ├── cryptoLookup.js            # Cryptocurrency data
│   │   ├── currencyConverter.js       # Currency conversion
│   │   ├── emailAssistant.js          # Email assistance
│   │   ├── fitnessTracker.js          # Fitness tracking
│   │   ├── imageSearch.js             # Image search
│   │   ├── musicRecommendations.js    # Music recommendations
│   │   ├── newsSearch.js              # News search
│   │   ├── stockLookup.js             # Stock information
│   │   ├── translation.js             # Language translation
│   │   └── [15+ more tools...]        # Additional specialized tools
│   ├── utils/                    # Utility functions
│   │   ├── logger.js                  # Winston logging
│   │   ├── errorHandler.js            # Error handling
│   │   ├── cache.js                   # Caching utilities
│   │   ├── sanitize.js                # Input sanitization
│   │   ├── memory.js                  # Memory management
│   │   ├── analyticsHelper.js         # Analytics utilities
│   │   ├── imageCompression.js        # Image processing
│   │   └── collectiveDataHelper.js    # Collective data utilities
│   └── server.js                 # Main application entry
├── tests/                        # Test suites
│   ├── integration/              # API integration tests
│   ├── unit/                     # Unit tests
│   └── scripts/                  # Test utilities
├── eslint.config.js              # ESLint configuration
├── package.json                  # Dependencies & scripts
└── README.md                     # This file
```

## ✨ Core Features

### 🤖 AI & Personalization
- **Advanced AI Chat**: OpenRouter integration with GPT-4o, Claude, and other models
- **Tool Ecosystem**: 25+ specialized AI tools (web search, weather, calculator, etc.)
- **Personalization Engine**: Adaptive AI personality based on user behavior
- **Emotional Intelligence**: Deep emotional analytics and pattern recognition
- **Memory System**: Conversation memory with intelligent importance scoring

### 📱 Mobile & Real-time
- **File Upload**: Support for images, text files, and PDFs with processing
- **Offline Sync**: Queue system for offline mobile functionality
- **WebSocket**: Real-time chat updates and notifications
- **Push Notifications**: Smart notification system
- **Batch API**: Mobile-optimized batch request processing

### 🧠 Analytics & Intelligence
- **Behavioral Analytics**: Deep user behavior pattern analysis
- **Collective Intelligence**: Anonymized insights from user patterns
- **Predictive Analytics**: Growth trajectory and behavioral predictions
- **Personal Insights**: Customized analytics and recommendations
- **Emotional Tracking**: Comprehensive emotion analysis and insights

### 💳 Subscription & Credits
- **Stripe Integration**: Subscription management and payment processing
- **Credit System**: Usage-based credit tracking and management
- **Subscription Tiers**: Multiple subscription levels with feature gates

### 🔒 Security & Performance
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: API protection and abuse prevention
- **Input Sanitization**: Comprehensive security validation
- **Redis Caching**: High-performance caching layer
- **Performance Monitoring**: Real-time performance metrics

## 🛠️ Technology Stack

- **Runtime**: Node.js 18+ with ES6 modules
- **Framework**: Express.js with comprehensive middleware
- **Database**: MongoDB with Mongoose ODM
- **Caching**: Redis for sessions and data caching
- **Real-time**: Socket.io WebSockets
- **AI**: OpenRouter API (GPT-4o, Claude, etc.)
- **Payment**: Stripe for subscriptions and payments
- **File Processing**: Multer + Sharp for image handling
- **Testing**: Jest for unit and integration tests
- **Code Quality**: ESLint for linting and standards
- **Deployment**: Railway, Render, Heroku support

## 📡 Key API Endpoints

### Authentication & User
```
POST /api/auth/login        # User authentication
POST /api/auth/signup       # User registration
GET  /api/user/profile      # Get user profile
PUT  /api/user/profile      # Update user profile
```

### AI & Chat
```
POST /api/ai/chat           # AI chat with streaming
POST /api/ai/tools/execute  # Execute AI tools
POST /api/ai/personalized   # Personalized AI responses
```

### Mobile & Files
```
POST /api/mobile/upload     # File upload (images, text, PDF)
POST /api/mobile/sync       # Data synchronization
POST /api/mobile/batch      # Batch API requests
```

### Analytics & Insights
```
GET  /api/analytics/insights    # Personal insights
GET  /api/emotions/history      # Emotional analytics
GET  /api/collective-data/insights # Collective insights
```

### Health & Monitoring
```
GET  /api/health/health     # Server health check
GET  /api/health/llm        # LLM service health
```

## 🚀 Development

### Environment Setup
```bash
# Required environment variables
MONGO_URI=mongodb://localhost:27017/numina
JWT_SECRET=your-jwt-secret
OPENROUTER_API_KEY=sk-or-your-key
REDIS_URL=redis://localhost:6379
STRIPE_SECRET_KEY=sk_test_your-key
PORT=5001
NODE_ENV=development
```

### Development Commands
```bash
npm run dev          # Start development server with nodemon
npm test             # Run Jest test suite
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage
npm run lint         # Run ESLint
npm run lint:fix     # Fix linting issues
```

### Production Deployment
```bash
npm start            # Production server
npm run build        # Build for production (if applicable)
```

## 🧪 Testing

Comprehensive test suite with Jest:
- **Unit Tests**: Individual service and utility testing
- **Integration Tests**: API endpoint testing
- **Coverage Reports**: Detailed test coverage analysis

```bash
npm test                    # Run all tests
npm run test:coverage      # Test with coverage report
```

## 📊 Performance Features

- **Redis Caching**: Session and data caching for fast responses
- **Connection Pooling**: Optimized database connections
- **Request Caching**: Intelligent API response caching
- **Performance Monitoring**: Real-time metrics and logging
- **Memory Management**: Efficient resource usage tracking

## 🔐 Security Features

- **JWT Authentication**: Secure token-based auth with middleware
- **Rate Limiting**: Protection against API abuse
- **CORS Configuration**: Secure cross-origin resource sharing
- **Input Validation**: Comprehensive request sanitization
- **Security Headers**: Helmet.js security headers
- **Admin Controls**: Role-based access control

## 📈 Analytics Capabilities

- **User Behavior**: Comprehensive behavioral pattern analysis
- **Emotional Intelligence**: Advanced emotion tracking and insights
- **Predictive Analytics**: Growth trajectory predictions
- **Collective Insights**: Anonymized user pattern analysis
- **Performance Metrics**: Real-time server and API metrics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`npm test`)
4. Run linting (`npm run lint`)
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📄 License

Licensed under the Apache 2.0 License - see [LICENSE](LICENSE) for details.

## 🆘 Support

- **Documentation**: Check the API docs at `/api/docs`
- **Health Check**: Monitor server status at `/api/health/health`
- **Issues**: Report bugs and feature requests on GitHub
- **Performance**: Monitor real-time metrics and logs

---

Built with ❤️ for the Numina AI platform - Empowering personalized AI experiences.