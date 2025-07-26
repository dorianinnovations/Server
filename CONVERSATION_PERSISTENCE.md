# Conversation Persistence System

## Overview

Numina now features a comprehensive conversation persistence system that stores user conversations permanently, replacing the previous 24-hour TTL system. This ensures users never lose their conversation history and provides better context for AI interactions.

## Key Features

### ✅ Persistent Storage
- **No more 24-hour data loss**: Conversations are stored permanently
- **Automatic conversation threading**: Messages are grouped into logical conversations
- **Rich metadata**: Attachments, timestamps, and context preservation
- **Mobile sync integration**: Seamless synchronization with mobile app

### ✅ Performance Optimized
- **Dual storage**: Short-term memory for immediate context + long-term storage
- **Efficient indexing**: Optimized database queries for fast retrieval
- **Pagination support**: Handle large conversation histories efficiently
- **Caching**: Redis caching for frequently accessed conversations

### ✅ User Experience
- **Conversation management**: Archive, delete, rename conversations
- **Search functionality**: Find conversations by content or title
- **Context preservation**: AI maintains awareness across conversation history
- **Migration support**: Automatic migration from old short-term system

## Architecture

### Models

#### Conversation Model (`src/models/Conversation.js`)
```javascript
{
  userId: ObjectId,           // User who owns the conversation
  title: String,              // Auto-generated or user-set title
  messages: [MessageSchema],  // Array of conversation messages
  lastActivity: Date,         // Last message timestamp
  isArchived: Boolean,        // Archive status
  tags: [String],            // User-defined tags
  summary: String,           // AI-generated summary
  messageCount: Number,      // Total message count
  createdAt: Date           // Conversation creation date
}
```

#### Message Schema
```javascript
{
  role: String,              // 'user', 'assistant', 'system'
  content: String,           // Message content
  timestamp: Date,           // Message timestamp
  attachments: [String],     // File URLs or data
  metadata: Map             // Additional context data
}
```

### Services

#### ConversationService (`src/services/conversationService.js`)
- `createConversation(userId, title)` - Create new conversation
- `addMessage(userId, conversationId, role, content, attachments, metadata)` - Add message
- `getUserConversations(userId, options)` - Get user's conversations with pagination
- `getConversation(userId, conversationId, messageLimit)` - Get specific conversation
- `archiveConversation(userId, conversationId)` - Archive conversation
- `deleteConversation(userId, conversationId)` - Delete conversation
- `updateConversationTitle(userId, conversationId, title)` - Update title
- `getConversationContext(userId, conversationId, limit)` - Get AI context
- `migrateShortTermMemory(userId)` - Migrate from old system

### API Endpoints

#### Conversation Management (`/conversations`)
- `GET /conversations` - List user conversations with pagination
- `GET /conversations/:id` - Get specific conversation with messages
- `POST /conversations` - Create new conversation
- `POST /conversations/:id/messages` - Add message to conversation
- `PUT /conversations/:id/title` - Update conversation title
- `PUT /conversations/:id/archive` - Archive conversation
- `DELETE /conversations/:id` - Delete conversation

#### Context & Migration
- `GET /conversations/context/:id?` - Get conversation context for AI
- `POST /conversations/migrate` - Migrate short-term memory to conversations

## Integration Points

### AI Completion Routes
The main completion endpoint (`/completion`) now:
1. Accepts optional `conversationId` parameter
2. Saves both user prompt and AI response to persistent storage
3. Falls back to short-term memory if conversation service fails
4. Maintains backward compatibility

### Mobile App Integration
Mobile routes (`/mobile/*`) updated to:
- Sync conversations in mobile sync endpoint
- Return conversation history in batch requests
- Support offline conversation queueing

### Short-Term Memory Bridge
The system maintains both:
- **Short-term memory**: 24-hour TTL for immediate context and caching
- **Long-term conversations**: Permanent storage for history and context

## Migration

### Automatic Migration
Run the migration script to convert existing short-term memory:

```bash
# Full migration for all users
node scripts/migrateConversations.js

# Single user migration
node scripts/migrateConversations.js --user=USER_ID

# Dry run mode (coming soon)
node scripts/migrateConversations.js --dry-run
```

### Migration Process
1. **Groups existing messages** by conversationId or time-based sessions
2. **Creates persistent conversations** with proper threading
3. **Preserves all metadata** including timestamps and attachments
4. **Maintains data integrity** with comprehensive error handling
5. **Provides detailed logging** of migration progress

## Usage Examples

### Creating a Conversation
```javascript
const conversation = await conversationService.createConversation(
  userId, 
  "My AI Assistant Chat"
);
```

### Adding Messages
```javascript
await conversationService.addMessage(
  userId,
  conversationId,
  "user",
  "Hello, how are you?",
  [], // attachments
  { mood: "friendly" } // metadata
);
```

### Getting Conversation History
```javascript
const result = await conversationService.getUserConversations(userId, {
  page: 1,
  limit: 20,
  includeArchived: false,
  search: "ai assistant"
});
```

### Mobile App Integration
```javascript
// In completion request
fetch('/completion', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: "Hello!",
    conversationId: "existing-conversation-id", // Optional
    stream: false
  })
});
```

## Performance Considerations

### Database Indexes
- `{ userId: 1, lastActivity: -1 }` - User conversation listing
- `{ userId: 1, isArchived: 1, lastActivity: -1 }` - Archived filtering
- `{ userId: 1, createdAt: -1 }` - Creation date sorting

### Caching Strategy
- Recent conversations cached in Redis (5 minutes)
- Mobile sync data cached (2 minutes)
- Chat history cached (5 minutes)

### Token Management
- Dynamic context window based on conversation length
- Intelligent message selection for AI context
- Incremental memory optimization for large conversations

## Security & Privacy

### Access Control
- All endpoints protected with user authentication
- Users can only access their own conversations
- Conversation IDs are UUIDs for security

### Data Retention
- Conversations stored indefinitely unless user deletes
- Archive functionality for conversation management
- User-controlled deletion with cascade cleanup

## Monitoring & Analytics

### Metrics Tracked
- Conversation creation rates
- Message volume per conversation
- Migration success rates
- API endpoint performance
- Cache hit rates

### Health Checks
- Database connection monitoring
- Migration status tracking
- Service availability checks

## Backward Compatibility

The system maintains full backward compatibility:
- Existing short-term memory still works
- API endpoints remain unchanged
- Mobile app requires no immediate updates
- Gradual migration with no service interruption

## Future Enhancements

### Planned Features
- [ ] Conversation search across message content
- [ ] AI-generated conversation summaries
- [ ] Conversation sharing between users
- [ ] Export conversations to various formats
- [ ] Conversation templates and presets
- [ ] Advanced conversation analytics
- [ ] Real-time collaborative conversations

### Performance Improvements
- [ ] Message compression for large conversations
- [ ] Intelligent context selection algorithms
- [ ] Conversation clustering and categorization
- [ ] Predictive conversation loading

## Support & Troubleshooting

### Common Issues

**Migration Failures**
- Check database connectivity
- Verify user permissions
- Review migration logs for specific errors

**Performance Issues**
- Monitor database indexes
- Check Redis cache health
- Review conversation message counts

**API Errors**
- Validate conversation IDs
- Check user authentication
- Verify request payload format

### Getting Help
- Check server logs for detailed error messages
- Use migration script's single-user mode for testing
- Contact development team for complex migration issues

---

*This system ensures Numina users never lose their valuable conversation history while maintaining optimal performance and user experience.*