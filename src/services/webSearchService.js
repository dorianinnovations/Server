import axios from 'axios';
import * as cheerio from 'cheerio';
import { createLLMService } from './llmService.js';
import { log } from '../utils/logger.js';

class WebSearchService {
  constructor() {
    this.llmService = createLLMService();
    this.searchApiKey = process.env.SERPAPI_API_KEY || process.env.GOOGLE_SEARCH_API_KEY;
    this.searchEngine = process.env.SEARCH_ENGINE || 'serpapi'; // serpapi, google, or bing
    this.maxResults = 5;
    this.maxContentLength = 8000; // Max chars to extract from each page
  }

  async searchAndSummarize(query, options = {}) {
    try {
      const {
        maxResults = this.maxResults,
        includeContent = true,
        summaryStyle = 'comprehensive', // 'brief', 'comprehensive', 'technical'
        userId = null
      } = options;

      log.api(`🔍 Starting web search for: "${query}"`);

      // Step 1: Perform web search
      const searchResults = await this.performWebSearch(query, maxResults);
      
      if (!searchResults || searchResults.length === 0) {
        return {
          success: false,
          message: 'No search results found',
          summary: null,
          sources: []
        };
      }

      // Step 2: Fetch and extract content from top results
      let contentResults = [];
      if (includeContent) {
        contentResults = await this.fetchContentFromResults(searchResults);
      }

      // Step 3: Generate comprehensive summary
      const summary = await this.generateSummary(query, searchResults, contentResults, summaryStyle);

      log.success(`✅ Web search completed for: "${query}"`);

      return {
        success: true,
        query,
        summary,
        sources: searchResults.map(result => ({
          title: result.title,
          url: result.url,
          snippet: result.snippet,
          domain: new URL(result.url).hostname
        })),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      log.error('Web search and summarization failed', error);
      return {
        success: false,
        message: 'Search service temporarily unavailable',
        error: error.message
      };
    }
  }

  async performWebSearch(query, maxResults) {
    try {
      switch (this.searchEngine) {
        case 'serpapi':
          return await this.searchWithSerpApi(query, maxResults);
        case 'google':
          return await this.searchWithGoogleApi(query, maxResults);
        case 'bing':
          return await this.searchWithBingApi(query, maxResults);
        default:
          // Fallback to DuckDuckGo scraping (no API key required)
          return await this.searchWithDuckDuckGo(query, maxResults);
      }
    } catch (error) {
      log.warn('Primary search failed, trying fallback', { error: error.message });
      return await this.searchWithDuckDuckGo(query, maxResults);
    }
  }

  async searchWithSerpApi(query, maxResults) {
    if (!this.searchApiKey) {
      throw new Error('SerpAPI key not configured');
    }

    const response = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google',
        q: query,
        api_key: this.searchApiKey,
        num: maxResults,
        safe: 'active'
      },
      timeout: 10000
    });

    return response.data.organic_results?.map(result => ({
      title: result.title,
      url: result.link,
      snippet: result.snippet || ''
    })) || [];
  }

  async searchWithGoogleApi(query, maxResults) {
    if (!this.searchApiKey || !process.env.GOOGLE_SEARCH_ENGINE_ID) {
      throw new Error('Google Search API credentials not configured');
    }

    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: this.searchApiKey,
        cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
        q: query,
        num: maxResults,
        safe: 'active'
      },
      timeout: 10000
    });

    return response.data.items?.map(item => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet || ''
    })) || [];
  }

  async searchWithBingApi(query, maxResults) {
    if (!this.searchApiKey) {
      throw new Error('Bing Search API key not configured');
    }

    const response = await axios.get('https://api.bing.microsoft.com/v7.0/search', {
      headers: {
        'Ocp-Apim-Subscription-Key': this.searchApiKey
      },
      params: {
        q: query,
        count: maxResults,
        safeSearch: 'Moderate'
      },
      timeout: 10000
    });

    return response.data.webPages?.value?.map(result => ({
      title: result.name,
      url: result.url,
      snippet: result.snippet || ''
    })) || [];
  }

  async searchWithDuckDuckGo(query, maxResults) {
    // Fallback method using DuckDuckGo instant answers
    try {
      const response = await axios.get('https://api.duckduckgo.com/', {
        params: {
          q: query,
          format: 'json',
          no_html: '1',
          skip_disambig: '1'
        },
        timeout: 8000
      });

      const results = [];
      
      // Add main result if available
      if (response.data.AbstractURL) {
        results.push({
          title: response.data.Heading || query,
          url: response.data.AbstractURL,
          snippet: response.data.AbstractText || ''
        });
      }

      // Add related topics
      if (response.data.RelatedTopics) {
        response.data.RelatedTopics.slice(0, maxResults - 1).forEach(topic => {
          if (topic.FirstURL) {
            results.push({
              title: topic.Text?.split(' - ')[0] || 'Related Result',
              url: topic.FirstURL,
              snippet: topic.Text || ''
            });
          }
        });
      }

      return results.slice(0, maxResults);
    } catch (error) {
      log.warn('DuckDuckGo search failed', { error: error.message });
      return [];
    }
  }

  async fetchContentFromResults(searchResults) {
    const contentPromises = searchResults.slice(0, 3).map(async (result) => {
      try {
        const content = await this.extractWebContent(result.url);
        return {
          ...result,
          content: content.substring(0, this.maxContentLength)
        };
      } catch (error) {
        log.warn(`Failed to fetch content from ${result.url}`, { error: error.message });
        return { ...result, content: result.snippet };
      }
    });

    return Promise.all(contentPromises);
  }

  async extractWebContent(url) {
    try {
      const response = await axios.get(url, {
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NuminaBot/1.0; +https://numina.ai)'
        },
        maxRedirects: 3
      });

      const $ = cheerio.load(response.data);
      
      // Remove unwanted elements
      $('script, style, nav, header, footer, aside, .ad, .advertisement').remove();
      
      // Extract main content
      let content = '';
      const contentSelectors = ['main', 'article', '.content', '.post', '.entry', 'body'];
      
      for (const selector of contentSelectors) {
        const element = $(selector).first();
        if (element.length) {
          content = element.text().trim();
          break;
        }
      }
      
      if (!content) {
        content = $('body').text().trim();
      }
      
      // Clean up whitespace
      return content.replace(/\s+/g, ' ').trim();
      
    } catch (error) {
      throw new Error(`Failed to extract content: ${error.message}`);
    }
  }

  async generateSummary(query, searchResults, contentResults, summaryStyle) {
    try {
      const sourceData = contentResults.length > 0 ? contentResults : searchResults;
      
      const systemPrompt = this.getSummarySystemPrompt(summaryStyle);
      const userPrompt = this.buildSummaryPrompt(query, sourceData);

      const response = await this.llmService.makeLLMRequest([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        temperature: 0.3,
        n_predict: 800,
        observerPurpose: 'web_search_summary'
      });

      return response.message?.content || 'Unable to generate summary';
      
    } catch (error) {
      log.error('Failed to generate summary', error);
      return this.generateFallbackSummary(searchResults);
    }
  }

  getSummarySystemPrompt(style) {
    const basePrompt = `You are a web research assistant that creates helpful summaries of search results. 
Your goal is to synthesize information from multiple sources into a coherent, informative response.

Guidelines:
- Focus on answering the user's query directly
- Combine information from multiple sources when relevant
- Highlight key facts, findings, and insights
- Use clear, accessible language
- Don't include URLs or "according to source X" references
- Present information as a unified response, not a list of source summaries`;

    const styleVariants = {
      brief: `${basePrompt}\n- Keep response concise (2-3 paragraphs maximum)\n- Focus on the most essential information`,
      comprehensive: `${basePrompt}\n- Provide detailed coverage of the topic\n- Include context, implications, and different perspectives\n- Aim for 3-5 paragraphs`,
      technical: `${basePrompt}\n- Focus on technical details, specifications, and expert insights\n- Include relevant data, statistics, and methodology where available`
    };

    return styleVariants[style] || styleVariants.comprehensive;
  }

  buildSummaryPrompt(query, sourceData) {
    let prompt = `User Query: "${query}"\n\nSource Information:\n\n`;
    
    sourceData.forEach((source, index) => {
      prompt += `Source ${index + 1}: ${source.title}\n`;
      if (source.content) {
        prompt += `Content: ${source.content}\n\n`;
      } else {
        prompt += `Summary: ${source.snippet}\n\n`;
      }
    });

    prompt += `Based on the above sources, provide a comprehensive answer to the user's query.`;
    
    return prompt;
  }

  generateFallbackSummary(searchResults) {
    if (!searchResults || searchResults.length === 0) {
      return 'No relevant information found for your search query.';
    }

    let summary = `Here's what I found regarding your search:\n\n`;
    
    searchResults.slice(0, 3).forEach((result, index) => {
      if (result.snippet) {
        summary += `${result.snippet} `;
      }
    });

    return summary.trim();
  }
}

export default WebSearchService;