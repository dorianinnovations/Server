# Collective Data API Documentation

## Overview

The Collective Data API provides secure, rate-limited access to aggregated emotional analytics data from consenting users. All LLM processing is server-side only, and sensitive operations require authentication and admin privileges.

## Security Features

### Authentication & Authorization
- **JWT Authentication**: All sensitive endpoints require valid JWT tokens
- **Admin Protection**: Administrative operations require admin privileges
- **API Key Validation**: External integrations can use API keys for access
- **Role-Based Access**: Different permission levels for different operations

### Rate Limiting
- **Collective Data**: 50 requests per 15 minutes
- **Snapshot Generation**: 10 requests per hour
- **Export Operations**: 5 requests per hour
- **Admin Operations**: 20 requests per 15 minutes
- **Aggregation Service**: 30 requests per 5 minutes

### Security Headers
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security: max-age=31536000; includeSubDomains
- Content-Security-Policy: default-src 'self'
- Referrer-Policy: strict-origin-when-cross-origin

## Environment Variables

```bash
# Admin Configuration
ADMIN_USER_IDS=user1,user2,user3
ADMIN_EMAILS=admin@example.com,admin2@example.com

# API Keys for External Integrations
API_KEYS=key1,key2,key3

# Allowed Origins for CORS
ALLOWED_ORIGINS=https://yourdomain.com,http://localhost:3000

# LLM Service (Server-side only)
OPENROUTER_API_KEY=your_openrouter_api_key
```

## Consent Management

### Update User Consent
```http
POST /collective-data/consent
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "consentStatus": "granted",
  "dataTypes": {
    "emotions": true,
    "intensity": true,
    "context": false,
    "demographics": false,
    "activityPatterns": false
  },
  "notes": "User consent for emotional data analysis"
}
```

**Rate Limit**: 100 requests per 15 minutes (user-specific)

### Get User Consent Status
```http
GET /collective-data/consent
Authorization: Bearer <jwt_token>
```

## Data Access (Rate Limited)

### Get Aggregated Emotional Data
```http
GET /collective-data/emotions?timeRange=30d&groupBy=day&includeIntensity=true&includeContext=false&minConsentCount=5&format=json&compress=false&visualization=chart
```

**Rate Limit**: 50 requests per 15 minutes

**Parameters**:
- `timeRange`: 7d, 30d, 90d, 1y, all
- `groupBy`: hour, day, week, month
- `includeIntensity`: true/false
- `includeContext`: true/false
- `minConsentCount`: minimum number of consenting users
- `format`: json, csv
- `compress`: true/false
- `visualization`: chart, table, timeline

### Get Demographic Patterns
```http
GET /collective-data/demographics?includeActivityPatterns=true&includeGeographicData=false
```

**Rate Limit**: 50 requests per 15 minutes

### Get Real-Time Insights
```http
GET /collective-data/insights
```

**Rate Limit**: 50 requests per 15 minutes

### Get Formatted Data
```http
GET /collective-data/formatted?timeRange=30d&groupBy=day&includeIntensity=true&includeContext=false&minConsentCount=5&visualization=chart&includeStats=true
```

**Rate Limit**: 50 requests per 15 minutes

### Get Collective Data Statistics
```http
GET /collective-data/stats
```

**Rate Limit**: 50 requests per 15 minutes

## Snapshot Management

### Generate Snapshot (Admin Only)
```http
POST /collective-snapshots/generate
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "timeRange": "30d"
}
```

**Rate Limit**: 10 requests per hour
**Authentication**: Required
**Admin**: Required

### Get Latest Snapshot
```http
GET /collective-snapshots/latest?timeRange=30d
```

**Rate Limit**: 50 requests per 15 minutes

### Get Snapshot History
```http
GET /collective-snapshots/history?timeRange=30d&limit=10
```

**Rate Limit**: 50 requests per 15 minutes

### Get Archetype History
```http
GET /collective-snapshots/archetypes?timeRange=30d&limit=20
```

**Rate Limit**: 50 requests per 15 minutes

### Get Emotion Trends
```http
GET /collective-snapshots/emotions?timeRange=30d&limit=20
```

**Rate Limit**: 50 requests per 15 minutes

### Get Snapshot Statistics
```http
GET /collective-snapshots/stats
```

**Rate Limit**: 50 requests per 15 minutes

### Get Detailed Snapshot
```http
GET /collective-snapshots/:id
```

**Rate Limit**: 50 requests per 15 minutes

### Search Snapshots
```http
GET /collective-snapshots/search?archetype=optimist&emotion=joy&timeRange=30d&limit=10&page=1
```

**Rate Limit**: 50 requests per 15 minutes

### Delete Snapshot (Admin Only)
```http
DELETE /collective-snapshots/:id
Authorization: Bearer <jwt_token>
```

**Rate Limit**: 20 requests per 15 minutes
**Authentication**: Required
**Admin**: Required

### Export Snapshots (Admin Only)
```http
GET /collective-snapshots/export?format=json&timeRange=30d&limit=100
Authorization: Bearer <jwt_token>
```

**Rate Limit**: 5 requests per hour
**Authentication**: Required
**Admin**: Required

## Scheduled Aggregation Service

### Start Service (Admin Only)
```http
POST /scheduled-aggregation/start
Authorization: Bearer <jwt_token>
```

**Rate Limit**: 20 requests per 15 minutes
**Authentication**: Required
**Admin**: Required

### Stop Service (Admin Only)
```http
POST /scheduled-aggregation/stop
Authorization: Bearer <jwt_token>
```

**Rate Limit**: 20 requests per 15 minutes
**Authentication**: Required
**Admin**: Required

### Get Service Status
```http
GET /scheduled-aggregation/status
```

**Rate Limit**: 30 requests per 5 minutes

### Trigger Manual Aggregation (Admin Only)
```http
POST /scheduled-aggregation/trigger
Authorization: Bearer <jwt_token>
```

**Rate Limit**: 30 requests per 5 minutes
**Authentication**: Required
**Admin**: Required

### Get Latest Scheduled Snapshot
```http
GET /scheduled-aggregation/latest
```

**Rate Limit**: 30 requests per 5 minutes

### Get Service Statistics
```http
GET /scheduled-aggregation/stats
```

**Rate Limit**: 30 requests per 5 minutes

### Reset Service Statistics (Admin Only)
```http
POST /scheduled-aggregation/reset
Authorization: Bearer <jwt_token>
```

**Rate Limit**: 20 requests per 15 minutes
**Authentication**: Required
**Admin**: Required

### Update Aggregation Interval (Admin Only)
```http
PUT /scheduled-aggregation/interval
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "minutes": 15
}
```

**Rate Limit**: 20 requests per 15 minutes
**Authentication**: Required
**Admin**: Required

### Health Check
```http
GET /scheduled-aggregation/health
```

**Rate Limit**: 30 requests per 5 minutes

## Admin Operations (Admin Only)

### Clear Cache
```http
POST /collective-data/cache/clear
Authorization: Bearer <jwt_token>
```

**Rate Limit**: 20 requests per 15 minutes
**Authentication**: Required
**Admin**: Required

### Export Collective Data
```http
GET /collective-data/export?format=json&timeRange=30d
Authorization: Bearer <jwt_token>
```

**Rate Limit**: 5 requests per hour
**Authentication**: Required
**Admin**: Required

## Error Responses

### Rate Limit Exceeded
```json
{
  "success": false,
  "message": "Too many collective data requests. Please try again later.",
  "retryAfter": 900,
  "limit": {
    "max": 50,
    "windowMs": 900000,
    "remaining": 0,
    "resetTime": 1640995200000
  }
}
```

### Authentication Required
```json
{
  "success": false,
  "message": "You are not logged in! Please log in to get access."
}
```

### Admin Privileges Required
```json
{
  "success": false,
  "message": "Admin privileges required"
}
```

### Invalid API Key
```json
{
  "success": false,
  "message": "Invalid API key"
}
```

## Rate Limit Headers

All responses include rate limit headers:
- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Time when the rate limit resets
- `X-RateLimit-Window`: Window size in milliseconds

## Security Considerations

1. **Server-Side LLM**: All LLM processing is done server-side only
2. **API Key Protection**: External integrations use API keys, not JWT tokens
3. **Admin Separation**: Admin operations are separate from regular user operations
4. **Content Validation**: All requests are validated for content type and size
5. **Request Sanitization**: All input is sanitized to prevent XSS attacks
6. **CORS Protection**: Strict CORS policies prevent unauthorized access
7. **Security Headers**: Comprehensive security headers protect against common attacks

## Best Practices

1. **Use HTTPS**: Always use HTTPS in production
2. **Store Tokens Securely**: Store JWT tokens securely on the client
3. **Handle Rate Limits**: Implement proper error handling for rate limit responses
4. **Monitor Usage**: Monitor API usage to stay within rate limits
5. **Admin Access**: Limit admin access to trusted users only
6. **API Keys**: Rotate API keys regularly for external integrations
7. **Logging**: Monitor logs for suspicious activity

## Development vs Production

### Development
- Admin access is more permissive for testing
- Rate limits may be more lenient
- CORS may allow localhost origins

### Production
- Strict admin access control
- Enforced rate limits
- Restricted CORS origins
- All security features enabled 