require('dotenv').config(); // For loading environment variables (Spotify keys)
const express = require('express');
const cors = require('cors');
const path = require('path'); // Added for serving static files
// const SpotifyWebApi = require('spotify-web-api-node'); // Removed
// const cookieParser = require('cookie-parser'); // Removed

// Placeholder for the new iTunes service
const itunesService = require('./itunesService'); 

const app = express();
const PORT = 8000; // Keep at 8000 as previously set

// Middleware
app.use(cors({ origin: 'http://127.0.0.1:8000', credentials: true })); // Reverted for local dev
// app.use(cors({
//   origin: [ process.env.NODE_ENV === 'production'
//              ? 'https://sl.rsadeqi.com' // Your Vercel domain
//              : 'http://127.0.0.1:8000' ],
//   credentials: true
// }));
// app.use(cookieParser()); // Removed
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Removed Spotify Authentication Routes --- 
// app.get('/login', ...);
// app.get('/callback', ...);
// app.use(async (req, res, next) => { ... }); // Removed token middleware

// --- API Routes (to be updated to use itunesService) ---
app.get('/api/song/random', async (req, res) => {
    try {
        const song = await itunesService.getRandomSong(); // Switched to itunesService
        if (song) {
            res.json(song);
        } else {
            res.status(404).json({ message: "Could not fetch a random song from iTunes." });
        }
    } catch (error) {
        console.error("Server error fetching random song:", error);
        res.status(500).json({ message: "Error fetching random song from iTunes", error: error.message });
    }
});

app.get('/api/songs', async (req, res) => {
    try {
        const songs = await itunesService.getAllSongsForAutocomplete(); // Switched to itunesService
        if (songs && songs.length > 0) {
            res.json(songs);
        } else {
            res.status(404).json({ message: "No songs found or error fetching songs from iTunes." });
        }
    } catch (error) {
        console.error("Server error fetching all songs:", error);
        res.status(500).json({ message: "Error fetching songs from iTunes", error: error.message });
    }
});

// New endpoint for dynamic autocomplete search
app.get('/api/songs/search', async (req, res) => {
    const searchTerm = req.query.term;
    if (!searchTerm) {
        return res.status(400).json({ message: "Search term is required" });
    }
    try {
        // Fetch a smaller list, e.g., 15 results, for autocomplete suggestions
        // And target song titles specifically with attribute='songTerm'
        const songs = await itunesService.searchItunes(searchTerm, 'song', 'music', 15, 'US', 'songTerm');
        res.json(songs);
    } catch (error) {
        console.error("Server error during song search for autocomplete:", error);
        res.status(500).json({ message: "Error searching songs", error: error.message });
    }
});

// Catch-all route to serve index.html
app.get('*', (req, res) => {
    // Simplified: only check if it's not an API route before sending index.html
    if (req.path.startsWith('/api/')) {
        return res.status(404).send("Not found");
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://127.0.0.1:${PORT}`); // Updated log to reflect 127.0.0.1
}); 

// module.exports = app; // Commented out for local dev 