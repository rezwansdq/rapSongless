const fetch = require('node-fetch');
const spotifyService = require('./spotifyService');
const crypto = require('crypto');

const ITUNES_API_BASE_URL = 'https://itunes.apple.com/search';
const CHARTS_URL = 'https://itunes.apple.com/us/rss/topsongs/limit=100/genre=18/json';

// Helper function to transform only iTunes track data (if used in fallback)
function transformItunesTrackForFallback(track) {
    let albumArt = track.artworkUrl100;
    if (albumArt) {
        albumArt = albumArt.replace('100x100bb.jpg', '600x600bb.jpg');
    }
    return {
        id: track.trackId.toString(), // Ensure ID is a string
        title: track.trackName,
        artist: track.artistName,
        previewUrl: track.previewUrl,
        albumArt: albumArt,
    };
}

// Helper function to check if an iTunes track's release date is 2006 or newer (for fallback)
function isRecentEnoughForFallback(track, year = 2006) {
    if (!track.releaseDate) return false;
    try {
        return new Date(track.releaseDate) >= new Date(`${year}-01-01`);
    } catch (e) {
        console.warn(`iTunesService: Could not parse releaseDate '${track.releaseDate}' for track: ${track.trackName} during fallback.`);
        return false;
    }
}

// Modified searchItunes: filters are now optional, and it returns raw iTunes results for flexibility
async function searchItunesRaw(term, entity = 'song', media = 'music', limit = 1, country = 'US', attribute = null, genreId = null, offset = 0) {
    const params = new URLSearchParams();
    if (term && term.trim() !== '') params.append('term', term);
    params.append('country', country);
    params.append('media', media);
    params.append('entity', entity);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    if (attribute) params.append('attribute', attribute);
    if (genreId) params.append('genreId', genreId.toString());

    const searchUrl = `${ITUNES_API_BASE_URL}?${params.toString()}`;
    try {
        const response = await fetch(searchUrl, { method: 'GET', headers: { 'Accept': 'application/json' } });
        if (!response.ok) {
            throw new Error(`iTunes API request failed for ${searchUrl} with status: ${response.status} - ${response.statusText}`);
        }
        const data = await response.json();
        return data.results || []; // Return raw results or empty array
    } catch (error) {
        console.error(`iTunesService: Error in searchItunesRaw at ${searchUrl}:`, error);
        throw error;
    }
}

async function getRandomSong(params) { // params will be { playlistId: '...' } or { artistName: '...' } or { playedSpotifyTrackIds: Set(...) }
    const MAX_ATTEMPTS = 5;
    let spotifyTrack = null;
    let logIdentifier = '';
    const playedSpotifyTrackIds = params.playedSpotifyTrackIds instanceof Set ? params.playedSpotifyTrackIds : new Set(); // Ensure it's a Set
    const unsuitableItunesTracks = new Set(); // New set for tracks without suitable iTunes matches

    if (params.playlistId) {
        logIdentifier = `playlist ID: ${params.playlistId}`;
        console.log(`iTunesService:getRandomSong - Mode: Playlist, ID: ${params.playlistId}, Exclude count: ${playedSpotifyTrackIds.size}`);
    } else if (params.artistName) {
        logIdentifier = `artist Name: '${params.artistName}'`;
        console.log(`iTunesService:getRandomSong - Mode: Artist, Name: ${params.artistName}, Exclude count: ${playedSpotifyTrackIds.size}`);
    } else {
        console.error("iTunesService: getRandomSong called without playlistId or artistName.");
        return null;
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        console.log(`iTunesService: Attempt ${attempt}/${MAX_ATTEMPTS} for random song using ${logIdentifier}...`);
        try {
            // 1. Get a track from Spotify based on mode
            if (params.playlistId) {
                spotifyTrack = await spotifyService.getRandomTrackFromPlaylist(params.playlistId, { excludeIds: playedSpotifyTrackIds });
            } else if (params.artistName) {
                spotifyTrack = await spotifyService.findPopularTrackByArtist(params.artistName, { searchLimit: 50, excludeIds: playedSpotifyTrackIds });
            }

            if (spotifyTrack && spotifyTrack.id && spotifyTrack.title && spotifyTrack.artist) {
                console.log(`iTunesService (Attempt ${attempt}): Spotify found: ${spotifyTrack.title} - ${spotifyTrack.artist} (ID: ${spotifyTrack.id}) using ${logIdentifier}`);

                // Check if the track is in the unsuitable tracks set
                if (unsuitableItunesTracks.has(spotifyTrack.id)) {
                    console.log(`iTunesService (Attempt ${attempt}): Skipping track ${spotifyTrack.title} - ${spotifyTrack.artist} as it has been marked unsuitable for iTunes.`);
                    continue; // Skip to the next attempt
                }

                // 2. Search iTunes for this specific track to get a previewUrl
                const itunesResults = await searchItunesRaw(`${spotifyTrack.title} ${spotifyTrack.artist}`, 'song', 'music', 10, 'US', null);

                if (itunesResults.length > 0) {
                    let matchedItunesTrack = null;
                    // Iterate to find a good match (e.g., exact title and artist, and has a previewUrl)
                    for (const itunesTrack of itunesResults) {
                        if (itunesTrack.trackName && itunesTrack.artistName && itunesTrack.previewUrl && 
                            itunesTrack.trackName.toLowerCase().includes(spotifyTrack.title.toLowerCase()) &&
                            itunesTrack.artistName.toLowerCase().includes(spotifyTrack.artist.toLowerCase())) {
                            matchedItunesTrack = itunesTrack;
                            break;
                        }
                    }

                    if (matchedItunesTrack) {
                        console.log(`iTunesService (Attempt ${attempt}): Found iTunes preview for Spotify track: ${matchedItunesTrack.trackName}`);
                        return { // Successfully found a song with preview
                            id: spotifyTrack.id, // Use Spotify ID as primary
                            title: spotifyTrack.title, // Spotify title
                            artist: spotifyTrack.artist, // Spotify artist
                            albumArt: spotifyTrack.albumArt, // Spotify album art (largest)
                            previewUrl: matchedItunesTrack.previewUrl // iTunes preview URL
                        };
                    } else {
                        // Add to unsuitable tracks set if no suitable match found
                        unsuitableItunesTracks.add(spotifyTrack.id);
                        console.log(`iTunesService (Attempt ${attempt}): No suitable iTunes match found for Spotify track: ${spotifyTrack.title} - ${spotifyTrack.artist}.`);
                    }
                } else {
                    console.log(`iTunesService (Attempt ${attempt}): No results found on iTunes for Spotify track: ${spotifyTrack.title} - ${spotifyTrack.artist}.`);
                    unsuitableItunesTracks.add(spotifyTrack.id); // Add to unsuitable tracks if no results
                }
            } else {
                console.log(`iTunesService (Attempt ${attempt}): Spotify did not return a suitable track.`);
            }
        } catch (error) {
            console.error(`iTunesService (Attempt ${attempt}): Error during hybrid lookup for ${logIdentifier}:`, error.message);
        }
        console.log(`iTunesService (Attempt ${attempt}): Failed to secure a song with preview in this attempt for ${logIdentifier}.`);
    }

    // If loop finishes, all attempts failed
    console.error(`iTunesService: All ${MAX_ATTEMPTS} attempts failed to get a song with a preview for ${logIdentifier}.`);
    return null; // Explicitly return null if no song is found after all attempts
}

async function getDailySong(params) {
    const { playlistId } = params;
    const MAX_ATTEMPTS = 10; // Try up to 10 songs from the daily list if previews are missing
    let logIdentifier = `daily song from playlist ID: ${playlistId}`;

    console.log(`iTunesService:getDailySong - Mode: Daily, Playlist ID: ${playlistId}`);

    try {
        // 1. Get all tracks from the Spotify playlist
        const tracks = await spotifyService.getAllTracksFromPlaylist(playlistId);
        if (!tracks || tracks.length === 0) {
            console.error(`iTunesService: No tracks found for daily challenge playlist ${playlistId}`);
            return null;
        }

        // 2. Deterministically select a song based on the date
        const today = new Date();
        const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD format

        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            // Create a hash of the date and attempt number to get a "random" but deterministic index
            const hash = crypto.createHash('sha256');
            hash.update(dateString + i.toString());
            const digest = hash.digest('hex');
            const index = parseInt(digest, 16) % tracks.length;

            const spotifyTrack = tracks[index];

            if (spotifyTrack && spotifyTrack.id && spotifyTrack.title && spotifyTrack.artist) {
                console.log(`iTunesService (Daily Attempt ${i + 1}): Selected track: ${spotifyTrack.title} - ${spotifyTrack.artist}`);

                // 3. Search iTunes for this specific track to get a previewUrl
                const itunesResults = await searchItunesRaw(`${spotifyTrack.title} ${spotifyTrack.artist}`, 'song', 'music', 10, 'US', null);

                if (itunesResults.length > 0) {
                    let matchedItunesTrack = null;
                    for (const itunesTrack of itunesResults) {
                        if (itunesTrack.trackName && itunesTrack.artistName && itunesTrack.previewUrl &&
                            itunesTrack.trackName.toLowerCase().includes(spotifyTrack.title.toLowerCase()) &&
                            itunesTrack.artistName.toLowerCase().includes(spotifyTrack.artist.toLowerCase())) {
                            matchedItunesTrack = itunesTrack;
                            break;
                        }
                    }

                    if (matchedItunesTrack) {
                        console.log(`iTunesService (Daily Attempt ${i + 1}): Found iTunes preview for daily track: ${matchedItunesTrack.trackName}`);
                        return {
                            id: spotifyTrack.id,
                            title: spotifyTrack.title,
                            artist: spotifyTrack.artist,
                            albumArt: spotifyTrack.albumArt,
                            previewUrl: matchedItunesTrack.previewUrl
                        };
                    } else {
                        console.log(`iTunesService (Daily Attempt ${i + 1}): No suitable iTunes match with preview for: ${spotifyTrack.title}. Trying next song.`);
                    }
                } else {
                    console.log(`iTunesService (Daily Attempt ${i + 1}): No iTunes results for: ${spotifyTrack.title}. Trying next song.`);
                }
            }
        }

        console.error(`iTunesService: Failed to find a daily song with a preview after ${MAX_ATTEMPTS} attempts.`);
        return null;

    } catch (error) {
        console.error(`iTunesService: Error in getDailySong for ${logIdentifier}:`, error);
        return null;
    }
}

// New function for Spotify-based autocomplete
async function searchSpotifyForAutocomplete(term) {
    console.log(`iTunesService: Searching Spotify for autocomplete with term: "${term}"...`);
    try {
        // spotifyService.searchTracksForAutocomplete already returns the desired structure
        const spotifySongs = await spotifyService.searchTracksForAutocomplete(term, 10);
        return spotifySongs; // [{ id, title, artist, albumArt, popularity }]
    } catch (error) {
        console.error(`iTunesService: Error in searchSpotifyForAutocomplete for term "${term}":`, error.message);
        return []; // Return empty on error, as frontend expects an array
    }
}

module.exports = {
    getRandomSong,
    getDailySong,
    searchSpotifyForAutocomplete, // For autocomplete endpoint
    searchItunesRaw // Expose if needed for direct iTunes search, but primarily internal now
    // getAllSongsForAutocomplete has been removed
};