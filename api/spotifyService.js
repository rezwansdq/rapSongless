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
async function searchTracksForAutocomplete(query, limit = 10, market = 'US', _isRetry = false) {
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
    if (error.statusCode === 401 && !_isRetry) {
        console.log('SpotifyService: Attempting token refresh (401) during autocomplete search.');
        await refreshSpotifyToken();
        console.log('SpotifyService: Retrying autocomplete search after token refresh.');
        return searchTracksForAutocomplete(query, limit, market, true); // Retry the call
    }
    console.error('SpotifyService: Error searching tracks for autocomplete:', query, 'Error:', error.message);
    throw error;
  }
}

// Function to find a popular track by a given artist
async function findPopularTrackByArtist(artistName, options = {}, _isRetry = false) {
  // Use minPopularity from options, default to 0 if not provided or invalid
  let minPopularity = parseInt(options.minPopularity, 10);
  if (isNaN(minPopularity) || minPopularity < 0 || minPopularity > 100) {
    minPopularity = 0; // Default to no minimum if invalid, or set a sensible default like 30-50 if preferred
  }
  const { searchLimit = 50, market = 'US' } = options;

  try {
    const apiClient = await getSpotifyApiClient();
    const query = `artist:${artistName}`;
    const searchData = await apiClient.searchTracks(query, { limit: searchLimit, market });

    if (searchData.body.tracks && searchData.body.tracks.items.length > 0) {
      let allArtistTracks = searchData.body.tracks.items;

      // Filter by minPopularity if specified and greater than 0
      if (minPopularity > 0) {
        allArtistTracks = allArtistTracks.filter(track => track.popularity >= minPopularity);
      }

      if (allArtistTracks.length === 0) {
        console.log(`SpotifyService: No tracks by ${artistName} found after popularity filter (minPopularity: ${minPopularity}). Search limit: ${searchLimit}`);
        return null;
      }

      // Prioritize tracks with a preview_url
      const tracksWithPreview = allArtistTracks.filter(track => track.preview_url);

      let chosenTrack = null; // Initialize chosenTrack to null

      if (tracksWithPreview.length > 0) {
        const randomIndex = Math.floor(Math.random() * tracksWithPreview.length);
        chosenTrack = tracksWithPreview[randomIndex];
        console.log(`SpotifyService: Selected track for ${artistName} (with preview_url, popularity >= ${minPopularity}): ${chosenTrack.name}`);
      } else {
        console.log(`SpotifyService: No tracks by ${artistName} found with a direct Spotify preview_url (after popularity filter).`);
        // Fallback: Pick any track from the filtered list (allArtistTracks)
        // This list has already been filtered by popularity if minPopularity > 0
        if (allArtistTracks.length > 0) {
            const randomIndex = Math.floor(Math.random() * allArtistTracks.length);
            chosenTrack = allArtistTracks[randomIndex];
            console.log(`SpotifyService: Fallback - selected track for ${artistName} (may not have Spotify preview_url, popularity >= ${minPopularity}): ${chosenTrack.name}`);
        }
      }

      if (chosenTrack) {
        return {
          id: chosenTrack.id,
          title: chosenTrack.name,
          artist: chosenTrack.artists[0] ? chosenTrack.artists[0].name : 'Unknown Artist',
          albumArt: getLargestAlbumArt(chosenTrack.album.images),
          // preview_url: chosenTrack.preview_url // IMPORTANT: Do not include preview_url here as it might be null
        };
      }
    }
    // This log means no tracks were returned by Spotify's searchTracks API for the artist at all.
    console.log(`SpotifyService: No tracks found at all for artist query - ${artistName} (limit: ${searchLimit}, market: ${market})`);
    return null;
  } catch (error) {
    if (error.statusCode === 401 && !_isRetry) {
      console.log('SpotifyService: Attempting token refresh (401) during popular track search.');
      await refreshSpotifyToken();
      console.log('SpotifyService: Retrying popular track search after token refresh.');
      return findPopularTrackByArtist(artistName, options, true); // Retry the call
    }
    console.error(`SpotifyService: Error finding popular track for artist ${artistName}:`, error.message);
    throw error;
  }
}

module.exports = {
  getSpotifyApiClient, // Renamed for clarity
  searchTracksForAutocomplete,
  findPopularTrackByArtist,
  refreshSpotifyToken
}; 