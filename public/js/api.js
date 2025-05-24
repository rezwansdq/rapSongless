// This module will handle interactions with the backend API or Spotify API directly.

// API endpoint path
const API_BASE_URL = '/api'; // Relative path works for both local and production

/**
 * Fetches a random rap/hip-hop track.
 */
export async function getRandomSong() {
    console.log("API: Fetching random song from backend...");
    try {
        const response = await fetch(`${API_BASE_URL}/song-random`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const song = await response.json();
        console.log("API: Random song fetched", song);
        // Backend should ideally provide valid data, including albumArt
        return song;
    } catch (error) {
        console.error("API: Error fetching random song:", error);
        // Fallback to a very basic mock if backend fails during dev
        return {
            id: "fallbackMockId",
            title: "Fallback Song",
            artist: "Fallback Artist",
            previewUrl: "https://p.scdn.co/mp3-preview/297fd17631339939714219609336d5885ae892f0", // A known working preview
            albumArt: "https://i.scdn.co/image/ab67616d0000b273d84b0fb7ce7ea54592714689" // Example album art
        };
    }
}

/**
 * Fetches song suggestions from the backend based on a search query.
 * @param {string} query The search term.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of song suggestions.
 */
export async function fetchSearchSuggestions(query) {
    if (!query || query.trim().length < 2) { // Basic validation
        return [];
    }
    console.log(`API: Fetching search suggestions for query: "${query}"...`);
    try {
        const response = await fetch(`${API_BASE_URL}/songs-search?term=${encodeURIComponent(query)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const songs = await response.json();
        console.log("API: Suggestions fetched", songs);
        return songs;
    } catch (error) {
        console.error("API: Error fetching search suggestions:", error);
        return []; // Return empty on error
    }
}

/**
 * DEPRECATED for autocomplete. Use fetchSearchSuggestions instead.
 * Fetches the full list of candidate tracks for autocomplete.
 */
export async function getAllSongs() {
    console.warn("API: getAllSongs() is deprecated for autocomplete. Use fetchSearchSuggestions().");
    console.log("API: Fetching all songs for autocomplete from backend (DEPRECATED)...");
    try {
        const response = await fetch(`${API_BASE_URL}/songs`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const songs = await response.json();
        console.log("API: All songs fetched for autocomplete", songs);
        return songs;
    } catch (error) {
        console.error("API: Error fetching all songs for autocomplete:", error);
        // Fallback to basic mock list
        return [
            { title: "HUMBLE.", artist: "Kendrick Lamar" },
            { title: "Sicko Mode", artist: "Travis Scott" },
            { title: "God's Plan", artist: "Drake" },
            { title: "Test Song 1", artist: "Test Artist A"},
            { title: "Another Test", artist: "Test Artist B"}
        ];
    }
}

// Note: For simplicity, the current design assumes a backend proxying Spotify calls 
// or serving pre-processed data. If Spotify API were called directly from client,
// OAuth handling would be needed here or in main.js.