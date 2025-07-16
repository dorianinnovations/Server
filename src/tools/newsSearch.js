export default async function newsSearch(args, userContext) {
  try {
    const { query, timeRange = 'day', source, category } = args;
    
    if (!query || typeof query !== 'string') {
      throw new Error('Query is required and must be a string');
    }

    // Use web search with news-specific query
    const webSearch = (await import('./webSearch.js')).default;
    
    let newsQuery = `${query} news`;
    if (timeRange === 'hour') newsQuery += ' latest breaking';
    if (timeRange === 'day') newsQuery += ' today';
    if (timeRange === 'week') newsQuery += ' this week';
    if (source) newsQuery += ` site:${source}`;
    if (category && category !== 'general') newsQuery += ` ${category}`;

    const searchResult = await webSearch({
      query: newsQuery,
      searchType: 'news',
      limit: 10
    }, userContext);

    if (!searchResult.success) {
      throw new Error('Failed to search for news');
    }

    // Filter and format results as news articles
    const articles = searchResult.results.map(result => ({
      title: result.title,
      summary: result.snippet,
      url: result.link,
      source: result.displayLink,
      category: category || 'general',
      publishedAt: new Date().toISOString() // Approximate
    }));

    return {
      success: true,
      data: {
        query,
        timeRange,
        category: category || 'general',
        source,
        resultsCount: articles.length,
        articles
      },
      message: `Found ${articles.length} news articles about "${query}"`
    };

  } catch (error) {
    console.error('News search error:', error);
    return {
      success: false,
      error: error.message || 'Failed to search news'
    };
  }
}