require('dotenv').config();
const SpotifyWebApi = require('spotify-web-api-node');

const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

// Default country code for content availability
const DEFAULT_MARKET = 'US'; 
let tokenExpirationEpoch;

async function getAccessToken() {
    if (!tokenExpirationEpoch || tokenExpirationEpoch < (Date.now() / 1000)) {
        console.log('Fetching new Spotify access token...');
        try {
            const data = await spotifyApi.clientCredentialsGrant();
            spotifyApi.setAccessToken(data.body['access_token']);
            tokenExpirationEpoch = (Date.now() / 1000) + data.body['expires_in'] - 300;
            console.log('New Spotify access token obtained, expires at:', new Date(tokenExpirationEpoch * 1000));
        } catch (error) {
            console.error('Error getting access token from Spotify:', error.message || error);
            throw error;
        }
    }
}

// APPROACH 1: Get tracks from a playlist (with market parameter)
async function getRapPlaylistTracks(playlistId = '37i9dQZF1DXcBWIGoYBM5M', market = DEFAULT_MARKET) {
    await getAccessToken();
    try {
        console.log(`Fetching tracks from playlist ID: ${playlistId} for market: ${market}`);
        const data = await spotifyApi.getPlaylistTracks(playlistId, {
            fields: 'items(track(id,name,artists(name),preview_url,album(images)))',
            limit: 50,
            market: market
        });

        const tracks = data.body.items
            .map(item => item.track)
            .filter(track => track && track.preview_url)
            .map(track => ({
                id: track.id,
                title: track.name,
                artist: track.artists.map(artist => artist.name).join(', '),
                previewUrl: track.preview_url,
                albumArt: track.album.images.length > 0 ? track.album.images[0].url : null,
            }));
        
        console.log(`Fetched ${tracks.length} playable tracks from playlist.`);
        return tracks;
    } catch (error) {
        console.error('Error fetching playlist tracks from Spotify:', error.message || error);
        return []; 
    }
}

// APPROACH 2: Search for tracks by genre
async function searchTracksByGenre(genre = 'hip hop', market = DEFAULT_MARKET, limit = 50) {
    await getAccessToken();
    try {
        console.log(`Searching for "${genre}" tracks in market: ${market}`);
        const data = await spotifyApi.searchTracks(`genre:${genre}`, {
            limit: limit,
            market: market
        });

        const tracks = data.body.tracks.items
            .filter(track => track.preview_url)
            .map(track => ({
                id: track.id,
                title: track.name,
                artist: track.artists.map(artist => artist.name).join(', '),
                previewUrl: track.preview_url,
                albumArt: track.album.images.length > 0 ? track.album.images[0].url : null,
            }));
        
        console.log(`Found ${tracks.length} playable ${genre} tracks through search.`);
        return tracks;
    } catch (error) {
        console.error(`Error searching for ${genre} tracks:`, error.message || error);
        return [];
    }
}

// APPROACH 3: Get recommendations based on genre seeds
async function getRecommendationsByGenre(genres = ['hip-hop', 'rap'], market = DEFAULT_MARKET, limit = 50) {
    await getAccessToken();
    try {
        console.log(`Getting recommendations for genres: ${genres.join(', ')} in market: ${market}`);
        const data = await spotifyApi.getRecommendations({
            seed_genres: genres,
            limit: limit,
            market: market
        });

        const tracks = data.body.tracks
            .filter(track => track.preview_url)
            .map(track => ({
                id: track.id,
                title: track.name,
                artist: track.artists.map(artist => artist.name).join(', '),
                previewUrl: track.preview_url,
                albumArt: track.album.images.length > 0 ? track.album.images[0].url : null,
            }));
        
        console.log(`Got ${tracks.length} playable tracks from recommendations.`);
        return tracks;
    } catch (error) {
        console.error('Error getting recommendations from Spotify:', error.message || error);
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
            for (const playlist of featuredPlaylistsData.body.playlists.items) {
                console.log(`Fetching tracks from featured playlist: ${playlist.name}`);
                try {
                    const tracksData = await spotifyApi.getPlaylistTracks(playlist.id, {
                        fields: 'items(track(id,name,artists(name),preview_url,album(images)))',
                        limit: 20,
                        market: market
                    });
                    
                    const playlistTracks = tracksData.body.items
                        .map(item => item.track)
                        .filter(track => track && track.preview_url)
                        .map(track => ({
                            id: track.id,
                            title: track.name,
                            artist: track.artists.map(artist => artist.name).join(', '),
                            previewUrl: track.preview_url,
                            albumArt: track.album.images.length > 0 ? track.album.images[0].url : null,
                        }));
                    
                    allTracks = [...allTracks, ...playlistTracks];
                } catch (error) {
                    console.error(`Error fetching tracks from playlist ${playlist.id}:`, error.message);
                    // Continue with the next playlist
                }
            }
        }
        
        console.log(`Fetched a total of ${allTracks.length} playable tracks from featured playlists.`);
        return allTracks;
    } catch (error) {
        console.error('Error fetching featured playlists from Spotify:', error.message || error);
        return [];
    }
}

// Get a random song using all available methods as fallbacks
async function getRandomSong() {
    // Try all approaches in sequence until one works
    console.log("Attempting to get a random song...");
    
    // 1. Try from RapCaviar playlist
    let tracks = await getRapPlaylistTracks('37i9dQZF1DX0XUsuxWHRQd', DEFAULT_MARKET);
    
    // 2. If no tracks, try from Today's Top Hits
    if (tracks.length === 0) {
        console.log("No tracks from RapCaviar, trying Today's Top Hits...");
        tracks = await getRapPlaylistTracks('37i9dQZF1DXcBWIGoYBM5M', DEFAULT_MARKET);
    }
    
    // 3. If still no tracks, try search
    if (tracks.length === 0) {
        console.log("No tracks from playlists, trying search...");
        tracks = await searchTracksByGenre('hip hop', DEFAULT_MARKET);
    }
    
    // 4. If still no tracks, try recommendations
    if (tracks.length === 0) {
        console.log("No tracks from search, trying recommendations...");
        tracks = await getRecommendationsByGenre(['hip-hop', 'rap'], DEFAULT_MARKET);
    }
    
    // 5. Last resort: featured playlists
    if (tracks.length === 0) {
        console.log("No tracks from recommendations, trying featured playlists...");
        tracks = await getTracksFromFeaturedPlaylists(DEFAULT_MARKET);
    }
    
    // Final check
    if (tracks.length === 0) {
        console.error("Failed to get any playable tracks from all approaches.");
        return null;
    }
    
    // Pick a random track
    const randomIndex = Math.floor(Math.random() * tracks.length);
    const randomTrack = tracks[randomIndex];
    console.log("Selected random song:", randomTrack.title, "-", randomTrack.artist);
    return randomTrack;
}

// Get all songs for autocomplete
async function getAllSongsForAutocomplete() {
    // Combine results from multiple sources for a robust list
    let allTracks = [];
    
    // Try to get tracks from each source
    const playlistTracks = await getRapPlaylistTracks('37i9dQZF1DX0XUsuxWHRQd', DEFAULT_MARKET);
    const searchTracks = await searchTracksByGenre('rap', DEFAULT_MARKET, 30);
    const recommendedTracks = await getRecommendationsByGenre(['hip-hop'], DEFAULT_MARKET, 30);
    
    // Combine all unique tracks by ID
    const trackMap = new Map();
    
    [...playlistTracks, ...searchTracks, ...recommendedTracks].forEach(track => {
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