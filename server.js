require('dotenv').config(); // For loading environment variables (Spotify keys)
const express = require('express');
const cors = require('cors');
const path = require('path'); // Added for serving static files
const SpotifyWebApi = require('spotify-web-api-node');
const cookieParser = require('cookie-parser'); // Added cookie-parser
const spotifyService = require('./spotifyService'); // Import the new Spotify service

const app = express();
const PORT = 8000; // Changed to 8000 to match redirect URI

// Spotify API setup
const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI, // Added redirectUri
});

const SCOPES = ['user-read-email', 'user-read-private', 'playlist-read-private', 'playlist-read-collaborative', 'user-top-read', 'user-library-read']; // Added common scopes

// Middleware
app.use(cors({ origin: 'http://127.0.0.1:8000', credentials: true })); // Updated origin to 127.0.0.1:8000
app.use(cookieParser()); // Use cookie-parser
app.use(express.json()); // To parse JSON bodies

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// --- Spotify Authentication Routes ---
app.get('/login', (req, res) => {
    const authUrl = spotifyApi.createAuthorizeURL(SCOPES, 'some-state-value'); // Added a state for CSRF protection
    res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
    const { code, state } = req.query; // Make sure to verify state if you send one
    // if (state === null || state !== 'some-state-value') { // Basic state check
    //   return res.status(400).send('State mismatch');
    // }
    try {
        const data = await spotifyApi.authorizationCodeGrant(code);
        const { access_token, refresh_token, expires_in } = data.body;

        spotifyApi.setAccessToken(access_token);
        spotifyApi.setRefreshToken(refresh_token);

        // Store tokens in secure, httpOnly cookies
        // The frontend won't be able to access these directly, which is good for security.
        // The spotifyApi instance on the server will use them.
        res.cookie('spotify_access_token', access_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: expires_in * 1000 });
        res.cookie('spotify_refresh_token', refresh_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
        
        console.log("Tokens obtained and set in cookies. Redirecting to home.");
        res.redirect('/'); // Redirect to the main page of your app
    } catch (err) {
        console.error('Error during Spotify auth callback:', err);
        res.status(500).send('Authentication failed. Check server logs.');
    }
});

// Middleware to check if tokens are present and set them on the spotifyApi instance for subsequent requests
// This is a simplified version. In a real app, you might want more robust token management.
app.use(async (req, res, next) => {
    if (req.cookies.spotify_access_token) {
        spotifyApi.setAccessToken(req.cookies.spotify_access_token);
    }
    if (req.cookies.spotify_refresh_token) {
        spotifyApi.setRefreshToken(req.cookies.spotify_refresh_token);
    }
    // Attempt to refresh token if it's expired (simplified check)
    // spotifyService.js will have a more robust ensureToken function
    // For now, this just ensures the API client has tokens if they exist in cookies.
    next();
});

// --- API Routes (now potentially using user-authorized tokens) ---
app.get('/api/song/random', async (req, res) => {
    // The spotifyService.getRandomSong will now need to handle token refreshing
    try {
        const song = await spotifyService.getRandomSong(spotifyApi); // Pass the configured spotifyApi instance
        if (song) {
            res.json(song);
        } else {
            res.status(404).json({ message: "Could not fetch a random playable song. User might need to login." });
        }
    } catch (error) {
        console.error("Server error fetching random song:", error);
        if (error.message && error.message.includes("No token provided")) {
            return res.status(401).json({ message: "Spotify authentication required. Please login.", redirectTo: '/login' });
        }
        res.status(500).json({ message: "Error fetching random song from Spotify", error: error.message });
    }
});

app.get('/api/songs', async (req, res) => {
    // The spotifyService.getAllSongsForAutocomplete will also need the spotifyApi instance
    try {
        const songs = await spotifyService.getAllSongsForAutocomplete(spotifyApi);
        if (songs && songs.length > 0) {
            res.json(songs);
        } else {
            res.status(404).json({ message: "No songs found or error fetching songs. User might need to login." });
        }
    } catch (error) {
        console.error("Server error fetching all songs:", error);
        if (error.message && error.message.includes("No token provided")) {
            return res.status(401).json({ message: "Spotify authentication required. Please login.", redirectTo: '/login' });
        }
        res.status(500).json({ message: "Error fetching songs from Spotify", error: error.message });
    }
});

// Catch-all route to serve index.html
app.get('*', (req, res) => {
    // Avoid sending index.html for API routes or auth routes if they weren't caught
    if (req.path.startsWith('/api/') || req.path === '/login' || req.path === '/callback') {
        return res.status(404).send("Not found");
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Spotify redirect URI configured in .env should be: ${process.env.SPOTIFY_REDIRECT_URI}`);
    console.log(`Ensure your Spotify App Dashboard has this exact redirect URI: ${process.env.SPOTIFY_REDIRECT_URI}`);
}); 