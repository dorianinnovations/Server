# Numina AI Server

A comprehensive, modular Express.js server for the Numina AI assistant application featuring personalized AI, emotional analytics, collective intelligence, and advanced tool integration capabilities.

## 📁 Project Structure

```
numina-server/
├── src/                          # Main application source code
│   ├── config/                   # Configuration files
│   │   ├── constants.js          # Application constants
│   │   ├── database.js           # MongoDB connection configuration
│   │   └── environment.js        # Environment variable management
│   ├── middleware/               # Express middleware
│   │   ├── auth.js              # JWT authentication middleware
│   │   ├── cacheMiddleware.js    # Caching middleware
│   │   ├── performanceMiddleware.js # Performance monitoring
│   │   ├── rateLimiter.js       # Rate limiting
│   │   ├── security.js          # CORS, security headers, input validation
│   │   └── subscriptionGate.js  # Subscription validation
│   ├── models/                   # Database models
│   │   ├── User.js              # User model with authentication
│   │   ├── Task.js              # Background task model
│   │   ├── Event.js             # Event tracking model
│   │   ├── ShortTermMemory.js   # AI conversation memory model
│   │   ├── EmotionalAnalyticsSession.js # Emotional analytics model
│   │   ├── CollectiveDataConsent.js # Data consent management
│   │   ├── CollectiveSnapshot.js # Collective intelligence data
│   │   ├── UserBehaviorProfile.js # User behavior tracking
│   │   ├── CreditPool.js        # Credit management model
│   │   └── Tool.js              # AI tool definitions
│   ├── routes/                   # API route handlers
│   │   ├── auth.js              # Authentication routes (signup/login)
│   │   ├── user.js              # User profile routes
│   │   ├── health.js            # Health check endpoint
│   │   ├── completion.js        # LLM completion endpoint
│   │   ├── ai.js                # Core AI functionality
│   │   ├── emotions.js          # Emotional analytics routes
│   │   ├── personalizedAI.js    # Personalized AI features
│   │   ├── tools.js             # AI tool integration
│   │   ├── wallet.js            # Payment and wallet routes
│   │   ├── mobile.js            # Mobile-optimized routes
│   │   ├── sync.js              # Offline sync functionality
│   │   ├── tasks.js             # Background task processing
│   │   ├── docs.js              # API documentation and testing
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
│   │   ├── calculator.js        # Mathematical calculations
│   │   ├── codeGenerator.js     # Code generation tools
│   │   ├── cryptoLookup.js      # Cryptocurrency data
│   │   ├── currencyConverter.js # Currency conversion
│   │   ├── emailAssistant.js    # Email management
│   │   ├── fitnessTracker.js    # Fitness tracking
│   │   ├── imageSearch.js       # Image search capabilities
│   │   ├── itineraryGenerator.js # Travel planning tools
│   │   ├── linkedinHelper.js    # LinkedIn integration
│   │   ├── musicRecommendations.js # Music recommendations
│   │   ├── newsSearch.js        # News search
│   │   ├── nutritionLookup.js   # Nutrition information
│   │   ├── passwordGenerator.js # Password generation
│   │   ├── qrGenerator.js       # QR code generation
│   │   ├── reservationBooking.js # Booking system tools
│   │   ├── socialSearch.js      # Social media search
│   │   ├── spotifyPlaylist.js   # Music integration tools
│   │   ├── stockLookup.js       # Stock market data
│   │   ├── textGenerator.js     # Text generation
│   │   ├── timezoneConverter.js # Timezone conversion
│   │   ├── translation.js       # Language translation
│   │   ├── weatherCheck.js      # Weather information
│   │   └── webSearch.js         # Web search capabilities
│   ├── utils/                    # Utility functions
│   │   ├── logger.js            # Structured logging with Winston
│   │   ├── errorHandler.js      # Centralized error handling
│   │   ├── cache.js             # In-memory caching and monitoring
│   │   ├── memory.js            # Memory management
│   │   ├── sanitize.js          # Response sanitization utilities
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
├── package.json                  # Dependencies and scripts
├── jest.config.js               # Jest testing configuration
├── babel.config.js              # Babel transpilation config
├── railway.json                 # Railway deployment configuration
├── render.yaml                  # Render deployment configuration
├── Procfile                     # Heroku deployment configuration
├── LICENSE                      # Apache 2.0 license
└── README.md                    # Project documentation
```

## ✨ Features

### 🤖 AI Capabilities
- **Personalized AI**: Custom AI experiences tailored to each user
- **Emotional Intelligence**: Advanced emotional tracking with insights and analysis
- **Collective Intelligence**: AI that learns from all users' interactions
- **Tool Integration**: Comprehensive AI tool ecosystem with 25+ specialized tools
- **Memory Management**: Short-term conversation memory with TTL

### 📱 Mobile Optimization
- **Offline Sync**: Seamless functionality without internet connection
- **Push Notifications**: Smart notification system with user preferences
- **Mobile-optimized routes**: Fast loading and responsive design
- **Real-time WebSocket connections**: Live updates and instant communication

### 🏗️ Architecture & Performance
- **Modular Architecture**: Clean separation of concerns with dedicated modules
- **Advanced Authentication**: JWT-based auth with account locking and security features
- **Enhanced User Profiles**: Rich user profiles with preferences and statistics
- **Task Scheduling**: Advanced task system with cron jobs and priority queues
- **Analytics & Metrics**: Comprehensive analytics and performance tracking
- **Advanced Logging**: Structured logging with Winston and performance monitoring
- **Error Handling**: Centralized error handling with custom error classes
- **API Documentation**: Interactive API docs and testing interface

### 🔒 Security & Performance
- **Security**: CORS, rate limiting, security headers, and input validation
- **Performance**: Connection pooling, caching, memory monitoring, and optimization
- **Redis Caching**: Fast response times and session management
- **Memory Optimization**: Efficient resource usage and monitoring
- **Compression**: Response compression for better performance

### 🧪 Development & Testing
- **Comprehensive Testing**: Unit, integration, and end-to-end tests
- **Environment Configuration**: Separate dev/prod environments
- **Deployment Automation**: Multi-platform deployment support
- **Performance Monitoring**: Real-time performance tracking

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- MongoDB database
- Redis (for caching and sessions)
- Environment variables configured

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Create a `.env` file** with your configuration:
   ```env
   MONGO_URI=your_mongodb_connection_string
   REDIS_URL=your_redis_connection_string
   JWT_SECRET=your_jwt_secret
   OPENROUTER_API_KEY=your_openrouter_api_key
   PORT=5000
   NODE_ENV=development
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Start the production server**:
   ```bash
   npm start
   ```

5. **Run tests**:
   ```bash
   npm test
   npm run test:watch
   npm run test:coverage
   ```

### 🚀 SaaS Deployment

For the easiest deployment as a SaaS application:

1. **Quick Deploy (Recommended)**: Use our deployment script:
   ```bash
   ./scripts/deploy.sh
   ```

2. **Manual Deploy**: Follow the [Quick Start Guide](QUICK_START.md) for step-by-step instructions.

3. **Platform Options**:
   - **Railway** (Recommended): Zero-config deployment
   - **Render**: Free tier with easy setup
   - **Heroku**: Traditional platform with extensive docs

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment strategies.

## 📡 API Endpoints

### Authentication
- `POST /signup` - User registration
- `POST /login` - User login

### User Management
- `GET /profile` - Get user profile (protected)
- `PUT /profile` - Update user profile (protected)

### AI & LLM Integration
- `POST /completion` - Get AI completion (protected)
- `POST /ai/*` - Core AI functionality routes

### Emotional Analytics
- `GET /emotions/*` - Emotional analytics and insights
- `POST /emotional-analytics/*` - Emotional data processing

### Personalized AI
- `GET /personalized-ai/*` - Personalized AI features
- `POST /personalized-ai/*` - AI personalization data

### Tool Integration
- `GET /tools/*` - AI tool management
- `POST /tools/*` - Tool execution and results

### Task Management
- `GET /run-tasks` - Process background tasks (protected)
- `POST /tasks` - Schedule new task (protected)

### Payment & Wallet
- `GET /wallet/*` - Wallet and payment management
- `POST /wallet/*` - Payment processing

### Mobile & Sync
- `GET /mobile/*` - Mobile-optimized routes
- `POST /sync/*` - Offline sync functionality

### System & Analytics
- `GET /health` - Health check
- `GET /metrics` - System metrics (protected)
- `GET /status` - API status
- `GET /docs` - API documentation
- `GET /test` - Interactive API testing

## 🏗️ Development

The application is organized into logical modules:

- **Config**: Environment variables, database configuration, and constants
- **Models**: Database schemas and models with Mongoose
- **Middleware**: Authentication, security, and performance monitoring
- **Routes**: API endpoint handlers with validation
- **Services**: External service integrations (LLM, analytics, task scheduling)
- **Tools**: AI tool implementations and integrations
- **Utils**: Helper functions, error handling, logging, and caching
- **Tests**: Comprehensive test suite with Jest and Supertest
- **Scripts**: Deployment automation and performance testing

This modular structure makes the codebase more maintainable, testable, and scalable.

## 🧪 Testing

The project includes a comprehensive test suite:

- **Unit Tests**: Individual function and module testing
- **Integration Tests**: API endpoint testing with Supertest
- **End-to-End Tests**: Complete user workflow testing
- **Performance Tests**: Load testing and performance monitoring
- **Coverage Reports**: Detailed test coverage analysis

Run tests with:
```bash
npm test                    # Run all tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage report
```

## ⚡ Performance

The application includes advanced performance features:

- **Caching**: In-memory and Redis caching with TTL and monitoring
- **Connection Pooling**: Optimized database connections
- **Rate Limiting**: API rate limiting and abuse prevention
- **Compression**: Response compression for better performance
- **Monitoring**: Real-time performance metrics and logging
- **Optimization**: Memory usage monitoring and optimization

## 🔒 Security

Security features include:

- **Authentication**: JWT-based authentication with account locking
- **Authorization**: Role-based access control
- **Input Validation**: Comprehensive input sanitization and validation
- **Rate Limiting**: Protection against abuse and DDoS
- **Security Headers**: Helmet.js for security headers
- **CORS**: Configurable Cross-Origin Resource Sharing
- **Error Handling**: Secure error responses without information leakage

## 🛠️ Technology Stack

- **Runtime**: Node.js with Express.js
- **Database**: MongoDB with Mongoose ODM
- **Caching**: Redis
- **Real-time**: WebSocket
- **AI Integration**: OpenRouter API
- **Testing**: Jest
- **Deployment**: Heroku, Render, Railway
- **Security**: Helmet, CORS, Rate limiting
- **Performance**: Compression, Caching, Memory optimization

## 📄 License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details. 