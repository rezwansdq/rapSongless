// This module will handle interactions with the backend API.

const API_BASE_URL = '/api'; // Relative path for Vercel and local

// Cache for autocomplete suggestions
const suggestionsCache = new Map();
const CACHE_MAX_SIZE = 20; // Store up to 20 recent search terms

/**
 * Fetches a random song. The backend now uses a Spotify-first approach.
 */
export async function getRandomSong() {
    console.log("API: Fetching random song from backend (Spotify-first)...");
    try {
        const response = await fetch(`${API_BASE_URL}/song-random`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`HTTP error! status: ${response.status} - ${errorData.message}`);
        }
        const song = await response.json();
        console.log("API: Random song fetched (Spotify-first)", song);
        // Expected structure: { id (Spotify), title, artist, albumArt (Spotify), previewUrl (iTunes) }
        if (!song || !song.id || !song.title || !song.artist || !song.previewUrl) {
            console.warn("API: Received incomplete song data from backend:", song);
            // Depending on strictness, could throw error or use a more robust fallback
        }
        return song;
    } catch (error) {
        console.error("API: Error fetching random song:", error);
        // Fallback to a very basic mock if backend fails
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