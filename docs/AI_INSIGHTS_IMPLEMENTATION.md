# AI-Powered Analytics Insights Implementation

This document outlines the complete AI insight system implemented to support the mobile app's analytics features.

## Overview

The AI insight system transforms user behavioral data into personalized, meaningful insights using OpenRouter's GPT-4o API. It includes timegating, data categorization, and seamless mobile app integration.

## Architecture

### Database Models

#### AnalyticsInsight Model (`src/models/AnalyticsInsight.js`)
```javascript
{
  userId: ObjectId,           // User reference
  category: String,           // communication|personality|behavioral|emotional|growth
  insight: String,            // AI-generated insight (max 1000 chars)
  confidence: Number,         // 0-1 confidence score
  evidence: [String],         // Supporting evidence points
  dataFingerprint: String,    // For change detection
  dataPoints: Number,         // Number of data points analyzed
  generatedAt: Date,          // Generation timestamp
  expiresAt: Date,           // 7-day TTL
  isActive: Boolean          // Active/inactive status
}
```

#### InsightCooldown Model (`src/models/InsightCooldown.js`)
```javascript
{
  userId: ObjectId,
  category: String,
  lastGeneratedAt: Date,
  cooldownUntil: Date,
  cooldownPeriodHours: Number, // 3-48 hours based on category
  dataFingerprint: String,
  attemptCount: Number
}
```

### Core Service

#### AIInsightService (`src/services/aiInsightService.js`)

**Key Features:**
- **Data Integration**: Combines chat history, behavioral profiles, and user context
- **AI Processing**: Uses OpenRouter GPT-4o for insight generation
- **Timegating**: Category-specific cooldown periods (3-48 hours)
- **Data Fingerprinting**: Detects significant data changes
- **Fallback System**: Graceful degradation when AI fails

**Cooldown Periods:**
- Communication: 6 hours
- Personality: 24 hours
- Behavioral: 12 hours
- Emotional: 3 hours
- Growth: 48 hours

**Core Methods:**
```javascript
// Generate insight for category
generateCategoryInsight(userId, category, forceGenerate)

// Get comprehensive user data
getUserAnalyticsData(userId)

// Check cooldown status
getUserCooldownStatus(userId)

// Get recent insights
getUserInsights(userId, limit)
```

### API Endpoints

#### Analytics LLM Routes (`src/routes/analyticsLLM.js`)

**POST /analytics/llm**
- Main analytics processing endpoint
- Returns cooldown status and recent insights

**POST /analytics/llm/insights**
- Generate insights for specific category
- Supports streaming responses via Server-Sent Events
- Enforces cooldown periods

**POST /analytics/llm/weekly-digest**
- Generate weekly insights across all categories
- Combines fresh insights with recent history

**POST /analytics/llm/patterns**
- Deep pattern analysis with LLM integration
- Temporal and behavioral pattern recognition

**GET /analytics/llm/status**
- Get user's analytics and cooldown status
- Quick status check for mobile app

## Data Flow

```
Chat Messages (ShortTermMemory) 
    ↓
User Behavior Profile (UBPM)
    ↓
Categorized Analytics Service
    ↓
AI Insight Service (OpenRouter GPT-4o)
    ↓
AnalyticsInsight Storage
    ↓
Mobile App Display
```

## Integration with Existing Systems

### Data Sources
- **ShortTermMemory**: Recent chat conversations
- **UserBehaviorProfile**: Comprehensive behavioral data
- **User**: Profile and account information

### AI Integration
- **llmService.js**: OpenRouter connection pooling
- **Existing prompts**: Personality-aware system prompts
- **Tool ecosystem**: Integrates with 25+ AI tools

### Mobile App Support
- **Streaming**: Real-time insight generation
- **Offline**: Graceful handling of network issues
- **Caching**: 7-day insight TTL with smart invalidation

## Categorized Analytics

The system processes behavioral data into 5 major categories:

### 1. Communication Intelligence
- Message structure and tone
- Interaction patterns
- Language evolution

### 2. Personality Intelligence
- Big Five personality traits
- Extended traits (curiosity, empathy, creativity)
- Personality evolution over time

### 3. Behavioral Intelligence
- Temporal activity patterns
- Decision-making style
- Social dynamics

### 4. Emotional Intelligence
- Emotional baseline and stability
- Pattern recognition
- Emotional growth trajectory

### 5. Growth Intelligence
- Development stage analysis
- Goals and values alignment
- Learning patterns

## Prompt Engineering

Category-specific prompts ensure relevant, personalized insights:

```javascript
// Example: Communication prompt
`User has sent ${totalMessages} messages over ${daysSinceFirstChat} days. 
Most active ${mostActiveTimeOfDay}. Communication style: ${communicationStyle}.

COMMUNICATION DATA: ${JSON.stringify(categorizedData.communication)}

Write a 2-sentence insight about this person's communication intelligence. Focus on:
1. Their unique communication signature (what makes them distinctive)
2. How others likely perceive them in conversations

Be specific, personal, and revealing. Use "you" and present tense.`
```

## Security & Performance

### Security
- JWT authentication on all endpoints
- Input validation and sanitization
- Rate limiting via cooldown system
- Data fingerprinting prevents unnecessary API calls

### Performance
- Connection pooling for OpenRouter API
- 7-day insight caching with TTL
- Efficient database indexes
- Streaming responses for real-time feedback

## Testing

Test script: `scripts/testAIInsights.js`

**Test Coverage:**
- Data retrieval and categorization
- AI insight generation
- Cooldown system enforcement
- Database operations
- Error handling and fallbacks

## Deployment Notes

### Environment Variables Required
```bash
OPENROUTER_API_KEY=sk-or-...     # OpenRouter API key
MONGODB_URI=mongodb://...        # Database connection
```

### Database Indexes
```javascript
// AnalyticsInsight indexes
{ userId: 1, category: 1, generatedAt: -1 }
{ userId: 1, isActive: 1, generatedAt: -1 }
{ dataFingerprint: 1 }

// InsightCooldown indexes  
{ userId: 1, category: 1 } // unique
{ cooldownUntil: 1 }
{ userId: 1, cooldownUntil: 1 }
```

## Mobile App Integration

The mobile app expects these endpoint behaviors:

1. **Timegated Insights**: 429 status when cooldown active
2. **Streaming Support**: Server-Sent Events for real-time generation
3. **Fallback Handling**: Graceful degradation when AI fails
4. **Data Categorization**: 5 specific categories with consistent structure
5. **Evidence Points**: Supporting data for insight credibility

## Future Enhancements

1. **Advanced Pattern Recognition**: Machine learning for behavioral patterns
2. **Social Insights**: Cross-user compatibility analysis
3. **Predictive Analytics**: Future behavior prediction
4. **Personalized Recommendations**: Action-oriented insights
5. **Multi-modal Analysis**: Image/voice pattern recognition

## Monitoring & Metrics

Key metrics to monitor:
- Insight generation success rate
- API response times
- Cooldown adherence
- User engagement with insights
- OpenRouter API usage and costs

This implementation provides a robust foundation for AI-powered personal analytics with room for future expansion and enhancement.