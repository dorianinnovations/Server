# Numina AI Server 2.0

Production-ready Express.js backend featuring advanced AI personalization, UBPM cognitive modeling, and comprehensive tool integration.

## Project Structure

```
numina-server/
├── src/
│   ├── config/
│   │   ├── constants.js              # HTTP status & messages
│   │   ├── database.js               # MongoDB connection
│   │   ├── environment.js            # Environment management
│   │   └── tiers.js                  # Subscription tier config
│   ├── models/
│   │   ├── User.js                   # User accounts & profiles
│   │   ├── Conversation.js           # Chat history storage
│   │   ├── ShortTermMemory.js        # AI conversation context
│   │   ├── UserBehaviorProfile.js    # UBPM psychological data
│   │   ├── Event.js                  # User activity tracking
│   │   ├── Tool.js                   # AI tools registry
│   │   ├── UserConstants.js          # User preferences
│   │   ├── UserEvent.js              # User events
│   │   └── DeletionTask.js           # Data cleanup management
│   ├── routes/
│   │   ├── auth.js                   # Authentication & JWT
│   │   ├── user.js                   # User management
│   │   ├── ai.js                     # AI chat & UBPM integration
│   │   ├── health.js                 # System health monitoring
│   │   ├── subscription.js           # Stripe subscription management
│   │   ├── ubpm.js                   # UBPM behavioral analytics
│   │   ├── analyticsLLM.js           # LLM-powered analytics
│   │   ├── analyticsEcosystem.js     # System-wide analytics
│   │   ├── analyticsRateStatus.js    # Rate limiting analytics
│   │   └── personalizedAI.js         # Contextual AI responses
│   ├── services/
│   │   ├── llmService.js             # OpenRouter LLM integration
│   │   ├── ubpmCognitiveEngine.js    # Advanced cognitive modeling
│   │   ├── cognitiveArchitectureEngine.js # Cognitive architecture
│   │   ├── aiInsightService.js       # AI-powered insights
│   │   ├── enhancedMemoryService.js  # Advanced memory management
│   │   ├── conversationService.js    # Chat persistence
│   │   ├── contextInjectionService.js # Dynamic context injection
│   │   ├── numinaContextBuilder.js   # Context generation
│   │   ├── optimizedChat.js          # Performance-optimized chat
│   │   ├── personalizationEngine.js  # AI personalization
│   │   ├── webSearchService.js       # Advanced web search
│   │   ├── emailService.js           # Multi-provider email
│   │   ├── stripeService.js          # Payment processing
│   │   ├── websocketService.js       # Real-time communication
│   │   ├── redisService.js           # Caching & sessions
│   │   ├── toolRegistry.js           # AI tools management
│   │   ├── imageDisplayService.js    # Image processing
│   │   ├── richContentService.js     # Rich media handling
│   │   ├── connectionEngine.js       # Social connections
│   │   ├── ubpmService.js            # UBPM analysis
│   │   └── autonomousUBPM.js         # Autonomous UBPM
│   ├── middleware/
│   │   ├── auth.js                   # JWT authentication
│   │   ├── security.js               # CORS & security headers
│   │   ├── performanceMiddleware.js  # Performance monitoring
│   │   ├── cacheMiddleware.js        # Response caching
│   │   └── tierLimiter.js            # Subscription tier limits
│   ├── tools/
│   │   ├── insaneWebSearch.js        # Advanced web search
│   │   ├── realUBPMAnalysis.js       # Real-time UBPM analysis
│   │   └── [other tools...]          # Additional specialized tools
│   ├── utils/
│   │   ├── logger.js                 # Winston logging system
│   │   ├── errorHandler.js           # Error handling
│   │   ├── cache.js                  # Caching utilities
│   │   └── sanitize.js               # Input sanitization
│   └── server.js                     # Main application entry
├── archive/
│   └── unused-services/              # Legacy services (archived)
├── tests/                            # Comprehensive test suite
├── scripts/                          # Development scripts
├── package.json                      # Dependencies & scripts
├── .env                              # Environment configuration
├── CLAUDE.md                         # Development documentation
└── README.md                         # This documentation
```

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 8.0+
- Redis (optional, for caching)

### Installation
```bash
git clone <repository-url>
cd numina-server
npm install
cp .env.template .env
# Edit .env with your configuration
npm run dev
```

### Environment Configuration
```bash
# Core (Required)
MONGO_URI=mongodb://localhost:27017/numina-ai
JWT_SECRET=your-super-secure-jwt-secret-here
NODE_ENV=development
PORT=5000

# AI Services (Required)
OPENROUTER_API_KEY=sk-or-your-openrouter-api-key

# Payment Processing (Production)
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Email Services (Multi-provider fallback)
EMAIL_USER=your-gmail@gmail.com
EMAIL_APP_PASSWORD=your-gmail-app-password
BREVO_API_KEY=your-brevo-api-key
SENDGRID_API_KEY=your-sendgrid-api-key

# External APIs (Optional)
GOOGLE_SEARCH_API_KEY=your-google-search-api-key
GOOGLE_SEARCH_ENGINE_ID=your-search-engine-id
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
```

## API Endpoints

### Authentication
```http
POST /signup              # User registration with email verification
POST /login               # User authentication & JWT token
POST /refresh             # JWT token refresh
POST /spotify/connect     # Spotify account integration
POST /spotify/disconnect  # Spotify disconnection
```

### User Management
```http
GET    /profile             # User profile with tier information
POST   /profile/picture     # Profile picture upload (50MB limit)
DELETE /profile/picture     # Profile picture removal
GET    /settings            # User settings retrieval
POST   /settings            # Settings configuration
GET    /preferences         # User preferences
POST   /preferences         # Preferences update
PUT    /emotional-profile   # Emotional profile configuration
DELETE /delete/:userId?     # Complete account deletion
GET    /mongo-data          # Comprehensive user data export
```

### AI & Intelligence
```http
POST   /ai/chat             # Main AI chat with UBPM integration
POST   /ai/upload           # File upload for AI processing (50MB, 10 files)
GET    /ai/conversation/:id # Retrieve specific conversation
DELETE /ai/conversation/:id # Delete conversation

GET    /ubpm/profile        # User behavior profile
POST   /ubpm/analyze        # Behavioral pattern analysis
GET    /ubpm/insights       # Personalized insights

POST   /analyticsLLM/chat   # LLM-powered analytics
GET    /analyticsEcosystem  # System-wide analytics
POST   /personalizedAI/chat # Contextual AI responses
```

### Subscription & Billing
```http
GET  /subscription/status                    # Current subscription status
POST /subscription/create-checkout-session   # Stripe checkout session
POST /subscription/webhook                   # Stripe webhook handler
POST /subscription/cancel                    # Subscription cancellation
```

### Monitoring & Health
```http
GET /health    # Comprehensive system health check
GET /          # Basic server status
GET /test      # Operational status verification
```

## Key Features

### UBPM (User Behavior Pattern Modeling)
Advanced cognitive architecture that learns and adapts to individual users:
- Psychological profiling with deep behavioral pattern analysis
- Dynamic system prompts with AI personality adaptation
- Cognitive architecture with advanced reasoning and context integration
- Personalized responses with tailored AI communication style

### AI Chat Engine
Next-generation conversational AI:
- Multi-model support via OpenRouter integration (GPT-4o, Claude, etc.)
- Enhanced memory with intelligent conversation context retention
- Tool integration with advanced web search and processing capabilities
- Streaming responses with real-time typing indicators and updates
- File processing supporting images, documents, and rich media

### Mobile-First Architecture
Optimized for cross-platform mobile applications:
- File upload support for 50MB files, 10 files per request
- Real-time sync via WebSocket-based communication
- Offline support with robust offline data handling
- Performance optimized API responses
- Enterprise-grade security for mobile clients

### Subscription Management
Comprehensive billing and tier management:
- Stripe integration with full payment processing
- Multiple tiers: Core, Pro, Aether subscription levels
- Usage tracking with real-time usage monitoring
- Feature gating with tier-based feature access

## Technology Stack

### Core Technologies
- Runtime: Node.js 18+ with ES6 modules
- Framework: Express.js 4.21+ with comprehensive middleware
- Database: MongoDB 8.16+ with Mongoose ODM
- Caching: Redis with ioredis client
- Real-time: Socket.io WebSocket integration
- Authentication: JWT with bcrypt password hashing

### AI & Integration
- AI Provider: OpenRouter API (multi-model support)
- Payment: Stripe for subscription management
- Email: Multi-provider (Gmail, Brevo, SendGrid)
- File Processing: Multer + Sharp for media handling
- Search: Advanced web search capabilities
- Analytics: Real-time behavioral analytics

### Development & Quality
- Testing: Jest with comprehensive test suite
- Code Quality: ESLint with custom configuration
- Documentation: Comprehensive API documentation
- Deployment: Railway, Render, Heroku support
- Monitoring: Winston logging with performance metrics

## Testing & Development

### Test Suite
```bash
npm test                    # Run full test suite
npm run test:coverage       # Test with coverage reports
npm run test:watch          # Watch mode for development
npm run test:e2e           # End-to-end testing
npm run test:monitor       # Continuous monitoring
```

### Performance Testing
```bash
npm run test-performance    # Performance benchmarks
npm run test-optimizations # Optimization validation
npm run test-api           # API endpoint testing
npm run test-websocket     # WebSocket functionality
```

### Development Commands
```bash
npm run dev                 # Development server with nodemon
npm run start              # Production server
npm run lint               # Code quality check
npm run lint:errors        # Error-only linting
```

## Authentication Guide

### JWT Authentication
The authentication system is reliable when used correctly:

```bash
# Create fresh user and get token
FRESH_TOKEN=$(curl -s -X POST http://localhost:5000/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test-'$(date +%s)'@test.com","password":"TestPassword123"}' | \
  jq -r '.token')

# Use token for any protected endpoint
curl -s -H "Authorization: Bearer $FRESH_TOKEN" http://localhost:5000/profile | jq .

# Login with existing credentials
LOGIN_TOKEN=$(curl -s -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"YourPassword123"}' | \
  jq -r '.token')
```

### Common Authentication Issues
1. Password Requirements: Minimum 8 characters (use `TestPassword123`)
2. Header Format: Always use `"Authorization: Bearer $TOKEN"`
3. Token Persistence: Extract and use tokens in same command for reliability
4. Fresh Tokens: Always create fresh tokens for testing

## Performance & Monitoring

### Health Monitoring
```bash
# Quick health check
curl -s http://localhost:5000/health | jq .

# System status
curl -s http://localhost:5000/ | jq .

# Test operational status
curl -s http://localhost:5000/test | jq .
```

### Performance Features
- Redis caching for session and response caching
- Connection pooling with optimized database connections
- Memory management with automatic garbage collection and monitoring
- Request optimization with intelligent API response optimization
- Real-time metrics with performance monitoring and alerting

## Security Features

### Enterprise Security Standards
- JWT authentication with secure token-based authentication and refresh
- Rate limiting for API protection against abuse and attacks
- CORS configuration with secure cross-origin resource sharing
- Input validation with comprehensive request sanitization
- Security headers via Helmet.js security headers
- Environment protection with secure environment variable management

### Data Protection
- Encryption with Bcrypt password hashing using 12 rounds
- Sanitization with input sanitization and validation
- Authorization with role-based access control
- Privacy with GDPR-compliant data handling

## Deployment

### Supported Platforms
- Railway: `railway.json` configuration
- Render: `render.yaml` configuration
- Heroku: `Procfile` configuration
- Docker: Container-ready architecture

### Production Configuration
```bash
NODE_ENV=production
PORT=5000
# Configure all required environment variables
# Set up MongoDB Atlas or production database
# Configure Redis for production caching
# Set up Stripe for payment processing
```

## Analytics & Insights

### Behavioral Analytics
- UBPM analysis with advanced user behavior pattern modeling
- Emotional intelligence with comprehensive emotion tracking
- Predictive analytics with user growth trajectory predictions
- Performance metrics with real-time system performance analytics

### User Insights
- Conversation analytics with chat pattern analysis
- Usage patterns with feature usage and engagement metrics
- Personalization metrics with AI adaptation effectiveness
- Subscription analytics with billing and tier usage analysis

## Contributing

### Development Workflow
1. Fork repository and create feature branch
2. Follow existing code patterns and conventions
3. Write comprehensive tests for new features
4. Run linting and ensure code quality
5. Update documentation as needed
6. Submit pull request with detailed description

### Code Standards
- ES6+ JavaScript with modern syntax
- Comprehensive error handling
- Security-first development practices
- Performance optimization focus
- Mobile-first API design

## License & Support

**License**: Apache 2.0 - see [LICENSE](LICENSE) for details

### Getting Help
- Documentation: Complete API documentation in CLAUDE.md
- Health Monitoring: Real-time status at `/health`
- Issues: GitHub issue tracking
- Performance: Built-in monitoring and logging

## Roadmap

### Completed (v2.0)
- Major architecture overhaul
- UBPM cognitive engine integration
- Enhanced authentication system
- Advanced memory management
- Mobile-optimized APIs
- Comprehensive testing suite

### Upcoming Features
- Advanced AI tool ecosystem expansion
- Enhanced real-time collaboration features
- Advanced analytics dashboard
- Multi-language support expansion

---

Built for the Numina AI Platform - Production Ready v2.0

*Last Updated: July 31, 2025*