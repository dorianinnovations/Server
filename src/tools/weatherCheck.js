export default async function weatherCheck(args, _userContext) {
  try {
    const { location, days = 1, units = 'metric' } = args;
    
    if (!location || typeof location !== 'string') {
      throw new Error('Location is required and must be a string');
    }

    // Use OpenWeatherMap API if available, otherwise fallback to weather web search
    if (process.env.OPENWEATHER_API_KEY) {
      try {
        return await getOpenWeatherData(location, days, units);
      } catch (apiError) {
        console.warn('OpenWeather API failed, falling back to web search:', apiError.message);
        return await getWeatherFromWebSearch(location, days, units);
      }
    } else {
      return await getWeatherFromWebSearch(location, days, units);
    }

  } catch (error) {
    console.error('Weather check error:', error);
    return {
      success: false,
      error: error.message || 'Failed to get weather data'
    };
  }
}

async function getOpenWeatherData(location, days, units) {
  const axios = (await import('axios')).default;
  const baseUrl = 'https://api.openweathermap.org/data/2.5/weather';
  
  try {
    const response = await axios.get(baseUrl, {
      params: {
        q: location,
        appid: process.env.OPENWEATHER_API_KEY,
        units: units
      },
      timeout: 5000
    });

    const data = response.data;
    return {
      success: true,
      data: {
        location: {
          name: data.name,
          country: data.sys.country,
          coordinates: { lat: data.coord.lat, lon: data.coord.lon }
        },
        current: {
          temperature: Math.round(data.main.temp),
          feelsLike: Math.round(data.main.feels_like),
          humidity: data.main.humidity,
          windSpeed: data.wind.speed,
          condition: data.weather[0].description,
          icon: data.weather[0].icon
        },
        units: units
      },
      message: `Current weather in ${data.name}: ${Math.round(data.main.temp)}°${units === 'metric' ? 'C' : 'F'}, ${data.weather[0].description}`
    };
  } catch (error) {
    console.warn('OpenWeather API error:', error.response?.status, error.response?.data?.message || error.message);
    // If API key is invalid or other API error, fall back to web search
    throw new Error('OpenWeather API unavailable - falling back to web search');
  }
}

async function getWeatherFromWebSearch(location, _days, _units) {
  // Import the web search tool
  const webSearch = (await import('./webSearch.js')).default;
  
  const searchResult = await webSearch({
    query: `weather ${location} today current temperature`,
    searchType: 'general',
    limit: 3
  }, {});

  if (!searchResult.success) {
    throw new Error('Failed to search for weather information');
  }

  return {
    success: true,
    data: {
      location: { name: location },
      searchResults: searchResult.results,
      message: 'Weather information from web search'
    },
    message: `Weather search results for ${location}`,
    instructions: [
      'Weather API key not configured - showing web search results',
      'Check the search results for current weather information',
      'For real-time data, configure OPENWEATHER_API_KEY environment variable'
    ]
  };
}