export default async function nutritionLookup(args, userContext) {
  try {
    const { food, quantity, includeAlternatives = false } = args;
    
    if (!food || typeof food !== 'string') {
      throw new Error('Food item is required');
    }

    const webSearch = (await import('./webSearch.js')).default;
    
    let nutritionQuery = `${food} nutrition facts calories protein carbs fat`;
    if (quantity) nutritionQuery += ` ${quantity}`;
    nutritionQuery += ' site:nutritionix.com OR site:myfitnesspal.com OR site:usda.gov';

    const searchResult = await webSearch({
      query: nutritionQuery,
      searchType: 'general',
      limit: 5
    }, userContext);

    if (!searchResult.success) {
      throw new Error('Failed to search for nutrition information');
    }

    let alternatives = [];
    if (includeAlternatives) {
      const altQuery = `healthy alternatives to ${food} nutrition`;
      const altResult = await webSearch({
        query: altQuery,
        searchType: 'general',
        limit: 3
      }, userContext);
      
      if (altResult.success) {
        alternatives = altResult.results;
      }
    }

    return {
      success: true,
      data: {
        food,
        quantity: quantity || 'standard serving',
        nutritionInfo: searchResult.results,
        alternatives: alternatives,
        includeAlternatives
      },
      message: `Nutrition information for ${food}`,
      instructions: [
        'Check the search results for detailed nutrition facts',
        'For precise data, configure a nutrition API key',
        'Nutrition information is approximate and may vary'
      ]
    };

  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to lookup nutrition information'
    };
  }
}