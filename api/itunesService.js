const fetch = require('node-fetch');
const crypto = require('crypto');

const ITUNES_API_BASE_URL = 'https://itunes.apple.com/search';

// Enhanced helper to ensure high-quality album art
function extractHighResAlbumArt(itunesTrack) {
    let albumArt = itunesTrack.artworkUrl100;
    if (albumArt) {
        // iTunes often provides 100x100. We can usually request much larger (e.g., 600x600 or 1000x1000)
        albumArt = albumArt.replace('100x100bb.jpg', '600x600bb.jpg');
    }
    return albumArt;
}

// Transform raw iTunes track to our standard app format
function transformItunesTrack(track) {
    return {
        id: track.trackId ? track.trackId.toString() : Date.now().toString(), // Ensure ID is a string
        title: track.trackName,
        artist: track.artistName,
        previewUrl: track.previewUrl,
        albumArt: extractHighResAlbumArt(track),
    };
}

async function searchItunesRaw(term, entity = 'song', media = 'music', limit = 50, country = 'US', attribute = null) {
    const params = new URLSearchParams();
    if (term && term.trim() !== '') params.append('term', term);
    params.append('country', country);
    params.append('media', media);
    params.append('entity', entity);
    params.append('limit', limit.toString());
    if (attribute) params.append('attribute', attribute);

    const searchUrl = `${ITUNES_API_BASE_URL}?${params.toString()}`;
    try {
        const response = await fetch(searchUrl, { method: 'GET', headers: { 'Accept': 'application/json' } });
        if (!response.ok) {
            throw new Error(`iTunes API request failed for ${searchUrl} with status: ${response.status} - ${response.statusText}`);
        }
        const data = await response.json();
        return data.results || [];
    } catch (error) {
        console.error(`iTunesService: Error in searchItunesRaw at ${searchUrl}:`, error);
        throw error;
    }
}

// Fetch top songs for a specific iTunes genre via RSS feed
async function getTopSongsByGenre(genreId, limit = 100) {
    const rssUrl = `https://itunes.apple.com/us/rss/topsongs/limit=${limit}/genre=${genreId}/json`;
    try {
        const response = await fetch(rssUrl);
        if (!response.ok) {
            throw new Error(`iTunes RSS fetch failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        
        if (!data.feed || !data.feed.entry) return [];

        // Map RSS entries to match the shape of the search API roughly so we can re-use transform logic
        return data.feed.entry.map(entry => {
            // Find a preview URL in the links array
            const previewLink = entry.link.find(l => l.attributes && l.attributes.rel === 'enclosure' && l.attributes.type === 'audio/x-m4a');
            
            // Get the best available image
            const images = entry['im:image'];
            const bestImage = images && images.length > 0 ? images[images.length - 1].label : null;

            return {
                trackId: entry.id.attributes['im:id'],
                trackName: entry['im:name'].label,
                artistName: entry['im:artist'].label,
                previewUrl: previewLink ? previewLink.attributes.href : null,
                artworkUrl100: bestImage
            };
        }).filter(track => track.previewUrl); // Only keep tracks that actually have an audio preview
    } catch (error) {
        console.error(`iTunesService: Error fetching top songs for genre ${genreId}:`, error);
        return [];
    }
}


async function getRandomSong(params) {
    const playedTrackIds = params.playedSpotifyTrackIds instanceof Set ? params.playedSpotifyTrackIds : new Set();
    let tracks = [];

    if (params.genreId) {
        console.log(`iTunesService:getRandomSong - Mode: Genre, ID: ${params.genreId}, Exclude count: ${playedTrackIds.size}`);
        tracks = await getTopSongsByGenre(params.genreId, 100);
    } else if (params.artistName) {
        console.log(`iTunesService:getRandomSong - Mode: Artist, Name: '${params.artistName}', Exclude count: ${playedTrackIds.size}`);
        // Search for songs by this artist
        const rawTracks = await searchItunesRaw(params.artistName, 'song', 'music', 50, 'US', 'artistTerm');
        // Pre-filter out songs without a previewUrl (happens occasionally)
        tracks = rawTracks.filter(t => t.previewUrl);
    } else {
        console.error("iTunesService: getRandomSong called without genreId or artistName.");
        return null;
    }

    if (!tracks || tracks.length === 0) {
        console.log(`iTunesService: No tracks found for the requested parameters.`);
        return null;
    }

    // Filter out already played tracks
    const availableTracks = tracks.filter(t => !playedTrackIds.has(t.trackId ? t.trackId.toString() : ''));

    if (availableTracks.length === 0) {
        console.log(`iTunesService: All tracks have been played for these parameters.`);
        return null;
    }

    // Pick a random track
    const randomIndex = Math.floor(Math.random() * availableTracks.length);
    const chosenTrack = availableTracks[randomIndex];

    console.log(`iTunesService: Selected track: ${chosenTrack.trackName} by ${chosenTrack.artistName}`);
    return transformItunesTrack(chosenTrack);
}

async function getDailySong(params) {
    const { genreId } = params;
    if (!genreId) {
         console.error(`iTunesService: getDailySong called without a genreId.`);
         return null;
    }

    console.log(`iTunesService:getDailySong - Mode: Daily, Genre ID: ${genreId}`);

    try {
        const tracks = await getTopSongsByGenre(genreId, 50);
        if (!tracks || tracks.length === 0) {
            console.error(`iTunesService: No tracks found in daily genre ${genreId}`);
            return null;
        }

        // Deterministically select a song based on the date
        const today = new Date();
        const dateString = today.toISOString().split('T')[0];

        const hash = crypto.createHash('sha256');
        hash.update(dateString + 'daily'); 
        const digest = hash.digest('hex');
        const index = parseInt(digest, 16) % tracks.length;

        const chosenTrack = tracks[index];
        console.log(`iTunesService (Daily): Selected track: ${chosenTrack.trackName} - ${chosenTrack.artistName}`);
        
        return transformItunesTrack(chosenTrack);
    } catch (error) {
        console.error(`iTunesService: Error in getDailySong for genre ${genreId}:`, error);
        return null;
    }
}

// Searching for autocomplete dropdowns. We search for songs.
async function searchItunesForAutocomplete(term) {
    console.log(`iTunesService: Searching iTunes for autocomplete with term: "${term}"...`);
    try {
        const results = await searchItunesRaw(term, 'song', 'music', 10, 'US');
        return results.map(track => ({
            id: track.trackId ? track.trackId.toString() : Date.now().toString(),
            title: track.trackName,
            artist: track.artistName,
            albumArt: extractHighResAlbumArt(track)
        }));
    } catch (error) {
        console.error(`iTunesService: Error in searchItunesForAutocomplete for term "${term}":`, error.message);
        return [];
    }
}

module.exports = {
    getRandomSong,
    getDailySong,
    searchItunesForAutocomplete,
    searchItunesRaw
};