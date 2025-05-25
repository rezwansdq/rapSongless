require('dotenv').config();
const cors = require('cors');
const spotifyService = require('./spotifyService'); // Assuming spotifyService.js is in the same api directory

const corsMiddleware = cors();

module.exports = (req, res) => {
  corsMiddleware(req, res, async () => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const playlistId = parsedUrl.searchParams.get('id');

    if (!playlistId) {
      return res.status(400).json({ success: false, message: "Playlist ID is required" });
    }

    try {
      const details = await spotifyService.getPlaylistDetails(playlistId);
      if (details && details.id) {
        res.json({ success: true, id: details.id, name: details.name, totalTracks: details.totalTracks });
      } else {
        // This will cover cases where getPlaylistDetails returns null (e.g., 404 or other non-retryable error from Spotify)
        res.status(404).json({ success: false, message: "Playlist not found or access denied by Spotify. Please check the link or try a different one." });
      }
    } catch (error) {
      // This catch block is for unexpected errors in this handler itself
      console.error("API Playlist-Validate: Server error for ID:", playlistId, error);
      res.status(500).json({ success: false, message: "Internal server error validating playlist", error: error.message });
    }
  });
}; 