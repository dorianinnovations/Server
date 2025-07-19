export default async function translation(args, _userContext) {
  try {
    const { text, fromLanguage, toLanguage, includePhonetic = false } = args;
    
    if (!text || typeof text !== 'string') {
      throw new Error('Text to translate is required');
    }
    
    if (!toLanguage || typeof toLanguage !== 'string') {
      throw new Error('Target language is required');
    }

    // Use Google Translate API if available, otherwise fallback to web search
    if (process.env.GOOGLE_TRANSLATE_API_KEY) {
      return await getGoogleTranslation(text, fromLanguage, toLanguage, includePhonetic);
    } else {
      return await getTranslationFromWebSearch(text, fromLanguage, toLanguage);
    }

  } catch (error) {
    console.error('Translation error:', error);
    return {
      success: false,
      error: error.message || 'Failed to translate text'
    };
  }
}

async function getGoogleTranslation(text, fromLanguage, toLanguage, _includePhonetic) {
  const axios = (await import('axios')).default;
  const baseUrl = 'https://translation.googleapis.com/language/translate/v2';
  
  try {
    const params = {
      key: process.env.GOOGLE_TRANSLATE_API_KEY,
      q: text,
      target: toLanguage
    };
    
    if (fromLanguage) {
      params.source = fromLanguage;
    }

    const response = await axios.post(baseUrl, null, {
      params: params,
      timeout: 5000
    });

    const translation = response.data.data.translations[0];
    
    return {
      success: true,
      data: {
        originalText: text,
        translatedText: translation.translatedText,
        fromLanguage: translation.detectedSourceLanguage || fromLanguage,
        toLanguage: toLanguage,
        confidence: 1.0
      },
      message: `Translated from ${translation.detectedSourceLanguage || fromLanguage} to ${toLanguage}`
    };
  } catch (_error) {
    throw new Error('Failed to translate using Google Translate API');
  }
}

async function getTranslationFromWebSearch(text, fromLanguage, toLanguage) {
  // Import the web search tool
  const webSearch = (await import('./webSearch.js')).default;
  
  const searchQuery = `translate "${text}" from ${fromLanguage || 'auto'} to ${toLanguage}`;
  
  const searchResult = await webSearch({
    query: searchQuery,
    searchType: 'general',
    limit: 3
  }, {});

  if (!searchResult.success) {
    throw new Error('Failed to search for translation');
  }

  return {
    success: true,
    data: {
      originalText: text,
      fromLanguage: fromLanguage || 'auto-detect',
      toLanguage: toLanguage,
      searchResults: searchResult.results,
      translationQuery: searchQuery
    },
    message: `Translation search results for "${text}" to ${toLanguage}`,
    instructions: [
      'Translation API key not configured - showing web search results',
      'Check the search results for translation services like Google Translate',
      'For direct translation, configure GOOGLE_TRANSLATE_API_KEY environment variable'
    ]
  };
}