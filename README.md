# Numina Server

A modular Express.js server for the Numina AI assistant application.

## Project Structure

```
├── src/
│   ├── config/
│   │   ├── database.js          # MongoDB connection configuration
│   │   ├── environment.js       # Environment variable management
│   │   └── constants.js         # Application constants and configuration
│   ├── models/
│   │   ├── User.js             # User model with authentication
│   │   ├── ShortTermMemory.js  # Conversation memory model
│   │   └── Task.js             # Background task model
│   ├── middleware/
│   │   ├── auth.js             # JWT authentication middleware
│   │   ├── security.js         # CORS, rate limiting, and security headers
│   │   └── performanceMiddleware.js # Performance monitoring and optimization
│   ├── routes/
│   │   ├── auth.js             # Authentication routes (signup/login)
│   │   ├── user.js             # User profile routes
│   │   ├── health.js           # Health check endpoint
│   │   ├── completion.js       # LLM completion endpoint
│   │   ├── tasks.js            # Background task processing
│   │   └── docs.js             # API documentation and testing
│   ├── services/
│   │   ├── llmService.js       # LLM API service
│   │   ├── analytics.js        # Analytics and metrics service
│   │   └── taskScheduler.js    # Task scheduling and management
│   ├── utils/
│   │   ├── sanitize.js         # Response sanitization utilities
│   │   ├── cache.js            # In-memory caching and monitoring
│   │   ├── errorHandler.js     # Centralized error handling
│   │   └── logger.js           # Structured logging with Winston
│   └── server.js               # Main application entry point
├── tests/
│   ├── routes/                 # Route-specific tests
│   ├── utils/                  # Utility function tests
│   └── setup.js                # Test configuration and setup
├── scripts/
│   ├── deploy.sh               # Deployment automation script
│   └── performance-test.js     # Performance testing utilities
├── server.js                   # Legacy entry point (redirects to src/server.js)
├── package.json                # Dependencies and scripts
├── railway.json                # Railway deployment configuration
├── render.yaml                 # Render deployment configuration
├── Procfile                    # Heroku deployment configuration
├── babel.config.js             # Babel configuration for testing
├── jest.config.js              # Jest testing configuration
└── .gitignore                  # Git ignore rules
```

## Features

- **Modular Architecture**: Clean separation of concerns with dedicated modules
- **Advanced Authentication**: JWT-based auth with account locking and security features
- **Enhanced User Profiles**: Rich user profiles with preferences and statistics
- **LLM Integration**: Integration with Claude 3 Sonnet via OpenRouter API
- **Memory Management**: Short-term conversation memory with TTL
- **Emotional Intelligence**: Advanced emotional tracking with insights and analysis
- **Task Scheduling**: Advanced task system with cron jobs and priority queues
- **Analytics & Metrics**: Comprehensive analytics and performance tracking
- **Advanced Logging**: Structured logging with Winston and performance monitoring
- **Error Handling**: Centralized error handling with custom error classes
- **API Documentation**: Interactive API docs and testing interface
- **Security**: CORS, rate limiting, security headers, and input validation
- **Performance**: Connection pooling, caching, memory monitoring, and optimization
- **Testing**: Comprehensive test suite with Jest and Supertest
- **Deployment**: Multi-platform deployment support (Railway, Render, Heroku)

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- MongoDB database
- Environment variables configured

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file with your configuration:
   ```env
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   LLAMA_CPP_API_URL=your_llm_api_url
   PORT=5000
   NODE_ENV=development
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Start the production server:
   ```bash
   npm start
   ```

5. Run tests:
   ```bash
   npm test
   npm run test:watch
   npm run test:coverage
   ```

### SaaS Deployment

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

## API Endpoints

### Authentication
- `POST /signup` - User registration
- `POST /login` - User login

### User Management
- `GET /profile` - Get user profile (protected)
- `PUT /profile` - Update user profile (protected)

### LLM Integration
- `POST /completion` - Get AI completion (protected)

### Task Management
- `GET /run-tasks` - Process background tasks (protected)
- `POST /tasks` - Schedule new task (protected)

### System & Analytics
- `GET /health` - Health check
- `GET /metrics` - System metrics (protected)
- `GET /status` - API status
- `GET /docs` - API documentation
- `GET /test` - Interactive API testing

## Development

The application is organized into logical modules:

- **Config**: Environment variables, database configuration, and constants
- **Models**: Database schemas and models with Mongoose
- **Middleware**: Authentication, security, and performance monitoring
- **Routes**: API endpoint handlers with validation
- **Services**: External service integrations (LLM, analytics, task scheduling)
- **Utils**: Helper functions, error handling, logging, and caching
- **Tests**: Comprehensive test suite with Jest and Supertest
- **Scripts**: Deployment automation and performance testing

This modular structure makes the codebase more maintainable, testable, and scalable.

## Testing

The project includes a comprehensive test suite:

- **Unit Tests**: Individual function and module testing
- **Integration Tests**: API endpoint testing with Supertest
- **Performance Tests**: Load testing and performance monitoring
- **Coverage Reports**: Detailed test coverage analysis

Run tests with:
```bash
npm test                    # Run all tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage report
```

## Performance

The application includes advanced performance features:

- **Caching**: In-memory caching with TTL and monitoring
- **Connection Pooling**: Optimized database connections
- **Rate Limiting**: API rate limiting and abuse prevention
- **Compression**: Response compression for better performance
- **Monitoring**: Real-time performance metrics and logging
- **Optimization**: Memory usage monitoring and optimization

## Security

Security features include:

- **Authentication**: JWT-based authentication with account locking
- **Authorization**: Role-based access control
- **Input Validation**: Comprehensive input sanitization and validation
- **Rate Limiting**: Protection against abuse and DDoS
- **Security Headers**: Helmet.js for security headers
- **CORS**: Configurable Cross-Origin Resource Sharing
- **Error Handling**: Secure error responses without information leakage 