require('dotenv').config();
const SpotifyWebApi = require('spotify-web-api-node');

// Define constants for playlist IDs to avoid duplication errors
const RAP_CAVIAR_ID = '37i9dQZF1DX0XUsuxWHRQd'; // RapCaviar
const TOP_HITS_ID = '37i9dQZF1DXcBWIGoYBM5M'; // Today's Top Hits

const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

// Default country code for content availability
const DEFAULT_MARKET = 'US'; 
let tokenExpirationEpoch;

// Debug flag to temporarily bypass preview_url filtering
const BYPASS_PREVIEW_CHECK = true;

async function getAccessToken() {
    if (!tokenExpirationEpoch || tokenExpirationEpoch < (Date.now() / 1000)) {
        console.log('Fetching new Spotify access token...');
        try {
            const data = await spotifyApi.clientCredentialsGrant();
            console.log('Token grant response:', JSON.stringify(data.body, null, 2));
            spotifyApi.setAccessToken(data.body['access_token']);
            tokenExpirationEpoch = (Date.now() / 1000) + data.body['expires_in'] - 300;
            console.log('New Spotify access token obtained, expires at:', new Date(tokenExpirationEpoch * 1000));
            console.log('Access token (first few chars):', data.body['access_token'].substring(0, 10) + '...');
        } catch (error) {
            console.error('Error getting access token from Spotify:', JSON.stringify(error, null, 2));
            throw error;
        }
    }
}

// APPROACH 1: Get recommendations based on genre seeds (now first in our strategy)
async function getRecommendationsByGenre(genres = ['hip-hop', 'rap'], market = DEFAULT_MARKET, limit = 50) {
    await getAccessToken();
    try {
        console.log(`Getting recommendations for genres: ${genres.join(', ')} in market: ${market}`);
        const data = await spotifyApi.getRecommendations({
            seed_genres: genres,
            limit: limit,
            market: market
        });

        console.log(`Got ${data.body.tracks.length} raw tracks from recommendations before filtering.`);
        
        // Apply filter conditionally
        let tracks;
        if (BYPASS_PREVIEW_CHECK) {
            tracks = data.body.tracks.map(track => ({
                id: track.id,
                title: track.name,
                artist: track.artists.map(artist => artist.name).join(', '),
                previewUrl: track.preview_url || null, // Accept null preview URLs
                albumArt: track.album.images.length > 0 ? track.album.images[0].url : null,
            }));
            console.log(`Including ALL ${tracks.length} tracks from recommendations, even without preview URLs.`);
        } else {
            tracks = data.body.tracks
                .filter(track => track.preview_url)
                .map(track => ({
                    id: track.id,
                    title: track.name,
                    artist: track.artists.map(artist => artist.name).join(', '),
                    previewUrl: track.preview_url,
                    albumArt: track.album.images.length > 0 ? track.album.images[0].url : null,
                }));
            console.log(`Got ${tracks.length} playable tracks (with preview URLs) from recommendations.`);
        }
        
        return tracks;
    } catch (error) {
        console.error('Error getting recommendations from Spotify:', JSON.stringify(error, null, 2));
        return [];
    }
}

// APPROACH 2: Get tracks from a playlist (with market parameter)
async function getRapPlaylistTracks(playlistId, market = DEFAULT_MARKET) {
    await getAccessToken();
    try {
        console.log(`Fetching tracks from playlist ID: ${playlistId} for market: ${market}`);
        const data = await spotifyApi.getPlaylistTracks(playlistId, {
            fields: 'items(track(id,name,artists(name),preview_url,album(images)))',
            limit: 50,
            market: market
        });

        console.log(`Got ${data.body.items.length} raw tracks from playlist before filtering.`);
        
        // Apply filter conditionally
        let tracks;
        if (BYPASS_PREVIEW_CHECK) {
            tracks = data.body.items
                .map(item => item.track)
                .filter(track => track) // Ensure track exists, but don't filter on preview_url
                .map(track => ({
                    id: track.id,
                    title: track.name,
                    artist: track.artists.map(artist => artist.name).join(', '),
                    previewUrl: track.preview_url || null, // Accept null preview URLs
                    albumArt: track.album.images.length > 0 ? track.album.images[0].url : null,
                }));
            console.log(`Including ALL ${tracks.length} tracks from playlist, even without preview URLs.`);
        } else {
            tracks = data.body.items
                .map(item => item.track)
                .filter(track => track && track.preview_url)
                .map(track => ({
                    id: track.id,
                    title: track.name,
                    artist: track.artists.map(artist => artist.name).join(', '),
                    previewUrl: track.preview_url,
                    albumArt: track.album.images.length > 0 ? track.album.images[0].url : null,
                }));
            console.log(`Got ${tracks.length} playable tracks (with preview URLs) from playlist.`);
        }
        
        return tracks;
    } catch (error) {
        console.error('Error fetching playlist tracks from Spotify:', JSON.stringify(error, null, 2));
        return [];
    }
}

// APPROACH 3: Search for tracks by genre
async function searchTracksByGenre(genre = 'hip hop', market = DEFAULT_MARKET, limit = 50) {
    await getAccessToken();
    try {
        console.log(`Searching for "${genre}" tracks in market: ${market}`);
        const data = await spotifyApi.searchTracks(`genre:${genre}`, {
            limit: limit,
            market: market
        });

        console.log(`Got ${data.body.tracks.items.length} raw tracks from search before filtering.`);
        
        // Apply filter conditionally
        let tracks;
        if (BYPASS_PREVIEW_CHECK) {
            tracks = data.body.tracks.items.map(track => ({
                id: track.id,
                title: track.name,
                artist: track.artists.map(artist => artist.name).join(', '),
                previewUrl: track.preview_url || null, // Accept null preview URLs
                albumArt: track.album.images.length > 0 ? track.album.images[0].url : null,
            }));
            console.log(`Including ALL ${tracks.length} tracks from search, even without preview URLs.`);
        } else {
            tracks = data.body.tracks.items
                .filter(track => track.preview_url)
                .map(track => ({
                    id: track.id,
                    title: track.name,
                    artist: track.artists.map(artist => artist.name).join(', '),
                    previewUrl: track.preview_url,
                    albumArt: track.album.images.length > 0 ? track.album.images[0].url : null,
                }));
            console.log(`Got ${tracks.length} playable tracks (with preview URLs) from search.`);
        }
        
        return tracks;
    } catch (error) {
        console.error(`Error searching for ${genre} tracks:`, JSON.stringify(error, null, 2));
        return [];
    }
}

// APPROACH 4: Get featured playlists and fetch tracks from them
async function getTracksFromFeaturedPlaylists(market = DEFAULT_MARKET, limit = 2) {
    await getAccessToken();
    try {
        console.log(`Getting featured playlists in market: ${market}`);
        const featuredPlaylistsData = await spotifyApi.getFeaturedPlaylists({
            limit: limit,
            market: market
        });
        
        let allTracks = [];
        
        if (featuredPlaylistsData.body.playlists && featuredPlaylistsData.body.playlists.items.length > 0) {
            console.log(`Found ${featuredPlaylistsData.body.playlists.items.length} featured playlists.`);
            
            for (const playlist of featuredPlaylistsData.body.playlists.items) {
                console.log(`Fetching tracks from featured playlist: ${playlist.name} (${playlist.id})`);
                try {
                    const tracksData = await spotifyApi.getPlaylistTracks(playlist.id, {
                        fields: 'items(track(id,name,artists(name),preview_url,album(images)))',
                        limit: 20,
                        market: market
                    });
                    
                    console.log(`Got ${tracksData.body.items.length} raw tracks from featured playlist before filtering.`);
                    
                    // Apply filter conditionally
                    let playlistTracks;
                    if (BYPASS_PREVIEW_CHECK) {
                        playlistTracks = tracksData.body.items
                            .map(item => item.track)
                            .filter(track => track) // Ensure track exists, but don't filter on preview_url
                            .map(track => ({
                                id: track.id,
                                title: track.name,
                                artist: track.artists.map(artist => artist.name).join(', '),
                                previewUrl: track.preview_url || null, // Accept null preview URLs
                                albumArt: track.album.images.length > 0 ? track.album.images[0].url : null,
                            }));
                    } else {
                        playlistTracks = tracksData.body.items
                            .map(item => item.track)
                            .filter(track => track && track.preview_url)
                            .map(track => ({
                                id: track.id,
                                title: track.name,
                                artist: track.artists.map(artist => artist.name).join(', '),
                                previewUrl: track.preview_url,
                                albumArt: track.album.images.length > 0 ? track.album.images[0].url : null,
                            }));
                    }
                    
                    allTracks = [...allTracks, ...playlistTracks];
                    console.log(`Added ${playlistTracks.length} tracks from this playlist. Total tracks now: ${allTracks.length}`);
                } catch (error) {
                    console.error(`Error fetching tracks from playlist ${playlist.id}:`, JSON.stringify(error, null, 2));
                    // Continue with the next playlist
                }
            }
        }
        
        console.log(`Fetched a total of ${allTracks.length} tracks from featured playlists.`);
        return allTracks;
    } catch (error) {
        console.error('Error fetching featured playlists from Spotify:', JSON.stringify(error, null, 2));
        return [];
    }
}

// Get a random song using all available methods as fallbacks
async function getRandomSong() {
    // Try all approaches in sequence until one works
    console.log("Attempting to get a random song...");
    
    // 1. Try recommendations first (likely to have preview URLs)
    let tracks = await getRecommendationsByGenre(['hip-hop', 'rap'], DEFAULT_MARKET);
    
    // 2. If no tracks, try from RapCaviar playlist
    if (tracks.length === 0) {
        console.log("No tracks from recommendations, trying RapCaviar playlist...");
        tracks = await getRapPlaylistTracks(RAP_CAVIAR_ID, DEFAULT_MARKET);
    }
    
    // 3. If still no tracks, try from Today's Top Hits
    if (tracks.length === 0) {
        console.log("No tracks from RapCaviar, trying Today's Top Hits...");
        tracks = await getRapPlaylistTracks(TOP_HITS_ID, DEFAULT_MARKET);
    }
    
    // 4. If still no tracks, try search
    if (tracks.length === 0) {
        console.log("No tracks from playlists, trying search...");
        tracks = await searchTracksByGenre('hip hop', DEFAULT_MARKET);
    }
    
    // 5. Last resort: featured playlists
    if (tracks.length === 0) {
        console.log("No tracks from search, trying featured playlists...");
        tracks = await getTracksFromFeaturedPlaylists(DEFAULT_MARKET);
    }
    
    // Final check
    if (tracks.length === 0) {
        console.error("Failed to get any tracks from all approaches.");
        return null;
    }
    
    console.log(`Found ${tracks.length} total tracks to choose from.`);
    
    // Get tracks with preview URLs if we want to play snippets
    const tracksWithPreviews = tracks.filter(track => track.previewUrl);
    console.log(`Of these, ${tracksWithPreviews.length} tracks have preview URLs.`);
    
    // If we have tracks with previews, prioritize those; otherwise use any track
    const availableTracks = tracksWithPreviews.length > 0 ? tracksWithPreviews : tracks;
    
    // Pick a random track
    const randomIndex = Math.floor(Math.random() * availableTracks.length);
    const randomTrack = availableTracks[randomIndex];
    console.log("Selected random song:", randomTrack.title, "-", randomTrack.artist);
    console.log("Preview URL available:", randomTrack.previewUrl ? "Yes" : "No");
    
    return randomTrack;
}

// Get all songs for autocomplete
async function getAllSongsForAutocomplete() {
    // Combine results from multiple sources for a robust list
    let allTracks = [];
    
    // Try to get tracks from each source
    const recommendedTracks = await getRecommendationsByGenre(['hip-hop'], DEFAULT_MARKET, 30);
    const playlistTracks = await getRapPlaylistTracks(RAP_CAVIAR_ID, DEFAULT_MARKET);
    const searchTracks = await searchTracksByGenre('rap', DEFAULT_MARKET, 30);
    
    // Combine all unique tracks by ID
    const trackMap = new Map();
    
    [...recommendedTracks, ...playlistTracks, ...searchTracks].forEach(track => {
        if (!trackMap.has(track.id)) {
            trackMap.set(track.id, track);
        }
    });
    
    allTracks = Array.from(trackMap.values());
    console.log(`Compiled ${allTracks.length} unique tracks for autocomplete.`);
    
    return allTracks;
}

module.exports = {
    getRandomSong,
    getAllSongsForAutocomplete,
    getRapPlaylistTracks,
    searchTracksByGenre,
    getRecommendationsByGenre
}; 