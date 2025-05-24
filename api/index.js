require('dotenv').config();
const cors = require('cors');
const itunesService = require('./itunesService');

// Helper to handle CORS middleware for Vercel functions
const corsMiddleware = cors();

// API handler for Vercel
module.exports = (req, res) => {
  corsMiddleware(req, res, async () => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    if (path === '/api/song/random') {
      await handleRandomSong(req, res);
    } else if (path === '/api/songs/search') {
      await handleSongSearch(req, res);
    } else {
      res.status(404).json({ message: "API endpoint not found" });
    }
  });
};

// Handler functions
async function handleRandomSong(req, res) {
  try {
    const song = await itunesService.getRandomSong();
    if (song) {
      res.json(song);
    } else {
      res.status(404).json({ message: "Could not fetch a random song." });
    }
  } catch (error) {
    console.error("API Index: Server error fetching random song:", error);
    res.status(500).json({ message: "Error fetching random song", error: error.message });
  }
}

async function handleSongSearch(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const searchTerm = parsedUrl.searchParams.get('term');

  if (!searchTerm) {
    return res.status(400).json({ message: "Search term is required" });
  }
  
  try {
    const songs = await itunesService.searchSpotifyForAutocomplete(searchTerm);
    res.json(songs);
  } catch (error) {
    console.error("API Index: Server error during Spotify song search for autocomplete:", error);
    res.status(500).json({ message: "Error searching songs via Spotify", error: error.message });
  }
} 