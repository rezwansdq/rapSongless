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
    const mode = parsedUrl.searchParams.get('mode');
    const excludeIdsString = parsedUrl.searchParams.get('exclude_ids');

    // Log received parameters for debugging
    console.log(`API song-random: Received request. Mode: ${mode}, PlaylistId: ${playlistId}, ArtistName: ${artistName}, Exclude IDs: ${excludeIdsString ? excludeIdsString.substring(0,100) + '...' : 'none'}`);

    if (mode === 'daily') {
        if (!playlistId) {
            console.error('API song-random: Playlist ID is missing for daily mode.');
            return res.status(400).json({ message: "Playlist ID is required for daily mode." });
        }
    } else if (!playlistId && !artistName) {
      console.error('API song-random: Playlist ID or Artist Name is missing from the request.');
      return res.status(400).json({ message: "Playlist ID or Artist Name is required for fetching a random song." });
    }

    let song;
    try {
      let serviceParams = {};
      if (playlistId) {
        serviceParams.playlistId = playlistId;
      } else if (artistName) {
        serviceParams.artistName = artistName;
      }

      if (excludeIdsString) {
        serviceParams.playedSpotifyTrackIds = new Set(excludeIdsString.split(',').filter(id => id.trim() !== ''));
        console.log(`API song-random: Parsed ${serviceParams.playedSpotifyTrackIds.size} IDs to exclude.`);
      } else {
        serviceParams.playedSpotifyTrackIds = new Set(); // Ensure it's always a Set
      }

      if (mode === 'daily') {
        song = await itunesService.getDailySong(serviceParams);
      } else {
        song = await itunesService.getRandomSong(serviceParams);
      }

      if (song) {
        res.json(song);
      } else {
        let message = "Could not fetch a random song.";
        if (mode === 'daily') message = `Could not fetch the daily song.`;
        else if (playlistId) message = `Could not fetch a random song from playlist ${playlistId}.`;
        else if (artistName) message = `Could not fetch a random song for artist '${artistName}'.`;
        res.status(404).json({ message });
      }
    } catch (error) {
      console.error(`API song-random: Server error. PlaylistId: ${playlistId}, ArtistName: ${artistName}. Error:`, error);
      res.status(500).json({ message: "Error fetching random song", error: error.message });
    }
  });
}; 