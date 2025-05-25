const fetch = require('node-fetch');
const spotifyService = require('./spotifyService');

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

async function getRandomSong(playlistId) {
    const MAX_ATTEMPTS = 5;

    if (!playlistId) {
        console.error("iTunesService: getRandomSong called without playlistId.");
        return null;
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        console.log(`iTunesService: Attempt ${attempt}/${MAX_ATTEMPTS} for random song from playlist ID: ${playlistId}...`);
        try {
            // 1. Get a random track from the user-specified Spotify playlist, no popularity filter
            const spotifyTrack = await spotifyService.getRandomTrackFromPlaylist(playlistId, { minPopularity: 0 });

            if (spotifyTrack && spotifyTrack.id && spotifyTrack.title && spotifyTrack.artist) {
                console.log(`iTunesService (Attempt ${attempt}): Spotify found: ${spotifyTrack.title} - ${spotifyTrack.artist} (ID: ${spotifyTrack.id}) from playlist ${playlistId}`);

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
                        console.log(`iTunesService (Attempt ${attempt}): No suitable iTunes match with preview found for Spotify track: ${spotifyTrack.title} - ${spotifyTrack.artist}. Examining iTunes results (found ${itunesResults.length}):`);
                        itunesResults.forEach((item, index) => {
                            console.log(`  Result ${index + 1}: Name='${item.trackName}', Artist='${item.artistName}', HasPreview=${!!item.previewUrl}`);
                        });
                    }
                } else {
                    console.log(`iTunesService (Attempt ${attempt}): Could not find Spotify track '${spotifyTrack.title} - ${spotifyTrack.artist}' on iTunes search (0 results).`);
                }
            } else {
                console.log(`iTunesService (Attempt ${attempt}): Spotify did not return a suitable track.`);
            }
        } catch (error) {
            console.error(`iTunesService (Attempt ${attempt}): Error during hybrid lookup:`, error.message);
            // Log error and continue to the next attempt if not maxed out
        }
        console.log(`iTunesService (Attempt ${attempt}): Failed to secure a song with preview in this attempt.`);
    }

    // If loop finishes, all attempts failed
    console.error(`iTunesService: All ${MAX_ATTEMPTS} attempts failed to get a song with a preview.`);
    return null; // Explicitly return null if no song is found after all attempts
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
    searchSpotifyForAutocomplete, // For autocomplete endpoint
    searchItunesRaw // Expose if needed for direct iTunes search, but primarily internal now
    // getAllSongsForAutocomplete has been removed
}; 