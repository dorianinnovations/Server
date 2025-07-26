# Web Search and Summarization Setup

This document explains how to configure and use the new web search and summarization feature that provides GPT-4o with intelligent web search capabilities instead of just returning links.

## Features

- **Intelligent Summarization**: Instead of just providing links, the system searches the web and provides comprehensive summaries
- **Multiple Search APIs**: Supports SerpAPI, Google Custom Search, Bing Search, and DuckDuckGo fallback
- **Content Extraction**: Fetches and processes actual web page content for better summaries
- **Tier-based Limits**: Different usage limits based on user subscription tier
- **Rich Formatting**: Returns both markdown-formatted responses and structured data

## Environment Variables

Add these to your `.env` file to enable different search engines:

```bash
# Option 1: SerpAPI (Recommended - most reliable)
SERPAPI_API_KEY=your_serpapi_key_here
SEARCH_ENGINE=serpapi

# Option 2: Google Custom Search
GOOGLE_SEARCH_API_KEY=your_google_api_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id
SEARCH_ENGINE=google

# Option 3: Bing Search
BING_SEARCH_API_KEY=your_bing_api_key
SEARCH_ENGINE=bing

# Option 4: No API key needed (DuckDuckGo fallback)
# Will automatically use DuckDuckGo if no other keys are provided
```

## API Endpoints

### Direct Web Search API
```
POST /ai/web-search
```

**Request Body:**
```json
{
  "query": "latest developments in AI 2024",
  "maxResults": 5,
  "summaryStyle": "comprehensive"
}
```

**Response:**
```json
{
  "success": true,
  "query": "latest developments in AI 2024",
  "summary": "Based on recent developments in 2024, AI has seen significant advances in...",
  "sources": [
    {
      "title": "AI Breakthroughs in 2024",
      "url": "https://example.com/ai-2024",
      "snippet": "Recent advances include...",
      "domain": "example.com"
    }
  ],
  "searchTimestamp": "2024-07-26T..."
}
```

### Tool Usage (for GPT-4o)

The `web_search` tool is automatically available to GPT-4o with these parameters:

- `query` (required): Search query string
- `maxResults` (optional): Number of results to analyze (1-10, default: 5)
- `summaryStyle` (optional): "brief", "comprehensive", or "technical" (default: "comprehensive")

## Usage Examples

### For GPT-4o Integration

When GPT-4o needs current information, it can now use the web_search tool:

```json
{
  "name": "web_search",
  "parameters": {
    "query": "current weather in New York",
    "summaryStyle": "brief"
  }
}
```

### Direct API Usage

```bash
curl -X POST http://localhost:3000/ai/web-search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "quantum computing breakthroughs 2024",
    "maxResults": 3,
    "summaryStyle": "technical"
  }'
```

## Rate Limits

Based on user subscription tier:

- **CORE**: 10 searches/day, 3/hour
- **PREMIUM**: 50 searches/day, 15/hour  
- **ULTIMATE**: 200 searches/day, 50/hour

## Summary Styles

- **brief**: Concise 2-3 paragraph summaries
- **comprehensive**: Detailed 3-5 paragraph coverage with context
- **technical**: Focus on technical details, data, and specifications

## Search API Comparison

| Provider | Cost | Rate Limits | Quality | Setup |
|----------|------|-------------|---------|-------|
| SerpAPI | $50/5K queries | High | Excellent | Easy |
| Google Custom Search | Free 100/day | 100/day | Good | Medium |
| Bing Search API | $3/1K queries | High | Good | Easy |
| DuckDuckGo | Free | Limited | Basic | None |

## Troubleshooting

1. **No search results**: Check API keys and internet connectivity
2. **Rate limit errors**: Verify your API plan limits
3. **Poor summaries**: Try different summaryStyle options
4. **Timeout errors**: The service has fallbacks, but may indicate API issues

## Benefits for Users

- **No more link spam**: Users get actual answers instead of lists of links
- **Current information**: Access to real-time web data
- **Intelligent synthesis**: AI combines information from multiple sources
- **Time saving**: Users don't need to click through multiple links
- **Better UX**: Cleaner, more helpful responses

This replaces the old behavior where GPT-4o would just provide links with intelligent, summarized information that directly answers user queries.