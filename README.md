# Numina Server

A modular Express.js server for the Numina AI assistant application.

## Project Structure

```
src/
├── config/
│   └── database.js          # MongoDB connection configuration
├── models/
│   ├── User.js             # User model with authentication
│   ├── ShortTermMemory.js  # Conversation memory model
│   └── Task.js             # Background task model
├── middleware/
│   ├── auth.js             # JWT authentication middleware
│   └── security.js         # CORS, rate limiting, and security headers
├── routes/
│   ├── auth.js             # Authentication routes (signup/login)
│   ├── user.js             # User profile routes
│   ├── health.js           # Health check endpoint
│   ├── completion.js       # LLM completion endpoint
│   └── tasks.js            # Background task processing
├── services/
│   └── llmService.js       # LLM API service
├── utils/
│   ├── sanitize.js         # Response sanitization utilities
│   └── cache.js            # In-memory caching and monitoring
└── server.js               # Main application entry point
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

## Getting Started

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
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Start the production server:
   ```bash
   npm start
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

The application is now split into logical modules:

- **Models**: Database schemas and models
- **Middleware**: Authentication and security middleware
- **Routes**: API endpoint handlers
- **Services**: External service integrations
- **Utils**: Helper functions and utilities
- **Config**: Configuration files

This modular structure makes the codebase more maintainable and easier to test. 