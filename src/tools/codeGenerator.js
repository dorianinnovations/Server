export default async function codeGenerator(args, userContext) {
  try {
    const { language, description, framework, complexity = 'simple' } = args;
    
    if (!language || !description) {
      throw new Error('Language and description are required');
    }

    const webSearch = (await import('./webSearch.js')).default;
    
    let codeQuery = `${language} code example ${description}`;
    if (framework) codeQuery += ` ${framework}`;
    if (complexity) codeQuery += ` ${complexity}`;
    codeQuery += ' tutorial github stackoverflow';

    const searchResult = await webSearch({
      query: codeQuery,
      searchType: 'general',
      limit: 5
    }, userContext);

    if (!searchResult.success) {
      throw new Error('Failed to search for code examples');
    }

    return {
      success: true,
      data: {
        language,
        description,
        framework,
        complexity,
        codeExamples: searchResult.results,
        query: codeQuery
      },
      message: `Code examples for ${language}: "${description}"`,
      instructions: [
        'Check the search results for code examples and tutorials',
        'For AI-generated code, configure OpenAI API key',
        'Review and test any code before using in production'
      ]
    };

  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to generate code'
    };
  }
}