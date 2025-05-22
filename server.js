require('dotenv').config(); // For loading environment variables (Spotify keys)
const express = require('express');
const cors = require('cors');
// const Spotify = require('node-spotify-api'); // We'll integrate this later

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // To parse JSON bodies

// --- Mock Data (will be replaced by Spotify API calls) ---
const mockSongsList = [
    { id: "s1", title: "HUMBLE.", artist: "Kendrick Lamar", previewUrl: "https://p.scdn.co/mp3-preview/297fd17631339939714219609336d5885ae892f0", spotifyStreams: 200000000 },
    { id: "s2", title: "Sicko Mode", artist: "Travis Scott", previewUrl: "https://p.scdn.co/mp3-preview/d8a26b78b00a010980cb9692f00a0f0f1b960251", spotifyStreams: 180000000 },
    { id: "s3", title: "God's Plan", artist: "Drake", previewUrl: "https://p.scdn.co/mp3-preview/cbedb9057c33a100c69736b1c83304023698dd68", spotifyStreams: 220000000 },
    { id: "s4", title: "Rockstar", artist: "Post Malone ft. 21 Savage", previewUrl: "https://p.scdn.co/mp3-preview/8b0124420189796a48932d9c0ef7e9f5a6f5f692", spotifyStreams: 190000000 },
    { id: "s5", title: "Lucid Dreams", artist: "Juice WRLD", previewUrl: "https://p.scdn.co/mp3-preview/e987099aab2290911676aa3a00183d7a18e6bd58", spotifyStreams: 170000000 },
    { id: "s6", title: "The Box", artist: "Roddy Ricch", previewUrl: "https://p.scdn.co/mp3-preview/f9f70e0d0e3b528a9f5f9d8d48ca9598df60f1cf", spotifyStreams: 210000000 }
];

// --- API Routes ---

// GET /api/song/random - Fetches a random rap/hip-hop track
app.get('/api/song/random', async (req, res) => {
    // TODO: Implement actual Spotify API call to get a random popular rap/hip-hop song
    // For now, return a random song from the mock list
    try {
        const randomSong = mockSongsList[Math.floor(Math.random() * mockSongsList.length)];
        if (!randomSong.previewUrl) {
            // Basic fallback if a mock song accidentally misses a URL
            randomSong.previewUrl = "https://p.scdn.co/mp3-preview/297fd17631339939714219609336d5885ae892f0";
        }
        res.json(randomSong);
    } catch (error) {
        console.error("Error fetching random song:", error);
        res.status(500).json({ error: "Failed to fetch random song" });
    }
});

// GET /api/songs - Fetches the full list of candidate tracks for autocomplete
app.get('/api/songs', async (req, res) => {
    // TODO: Implement actual Spotify API call or use a more extensive curated list
    // For now, return a simplified list for autocomplete (title and artist)
    try {
        const autocompleteList = mockSongsList.map(song => ({ title: song.title, artist: song.artist }));
        res.json(autocompleteList);
    } catch (error) {
        console.error("Error fetching songs list:", error);
        res.status(500).json({ error: "Failed to fetch songs list" });
    }
});

// --- Spotify API Integration (Placeholder for now) ---
/*
const spotify = new Spotify({
  id: process.env.SPOTIFY_CLIENT_ID,
  secret: process.env.SPOTIFY_CLIENT_SECRET
});

async function getSpotifyRapSongs() {
    try {
        // Example: Search for playlists with "Rap Caviar", "Most Necessary" etc.
        // Or search for tracks with genre:hip-hop and sort by popularity
        const data = await spotify.search({ type: 'track', query: 'genre:"hip hop"', limit: 50 });
        let tracks = data.tracks.items;
        
        // Filter for tracks with preview_url and high popularity (Spotify's popularity is 0-100)
        tracks = tracks.filter(track => track.preview_url && track.popularity > 75); // Adjust popularity threshold

        if (tracks.length === 0) {
            // Fallback or broaden search if no tracks meet criteria
            return mockSongsList; // For now
        }

        return tracks.map(track => ({
            id: track.id,
            title: track.name,
            artist: track.artists.map(a => a.name).join(', '),
            previewUrl: track.preview_url,
            spotifyPopularity: track.popularity // Using popularity as a proxy for streams
        }));
    } catch (err) {
        console.error('Error fetching from Spotify:', err);
        return mockSongsList; // Fallback to mocks
    }
}
// We will call getSpotifyRapSongs() to populate our lists once ready.
*/

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
}); 