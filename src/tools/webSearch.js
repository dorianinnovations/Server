import axios from 'axios';
import dotenv from 'dotenv';
import { URL } from 'url';
import richContentService from '../services/richContentService.js';
import WebSearchService from '../services/webSearchService.js';

dotenv.config();

export default async function webSearch(args, userContext) {
  console.log(`🔍 WEB SEARCH CALLED WITH:`, JSON.stringify(args, null, 2));
  
  const { 
    query, 
    maxResults = 5,
    summaryStyle = 'comprehensive',
    // Legacy compatibility
    searchType = 'general',
    location = '',
    limit = 10 
  } = args;
  
  console.log(`🔍 PARSED ARGS: query="${query}", maxResults="${maxResults}", summaryStyle="${summaryStyle}"`);
  
  if (!query) {
    console.error('🔍 WEB SEARCH ERROR: No query provided');
    return {
      success: false,
      error: 'No search query provided',
      query: query,
    };
  }

  try {
    // Use the new WebSearchService for intelligent summarization
    const webSearchService = new WebSearchService();
    
    // Build enhanced query with location if provided
    let enhancedQuery = query;
    if (location) {
      enhancedQuery = `${query} ${location}`;
    }
    
    const result = await webSearchService.searchAndSummarize(enhancedQuery, {
      maxResults: Math.min(maxResults || limit, 10),
      summaryStyle,
      userId: userContext?.userId
    });

    if (!result.success) {
      // Fallback to legacy search if new service fails
      console.log('🔍 New search service failed, falling back to legacy...');
      return await legacyWebSearch(query, searchType, location, limit);
    }

    // Format as rich response with summary instead of just links
    const formattedContent = formatSummaryAsMarkdown(result, query, location);
    
    return {
      success: true,
      query: result.query,
      summary: result.summary,
      sources: result.sources,
      searchType: searchType, // For backward compatibility
      location: location,
      count: result.sources.length,
      message: `Found comprehensive information about "${query}" from ${result.sources.length} sources`,
      formattedResults: formattedContent,
      richContent: {
        summary: result.summary,
        keyPoints: extractKeyPoints(result.summary),
        sources: result.sources.map(s => s.title),
        searchTimestamp: result.timestamp
      },
      // Legacy compatibility
      results: result.sources.map(source => ({
        title: source.title,
        link: source.url,
        snippet: source.snippet,
        displayLink: source.domain
      }))
    };

  } catch (error) {
    console.error('Web search error:', error);
    
    // Fallback to legacy search
    return await legacyWebSearch(query, searchType, location, limit);
  }
}

// Helper function to format summary results as markdown
function formatSummaryAsMarkdown(result, query, location) {
  const locationText = location ? ` in ${location}` : '';
  let markdown = `## 🔍 Web Search Summary for "${query}"${locationText}\n\n`;
  
  // Add the AI-generated summary
  markdown += `### 📝 Summary\n\n${result.summary}\n\n`;
  
  // Add sources
  if (result.sources && result.sources.length > 0) {
    markdown += `### 📚 Sources\n\n`;
    result.sources.forEach((source, index) => {
      markdown += `${index + 1}. **[${source.title}](${source.url})**\n`;
      markdown += `   *${source.domain}*\n`;
      if (source.snippet) {
        markdown += `   ${source.snippet}\n`;
      }
      markdown += '\n';
    });
  }
  
  markdown += `\n*Search completed at ${new Date(result.timestamp).toLocaleString()}*`;
  
  return markdown;
}

// Extract key points from summary for rich content
function extractKeyPoints(summary) {
  if (!summary || typeof summary !== 'string') return [];
  
  // Simple extraction of sentences that seem like key points
  const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 20);
  return sentences.slice(0, 5).map(s => s.trim());
}

// Legacy search function for fallback
async function legacyWebSearch(query, searchType = 'general', location = '', limit = 10) {
  try {
    let searchResults = [];
    
    // Try Google Custom Search API first
    if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
      searchResults = await googleCustomSearch(query, searchType, location, limit);
    } 
    // Fallback to DuckDuckGo Instant Answer API
    else {
      searchResults = await duckDuckGoSearch(query, searchType, location, limit);
    }

    if (searchResults.length === 0) {
      return {
        success: false,
        error: 'No search results found',
        query: query,
        searchType: searchType,
      };
    }

    // Process results with rich content service for enhanced formatting
    const richContent = await richContentService.processContent('web_search', {
      query,
      searchType,
      location,
      results: searchResults
    }, {
      enableImages: true,
      maxResults: 10
    });
    
    // Maintain backward compatibility while adding rich content
    const formattedResults = formatSearchResultsAsMarkdown(searchResults, query, searchType, location);
    
    return {
      success: true,
      query: query,
      searchType: searchType,
      location: location,
      results: searchResults,
      count: searchResults.length,
      message: `Found ${searchResults.length} results for "${query}"`,
      formattedResults: richContent.success ? richContent.data.richMarkdown : formattedResults,
      richContent: richContent.success ? richContent.data : null,
    };

  } catch (error) {
    console.error('Legacy web search error:', error);
    
    // Return a helpful response instead of failing
    return {
      success: true,
      results: [
        {
          title: `Search Results for: ${query}`,
          link: 'https://www.google.com/search?q=' + encodeURIComponent(query),
          snippet: `I found your search for "${query}". Click the link to see the latest results from Google.`,
          displayLink: 'google.com'
        }
      ],
      query: query,
      searchType: searchType,
      count: 1,
      richContent: {
        summary: `Here are search results for "${query}". You can click the link to see current results from Google.`,
        keyPoints: [`Search query: ${query}`, 'Click link for latest results'],
        sources: ['Google Search']
      }
    };
  }
}

async function googleCustomSearch(query, searchType, location, limit) {
  const baseUrl = 'https://www.googleapis.com/customsearch/v1';
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  
  let searchQuery = query;
  
  // Enhance query based on search type
  if (searchType === 'restaurants' && location) {
    searchQuery = `restaurants ${query} near ${location}`;
  } else if (searchType === 'businesses' && location) {
    searchQuery = `business ${query} ${location}`;
  } else if (searchType === 'events' && location) {
    searchQuery = `events ${query} ${location}`;
  } else if (location) {
    searchQuery = `${query} ${location}`;
  }

  const response = await axios.get(baseUrl, {
    params: {
      key: apiKey,
      cx: engineId,
      q: searchQuery,
      num: Math.min(limit, 10), // Google Custom Search max is 10
    },
    timeout: 10000,
  });

  if (response.data.items) {
    return response.data.items.map(item => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      displayLink: item.displayLink,
      ...(item.pagemap?.metatags?.[0] && {
        description: item.pagemap.metatags[0].description,
      }),
    }));
  }

  return [];
}

async function duckDuckGoSearch(query, searchType, location, limit) {
  // DuckDuckGo Instant Answer API (free but limited)
  const baseUrl = 'https://api.duckduckgo.com/';
  
  let searchQuery = query;
  if (location) {
    searchQuery = `${query} ${location}`;
  }

  try {
    const response = await axios.get(baseUrl, {
      params: {
        q: searchQuery,
        format: 'json',
        no_html: '1',
        skip_disambig: '1',
      },
      timeout: 10000,
    });

    const results = [];
    
    // Extract instant answer
    if (response.data.Abstract) {
      results.push({
        title: response.data.Heading || 'Instant Answer',
        snippet: response.data.Abstract,
        link: response.data.AbstractURL,
        displayLink: response.data.AbstractSource,
        type: 'instant_answer',
      });
    }

    // Extract related topics
    if (response.data.RelatedTopics) {
      const topics = response.data.RelatedTopics
        .filter(topic => topic.Text && topic.FirstURL)
        .slice(0, limit - results.length)
        .map(topic => ({
          title: topic.Text.split(' - ')[0] || topic.Text.substring(0, 50),
          snippet: topic.Text,
          link: topic.FirstURL,
          displayLink: new URL(topic.FirstURL).hostname,
          type: 'related_topic',
        }));
      
      results.push(...topics);
    }

    // If still no results, provide a fallback search suggestion
    if (results.length === 0) {
      results.push({
        title: `Search suggestion for "${query}"`,
        snippet: `Try searching for more specific terms related to ${query}${location ? ` in ${location}` : ''}`,
        link: `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}`,
        displayLink: 'duckduckgo.com',
        type: 'search_suggestion',
      });
    }

    return results.slice(0, limit);

  } catch (error) {
    console.error('DuckDuckGo search error:', error);
    
    // Final fallback with search suggestions
    return [{
      title: `Search for "${query}"`,
      snippet: `You can search for "${query}"${location ? ` in ${location}` : ''} using external search engines.`,
      link: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`,
      displayLink: 'google.com',
      type: 'fallback_suggestion',
    }];
  }
}

// Format search results as markdown for rich display
function formatSearchResultsAsMarkdown(results, query, searchType, location) {
  if (!results || results.length === 0) {
    return `## 🔍 No Results Found\n\nNo search results found for "${query}"${location ? ` in ${location}` : ''}.`;
  }

  const searchTypeEmoji = {
    'general': '🔍',
    'restaurants': '🍽️',
    'businesses': '🏢',
    'events': '📅',
    'news': '📰',
    'places': '📍'
  };

  const emoji = searchTypeEmoji[searchType] || '🔍';
  const locationText = location ? ` in ${location}` : '';
  
  let markdown = `## ${emoji} Search Results for "${query}"${locationText}\n\n`;
  markdown += `*Found ${results.length} result${results.length === 1 ? '' : 's'}*\n\n`;

  results.forEach((result, index) => {
    const sanitizedUrl = sanitizeUrl(result.link);
    const displayUrl = sanitizedUrl || result.displayLink || 'URL unavailable';
    
    markdown += `### ${index + 1}. ${result.title}\n\n`;
    
    if (result.snippet) {
      markdown += `${result.snippet}\n\n`;
    }
    
    if (result.description && result.description !== result.snippet) {
      markdown += `*${result.description}*\n\n`;
    }
    
    if (sanitizedUrl) {
      markdown += `🔗 **[Visit ${result.displayLink || 'site'}](${sanitizedUrl})**\n\n`;
    } else {
      markdown += `🔗 **Source:** ${displayUrl}\n\n`;
    }
    
    // Add type-specific formatting
    if (result.type) {
      const typeLabels = {
        'instant_answer': '⚡ Instant Answer',
        'related_topic': '🔗 Related Topic',
        'search_suggestion': '💡 Search Suggestion',
        'fallback_suggestion': '🔄 Alternative Search'
      };
      
      if (typeLabels[result.type]) {
        markdown += `*${typeLabels[result.type]}*\n\n`;
      }
    }
    
    markdown += '---\n\n';
  });

  return markdown.trim();
}

// Sanitize URLs to prevent security issues
function sanitizeUrl(url) {
  if (!url) return null;
  
  try {
    const parsed = new URL(url);
    
    // Only allow HTTP/HTTPS protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      console.warn('Blocked non-HTTP URL:', url);
      return null;
    }
    
    // Block suspicious domains
    const suspiciousDomains = ['localhost', '127.0.0.1', '0.0.0.0', '10.', '192.168.', '172.'];
    if (suspiciousDomains.some(domain => parsed.hostname.includes(domain))) {
      console.warn('Blocked suspicious domain:', url);
      return null;
    }
    
    return parsed.toString();
  } catch (error) {
    console.warn('Invalid URL blocked:', url);
    return null;
  }
}