require('dotenv').config(); // For loading environment variables (Spotify keys)
const express = require('express');
const cors = require('cors');
const path = require('path'); // Added for serving static files
// const SpotifyWebApi = require('spotify-web-api-node'); // Removed
// const cookieParser = require('cookie-parser'); // Removed

// Placeholder for the new iTunes service
const itunesService = require('./api/itunesService'); // Updated path

const app = express();
const PORT = process.env.PORT || 8000; // Use environment variable for port or default to 8000

// Middleware
app.use(cors({
  origin: [ 
    process.env.NODE_ENV === 'production' ? 'https://sl.rsadeqi.com' : 'http://127.0.0.1:8000',
    'http://localhost:8000' // Also allow generic localhost
  ],
  credentials: true
}));
// app.use(cors({
//   origin: [ process.env.NODE_ENV === 'production'
//              ? 'https://sl.rsadeqi.com' // Your Vercel domain
//              : 'http://127.0.0.1:8000' ], // Localhost for development
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
        const song = await itunesService.getRandomSong(); // This now uses Spotify-first approach
        if (song) {
            res.json(song);
        } else {
            // Updated message to be more generic as it could be Spotify or iTunes issue
            res.status(404).json({ message: "Could not fetch a random song." });
        }
    } catch (error) {
        console.error("Server error fetching random song:", error);
        res.status(500).json({ message: "Error fetching random song", error: error.message });
    }
});

// Updated endpoint for dynamic autocomplete search (Spotify-based)
app.get('/api/songs/search', async (req, res) => {
    const searchTerm = req.query.term;
    if (!searchTerm) {
        return res.status(400).json({ message: "Search term is required" });
    }
    try {
        // Uses the new function in itunesService that calls Spotify
        const songs = await itunesService.searchSpotifyForAutocomplete(searchTerm);
        res.json(songs); // songs is an array of {id, title, artist, albumArt, popularity}
    } catch (error) {
        console.error("Server error during Spotify song search for autocomplete:", error);
        res.status(500).json({ message: "Error searching songs via Spotify", error: error.message });
    }
});

// Catch-all route to serve index.html for client-side routing
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, 'public', 'home.html'));
    } else {
        // If it starts with /api/ but isn't matched above, it's a 404 for an API route
        res.status(404).json({ message: "API endpoint not found" });
    }
});

app.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 

// module.exports = app; // Keep commented out for local nodemon dev, uncomment for Vercel if needed 