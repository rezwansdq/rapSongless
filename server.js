require('dotenv').config(); // For loading environment variables (Spotify keys)
const express = require('express');
const cors = require('cors');
const path = require('path'); // Added for serving static files
const spotifyService = require('./spotifyService'); // Import the new Spotify service

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // To parse JSON bodies

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

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
    try {
        const song = await spotifyService.getRandomSong();
        if (song) {
            res.json(song);
        } else {
            res.status(404).json({ message: "Could not fetch a random playable song." });
        }
    } catch (error) {
        console.error("Server error fetching random song:", error);
        res.status(500).json({ message: "Error fetching random song from Spotify", error: error.message });
    }
});

// GET /api/songs - Fetches the full list of candidate tracks for autocomplete
app.get('/api/songs', async (req, res) => {
    try {
        const songs = await spotifyService.getAllSongsForAutocomplete();
        if (songs && songs.length > 0) {
            res.json(songs);
        } else {
            res.status(404).json({ message: "No songs found or error fetching songs." });
        }
    } catch (error) {
        console.error("Server error fetching all songs:", error);
        res.status(500).json({ message: "Error fetching songs from Spotify", error: error.message });
    }
});

// Catch-all route to serve index.html for any other GET request (for client-side routing)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
}); 