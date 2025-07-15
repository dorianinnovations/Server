import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export default async function webSearch(args, userContext) {
  const { 
    query, 
    searchType = 'general',
    location = '',
    limit = 10 
  } = args;

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

    return {
      success: true,
      query: query,
      searchType: searchType,
      location: location,
      results: searchResults,
      count: searchResults.length,
      message: `Found ${searchResults.length} results for "${query}"`,
    };

  } catch (error) {
    console.error('Web search error:', error);
    return {
      success: false,
      error: 'Failed to perform web search',
      details: error.message,
      query: query,
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