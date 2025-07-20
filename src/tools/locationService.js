export default async function locationService(args, userContext) {
  try {
    const { action = 'get_location', ...options } = args;

    switch (action) {
      case 'get_location':
        return await getCurrentLocation(userContext, options);
      case 'geocode':
        return await geocodeLocation(args, userContext);
      case 'reverse_geocode':
        return await reverseGeocode(args, userContext);
      default:
        throw new Error(`Unknown location action: ${action}`);
    }
  } catch (error) {
    console.error('Location service error:', error);
    return {
      success: false,
      error: error.message || 'Failed to process location request',
      action: args.action,
    };
  }
}

async function getCurrentLocation(userContext, options = {}) {
  // Check if user has location data in their session/profile
  console.log('🔍 LocationService: Getting location for user');
  
  // First try to get from userContext
  const userLocation = userContext?.currentLocation || userContext?.location;
  
  if (userLocation) {
    console.log('📍 LocationService: Using provided location data');
    // User has provided location data
    return {
      success: true,
      action: 'get_location',
      location: {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        city: userLocation.city,
        region: userLocation.region || userLocation.state,
        country: userLocation.country,
        address: userLocation.address || `${userLocation.city}, ${userLocation.region || userLocation.state}, ${userLocation.country}`,
        timestamp: userLocation.timestamp || new Date().toISOString()
      },
      message: `Current location: ${userLocation.city}, ${userLocation.region || userLocation.state}, ${userLocation.country}`,
      accuracy: userLocation.accuracy || 'city-level'
    };
  } else {
    // No location data available - prompt user to enable location
    return {
      success: false,
      action: 'get_location',
      error: 'Location not available',
      message: 'I need access to your location to help with location-based requests.',
      instructions: [
        'Please enable location access in your mobile app',
        'Your location data is used only for this request and not stored',
        'You can ask for weather, nearby places, or other location-based assistance'
      ],
      requestLocationPermission: true
    };
  }
}

async function geocodeLocation(args, userContext) {
  const { address } = args;
  
  if (!address) {
    throw new Error('Address is required for geocoding');
  }

  // This would integrate with a geocoding service like Google Maps API
  // For now, return a helpful response
  return {
    success: true,
    action: 'geocode',
    query: address,
    message: `Geocoding service ready for address: ${address}`,
    note: 'Geocoding API integration can be added when needed'
  };
}

async function reverseGeocode(args, userContext) {
  const { latitude, longitude } = args;
  
  if (!latitude || !longitude) {
    throw new Error('Latitude and longitude are required for reverse geocoding');
  }

  return {
    success: true,
    action: 'reverse_geocode',
    coordinates: { latitude, longitude },
    message: `Reverse geocoding service ready for coordinates: ${latitude}, ${longitude}`,
    note: 'Reverse geocoding API integration can be added when needed'
  };
}