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
    const artistName = parsedUrl.searchParams.get('artistName');

    // Log received parameters for debugging
    console.log(`API song-random: Received request. PlaylistId: ${playlistId}, ArtistName: ${artistName}`);

    if (!playlistId && !artistName) {
      console.error('API song-random: Playlist ID or Artist Name is missing from the request.');
      return res.status(400).json({ message: "Playlist ID or Artist Name is required for fetching a random song." });
    }

    let song;
    try {
      if (playlistId) {
        song = await itunesService.getRandomSong({ playlistId });
      } else if (artistName) {
        song = await itunesService.getRandomSong({ artistName });
      }

      if (song) {
        res.json(song);
      } else {
        let message = "Could not fetch a random song.";
        if (playlistId) message = `Could not fetch a random song from playlist ${playlistId}.`;
        if (artistName) message = `Could not fetch a random song for artist '${artistName}'.`;
        res.status(404).json({ message });
      }
    } catch (error) {
      console.error(`API song-random: Server error. PlaylistId: ${playlistId}, ArtistName: ${artistName}. Error:`, error);
      res.status(500).json({ message: "Error fetching random song", error: error.message });
    }
  });
}; 