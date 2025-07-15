import axios from 'axios';

export default async function spotifyPlaylist(args, userContext) {
  const { 
    playlistName, 
    description = '', 
    tracks = [],
    mood = '',
    genre = '',
    isPublic = false 
  } = args;

  const { user } = userContext;

  try {
    const spotifyToken = user.profile?.get('spotifyAccessToken');
    
    if (!spotifyToken) {
      return {
        success: false,
        error: 'Spotify account not connected',
        action: 'connect_spotify',
        message: 'Please connect your Spotify account to create playlists.',
      };
    }

    const spotifyUserId = user.profile?.get('spotifyUserId');
    if (!spotifyUserId) {
      return {
        success: false,
        error: 'Spotify user ID not found',
        action: 'reconnect_spotify',
      };
    }

    const playlist = await createSpotifyPlaylist(
      spotifyToken,
      spotifyUserId,
      playlistName,
      description,
      isPublic
    );

    if (playlist.success) {
      let addedTracks = [];
      
      if (tracks.length > 0) {
        const trackResults = await addTracksToPlaylist(
          spotifyToken,
          playlist.id,
          tracks
        );
        addedTracks = trackResults.addedTracks;
      } else if (mood || genre) {
        const recommendedTracks = await getRecommendedTracks(
          spotifyToken,
          mood,
          genre,
          user
        );
        
        if (recommendedTracks.length > 0) {
          const trackResults = await addTracksToPlaylist(
            spotifyToken,
            playlist.id,
            recommendedTracks
          );
          addedTracks = trackResults.addedTracks;
        }
      }

      return {
        success: true,
        playlistId: playlist.id,
        playlistUrl: playlist.external_urls.spotify,
        playlistName: playlist.name,
        tracksAdded: addedTracks.length,
        tracks: addedTracks,
        message: `Created playlist "${playlistName}" with ${addedTracks.length} tracks.`,
      };
    } else {
      return {
        success: false,
        error: playlist.error || 'Failed to create playlist',
      };
    }
  } catch (error) {
    console.error('Spotify playlist error:', error);
    return {
      success: false,
      error: 'Failed to create Spotify playlist',
      details: error.message,
    };
  }
}

async function createSpotifyPlaylist(token, userId, name, description, isPublic) {
  try {
    const response = await axios.post(
      `https://api.spotify.com/v1/users/${userId}/playlists`,
      {
        name: name,
        description: description,
        public: isPublic,
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      ...response.data,
    };
  } catch (error) {
    console.error('Spotify API error:', error.response?.data);
    return {
      success: false,
      error: error.response?.data?.error?.message || 'Failed to create playlist',
    };
  }
}

async function addTracksToPlaylist(token, playlistId, tracks) {
  try {
    const trackUris = tracks.map(track => {
      if (typeof track === 'string') {
        return track.startsWith('spotify:') ? track : `spotify:track:${track}`;
      }
      return track.uri || `spotify:track:${track.id}`;
    });

    const response = await axios.post(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      {
        uris: trackUris,
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      addedTracks: trackUris,
      snapshot_id: response.data.snapshot_id,
    };
  } catch (error) {
    console.error('Error adding tracks to playlist:', error.response?.data);
    return {
      success: false,
      error: error.response?.data?.error?.message || 'Failed to add tracks',
      addedTracks: [],
    };
  }
}

async function getRecommendedTracks(token, mood, genre, user) {
  try {
    const seedGenres = genre ? [genre] : ['pop'];
    const targetFeatures = getMoodFeatures(mood);
    
    const response = await axios.get('https://api.spotify.com/v1/recommendations', {
      params: {
        seed_genres: seedGenres.join(','),
        limit: 20,
        ...targetFeatures,
      },
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    return response.data.tracks.map(track => track.uri);
  } catch (error) {
    console.error('Error getting recommendations:', error.response?.data);
    return [];
  }
}

function getMoodFeatures(mood) {
  const moodMap = {
    'happy': {
      target_valence: 0.8,
      target_energy: 0.7,
      target_danceability: 0.8,
    },
    'sad': {
      target_valence: 0.2,
      target_energy: 0.3,
      target_acousticness: 0.7,
    },
    'energetic': {
      target_energy: 0.9,
      target_danceability: 0.8,
      target_tempo: 140,
    },
    'calm': {
      target_valence: 0.5,
      target_energy: 0.3,
      target_acousticness: 0.8,
    },
    'focus': {
      target_valence: 0.6,
      target_energy: 0.5,
      target_instrumentalness: 0.7,
    },
    'workout': {
      target_energy: 0.9,
      target_danceability: 0.9,
      target_tempo: 150,
    },
  };

  return moodMap[mood.toLowerCase()] || {};
}