export default async function stockLookup(args, userContext) {
  try {
    const { symbol, timeRange = '1d', includeNews = false } = args;
    
    if (!symbol || typeof symbol !== 'string') {
      throw new Error('Stock symbol is required');
    }

    const webSearch = (await import('./webSearch.js')).default;
    
    const stockQuery = `${symbol.toUpperCase()} stock price today current market data`;
    
    const searchResult = await webSearch({
      query: stockQuery,
      searchType: 'general',
      limit: 5
    }, userContext);

    if (!searchResult.success) {
      throw new Error('Failed to search for stock data');
    }

    let newsResults = [];
    if (includeNews) {
      const newsQuery = `${symbol.toUpperCase()} stock news today`;
      const newsSearchResult = await webSearch({
        query: newsQuery,
        searchType: 'news',
        limit: 3
      }, userContext);
      
      if (newsSearchResult.success) {
        newsResults = newsSearchResult.results;
      }
    }

    return {
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        timeRange,
        priceData: searchResult.results,
        news: newsResults,
        includeNews
      },
      message: `Stock data for ${symbol.toUpperCase()}`,
      instructions: [
        'Check the search results for current stock price and market data',
        'For real-time data, configure a financial API key'
      ]
    };

  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to lookup stock data'
    };
  }
}