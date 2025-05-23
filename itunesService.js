const fetch = require('node-fetch');

const ITUNES_API_BASE_URL = 'https://itunes.apple.com/search';
// const CHARTS_URL = 'https://rss.applemarketingtools.com/api/v2/us/music/most-played/100/hip-hop-rap/songs.json'; // Old URL, was 404ing
const CHARTS_URL = 'https://itunes.apple.com/us/rss/topsongs/limit=100/genre=18/json'; // New potential chart URL

// Helper function to transform iTunes track data into our game's song format
function transformItunesTrack(track) {
    // iTunes artwork URLs can be customized for size, e.g., artworkUrl100 gives 100x100.
    // We can try to get a larger one by replacing '100x100' with something like '600x600'.
    let albumArt = track.artworkUrl100; // Default to 100x100
    if (albumArt) {
        albumArt = albumArt.replace('100x100bb.jpg', '600x600bb.jpg'); 
    }

    return {
        id: track.trackId, // iTunes trackId
        title: track.trackName,
        artist: track.artistName,
        previewUrl: track.previewUrl, // This is the 30-second audio snippet
        albumArt: albumArt, // Artwork URL
        // Add other fields if needed, e.g., collectionName for album title
        // collectionName: track.collectionName 
    };
}

// Helper function to check if a track's release date is 2006 or newer
function isRecentEnough(track, year = 2006) {
    if (!track.releaseDate) return false; // If no release date, assume not recent enough or handle as preferred
    try {
        return new Date(track.releaseDate) >= new Date(`${year}-01-01`);
    } catch (e) {
        console.warn(`iTunesService: Could not parse releaseDate '${track.releaseDate}' for track: ${track.trackName}`);
        return false; // If date is unparseable, treat as not recent
    }
}

async function searchItunes(term, entity = 'song', media = 'music', limit = 50, country = 'US', attribute = null, genreId = null, offset = 0) {
    const params = new URLSearchParams();
    // Only append term if it's provided and not empty, as some searches might be genre-only with an offset
    if (term && term.trim() !== '') params.append('term', term);
    params.append('country', country);
    params.append('media', media);
    params.append('entity', entity);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString()); // Ensure offset is included
    if (attribute) params.append('attribute', attribute);
    if (genreId) params.append('genreId', genreId.toString());

    const searchUrl = `${ITUNES_API_BASE_URL}?${params.toString()}`;
    // console.log(`iTunesService: Searching URL: ${searchUrl}`); // Potentially too verbose for every lookup

    try {
        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        if (!response.ok) {
            const errorBody = await response.text(); // Try to get more error details
            // console.error(`iTunesService: API Error Body for ${searchUrl}: ${errorBody}`);
            throw new Error(`iTunes API request failed for ${searchUrl} with status: ${response.status} - ${response.statusText}`);
        }
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            return data.results
                .filter(track => track.previewUrl && track.kind === 'song') 
                .filter(isRecentEnough) 
                .map(transformItunesTrack);
        }
        return [];
    } catch (error) {
        // console.error(`iTunesService: Error searching iTunes at ${searchUrl}:`, error);
        throw error; 
    }
}

async function fetchTopRapChartRaw() {
    console.log("iTunesService: Fetching top rap chart from Apple RSS...");
    try {
        const response = await fetch(CHARTS_URL);
        if (!response.ok) {
            console.error(`iTunesService: Failed to fetch charts, status: ${response.status}`);
            return [];
        }
        const data = await response.json();
        if (data.feed && data.feed.results) {
            console.log(`iTunesService: Successfully fetched ${data.feed.results.length} songs from chart.`);
            return data.feed.results; // Return raw chart results { id, name, artistName, etc. }
        }
        // Check for the new common iTunes RSS structure: data.feed.entry
        if (data.feed && data.feed.entry && Array.isArray(data.feed.entry)) {
            console.log(`iTunesService: Successfully fetched ${data.feed.entry.length} songs from chart (new structure).`);
            // Transform entries to a more consistent format { id, name, artistName }
            return data.feed.entry.map(entry => ({
                id: entry.id?.attributes?.['im:id'], // e.g., data.feed.entry[0].id.attributes['im:id']
                name: entry['im:name']?.label,       // e.g., data.feed.entry[0]['im:name'].label
                artistName: entry['im:artist']?.label // e.g., data.feed.entry[0]['im:artist'].label
            }));
        }
        console.warn("iTunesService: Chart data in unexpected format or empty.");
        return [];
    } catch (error) {
        console.error("iTunesService: Error fetching or parsing top rap chart:", error);
        return [];
    }
}

async function getRandomSong() {
    console.log("iTunesService: Attempting to get random song, starting with Top Rap Chart...");
    const rawChartSongs = await fetchTopRapChartRaw();
    let enrichedChartSongs = [];

    if (rawChartSongs.length > 0) {
        console.log(`iTunesService: Enriching ${rawChartSongs.length} chart songs with preview URLs and details...`);
        for (const chartSong of rawChartSongs) {
            if (!chartSong.name || !chartSong.artistName) continue;
            try {
                // Search for the specific song from the chart to get full details including previewUrl and releaseDate
                // searchItunes already filters by previewUrl and isRecentEnough
                const searchResults = await searchItunes(
                    `${chartSong.name} ${chartSong.artistName}`,
                    'song', 
                    'music', 
                    1, // Limit to 1, we want the exact match
                    'US', 
                    null, // No specific attribute, general search for "title artist"
                    null, // No specific genreId for this lookup
                    0 // Offset 0 for this specific lookup
                );
                if (searchResults.length > 0) {
                    // Make sure the found song reasonably matches artist to avoid wrong matches from broad search
                    if (searchResults[0].artist.toLowerCase().includes(chartSong.artistName.toLowerCase()) || 
                        chartSong.artistName.toLowerCase().includes(searchResults[0].artist.toLowerCase())) {
                        enrichedChartSongs.push(searchResults[0]);
                    } else {
                        // console.log(`iTunesService: Chart song lookup for "${chartSong.name}" by ${chartSong.artistName} - artist mismatch: found ${searchResults[0].artist}`);
                    }
                }
            } catch (error) {
                // console.warn(`iTunesService: Error looking up details for chart song "${chartSong.name}": ${error.message}`);
                // Continue to next chart song if one lookup fails
            }
        }
        console.log(`iTunesService: Successfully enriched ${enrichedChartSongs.length} chart songs that have previews and are recent.`);
    }

    if (enrichedChartSongs.length > 0) {
        const randomIndex = Math.floor(Math.random() * enrichedChartSongs.length);
        console.log("iTunesService: Selecting a random song from enriched chart list.");
        return enrichedChartSongs[randomIndex];
    }
    //other fallback logic
    console.log("iTunesService: No suitable songs from chart. Falling back to direct iTunes search with genre/offset...");
    // Fallback logic (existing code)
    const MAX_OFFSET_GENRE = 1000; 
    const randomOffset = Math.floor(Math.random() * (MAX_OFFSET_GENRE / 50)) * 50; 

    let songs = await searchItunes('track', 'song', 'music', 50, 'US', null, 18, randomOffset);
    
    if (songs.length === 0) {
        console.log(`iTunesService: No songs from Genre ID 18 (term 'track', offset ${randomOffset}). Trying term 'hit' with same offset...`);
        songs = await searchItunes('hit', 'song', 'music', 50, 'US', null, 18, randomOffset);
    }
    if (songs.length === 0) {
        console.log("iTunesService: No songs from Genre ID 18 with random offset. Trying with offset 0...");
        songs = await searchItunes('track', 'song', 'music', 50, 'US', null, 18, 0);
        if (songs.length === 0) {
            songs = await searchItunes('hit', 'song', 'music', 50, 'US', null, 18, 0);
        }
    }
    if (songs.length === 0) {
        console.log("iTunesService: No songs from Genre ID 18 (even with offset 0). Trying fallback: Drake (broad search, offset 0)...");
        songs = await searchItunes('Drake', 'song', 'music', 50, 'US', null, null, 0);
    }
    if (songs.length === 0) {
        console.log("iTunesService: No Drake songs with previews found. Trying fallback: pop (broad search, offset 0)...");
        songs = await searchItunes('pop', 'song', 'music', 50, 'US', null, null, 0); 
    }

    if (songs.length === 0) {
        console.error("iTunesService: Failed to get any songs from iTunes for random selection after all fallbacks.");
        return null;
    }

    const randomIndex = Math.floor(Math.random() * songs.length);
    console.log("iTunesService: Selecting a random song from fallback direct iTunes search.");
    return songs[randomIndex];
}

async function getAllSongsForAutocomplete() {
    console.log("iTunesService: Fetching songs for autocomplete (Source: Drake)...");
    try {
        // Using a specific popular artist for a more reliable list for autocomplete
        const songs = await searchItunes('Drake', 'song', 'music', 50); // Limit to 50 for autocomplete
        
        if (songs.length < 10) { // Arbitrary threshold
            console.warn("iTunesService: Autocomplete song list is small (", songs.length, "songs). Consider broader search or fallback.");
        }
        return songs;
    } catch (error) {
        console.error("iTunesService: Error in getAllSongsForAutocomplete, returning empty list:", error.message);
        // Fallback to an empty list or a predefined mock list if desired
        return []; 
        // Example with mock data fallback:
        // return [
        //     { id: "mock1", title: "Mock Song 1 (iTunes Error)", artist: "Mock Artist", previewUrl: null, albumArt: null },
        //     { id: "mock2", title: "Mock Song 2 (iTunes Error)", artist: "Mock Artist", previewUrl: null, albumArt: null }
        // ];
    }
}

module.exports = {
    getRandomSong,
    getAllSongsForAutocomplete,
    searchItunes 
}; 