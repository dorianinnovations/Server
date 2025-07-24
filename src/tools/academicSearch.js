export default async function academicSearch(args, userContext) {
  try {
    console.log('🎓 ACADEMIC SEARCH CALLED WITH:', JSON.stringify(args, null, 2));
    console.log('🎓 ARGS TYPE:', typeof args);
    console.log('🎓 ARGS KEYS:', Object.keys(args || {}));
    
    const { query, field, yearRange } = args || {};
    
    console.log('🎓 DESTRUCTURED VALUES:', { query, field, yearRange, queryType: typeof query });
    
    if (!query || typeof query !== 'string') {
      console.error('🎓 ACADEMIC SEARCH ERROR: Invalid query:', { 
        query, 
        type: typeof query, 
        args,
        argsStringified: JSON.stringify(args)
      });
      throw new Error('Query is required and must be a string');
    }

    const webSearch = (await import('./webSearch.js')).default;
    
    let academicQuery = `${query} academic research paper`;
    if (field) academicQuery += ` ${field}`;
    if (yearRange) academicQuery += ` ${yearRange}`;
    
    // Add academic site filters
    academicQuery += ' site:scholar.google.com OR site:pubmed.ncbi.nlm.nih.gov OR site:arxiv.org OR site:jstor.org OR site:researchgate.net';

    const searchResult = await webSearch({
      query: academicQuery,
      searchType: 'general',
      limit: 10
    }, userContext);

    if (!searchResult.success) {
      throw new Error('Failed to search academic sources');
    }

    // Format results as academic papers
    const papers = searchResult.results.map(result => ({
      title: result.title,
      abstract: result.snippet,
      url: result.link,
      source: result.displayLink,
      field: field || 'General',
      year: extractYear(result.snippet) || 'Unknown'
    }));

    return {
      success: true,
      data: {
        query,
        field: field || 'General',
        yearRange,
        resultsCount: papers.length,
        papers
      },
      message: `Found ${papers.length} academic papers about "${query}"`
    };

  } catch (error) {
    console.error('Academic search error:', error);
    return {
      success: false,
      error: error.message || 'Failed to search academic sources'
    };
  }
}

function extractYear(text) {
  const yearMatch = text.match(/\b(19|20)\d{2}\b/);
  return yearMatch ? yearMatch[0] : null;
}