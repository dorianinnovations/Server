export default async function socialSearch(args, userContext) {
  try {
    const { query, platform = 'all', timeRange = 'day' } = args;
    
    if (!query || typeof query !== 'string') {
      throw new Error('Query is required and must be a string');
    }

    const webSearch = (await import('./webSearch.js')).default;
    
    let socialQuery = query;
    
    // Platform-specific search
    if (platform === 'twitter') {
      socialQuery = `${query} site:twitter.com OR site:x.com`;
    } else if (platform === 'reddit') {
      socialQuery = `${query} site:reddit.com`;
    } else if (platform === 'linkedin') {
      socialQuery = `${query} site:linkedin.com`;
    } else {
      socialQuery = `${query} social media twitter reddit linkedin`;
    }

    // Time range
    if (timeRange === 'hour') socialQuery += ' latest';
    if (timeRange === 'day') socialQuery += ' today';

    const searchResult = await webSearch({
      query: socialQuery,
      searchType: 'general',
      limit: 10
    }, userContext);

    if (!searchResult.success) {
      throw new Error('Failed to search social media');
    }

    // Format results as social posts
    const socialPosts = searchResult.results.map(result => ({
      title: result.title,
      content: result.snippet,
      url: result.link,
      platform: detectPlatform(result.displayLink),
      source: result.displayLink,
      timestamp: new Date().toISOString()
    }));

    return {
      success: true,
      data: {
        query,
        platform,
        timeRange,
        resultsCount: socialPosts.length,
        posts: socialPosts
      },
      message: `Found ${socialPosts.length} social media posts about "${query}"`
    };

  } catch (error) {
    console.error('Social search error:', error);
    return {
      success: false,
      error: error.message || 'Failed to search social media'
    };
  }
}

function detectPlatform(domain) {
  if (domain.includes('twitter') || domain.includes('x.com')) return 'Twitter';
  if (domain.includes('reddit')) return 'Reddit';
  if (domain.includes('linkedin')) return 'LinkedIn';
  if (domain.includes('facebook')) return 'Facebook';
  if (domain.includes('instagram')) return 'Instagram';
  return 'Other';
}