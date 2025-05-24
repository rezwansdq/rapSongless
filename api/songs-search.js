require('dotenv').config();
const cors = require('cors');
const itunesService = require('../itunesService');

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
      const songs = await itunesService.searchItunes(searchTerm, 'song', 'music', 15, 'US', 'songTerm');
      res.json(songs);
    } catch (error) {
      console.error("Server error during song search for autocomplete:", error);
      res.status(500).json({ message: "Error searching songs", error: error.message });
    }
  });
}; 