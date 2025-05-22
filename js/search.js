let songIndex = []; // Stores { title, artist } for searching

/**
 * Initializes the search index with a list of songs.
 * @param {Array<Object>} songs - Array of song objects, each with title and artist.
 */
export function initializeSearchIndex(songs) {
    songIndex = songs.map(song => ({
        title: song.title.toLowerCase(),
        artist: song.artist.toLowerCase(),
        originalTitle: song.title, // Keep original for display
        originalArtist: song.artist
    }));
    console.log("Search: Index initialized with", songIndex.length, "songs");
}

/**
 * Gets autocomplete suggestions based on the input query.
 * @param {string} query - The user's input string (>= 2 characters).
 * @returns {Array<Object>} - Array of matching songs { title, artist }.
 */
export function getAutocompleteSuggestions(query) {
    if (query.length < 2) {
        return [];
    }
    const lowerCaseQuery = query.toLowerCase();
    const suggestions = songIndex.filter(song => 
        song.title.includes(lowerCaseQuery) || 
        song.artist.includes(lowerCaseQuery)
    );

    // Return a limited number of suggestions to avoid overwhelming the UI
    // And map back to original casing for display
    return suggestions.slice(0, 10).map(song => ({
        title: song.originalTitle,
        artist: song.originalArtist
    })); 
}

/**
 * Checks if the guessed title and artist match a song in the index.
 * This is a simple exact match for now. Could be made more fuzzy if needed.
 * @param {string} guessedTitle 
 * @param {string} currentSongTitle
 * @param {string} currentSongArtist
 * @returns {boolean}
 */
export function checkGuess(guessedTitle, currentSongTitle, currentSongArtist) {
    if (!guessedTitle || !currentSongTitle || !currentSongArtist) return false;

    const query = guessedTitle.toLowerCase();
    const actualTitle = currentSongTitle.toLowerCase();
    // const actualArtist = currentSongArtist.toLowerCase();

    // For simplicity, we are primarily matching the title.
    // A more robust check might involve artist as well, or a combined string.
    // Or check if the guessed string is a substring of the title or vice-versa.
    // For now, a direct match or a significant overlap in titles.
    return actualTitle.includes(query) || query.includes(actualTitle);
} 