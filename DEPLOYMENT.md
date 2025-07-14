# 🚀 Numina Server Deployment Guide

## Production Deployment

### Environment Variables

For production deployment (like Render, Heroku, etc.), set the following environment variables:

```bash
# Essential Variables
NODE_ENV=production
REDIS_DISABLED=true
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/numina
JWT_SECRET=your-super-secret-jwt-key-here
OPENROUTER_API_KEY=your-openrouter-api-key

# Server Configuration
PORT=5000
JWT_EXPIRES_IN=1d

# Optional - Push Notifications
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY="your-firebase-private-key"
FIREBASE_CLIENT_EMAIL=your-firebase-client-email
```

### Redis Configuration

**For deployments without Redis:**
```bash
REDIS_DISABLED=true
```

**For deployments with Redis:**
```bash
REDIS_URL=redis://your-redis-host:6379
# or
REDIS_URL=rediss://username:password@host:port
```

### Platform-Specific Instructions

#### Render.com
1. Connect your GitHub repository
2. Set environment variables in Render dashboard
3. Build command: `npm install`
4. Start command: `npm start`

#### Heroku
1. `heroku create your-app-name`
2. `heroku config:set NODE_ENV=production`
3. `heroku config:set REDIS_DISABLED=true`
4. Set other required environment variables
5. `git push heroku main`

#### Railway
1. Connect GitHub repository
2. Set environment variables in Railway dashboard
3. Deploy automatically triggers

### Health Check

The server provides a health check endpoint:
```
GET /health
```

Response when healthy:
```json
{
  "status": "success",
  "health": {
    "server": "healthy",
    "database": "connected",
    "llm_api": "accessible",
    "redis": "fallback"
  }
}
```

### Performance Monitoring

The server includes:
- ✅ Memory monitoring
- ✅ Request logging
- ✅ Performance metrics
- ✅ Cache statistics
- ✅ Database connection monitoring

### Security Features

- ✅ JWT authentication
- ✅ Rate limiting
- ✅ CORS configuration
- ✅ Input validation
- ✅ Error handling
- ✅ SQL injection protection

### Troubleshooting

#### Redis Connection Issues
If you see Redis connection errors in logs:
1. Set `REDIS_DISABLED=true` in environment variables
2. Server will automatically use in-memory cache fallback
3. No functionality loss in single-instance deployments

#### Database Connection Issues
1. Check MongoDB URI format
2. Verify network access to MongoDB cluster
3. Check authentication credentials

#### Memory Issues
Server includes automatic memory monitoring and cleanup.
Monitor the health endpoint for memory usage.

### Scaling

For horizontal scaling, consider:
1. Adding Redis for shared caching
2. Database connection pooling (already configured)
3. Load balancer configuration
4. Session persistence

### Logs

Production logs include:
- Request/response logging
- Performance metrics
- Error tracking
- Cache statistics
- Database connection status

Set `LOG_LEVEL=info` for production to reduce verbosity.