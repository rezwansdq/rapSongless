require('dotenv').config();
const cors = require('cors');
const itunesService = require('./itunesService');

// Helper to handle CORS middleware for Vercel functions
const corsMiddleware = cors();

// API handler for random song
module.exports = (req, res) => {
  // Apply CORS
  corsMiddleware(req, res, async () => {
    try {
      const song = await itunesService.getRandomSong();
      if (song) {
        res.json(song);
      } else {
        res.status(404).json({ message: "Could not fetch a random song." });
      }
    } catch (error) {
      console.error("Server error fetching random song:", error);
      res.status(500).json({ message: "Error fetching random song", error: error.message });
    }
  });
}; 