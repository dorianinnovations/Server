export default async function imageSearch(args, userContext) {
  try {
    const { query, size = 'medium', color, type = 'photo' } = args;
    
    if (!query || typeof query !== 'string') {
      throw new Error('Query is required and must be a string');
    }

    const webSearch = (await import('./webSearch.js')).default;
    
    let imageQuery = `${query} images ${type}`;
    if (color) imageQuery += ` ${color}`;
    if (size) imageQuery += ` ${size}`;
    
    // Add image-specific sites
    imageQuery += ' site:unsplash.com OR site:pixabay.com OR site:pexels.com OR filetype:jpg OR filetype:png';

    const searchResult = await webSearch({
      query: imageQuery,
      searchType: 'general',
      limit: 8
    }, userContext);

    if (!searchResult.success) {
      throw new Error('Failed to search for images');
    }

    const images = searchResult.results.map(result => ({
      title: result.title,
      description: result.snippet,
      url: result.link,
      source: result.displayLink,
      size: size,
      type: type,
      color: color
    }));

    return {
      success: true,
      data: {
        query,
        size,
        color,
        type,
        resultsCount: images.length,
        images
      },
      message: `Found ${images.length} images for "${query}"`
    };

  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to search for images'
    };
  }
}