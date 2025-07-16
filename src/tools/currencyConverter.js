export default async function currencyConverter(args, userContext) {
  try {
    const { amount, fromCurrency, toCurrency } = args;
    
    if (!amount || !fromCurrency || !toCurrency) {
      throw new Error('Amount, fromCurrency, and toCurrency are required');
    }

    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('Amount must be a positive number');
    }

    const webSearch = (await import('./webSearch.js')).default;
    
    const conversionQuery = `${amount} ${fromCurrency.toUpperCase()} to ${toCurrency.toUpperCase()} exchange rate currency converter`;
    
    const searchResult = await webSearch({
      query: conversionQuery,
      searchType: 'general',
      limit: 3
    }, userContext);

    if (!searchResult.success) {
      throw new Error('Failed to search for exchange rates');
    }

    return {
      success: true,
      data: {
        amount,
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        conversionResults: searchResult.results,
        query: conversionQuery
      },
      message: `Currency conversion: ${amount} ${fromCurrency.toUpperCase()} to ${toCurrency.toUpperCase()}`,
      instructions: [
        'Check the search results for current exchange rates',
        'For real-time rates, configure an exchange rate API key'
      ]
    };

  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to convert currency'
    };
  }
}