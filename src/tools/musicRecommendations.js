import webSearch from './webSearch.js';

export default async function musicRecommendations(args, userContext) {
  const { 
    mood = '',
    genre = '',
    artist = '',
    playlistName = '',
    trackCount = 20
  } = args;

  try {
    // Build search query based on inputs
    let searchQuery = '';
    if (mood) {
      searchQuery += `${mood} music `;
    }
    if (genre) {
      searchQuery += `${genre} `;
    }
    if (artist) {
      searchQuery += `similar to ${artist} `;
    }
    searchQuery += 'popular songs recommendations 2024';

    // Search for music recommendations online
    const searchResults = await webSearch({
      query: searchQuery,
      searchType: 'general',
      limit: 10
    }, userContext);

    // Generate curated recommendations
    const recommendations = generateMusicRecommendations(mood, genre, artist, trackCount);
    
    // Combine web search results with curated recommendations
    const finalPlaylistName = playlistName || generatePlaylistName(mood, genre, artist);
    
    return {
      success: true,
      playlistName: finalPlaylistName,
      mood: mood,
      genre: genre,
      trackCount: recommendations.length,
      recommendations: recommendations,
      webResults: searchResults.success ? searchResults.results : [],
      message: `Created ${finalPlaylistName} with ${recommendations.length} track recommendations${mood ? ` for ${mood} mood` : ''}${genre ? ` in ${genre} genre` : ''}.`,
      instructions: [
        'These are curated music recommendations based on your preferences',
        'You can search for these songs on your preferred music platform',
        'Links to music databases and streaming services are provided in the web results',
        mood === 'focus' ? 'These tracks are selected for concentration and productivity' : '',
        mood === 'workout' ? 'These are high-energy tracks perfect for exercise' : '',
      ].filter(Boolean),
      spotifyAlternative: {
        message: 'To create an actual Spotify playlist, connect your Spotify account in your profile settings',
        manualSteps: [
          '1. Open Spotify and create a new playlist',
          `2. Name it "${finalPlaylistName}"`,
          '3. Search for and add the recommended tracks below',
          '4. Enjoy your personalized playlist!'
        ]
      }
    };

  } catch (error) {
    console.error('Music recommendations error:', error);
    return {
      success: false,
      error: 'Failed to generate music recommendations',
      details: error.message,
    };
  }
}

function generateMusicRecommendations(mood, genre, artist, count) {
  const moodTracks = {
    happy: [
      { title: 'Good as Hell', artist: 'Lizzo', genre: 'Pop' },
      { title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars', genre: 'Funk/Pop' },
      { title: 'Can\'t Stop the Feeling!', artist: 'Justin Timberlake', genre: 'Pop' },
      { title: 'Walking on Sunshine', artist: 'Katrina and the Waves', genre: 'Pop/Rock' },
      { title: 'Happy', artist: 'Pharrell Williams', genre: 'Pop' },
    ],
    sad: [
      { title: 'Someone Like You', artist: 'Adele', genre: 'Pop/Soul' },
      { title: 'Hurt', artist: 'Johnny Cash', genre: 'Country/Alternative' },
      { title: 'Mad World', artist: 'Gary Jules', genre: 'Alternative' },
      { title: 'The Sound of Silence', artist: 'Simon & Garfunkel', genre: 'Folk' },
      { title: 'Black', artist: 'Pearl Jam', genre: 'Grunge/Rock' },
    ],
    energetic: [
      { title: 'Thunder', artist: 'Imagine Dragons', genre: 'Pop/Rock' },
      { title: 'Pump It', artist: 'The Black Eyed Peas', genre: 'Hip-Hop/Pop' },
      { title: 'Eye of the Tiger', artist: 'Survivor', genre: 'Rock' },
      { title: 'Don\'t Stop Me Now', artist: 'Queen', genre: 'Rock' },
      { title: 'Titanium', artist: 'David Guetta ft. Sia', genre: 'EDM/Pop' },
    ],
    calm: [
      { title: 'Weightless', artist: 'Marconi Union', genre: 'Ambient' },
      { title: 'Claire de Lune', artist: 'Claude Debussy', genre: 'Classical' },
      { title: 'Mad About You', artist: 'Sting', genre: 'Pop/Jazz' },
      { title: 'The Night We Met', artist: 'Lord Huron', genre: 'Indie Folk' },
      { title: 'Holocene', artist: 'Bon Iver', genre: 'Indie Folk' },
    ],
    focus: [
      { title: 'Metamorphosis Two', artist: 'Philip Glass', genre: 'Classical/Minimalist' },
      { title: 'Avril 14th', artist: 'Aphex Twin', genre: 'Electronic/Ambient' },
      { title: 'Music for Airports', artist: 'Brian Eno', genre: 'Ambient' },
      { title: 'In a Time Lapse', artist: 'Ludovico Einaudi', genre: 'Neoclassical' },
      { title: 'Gymnopédie No. 1', artist: 'Erik Satie', genre: 'Classical' },
    ],
    workout: [
      { title: 'Till I Collapse', artist: 'Eminem', genre: 'Hip-Hop' },
      { title: 'Stronger', artist: 'Kanye West', genre: 'Hip-Hop' },
      { title: 'Work Out', artist: 'J. Cole', genre: 'Hip-Hop' },
      { title: 'Bangarang', artist: 'Skrillex', genre: 'Dubstep' },
      { title: 'Lose Yourself', artist: 'Eminem', genre: 'Hip-Hop' },
    ],
    romantic: [
      { title: 'All of Me', artist: 'John Legend', genre: 'Pop/R&B' },
      { title: 'Perfect', artist: 'Ed Sheeran', genre: 'Pop' },
      { title: 'At Last', artist: 'Etta James', genre: 'Jazz/Blues' },
      { title: 'La Vie En Rose', artist: 'Édith Piaf', genre: 'Chanson' },
      { title: 'Make You Feel My Love', artist: 'Bob Dylan', genre: 'Folk' },
    ],
    chill: [
      { title: 'Sunset Lover', artist: 'Petit Biscuit', genre: 'Electronic/Chill' },
      { title: 'Tycho - A Walk', artist: 'Tycho', genre: 'Ambient/Electronic' },
      { title: 'Odesza - Say My Name', artist: 'ODESZA', genre: 'Electronic/Chill' },
      { title: 'Bonobo - Kiara', artist: 'Bonobo', genre: 'Downtempo' },
      { title: 'Emancipator - Soon It Will Be Cold Enough', artist: 'Emancipator', genre: 'Trip-Hop' },
    ]
  };

  // Generic popular tracks for various genres
  const genreTracks = {
    pop: [
      { title: 'As It Was', artist: 'Harry Styles', genre: 'Pop' },
      { title: 'Anti-Hero', artist: 'Taylor Swift', genre: 'Pop' },
      { title: 'Flowers', artist: 'Miley Cyrus', genre: 'Pop' },
      { title: 'Unholy', artist: 'Sam Smith ft. Kim Petras', genre: 'Pop' },
    ],
    rock: [
      { title: 'Bohemian Rhapsody', artist: 'Queen', genre: 'Rock' },
      { title: 'Stairway to Heaven', artist: 'Led Zeppelin', genre: 'Rock' },
      { title: 'Hotel California', artist: 'Eagles', genre: 'Rock' },
      { title: 'Sweet Child O\' Mine', artist: 'Guns N\' Roses', genre: 'Rock' },
    ],
    jazz: [
      { title: 'Take Five', artist: 'Dave Brubeck Quartet', genre: 'Jazz' },
      { title: 'Kind of Blue', artist: 'Miles Davis', genre: 'Jazz' },
      { title: 'What a Wonderful World', artist: 'Louis Armstrong', genre: 'Jazz' },
      { title: 'Blue in Green', artist: 'Bill Evans', genre: 'Jazz' },
    ],
    electronic: [
      { title: 'Strobe', artist: 'Deadmau5', genre: 'Progressive House' },
      { title: 'Midnight City', artist: 'M83', genre: 'Synthwave' },
      { title: 'One More Time', artist: 'Daft Punk', genre: 'House' },
      { title: 'Scary Monsters and Nice Sprites', artist: 'Skrillex', genre: 'Dubstep' },
    ]
  };

  let tracks = [];
  
  // Add mood-based tracks
  if (mood && moodTracks[mood]) {
    tracks.push(...moodTracks[mood]);
  }
  
  // Add genre-based tracks
  if (genre && genreTracks[genre.toLowerCase()]) {
    tracks.push(...genreTracks[genre.toLowerCase()]);
  }
  
  // If no specific tracks found, use popular general tracks
  if (tracks.length === 0) {
    tracks = [
      { title: 'Blinding Lights', artist: 'The Weeknd', genre: 'Pop/Synthwave' },
      { title: 'Shape of You', artist: 'Ed Sheeran', genre: 'Pop' },
      { title: 'Billie Jean', artist: 'Michael Jackson', genre: 'Pop' },
      { title: 'Hey Jude', artist: 'The Beatles', genre: 'Rock/Pop' },
      { title: 'Imagine', artist: 'John Lennon', genre: 'Rock' },
      { title: 'Respect', artist: 'Aretha Franklin', genre: 'Soul/R&B' },
      { title: 'Like a Rolling Stone', artist: 'Bob Dylan', genre: 'Folk Rock' },
      { title: 'I Want to Hold Your Hand', artist: 'The Beatles', genre: 'Pop/Rock' },
    ];
  }
  
  // Shuffle and limit to requested count
  const shuffled = tracks.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function generatePlaylistName(mood, genre, artist) {
  if (mood && genre) {
    return `${mood.charAt(0).toUpperCase() + mood.slice(1)} ${genre.charAt(0).toUpperCase() + genre.slice(1)} Vibes`;
  }
  if (mood) {
    return `${mood.charAt(0).toUpperCase() + mood.slice(1)} Mood Playlist`;
  }
  if (genre) {
    return `${genre.charAt(0).toUpperCase() + genre.slice(1)} Essentials`;
  }
  if (artist) {
    return `Similar to ${artist}`;
  }
  return 'Personalized Music Recommendations';
}