require('dotenv').config();
const cors = require('cors');
const itunesService = require('./itunesService');

// Helper to handle CORS middleware for Vercel functions
const corsMiddleware = cors();

// API handler for song search
module.exports = (req, res) => {
  // Apply CORS
  corsMiddleware(req, res, async () => {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const searchTerm = url.searchParams.get('term');

    if (!searchTerm) {
      return res.status(400).json({ message: "Search term is required" });
    }
    
    try {
      // Use the new Spotify-based search function from itunesService
      const songs = await itunesService.searchSpotifyForAutocomplete(searchTerm);
      res.json(songs); // songs is an array of {id, title, artist, albumArt, popularity}
    } catch (error) {
      console.error("Server error during Spotify song search for autocomplete:", error);
      res.status(500).json({ message: "Error searching songs via Spotify", error: error.message });
    }
  });
}; 