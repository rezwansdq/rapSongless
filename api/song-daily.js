const fs = require('fs');
const path = require('path');
const cors = require('cors');

const corsMiddleware = cors();

// Path to the JSON file
const songsFilePath = path.join(process.cwd(), 'dailysongs', 'songs.json');

// Function to get the song for the current date
const getDailySong = () => {
    try {
        const data = fs.readFileSync(songsFilePath, 'utf8');
        const dailySongsData = JSON.parse(data);
        
        const today = new Date();
        const month = today.getUTCMonth() + 1;
        const day = today.getUTCDate();

        const dailyChallenge = dailySongsData.dailySongs.find(d => {
            const [year, songMonth, songDay] = d.date.split('-').map(Number);
            return (songMonth === month) && (songDay === day);
        });

        if (dailyChallenge && dailyChallenge.songs.length > 0) {
            const songs = dailyChallenge.songs.map(song => {
                song.id = `daily-${dailyChallenge.date}-${song.title}`; // Add a temporary ID
                song.previewUrl = song.preview_url;
                delete song.preview_url;
                return song;
            });
            return songs;
        }
        return null;
    } catch (error) {
        console.error('Error reading or parsing daily songs file:', error);
        return null;
    }
};

module.exports = (req, res) => {
    corsMiddleware(req, res, () => {
        const song = getDailySong();
        if (song) {
            res.status(200).json(song);
        } else {
            res.status(404).json({ message: 'Could not find a song for the current date.' });
        }
    });
};