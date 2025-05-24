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


async function getRandomSong() {
    console.log("iTunesService: Attempting hybrid Spotify/iTunes random song...");
    try {
        // 1. Get a popular track from Spotify (e.g., by Drake)
        const spotifyTrack = await spotifyService.findPopularTrackByArtist('Drake', { minPopularity: 70, searchLimit: 50 });

        if (spotifyTrack && spotifyTrack.id && spotifyTrack.title && spotifyTrack.artist) {
            console.log(`iTunesService: Spotify found: ${spotifyTrack.title} - ${spotifyTrack.artist} (ID: ${spotifyTrack.id})`);

            // 2. Search iTunes for this specific track to get a previewUrl
            // We will search for "Song Title Artist Name" to be specific
            // No need to filter by recency or preview here, we just need *a* preview for this specific song
            const itunesResults = await searchItunesRaw(`${spotifyTrack.title} ${spotifyTrack.artist}`, 'song', 'music', 5, 'US', 'songTerm');

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
                    console.log(`iTunesService: Found iTunes preview for Spotify track: ${matchedItunesTrack.trackName}`);
                    return {
                        id: spotifyTrack.id, // Use Spotify ID as primary
                        title: spotifyTrack.title, // Spotify title
                        artist: spotifyTrack.artist, // Spotify artist
                        albumArt: spotifyTrack.albumArt, // Spotify album art (largest)
                        previewUrl: matchedItunesTrack.previewUrl // iTunes preview URL
                    };
                } else {
                    console.log(`iTunesService: No suitable iTunes match with preview found for Spotify track: ${spotifyTrack.title}`);
                }
            } else {
                console.log(`iTunesService: Could not find Spotify track '${spotifyTrack.title} - ${spotifyTrack.artist}' on iTunes search.`);
            }
        } else {
            console.log("iTunesService: Spotify did not return a suitable track.");
        }
    } catch (spotifyError) {
        console.error("iTunesService: Error during Spotify-primary lookup:", spotifyError.message);
        // Proceed to iTunes-only fallback
    }

    console.log("iTunesService: Spotify/iTunes hybrid failed. Falling back to iTunes-only search for random song.");
    // Fallback logic (existing iTunes chart/genre based search)
    return getRandomSongFromItunesFallback(); 
}

// Extracted original iTunes fallback logic into its own function
async function getRandomSongFromItunesFallback() {
    console.log("iTunesService (Fallback): Attempting to get random song, starting with Top Rap Chart...");
    const rawChartSongs = await fetchTopRapChartRaw();
    let enrichedChartSongs = [];

    if (rawChartSongs.length > 0) {
        for (const chartSong of rawChartSongs) {
            if (!chartSong.name || !chartSong.artistName) continue;
            try {
                const searchResults = await searchItunesRaw(`${chartSong.name} ${chartSong.artistName}`, 'song', 'music', 1);
                if (searchResults.length > 0) {
                    const track = searchResults[0];
                     // Apply filters here for chart songs
                    if (track.previewUrl && track.kind === 'song' && isRecentEnoughForFallback(track)) {
                        if (track.artistName.toLowerCase().includes(chartSong.artistName.toLowerCase()) || chartSong.artistName.toLowerCase().includes(track.artistName.toLowerCase())){
                            enrichedChartSongs.push(transformItunesTrackForFallback(track));
                        }
                    }
                }
            } catch (error) {
                // console.warn(`iTunesService (Fallback): Error looking up details for chart song "${chartSong.name}": ${error.message}`);
            }
        }
        console.log(`iTunesService (Fallback): Enriched ${enrichedChartSongs.length} chart songs.`);
    }

    if (enrichedChartSongs.length > 0) {
        return enrichedChartSongs[Math.floor(Math.random() * enrichedChartSongs.length)];
    }

    console.log("iTunesService (Fallback): No suitable songs from chart. Trying direct iTunes genre/offset search...");
    const MAX_OFFSET_GENRE = 1000;
    const randomOffset = Math.floor(Math.random() * (MAX_OFFSET_GENRE / 50)) * 50;
    let itunesFallbackResults = [];

    const terms = ['track', 'hit']; // a general term, hip hop, rap, common artist like Drake
    for (const term of terms) {
        let results = await searchItunesRaw(term, 'song', 'music', 50, 'US', null, 18, randomOffset);
        results = results.filter(track => track.previewUrl && track.kind === 'song' && isRecentEnoughForFallback(track)).map(transformItunesTrackForFallback);
        if (results.length > 0) {
            itunesFallbackResults = results; break;
        }
    }
     if (itunesFallbackResults.length === 0) { // Try offset 0
        for (const term of terms) {
            let results = await searchItunesRaw(term, 'song', 'music', 50, 'US', null, 18, 0);
            results = results.filter(track => track.previewUrl && track.kind === 'song' && isRecentEnoughForFallback(track)).map(transformItunesTrackForFallback);
            if (results.length > 0) {
                itunesFallbackResults = results; break;
            }
        }
    }
    // Broader search if still no results
    if (itunesFallbackResults.length === 0) {
        let results = await searchItunesRaw('Drake', 'song', 'music', 50, 'US', null, null, 0);
        itunesFallbackResults = results.filter(track => track.previewUrl && track.kind === 'song' && isRecentEnoughForFallback(track)).map(transformItunesTrackForFallback);
    }
    if (itunesFallbackResults.length === 0) {
        let results = await searchItunesRaw('pop', 'song', 'music', 50, 'US', null, null, 0); // last resort
        itunesFallbackResults = results.filter(track => track.previewUrl && track.kind === 'song' && isRecentEnoughForFallback(track)).map(transformItunesTrackForFallback);
    }


    if (itunesFallbackResults.length === 0) {
        console.error("iTunesService (Fallback): Failed to get any songs from iTunes after all fallbacks.");
        return null;
    }
    return itunesFallbackResults[Math.floor(Math.random() * itunesFallbackResults.length)];
}

// Original fetchTopRapChartRaw - remains largely the same
async function fetchTopRapChartRaw() {
    console.log("iTunesService: Fetching top rap chart from Apple RSS for fallback...");
    try {
        const response = await fetch(CHARTS_URL);
        if (!response.ok) {
            console.error(`iTunesService: Failed to fetch charts (fallback), status: ${response.status}`);
            return [];
        }
        const data = await response.json();
        if (data.feed && data.feed.results) {
            return data.feed.results;
        }
        if (data.feed && data.feed.entry && Array.isArray(data.feed.entry)) {
            return data.feed.entry.map(entry => ({
                id: entry.id?.attributes?.['im:id'],
                name: entry['im:name']?.label,
                artistName: entry['im:artist']?.label
            }));
        }
        console.warn("iTunesService: Chart data (fallback) in unexpected format or empty.");
        return [];
    } catch (error) {
        console.error("iTunesService: Error fetching/parsing top rap chart (fallback):", error);
        return [];
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
    searchSpotifyForAutocomplete, // For autocomplete endpoint
    searchItunesRaw // Expose if needed for direct iTunes search, but primarily internal now
    // getAllSongsForAutocomplete has been removed
}; 