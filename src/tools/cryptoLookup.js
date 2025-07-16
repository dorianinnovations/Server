export default async function cryptoLookup(args, userContext) {
  try {
    const { symbol, currency = 'USD', timeRange = '24h' } = args;
    
    if (!symbol || typeof symbol !== 'string') {
      throw new Error('Crypto symbol is required');
    }

    const webSearch = (await import('./webSearch.js')).default;
    
    const cryptoQuery = `${symbol.toUpperCase()} ${currency} price cryptocurrency market cap current`;
    
    const searchResult = await webSearch({
      query: cryptoQuery,
      searchType: 'general',
      limit: 5
    }, userContext);

    if (!searchResult.success) {
      throw new Error('Failed to search for crypto data');
    }

    return {
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        currency,
        timeRange,
        priceData: searchResult.results
      },
      message: `Crypto data for ${symbol.toUpperCase()}/${currency}`,
      instructions: [
        'Check the search results for current crypto price and market data',
        'For real-time data, configure a crypto API key like CoinGecko or CoinMarketCap'
      ]
    };

  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to lookup crypto data'
    };
  }
}