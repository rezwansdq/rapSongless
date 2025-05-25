require('dotenv').config();
const cors = require('cors');
const itunesService = require('./itunesService');

// Helper to handle CORS middleware for Vercel functions
const corsMiddleware = cors();

// API handler for random song
module.exports = (req, res) => {
  corsMiddleware(req, res, async () => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const playlistId = parsedUrl.searchParams.get('playlistId');

    // Log received playlistId for debugging
    console.log(`API song-random: Received request for playlistId: ${playlistId}`);

    if (!playlistId) {
      console.error('API song-random: Playlist ID is missing from the request.');
      return res.status(400).json({ message: "Playlist ID is required for fetching a random song." });
    }

    try {
      const song = await itunesService.getRandomSong(playlistId);
      if (song) {
        res.json(song);
      } else {
        res.status(404).json({ message: `Could not fetch a random song from playlist ${playlistId}.` });
      }
    } catch (error) {
      console.error(`API song-random: Server error fetching random song for playlist ${playlistId}:`, error);
      res.status(500).json({ message: "Error fetching random song", error: error.message });
    }
  });
}; 