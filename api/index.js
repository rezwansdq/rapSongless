require('dotenv').config();
const cors = require('cors');
const itunesService = require('../itunesService');

// Helper to handle CORS middleware for Vercel functions
const corsMiddleware = cors();

// API handler for Vercel
module.exports = (req, res) => {
  // Apply CORS
  corsMiddleware(req, res, () => {
    // Parse the path from the URL
    const url = new URL(req.url, `https://${req.headers.host}`);
    const path = url.pathname;

    // Route handling
    if (path === '/api/song/random') {
      handleRandomSong(req, res);
    } else if (path === '/api/songs') {
      handleAllSongs(req, res);
    } else if (path === '/api/songs/search') {
      handleSongSearch(req, res);
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
      res.status(404).json({ message: "Could not fetch a random song from iTunes." });
    }
  } catch (error) {
    console.error("Server error fetching random song:", error);
    res.status(500).json({ message: "Error fetching random song from iTunes", error: error.message });
  }
}

async function handleAllSongs(req, res) {
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
}

async function handleSongSearch(req, res) {
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
} 