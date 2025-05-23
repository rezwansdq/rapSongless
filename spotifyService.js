require('dotenv').config();
// No longer need to create a new SpotifyWebApi instance here, it will be passed from server.js
// const SpotifyWebApi = require('spotify-web-api-node');

// Constants for playlist IDs and market remain useful
const RAP_CAVIAR_ID = '37i9dQZF1DX0XUsuxWHRQd';
const TOP_HITS_ID = '37i9dQZF1DXcBWIGoYBM5M';
const DEFAULT_MARKET = 'US';

// Removed BYPASS_PREVIEW_CHECK as we expect previews with user auth

// Token refresh mechanism
// The spotifyApi instance passed to functions will have getAccessToken, getRefreshToken, setAccessToken, setRefreshToken methods.
async function ensureToken(spotifyApiInstance) {
    if (!spotifyApiInstance.getAccessToken()) {
        console.log('SpotifyService: No access token set on the API instance.');
        // This case should ideally be handled by redirecting the user to /login
        // For now, we'll let operations fail, server.js will catch and suggest login.
        throw new Error('No token provided. User may need to log in.');
    }

    // Check if the token is expired or close to expiring (e.g., within the next 60 seconds)
    // The spotify-web-api-node library doesn't directly expose expiration time of the current token in a simple way after it's set.
    // We rely on the refresh token being available and attempt refresh if a request fails with an auth error (401).
    // A more proactive approach would involve storing tokenExpirationEpoch alongside cookies if possible, or decoding the JWT (if applicable).
    // For this example, we'll make refresh more reactive or assume server.js middleware handles basic presence.
    // A robust ensureToken would ideally check expiration. The library itself might handle some of this if calls fail.
    // The user-provided example had a ensureToken that checked spotifyApi.getAccessTokenExpiration() < now + 60
    // However, spotify-web-api-node doesn't have a getAccessTokenExpiration() method directly on the main instance.
    // We will rely on attempting the API call and refreshing if it fails due to token expiration.
    // This is a common pattern: try, and if auth error, refresh and retry.
}

// Helper function to make an API call with automatic token refresh
async function makeApiCall(spotifyApiInstance, apiFunction) {
    await ensureToken(spotifyApiInstance); // Basic check for token presence
    try {
        return await apiFunction();
    } catch (error) {
        // Check if error is due to expired token (e.g., 401 status code)
        if (error.statusCode === 401 && spotifyApiInstance.getRefreshToken()) {
            console.log('Spotify token expired or invalid, attempting to refresh...');
            try {
                const data = await spotifyApiInstance.refreshAccessToken();
                spotifyApiInstance.setAccessToken(data.body['access_token']);
                console.log('Spotify token refreshed successfully.');
                // Update cookie on server.js side would be ideal here if new token is different and has new expiry.
                // For now, the instance is updated. We might need to pass back the new token/expiry to server.js to update cookies.
                // server.js would need a way to update cookies without a full redirect.
                
                // Retry the original API function with the new token
                return await apiFunction();
            } catch (refreshError) {
                console.error('Error refreshing Spotify token:', JSON.stringify(refreshError, null, 2));
                // If refresh fails, user might need to log in again.
                throw new Error('Failed to refresh token. Please log in again.');
            }
        } else {
            // Re-throw other errors
            throw error;
        }
    }
}

// --- Modified API functions to use the passed spotifyApi instance and makeApiCall wrapper ---

async function getRecommendationsByGenre(spotifyApiInstance, genres = ['hip-hop', 'rap'], market = DEFAULT_MARKET, limit = 50) {
    return makeApiCall(spotifyApiInstance, async () => {
        console.log(`Getting recommendations for genres: ${genres.join(', ')} in market: ${market}`);
        const data = await spotifyApiInstance.getRecommendations({
            seed_genres: genres,
            limit: limit,
            market: market
        });
        console.log(`Got ${data.body.tracks.length} raw tracks from recommendations.`);
        const tracks = data.body.tracks
            .filter(track => track.preview_url) // Now we strictly filter for preview_url
            .map(track => ({
                id: track.id,
                title: track.name,
                artist: track.artists.map(artist => artist.name).join(', '),
                previewUrl: track.preview_url,
                albumArt: track.album.images.length > 0 ? track.album.images[0].url : null,
            }));
        console.log(`Got ${tracks.length} playable tracks (with preview URLs) from recommendations.`);
        return tracks;
    });
}

async function getRapPlaylistTracks(spotifyApiInstance, playlistId, market = DEFAULT_MARKET) {
    return makeApiCall(spotifyApiInstance, async () => {
        console.log(`Fetching tracks from playlist ID: ${playlistId} for market: ${market}`);
        const data = await spotifyApiInstance.getPlaylistTracks(playlistId, {
            fields: 'items(track(id,name,artists(name),preview_url,album(images)))',
            limit: 50,
            market: market
        });
        console.log(`Got ${data.body.items.length} raw tracks from playlist.`);
        const tracks = data.body.items
            .map(item => item.track)
            .filter(track => track && track.preview_url) // Strictly filter
            .map(track => ({
                id: track.id,
                title: track.name,
                artist: track.artists.map(artist => artist.name).join(', '),
                previewUrl: track.preview_url,
                albumArt: track.album.images.length > 0 ? track.album.images[0].url : null,
            }));
        console.log(`Got ${tracks.length} playable tracks (with preview URLs) from playlist.`);
        return tracks;
    });
}

async function searchTracksByGenre(spotifyApiInstance, genre = 'hip hop', market = DEFAULT_MARKET, limit = 50) {
    return makeApiCall(spotifyApiInstance, async () => {
        console.log(`Searching for "${genre}" tracks in market: ${market}`);
        // Using the user-provided example: searchTracks(`track:${query}`)
        // Let's adapt to search for genre, but also provide a query structure if needed.
        // For a general genre search, `genre:${genre}` is good.
        // If we want tracks *named* 'hip hop', it would be `track:hip hop`.
        // Assuming we want tracks *of the genre* hip hop:
        const data = await spotifyApiInstance.searchTracks(`genre:${genre}`, {
            limit: limit,
            market: market
        });
        console.log(`Got ${data.body.tracks.items.length} raw tracks from search.`);
        const tracks = data.body.tracks.items
            .filter(track => track.preview_url) // Strictly filter
            .map(track => ({
                id: track.id,
                title: track.name,
                artist: track.artists.map(artist => artist.name).join(', '),
                previewUrl: track.preview_url,
                albumArt: track.album.images.length > 0 ? track.album.images[0].url : null,
            }));
        console.log(`Got ${tracks.length} playable tracks (with preview URLs) from search.`);
        return tracks;
    });
}

async function getTracksFromFeaturedPlaylists(spotifyApiInstance, market = DEFAULT_MARKET, limit = 2) {
    return makeApiCall(spotifyApiInstance, async () => {
        console.log(`Getting featured playlists in market: ${market}`);
        const featuredPlaylistsData = await spotifyApiInstance.getFeaturedPlaylists({
            limit: limit, // Limit number of playlists to fetch
            market: market
        });
        let allTracks = [];
        if (featuredPlaylistsData.body.playlists && featuredPlaylistsData.body.playlists.items.length > 0) {
            for (const playlist of featuredPlaylistsData.body.playlists.items) {
                console.log(`Fetching tracks from featured playlist: ${playlist.name} (${playlist.id})`);
                const tracksData = await spotifyApiInstance.getPlaylistTracks(playlist.id, {
                    fields: 'items(track(id,name,artists(name),preview_url,album(images)))',
                    limit: 20, // Limit tracks per playlist
                    market: market
                });
                const playlistTracks = tracksData.body.items
                    .map(item => item.track)
                    .filter(track => track && track.preview_url) // Strictly filter
                    .map(track => ({
                        id: track.id,
                        title: track.name,
                        artist: track.artists.map(artist => artist.name).join(', '),
                        previewUrl: track.preview_url,
                        albumArt: track.album.images.length > 0 ? track.album.images[0].url : null,
                    }));
                allTracks = [...allTracks, ...playlistTracks];
            }
        }
        console.log(`Fetched a total of ${allTracks.length} playable tracks from featured playlists.`);
        return allTracks;
    });
}


async function getRandomSong(spotifyApiInstance) {
    console.log("SpotifyService: Attempting to get a random song using user token...");
    let tracks = [];
    try {
        tracks = await getRecommendationsByGenre(spotifyApiInstance, ['hip-hop', 'rap']);
        if (tracks.length === 0) {
            console.log("No tracks from recommendations, trying RapCaviar playlist...");
            tracks = await getRapPlaylistTracks(spotifyApiInstance, RAP_CAVIAR_ID);
        }
        if (tracks.length === 0) {
            console.log("No tracks from RapCaviar, trying Today's Top Hits...");
            tracks = await getRapPlaylistTracks(spotifyApiInstance, TOP_HITS_ID);
        }
        if (tracks.length === 0) {
            console.log("No tracks from playlists, trying search...");
            tracks = await searchTracksByGenre(spotifyApiInstance, 'hip hop');
        }
        if (tracks.length === 0) {
            console.log("No tracks from search, trying featured playlists...");
            tracks = await getTracksFromFeaturedPlaylists(spotifyApiInstance);
        }

        if (tracks.length === 0) {
            console.error("SpotifyService: Failed to get any tracks with preview_url from all approaches.");
            return null;
        }

        const randomIndex = Math.floor(Math.random() * tracks.length);
        const randomTrack = tracks[randomIndex];
        console.log("SpotifyService: Selected random song:", randomTrack.title, "-", randomTrack.artist);
        console.log("SpotifyService: Preview URL:", randomTrack.previewUrl);
        console.log("SpotifyService: Album Art URL:", randomTrack.albumArt);
        return randomTrack;
    } catch (error) {
        console.error("SpotifyService: Error in getRandomSong:", JSON.stringify(error, null, 2));
        if (error.message && error.message.includes('No token provided')) {
            throw error; // Re-throw for server.js to handle redirect
        }
        // For other errors, return null or throw a more generic error
        return null; 
    }
}

async function getAllSongsForAutocomplete(spotifyApiInstance) {
    console.log("SpotifyService: Fetching all songs for autocomplete using user token...");
    let allTracks = [];
    try {
        const recommendedTracks = await getRecommendationsByGenre(spotifyApiInstance, ['hip-hop'], DEFAULT_MARKET, 30);
        const playlistTracks = await getRapPlaylistTracks(spotifyApiInstance, RAP_CAVIAR_ID);
        const searchTracks = await searchTracksByGenre(spotifyApiInstance, 'rap', DEFAULT_MARKET, 30);

        const trackMap = new Map();
        [...recommendedTracks, ...playlistTracks, ...searchTracks].forEach(track => {
            if (track && track.id && !trackMap.has(track.id)) { // Ensure track and track.id exist
                trackMap.set(track.id, track);
            }
        });
        allTracks = Array.from(trackMap.values());
        console.log(`SpotifyService: Compiled ${allTracks.length} unique tracks (with previews) for autocomplete.`);
        return allTracks;
    } catch (error) {
        console.error("SpotifyService: Error in getAllSongsForAutocomplete:", JSON.stringify(error, null, 2));
        if (error.message && error.message.includes('No token provided')) {
            throw error; // Re-throw for server.js to handle redirect
        }
        return []; // Return empty for other errors
    }
}

module.exports = {
    getRandomSong,
    getAllSongsForAutocomplete,
    // Exposing these might be useful for direct calls if ever needed, but ensure they use makeApiCall or similar
    // getRapPlaylistTracks, 
    // searchTracksByGenre,
    // getRecommendationsByGenre
}; 