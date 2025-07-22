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
├── src/                          # Main application source
│   ├── config/                   # App configuration
│   │   ├── constants.js          # HTTP status codes & messages
│   │   ├── database.js           # MongoDB connection
│   │   └── environment.js        # Environment variable management
│   ├── models/                   # Mongoose schemas
│   │   ├── User.js                    # User auth & profile
│   │   ├── UserBehaviorProfile.js     # Behavioral analytics
│   │   ├── [Removed] EmotionalAnalyticsSession.js # Replaced with AI-driven emotion detection
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
│   │   ├── passwordGenerator.js       # Password generation
│   │   ├── qrGenerator.js             # QR code generation
│   │   ├── timezoneConverter.js       # Timezone conversion
│   │   ├── textGenerator.js           # Text generation
│   │   ├── spotifyPlaylist.js         # Spotify integration
│   │   ├── socialSearch.js            # Social media search
│   │   ├── reservationBooking.js      # Booking assistance
│   │   ├── nutritionLookup.js         # Nutrition information
│   │   ├── linkedinHelper.js          # LinkedIn assistance
│   │   ├── locationService.js         # Location services
│   │   ├── itineraryGenerator.js      # Travel planning
│   │   ├── creditManagement.js        # Credit system tools
│   │   ├── ubpmAnalysis.js            # UBPM analysis
│   │   └── [additional tools...]      # More specialized tools
│   ├── utils/                    # Utility functions
│   │   ├── logger.js                  # Winston logging
│   │   ├── errorHandler.js            # Error handling
│   │   ├── cache.js                   # Caching utilities
│   │   ├── sanitize.js                # Input sanitization
│   │   ├── memory.js                  # Memory management
│   │   ├── analyticsHelper.js         # Analytics utilities
│   │   ├── imageCompression.js        # Image processing
│   │   ├── imageCompressionBasic.js   # Basic image compression
│   │   ├── collectiveDataHelper.js    # Collective data utilities
│   │   ├── incrementalMemory.js       # Incremental memory system
│   │   ├── memoryAnalytics.js         # Memory analytics
│   │   └── memoryImportance.js        # Memory importance scoring
│   └── server.js                 # Main application entry
├── tests/                        # Test suites
│   ├── integration/              # API integration tests
│   │   ├── test_credit_setup.js      # Credit system tests
│   │   ├── test_endpoints.js         # Endpoint testing
│   │   ├── test_secure_cloud.js      # Cloud security tests
│   │   ├── test_stripe_wallet.js     # Payment tests
│   │   └── test_tools.js             # Tool execution tests
│   ├── unit/                     # Unit tests
│   ├── e2e/                      # End-to-end tests
│   │   └── complete-user-journey.test.js # Full user journey tests
│   ├── middleware/               # Middleware tests
│   │   └── security.test.js          # Security middleware tests
│   ├── routes/                   # Route-specific tests
│   │   ├── auth.test.js              # Authentication tests
│   │   ├── collectiveData.test.js    # Collective data tests
│   │   ├── collectiveSnapshots.test.js # Snapshot tests
│   │   ├── health.test.js            # Health check tests
│   │   ├── scheduledAggregation.test.js # Aggregation tests
│   │   └── user.test.js              # User management tests
│   ├── utils/                    # Utility tests
│   │   ├── cache.test.js             # Cache utility tests
│   │   ├── sanitize.test.js          # Sanitization tests
│   │   ├── globalTestSetup.js        # Test setup utilities
│   │   ├── globalTestTeardown.js     # Test teardown utilities
│   │   ├── testSetup.js              # Test configuration
│   │   └── successRateMonitor.js     # Success rate monitoring
│   ├── scripts/                   # Test utilities & scripts
│   │   ├── checkSnapshots.js         # Snapshot verification
│   │   ├── cleanupAndRegenerate.js   # Test data cleanup
│   │   ├── clearCache.js             # Cache clearing
│   │   ├── continuousMonitoring.js    # Continuous monitoring
│   │   ├── create_test_user.js       # Test user creation
│   │   ├── createTestUsers.js        # Bulk test user creation
│   │   ├── performance-test.js       # Performance testing
│   │   ├── runE2EWithMetrics.js      # E2E with metrics
│   │   ├── seed_events.js            # Event seeding
│   │   ├── seedTestData.js           # Test data seeding
│   │   ├── setup_test_user.js        # Test user setup
│   │   ├── setup_verified_account.js # Verified account setup
│   │   ├── simpleWSTest.js           # WebSocket testing
│   │   ├── testAPI.js                # API testing
│   │   ├── testWebSocket.js          # WebSocket testing
│   │   ├── test-final-email.js       # Email testing
│   │   └── quick-email-test.js       # Quick email tests
│   ├── metrics/                    # Test metrics
│   │   ├── accuracy-test.json        # Accuracy metrics
│   │   ├── historical-test.json      # Historical test data
│   │   └── success-rates.json        # Success rate data
│   ├── setup.js                     # Test setup configuration
│   ├── test-server.js               # Test server instance
│   ├── test-payload.json            # Test payloads
│   └── signup-payload.json          # Signup test data
├── scripts/                        # Development & deployment scripts
│   ├── deploy.sh                    # Deployment script
│   ├── optimizeDatabase.js          # Database optimization
│   ├── performanceTest.js           # Performance testing
│   ├── realWorldStressTest.sh       # Real-world stress testing
│   ├── stressTest.sh                # Stress testing
│   ├── testOptimizations.js         # Optimization testing
│   ├── testResendEmail.js           # Email service testing
│   ├── testRealEmail.js             # Real email testing
│   ├── testEmailFixed.js            # Fixed email testing
│   ├── testEmail.js                 # Basic email testing
│   ├── testCloudFeatures.js         # Cloud feature testing
│   ├── seedTestUsers.js             # Test user seeding
│   ├── seedCloudEvents.js           # Cloud event seeding
│   └── wipeData.js                  # Data cleanup
├── logs/                           # Application logs
├── coverage/                       # Test coverage reports
├── .expo/                          # Expo configuration
├── .claude/                        # Claude AI configuration
├── server.js                       # Render deployment wrapper
├── package.json                    # Dependencies & scripts
├── package-lock.json               # Locked dependencies
├── eslint.config.js                # ESLint configuration
├── jest.config.js                  # Jest test configuration
├── babel.config.js                 # Babel configuration
├── app.json                        # App configuration
├── Procfile                        # Heroku deployment
├── railway.json                    # Railway deployment
├── render.yaml                     # Render deployment
├── deploy-email-update.sh          # Email deployment script
├── server.log                      # Server log file
├── .gitignore                      # Git ignore rules
├── LICENSE                         # License file
└── README.md                       # This file
```

## ✨ Core Features

### 🤖 AI & Personalization
- **Advanced AI Chat**: OpenRouter integration with GPT-4o, Claude, and other models
- **Tool Ecosystem**: 25+ specialized AI tools organized by category:
  - **Search & Information**: Web search, news, academic research, image search
  - **Financial**: Stock lookup, cryptocurrency, currency conversion, credit management
  - **Productivity**: Calculator, code generation, password generation, QR generation
  - **Travel & Location**: Weather, timezone conversion, location services, itinerary generation
  - **Entertainment**: Music recommendations, Spotify integration, text generation
  - **Health & Fitness**: Fitness tracking, nutrition lookup, email assistance
  - **Social & Professional**: LinkedIn helper, social search, reservation booking
  - **Specialized**: Translation, UBPM analysis, collective data tools
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

### File Organization

The project follows a clean, organized structure:

- **`src/`**: Main application source code
  - **`config/`**: Configuration files (database, constants, environment)
  - **`models/`**: Mongoose schemas and data models
  - **`routes/`**: API endpoint handlers
  - **`services/`**: Business logic and external service integrations
  - **`middleware/`**: Express middleware (auth, security, caching)
  - **`tools/`**: 25+ specialized AI tools
  - **`utils/`**: Utility functions and helpers

- **`tests/`**: Comprehensive test suite
  - **`integration/`**: API integration tests
  - **`unit/`**: Unit tests for individual components
  - **`e2e/`**: End-to-end user journey tests
  - **`scripts/`**: Test utilities and automation scripts
  - **`metrics/`**: Test performance and accuracy metrics

- **`scripts/`**: Development and deployment scripts
  - Performance testing and optimization
  - Database management and seeding
  - Email service testing
  - Stress testing and monitoring

### Key Files

- **`server.js`**: Render deployment wrapper (main server in `src/server.js`)
- **`package.json`**: Dependencies and npm scripts
- **`eslint.config.js`**: Code quality and linting rules
- **`jest.config.js`**: Test configuration
- **Deployment configs**: `railway.json`, `render.yaml`, `Procfile`

## 🧪 Testing

Comprehensive test suite with Jest organized into logical categories:

### Test Structure
- **Unit Tests** (`tests/unit/`): Individual service and utility testing
- **Integration Tests** (`tests/integration/`): API endpoint and service integration testing
- **E2E Tests** (`tests/e2e/`): Complete user journey testing
- **Route Tests** (`tests/routes/`): Specific endpoint testing
- **Middleware Tests** (`tests/middleware/`): Security and middleware testing
- **Utility Tests** (`tests/utils/`): Helper function testing

### Test Scripts
- **Performance Testing**: `tests/scripts/performance-test.js`
- **Email Testing**: `tests/scripts/test-final-email.js`, `tests/scripts/quick-email-test.js`
- **WebSocket Testing**: `tests/scripts/testWebSocket.js`
- **User Setup**: `tests/scripts/createTestUsers.js`, `tests/scripts/setup_test_user.js`
- **Data Seeding**: `tests/scripts/seedTestData.js`, `tests/scripts/seed_events.js`

### Test Metrics
- **Accuracy Tracking**: `tests/metrics/accuracy-test.json`
- **Historical Data**: `tests/metrics/historical-test.json`
- **Success Rates**: `tests/metrics/success-rates.json`

```bash
npm test                    # Run all tests
npm run test:coverage      # Test with coverage report
npm run test:watch         # Run tests in watch mode
```

## 📊 Performance Features

- **Redis Caching**: Session and data caching for fast responses
- **Connection Pooling**: Optimized database connections
- **Request Caching**: Intelligent API response caching
- **Performance Monitoring**: Real-time metrics and logging
- **Memory Management**: Efficient resource usage tracking

## 🛠️ Development Scripts

The project includes comprehensive development and testing scripts:

### Performance & Optimization
- **`scripts/performanceTest.js`**: Comprehensive performance testing
- **`scripts/optimizeDatabase.js`**: Database optimization utilities
- **`scripts/testOptimizations.js`**: Optimization testing and validation
- **`scripts/stressTest.sh`**: Stress testing for API endpoints
- **`scripts/realWorldStressTest.sh`**: Real-world scenario stress testing

### Email & Communication
- **`scripts/testResendEmail.js`**: Email service testing
- **`scripts/testRealEmail.js`**: Real email delivery testing
- **`scripts/testEmailFixed.js`**: Fixed email configuration testing
- **`scripts/testEmail.js`**: Basic email functionality testing

### Data Management
- **`scripts/seedTestUsers.js`**: Bulk test user creation
- **`scripts/seedCloudEvents.js`**: Cloud event data seeding
- **`scripts/wipeData.js`**: Data cleanup and reset utilities

### Deployment
- **`scripts/deploy.sh`**: Automated deployment script
- **`deploy-email-update.sh`**: Email service deployment updates

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