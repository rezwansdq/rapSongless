// This module will handle interactions with the backend API.

const API_BASE_URL = '/api'; // Relative path for Vercel and local

// Cache for autocomplete suggestions
const suggestionsCache = new Map();
const CACHE_MAX_SIZE = 20; // Store up to 20 recent search terms

/**
 * Fetches a random song. The backend now uses a Spotify-first approach.
 * Can fetch based on playlist ID or artist name.
 * @param {string} parameter - The ID of the Spotify playlist or the name of the artist.
 * @param {string} mode - Type of parameter: 'playlist' or 'artist'.
 * @param {Set<string>} playedIdsSet - A set of Spotify track IDs that have already been played.
 */
export async function getRandomSong(parameter, mode = 'playlist', playedIdsSet = new Set()) { // Default mode to playlist for safety
    console.log(`API: Fetching random song from backend. Mode: ${mode}, Parameter: ${parameter}, Excluding: ${playedIdsSet.size} tracks`);
    
    if (!parameter) {
        console.error(`API: getRandomSong called without a ${mode === 'playlist' ? 'playlistId' : 'artistName'}.`);
        return {
            id: "errorMockId",
            title: `Error: ${mode === 'playlist' ? 'Playlist ID' : 'Artist Name'} Missing`,
            artist: "Please Select Input on Home",
            previewUrl: null, 
            albumArt: null 
        };
    }

    let apiUrl = `${API_BASE_URL}/song-random`;
    const queryParams = new URLSearchParams();

    if (mode === 'playlist') {
        queryParams.append('playlistId', parameter);
    } else if (mode === 'artist') {
        queryParams.append('artistName', parameter);
    } else {
        console.error(`API: Invalid mode "${mode}" for getRandomSong.`);
        // Fallback or error handling
        return { id: "errorModeId", title: "Error: Invalid Mode", artist: "Check API Call", previewUrl: null, albumArt: null };
    }

    if (playedIdsSet && playedIdsSet.size > 0) {
        queryParams.append('exclude_ids', Array.from(playedIdsSet).join(','));
    }
    
    apiUrl += `?${queryParams.toString()}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`HTTP error! status: ${response.status} - ${errorData.message}`);
        }
        const song = await response.json();
        console.log("API: Random song fetched", song);
        if (!song || !song.id || !song.title || !song.artist || !song.previewUrl) {
            console.warn("API: Received incomplete song data from backend:", song);
        }
        return song;
    } catch (error) {
        console.error("API: Error fetching random song:", error);
        return {
            id: "fallbackMockId",
            title: "Fallback: Can't Load Song",
            artist: "Please Try Again",
            previewUrl: "https://p.scdn.co/mp3-preview/297fd17631339939714219609336d5885ae892f0", 
            albumArt: "https://i.scdn.co/image/ab67616d0000b273d84b0fb7ce7ea54592714689" 
        };
    }
}

/**
 * Fetches the daily song for the current date.
 * @returns {Promise<Object|null>} A promise that resolves to the daily song object or null if not found.
 */
export async function getDailySong() {
    console.log("API: Fetching daily song from backend.");
    const apiUrl = `${API_BASE_URL}/song-daily`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`HTTP error! status: ${response.status} - ${errorData.message}`);
        }
        const song = await response.json();
        console.log("API: Daily song fetched", song);
        return song;
    } catch (error) {
        console.error("API: Error fetching daily song:", error);
        return null;
    }
}

/**
 * Fetches song suggestions from the backend (now Spotify-based) for autocomplete.
 * @param {string} query The search term.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of song suggestions
 *                                   (e.g., { id, title, artist, albumArt, popularity }).
 */
export async function fetchSearchSuggestions(query) {
    if (!query || query.trim().length < 2) {
        return [];
    }
    const lowerCaseQuery = query.toLowerCase().trim();

    if (suggestionsCache.has(lowerCaseQuery)) {
        console.log(`API: Serving suggestions for "${lowerCaseQuery}" from cache.`);
        return suggestionsCache.get(lowerCaseQuery);
    }

    console.log(`API: Fetching Spotify search suggestions for query: "${query}"...`);
    console.time(`fetchSuggestions-${lowerCaseQuery}`); // Start timer for fetch
    try {
        const response = await fetch(`${API_BASE_URL}/songs-search?term=${encodeURIComponent(query)}`);
        console.timeEnd(`fetchSuggestions-${lowerCaseQuery}`); // End timer for fetch

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`HTTP error! status: ${response.status} - ${errorData.message}`);
        }
        const songs = await response.json();
        console.log("API: Spotify suggestions fetched", songs);

        // Add to cache
        if (suggestionsCache.size >= CACHE_MAX_SIZE) {
            // Evict the oldest entry (Map iterates in insertion order)
            const oldestKey = suggestionsCache.keys().next().value;
            suggestionsCache.delete(oldestKey);
            console.log(`API: Cache full. Evicted oldest entry: "${oldestKey}"`);
        }
        suggestionsCache.set(lowerCaseQuery, songs);

        // The UI expects title and artist. The new backend provides these + id, albumArt, popularity.
        return songs;
    } catch (error) {
        console.timeEnd(`fetchSuggestions-${lowerCaseQuery}`); // Ensure timer ends on error too
        console.error("API: Error fetching Spotify search suggestions:", error);
        return []; // Return empty on error
    }
}

// getAllSongs() function has been removed as it was deprecated and functionality is replaced
// by dynamic search with fetchSearchSuggestions.

// Note: Backend now handles Spotify and iTunes interactions.