require('dotenv').config();
const cors = require('cors');
const itunesService = require('../itunesService');

// Helper to handle CORS middleware for Vercel functions
const corsMiddleware = cors();

// API handler for all songs
module.exports = (req, res) => {
  // Apply CORS
  corsMiddleware(req, res, async () => {
    try {
      const songs = await itunesService.getAllSongsForAutocomplete();
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
}; 