import logger from '../utils/logger.js';
import imageDisplayService from './imageDisplayService.js';

/**
 * Rich Content Service
 * Provides enhanced content formatting and display capabilities
 * for search results and other information-rich responses
 */

class RichContentService {
  constructor() {
    this.contentProcessors = new Map();
    this.registerDefaultProcessors();
  }

  /**
   * Register default content processors
   */
  registerDefaultProcessors() {
    // Web search processor
    this.contentProcessors.set('web_search', {
      processor: this.processWebSearchResults.bind(this),
      supportedTypes: ['general', 'restaurants', 'businesses', 'events', 'news', 'places']
    });

    // News search processor
    this.contentProcessors.set('news_search', {
      processor: this.processNewsResults.bind(this),
      supportedTypes: ['articles', 'breaking', 'headlines']
    });

    // Academic search processor
    this.contentProcessors.set('academic_search', {
      processor: this.processAcademicResults.bind(this),
      supportedTypes: ['papers', 'research', 'publications']
    });

    // Social search processor
    this.contentProcessors.set('social_search', {
      processor: this.processSocialResults.bind(this),
      supportedTypes: ['posts', 'tweets', 'discussions']
    });

    // Image search processor
    this.contentProcessors.set('image_search', {
      processor: this.processImageResults.bind(this),
      supportedTypes: ['photos', 'graphics', 'artwork']
    });
  }

  /**
   * Process content based on type and enhance with rich media
   * @param {string} contentType - Type of content to process
   * @param {Object} data - Raw data to process
   * @param {Object} options - Processing options
   * @returns {Object} Enhanced content with rich formatting
   */
  async processContent(contentType, data, options = {}) {
    try {
      const processor = this.contentProcessors.get(contentType);
      
      if (!processor) {
        logger.warn('No processor found for content type', { contentType });
        return this.createFallbackContent(data);
      }

      const enhancedContent = await processor.processor(data, options);
      
      return {
        success: true,
        contentType,
        data: enhancedContent,
        metadata: {
          processedAt: new Date().toISOString(),
          processorVersion: '1.0.0',
          hasRichMedia: this.hasRichMedia(enhancedContent)
        }
      };

    } catch (error) {
      logger.error('Failed to process content', { 
        contentType, 
        error: error.message 
      });
      
      return {
        success: false,
        error: error.message,
        fallback: this.createFallbackContent(data)
      };
    }
  }

  /**
   * Process web search results with enhanced formatting
   */
  async processWebSearchResults(data, options = {}) {
    const { enableImages = true, maxResults = 10 } = options;
    
    if (!data.results || !Array.isArray(data.results)) {
      return this.createEmptyResultsContent('web search', data.query);
    }

    let results = data.results.slice(0, maxResults);
    
    // Enhance with images if enabled
    if (enableImages) {
      results = await imageDisplayService.enhanceSearchResultsWithImages(results);
    }

    return {
      type: 'web_search',
      query: data.query,
      searchType: data.searchType || 'general',
      location: data.location,
      results: results,
      markdown: this.generateWebSearchMarkdown(results, data),
      richMarkdown: enableImages ? 
        imageDisplayService.generateRichMediaMarkdown(results) : 
        this.generateWebSearchMarkdown(results, data),
      summary: this.generateSearchSummary(results, data),
      stats: {
        totalResults: results.length,
        withImages: results.filter(r => r.hasImage).length,
        sources: [...new Set(results.map(r => r.displayLink))].length
      }
    };
  }

  /**
   * Process news search results
   */
  async processNewsResults(data, options = {}) {
    const { enableImages = true, maxResults = 10 } = options;
    
    if (!data.articles || !Array.isArray(data.articles)) {
      return this.createEmptyResultsContent('news', data.query);
    }

    let articles = data.articles.slice(0, maxResults);
    
    // Enhance with images if enabled
    if (enableImages) {
      articles = await imageDisplayService.enhanceSearchResultsWithImages(articles);
    }

    return {
      type: 'news_search',
      query: data.query,
      timeRange: data.timeRange,
      articles: articles,
      markdown: this.generateNewsMarkdown(articles, data),
      richMarkdown: enableImages ? 
        imageDisplayService.generateRichMediaMarkdown(articles) : 
        this.generateNewsMarkdown(articles, data),
      summary: this.generateNewsSummary(articles, data),
      stats: {
        totalArticles: articles.length,
        withImages: articles.filter(a => a.hasImage).length,
        sources: [...new Set(articles.map(a => a.source))].filter(Boolean).length,
        timeSpan: this.calculateTimeSpan(articles)
      }
    };
  }

  /**
   * Process academic search results
   */
  async processAcademicResults(data, options = {}) {
    const { maxResults = 8 } = options;
    
    if (!data.papers || !Array.isArray(data.papers)) {
      return this.createEmptyResultsContent('academic research', data.query);
    }

    const papers = data.papers.slice(0, maxResults);

    return {
      type: 'academic_search',
      query: data.query,
      field: data.field,
      papers: papers,
      markdown: this.generateAcademicMarkdown(papers, data),
      summary: this.generateAcademicSummary(papers, data),
      stats: {
        totalPapers: papers.length,
        withAbstracts: papers.filter(p => p.abstract).length,
        avgCitations: this.calculateAvgCitations(papers),
        yearRange: this.calculateYearRange(papers)
      }
    };
  }

  /**
   * Process social media search results
   */
  async processSocialResults(data, options = {}) {
    const { enableImages = true, maxResults = 15 } = options;
    
    if (!data.posts || !Array.isArray(data.posts)) {
      return this.createEmptyResultsContent('social media', data.query);
    }

    let posts = data.posts.slice(0, maxResults);
    
    // Enhance with images if enabled
    if (enableImages) {
      posts = await imageDisplayService.enhanceSearchResultsWithImages(posts);
    }

    return {
      type: 'social_search',
      query: data.query,
      platforms: data.platforms,
      posts: posts,
      markdown: this.generateSocialMarkdown(posts, data),
      richMarkdown: enableImages ? 
        imageDisplayService.generateRichMediaMarkdown(posts) : 
        this.generateSocialMarkdown(posts, data),
      summary: this.generateSocialSummary(posts, data),
      stats: {
        totalPosts: posts.length,
        withImages: posts.filter(p => p.hasImage).length,
        platforms: [...new Set(posts.map(p => p.platform))].filter(Boolean).length,
        engagement: this.calculateTotalEngagement(posts)
      }
    };
  }

  /**
   * Process image search results
   */
  async processImageResults(data, options = {}) {
    const { maxResults = 12, generateThumbnails = true } = options;
    
    if (!data.images || !Array.isArray(data.images)) {
      return this.createEmptyResultsContent('images', data.query);
    }

    let images = data.images.slice(0, maxResults);
    
    // Process all images for display
    if (generateThumbnails) {
      images = await Promise.all(images.map(async (img) => {
        const processedImage = await imageDisplayService.processImage(img.url, {
          width: 400,
          height: 400,
          generateThumbnail: true,
          thumbnailSize: 150
        });
        
        if (processedImage.success !== false) {
          img.processed = processedImage;
          img.hasProcessed = true;
        }
        
        return img;
      }));
    }

    return {
      type: 'image_search',
      query: data.query,
      images: images,
      markdown: this.generateImageMarkdown(images, data),
      summary: this.generateImageSummary(images, data),
      stats: {
        totalImages: images.length,
        processed: images.filter(i => i.hasProcessed).length,
        avgSize: this.calculateAvgImageSize(images),
        formats: [...new Set(images.map(i => i.format))].filter(Boolean)
      }
    };
  }

  /**
   * Generate markdown for web search results
   */
  generateWebSearchMarkdown(results, data) {
    const emoji = this.getSearchTypeEmoji(data.searchType);
    const locationText = data.location ? ` in ${data.location}` : '';
    
    let markdown = `## ${emoji} Search Results for "${data.query}"${locationText}\n\n`;
    markdown += `*Found ${results.length} result${results.length === 1 ? '' : 's'}*\n\n`;

    results.forEach((result, index) => {
      markdown += `### ${index + 1}. [${result.title}](${result.link})\n\n`;
      
      if (result.snippet) {
        markdown += `${result.snippet}\n\n`;
      }
      
      markdown += `**Source:** ${result.displayLink}\n\n`;
      markdown += '---\n\n';
    });

    return markdown.trim();
  }

  /**
   * Generate markdown for news results
   */
  generateNewsMarkdown(articles, data) {
    let markdown = `## 📰 News Results for "${data.query}"\n\n`;
    markdown += `*Found ${articles.length} article${articles.length === 1 ? '' : 's'}*\n\n`;

    articles.forEach((article, index) => {
      markdown += `### ${index + 1}. [${article.title}](${article.url})\n\n`;
      
      if (article.summary) {
        markdown += `${article.summary}\n\n`;
      }
      
      markdown += `**Source:** ${article.source}`;
      if (article.publishedAt) {
        markdown += ` • **Published:** ${new Date(article.publishedAt).toLocaleDateString()}`;
      }
      markdown += '\n\n---\n\n';
    });

    return markdown.trim();
  }

  /**
   * Generate markdown for academic results
   */
  generateAcademicMarkdown(papers, data) {
    let markdown = `## 🎓 Academic Results for "${data.query}"\n\n`;
    markdown += `*Found ${papers.length} paper${papers.length === 1 ? '' : 's'}*\n\n`;

    papers.forEach((paper, index) => {
      markdown += `### ${index + 1}. ${paper.title}\n\n`;
      
      if (paper.authors && paper.authors.length > 0) {
        markdown += `**Authors:** ${paper.authors.join(', ')}\n\n`;
      }
      
      if (paper.abstract) {
        markdown += `**Abstract:** ${paper.abstract.substring(0, 300)}${paper.abstract.length > 300 ? '...' : ''}\n\n`;
      }
      
      if (paper.year) {
        markdown += `**Year:** ${paper.year}`;
      }
      if (paper.citations) {
        markdown += ` • **Citations:** ${paper.citations}`;
      }
      if (paper.journal) {
        markdown += ` • **Journal:** ${paper.journal}`;
      }
      markdown += '\n\n---\n\n';
    });

    return markdown.trim();
  }

  /**
   * Helper methods
   */

  getSearchTypeEmoji(searchType) {
    const emojiMap = {
      'general': '🔍',
      'restaurants': '🍽️', 
      'businesses': '🏢',
      'events': '📅',
      'news': '📰',
      'places': '📍'
    };
    return emojiMap[searchType] || '🔍';
  }

  hasRichMedia(content) {
    return content.results?.some(r => r.hasImage) || 
           content.articles?.some(a => a.hasImage) ||
           content.posts?.some(p => p.hasImage) ||
           content.images?.some(i => i.hasProcessed);
  }

  createEmptyResultsContent(searchType, query) {
    return {
      type: searchType,
      query,
      results: [],
      markdown: `## No ${searchType} results found\n\nNo results found for "${query}".`,
      summary: `No ${searchType} results were found for the query "${query}".`,
      stats: { totalResults: 0 }
    };
  }

  createFallbackContent(data) {
    return {
      type: 'fallback',
      data,
      markdown: `## Content\n\n${JSON.stringify(data, null, 2)}`,
      summary: 'Content processed with fallback formatting.'
    };
  }

  generateSearchSummary(results, data) {
    if (!results.length) return `No results found for "${data.query}".`;
    
    const topSources = [...new Set(results.slice(0, 3).map(r => r.displayLink))];
    return `Found ${results.length} results for "${data.query}" from sources including ${topSources.join(', ')}.`;
  }

  generateNewsSummary(articles, data) {
    if (!articles.length) return `No news found for "${data.query}".`;
    
    const sources = [...new Set(articles.slice(0, 3).map(a => a.source))].filter(Boolean);
    return `Found ${articles.length} news articles about "${data.query}" from ${sources.join(', ')}.`;
  }

  generateAcademicSummary(papers, data) {
    if (!papers.length) return `No academic papers found for "${data.query}".`;
    
    const avgYear = Math.round(papers.reduce((sum, p) => sum + (p.year || 2020), 0) / papers.length);
    return `Found ${papers.length} academic papers on "${data.query}" with average publication year ${avgYear}.`;
  }

  generateSocialSummary(posts, data) {
    if (!posts.length) return `No social media posts found for "${data.query}".`;
    
    const platforms = [...new Set(posts.map(p => p.platform))].filter(Boolean);
    return `Found ${posts.length} social media posts about "${data.query}" across ${platforms.join(', ')}.`;
  }

  generateImageSummary(images, data) {
    if (!images.length) return `No images found for "${data.query}".`;
    
    const formats = [...new Set(images.map(i => i.format))].filter(Boolean);
    return `Found ${images.length} images for "${data.query}" in formats: ${formats.join(', ')}.`;
  }

  // Statistical helper methods
  calculateTimeSpan(articles) {
    const dates = articles.map(a => new Date(a.publishedAt)).filter(d => !isNaN(d));
    if (dates.length < 2) return null;
    
    const earliest = new Date(Math.min(...dates));
    const latest = new Date(Math.max(...dates));
    const diffDays = Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24));
    
    return `${diffDays} days`;
  }

  calculateAvgCitations(papers) {
    const citations = papers.map(p => p.citations).filter(c => typeof c === 'number');
    return citations.length > 0 ? Math.round(citations.reduce((a, b) => a + b, 0) / citations.length) : 0;
  }

  calculateYearRange(papers) {
    const years = papers.map(p => p.year).filter(y => y);
    if (years.length === 0) return null;
    
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    
    return minYear === maxYear ? `${minYear}` : `${minYear}-${maxYear}`;
  }

  calculateTotalEngagement(posts) {
    return posts.reduce((total, post) => {
      return total + (post.likes || 0) + (post.shares || 0) + (post.comments || 0);
    }, 0);
  }

  calculateAvgImageSize(images) {
    const sizes = images.map(i => i.size).filter(s => s);
    return sizes.length > 0 ? Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length) : 0;
  }
}

// Singleton instance
const richContentService = new RichContentService();

export default richContentService;