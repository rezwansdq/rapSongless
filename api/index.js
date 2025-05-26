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
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const playlistId = parsedUrl.searchParams.get('playlistId');
    const artistName = parsedUrl.searchParams.get('artistName');
    const excludeIdsString = parsedUrl.searchParams.get('exclude_ids');

    let serviceParams = {};
    if (playlistId) {
        serviceParams.playlistId = playlistId;
    } else if (artistName) {
        serviceParams.artistName = artistName;
    } else {
        return res.status(400).json({ message: "Playlist ID or Artist Name is required." });
    }

    if (excludeIdsString) {
        serviceParams.playedSpotifyTrackIds = new Set(excludeIdsString.split(',').filter(id => id.trim() !== ''));
        console.log(`API Index (handleRandomSong): Parsed ${serviceParams.playedSpotifyTrackIds.size} IDs to exclude.`);
    } else {
        serviceParams.playedSpotifyTrackIds = new Set();
    }

    console.log(`API Index (handleRandomSong): PlaylistId: ${playlistId}, ArtistName: ${artistName}, Exclude IDs: ${excludeIdsString ? excludeIdsString.substring(0,100) + '...' : 'none'}`);

    if (!serviceParams.playlistId && !serviceParams.artistName) {
        console.error('API Index (handleRandomSong): Playlist ID or Artist Name is missing.');
        return res.status(400).json({ message: "Playlist ID or Artist Name is required for fetching a random song." });
    }

    const song = await itunesService.getRandomSong(serviceParams);
    if (song) {
      res.json(song);
    } else {
      let message = "Could not fetch a random song.";
      if (playlistId) message = `Could not fetch a random song from playlist ${playlistId}. All unique songs may have been played or no suitable tracks found.`;
      if (artistName) message = `Could not fetch a random song for artist '${artistName}'. All unique songs may have been played or no suitable tracks found.`;
      res.status(404).json({ message });
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