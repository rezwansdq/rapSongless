require('dotenv').config();
const SpotifyWebApi = require('spotify-web-api-node');

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

let tokenExpirationEpoch;

async function refreshSpotifyToken() {
  console.log('SpotifyService: Refreshing access token...');
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body['access_token']);
    tokenExpirationEpoch = Date.now() + data.body['expires_in'] * 1000 - 60000; // Refresh 1 min before expiry
    console.log('SpotifyService: Access token refreshed. Expires:', new Date(tokenExpirationEpoch));
  } catch (error) {
    console.error('SpotifyService: Error refreshing access token:', error.message);
    throw error;
  }
}

async function getSpotifyApiClient() {
  if (!tokenExpirationEpoch || tokenExpirationEpoch < Date.now()) {
    await refreshSpotifyToken();
  }
  return spotifyApi;
}

// Helper to get the largest album art
function getLargestAlbumArt(images) {
  if (!images || images.length === 0) return null;
  return images.sort((a, b) => b.width - a.width)[0].url;
}

// Function to search tracks for autocomplete (Spotify only)
async function searchTracksForAutocomplete(query, limit = 10, market = 'US') {
  try {
    const apiClient = await getSpotifyApiClient();
    // Query format for artist and track: "artist:ArtistName track:TrackName" or just "TrackName" or "ArtistName"
    const searchData = await apiClient.searchTracks(query, { limit, market });

    if (searchData.body.tracks && searchData.body.tracks.items.length > 0) {
      return searchData.body.tracks.items.map(track => ({
        id: track.id,
        title: track.name,
        artist: track.artists[0] ? track.artists[0].name : 'Unknown Artist',
        albumArt: getLargestAlbumArt(track.album.images), // Get largest available
        popularity: track.popularity // Include popularity for potential client-side sorting/filtering
      }));
    }
    console.log('SpotifyService: No tracks found for autocomplete query -', query);
    return [];
  } catch (error) {
    console.error('SpotifyService: Error searching tracks for autocomplete:', query, 'Error:', error.message);
    if (error.statusCode === 401) {
        console.log('SpotifyService: Attempting token refresh due to 401 error during autocomplete search.');
        await refreshSpotifyToken();
        // Optionally, retry the search here once
    }
    throw error;
  }
}

// Function to find a popular track by a given artist
async function findPopularTrackByArtist(artistName, options = {}) {
  const { searchLimit = 50, market = 'US' } = options;
  try {
    const apiClient = await getSpotifyApiClient();
    const query = `artist:${artistName}`;
    const searchData = await apiClient.searchTracks(query, { limit: searchLimit, market });

    if (searchData.body.tracks && searchData.body.tracks.items.length > 0) {
      const tracks = searchData.body.tracks.items;
      const popularTracks = tracks.filter(track => track.preview_url);

      if (popularTracks.length > 0) {
        const randomIndex = Math.floor(Math.random() * popularTracks.length);
        const chosenTrack = popularTracks[randomIndex];
        console.log(`SpotifyService: Selected popular track for ${artistName}: ${chosenTrack.name}`);
        return {
          id: chosenTrack.id,
          title: chosenTrack.name,
          artist: chosenTrack.artists[0] ? chosenTrack.artists[0].name : 'Unknown Artist',
          albumArt: getLargestAlbumArt(chosenTrack.album.images),
          // Note: Spotify's preview_url is also available here if we want to use it as a direct fallback
          // preview_url: chosenTrack.preview_url 
        };
      }
      console.log(`SpotifyService: No tracks by ${artistName} found with a preview_url.`);
      // Optional: Fallback to any track by the artist if no popular ones found
      if(tracks.length > 0 && tracks[0].preview_url){
        const fallbackTrack = tracks[0]; // Or a random one from all tracks
        console.log(`SpotifyService: Fallback - selected first available track by ${artistName}: ${fallbackTrack.name}`);
        return {
            id: fallbackTrack.id,
            title: fallbackTrack.name,
            artist: fallbackTrack.artists[0] ? fallbackTrack.artists[0].name : 'Unknown Artist',
            albumArt: getLargestAlbumArt(fallbackTrack.album.images),
        };
      }
    }
    console.log(`SpotifyService: No tracks found for artist query - ${artistName}`);
    return null;
  } catch (error) {
    console.error(`SpotifyService: Error finding popular track for artist ${artistName}:`, error.message);
    if (error.statusCode === 401) {
      console.log('SpotifyService: Attempting token refresh due to 401 error.');
      await refreshSpotifyToken();
    }
    throw error;
  }
}

module.exports = {
  getSpotifyApiClient, // Renamed for clarity
  searchTracksForAutocomplete,
  findPopularTrackByArtist,
  refreshSpotifyToken
}; 