const fetch = require('node-fetch');
const crypto = require('crypto');
const cors = require('cors');

const corsMiddleware = cors();

// Seeded LCG PRNG — same seed always produces the same sequence
function seededRandom(seedStr) {
    const hash = crypto.createHash('sha256').update(seedStr).digest('hex');
    let state = parseInt(hash.slice(0, 8), 16);
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

// Fisher-Yates shuffle using the seeded PRNG
function deterministicShuffle(arr, rng) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

// Fetch top songs from iTunes RSS — genreId=null for the general top chart
async function fetchTopSongsFromRSS(genreId = null, limit = 100) {
    const url = genreId
        ? `https://itunes.apple.com/us/rss/topsongs/limit=${limit}/genre=${genreId}/json`
        : `https://itunes.apple.com/us/rss/topsongs/limit=${limit}/json`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`song-daily: RSS fetch failed for genreId=${genreId}: ${response.status}`);
            return [];
        }
        const data = await response.json();
        if (!data.feed || !data.feed.entry) return [];

        return data.feed.entry.map(entry => {
            const previewLink = entry.link.find(
                l => l.attributes && l.attributes.rel === 'enclosure' && l.attributes.type === 'audio/x-m4a'
            );
            const images = entry['im:image'];
            const bestImage = images && images.length > 0 ? images[images.length - 1].label : null;
            return {
                id: entry.id.attributes['im:id'],
                title: entry['im:name'].label,
                artist: entry['im:artist'].label,
                previewUrl: previewLink ? previewLink.attributes.href : null,
                albumArt: bestImage,
            };
        }).filter(t => t.previewUrl);
    } catch (error) {
        console.error(`song-daily: Error fetching RSS for genreId=${genreId}:`, error);
        return [];
    }
}

async function getDailySongs() {
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const rng = seededRandom(dateStr + '-v1');

    console.log(`song-daily: Building daily set for ${dateStr}`);

    // Fetch all pools in parallel
    const [rapTracks, popTracks, generalTracks] = await Promise.all([
        fetchTopSongsFromRSS('18', 100), // Rap & Hip-Hop
        fetchTopSongsFromRSS('14', 100), // Pop
        fetchTopSongsFromRSS(null, 100), // General top 100
    ]);

    console.log(`song-daily: Pool sizes — rap: ${rapTracks.length}, pop: ${popTracks.length}, general: ${generalTracks.length}`);

    // Pick 3 rap songs
    const shuffledRap = deterministicShuffle(rapTracks, rng);
    const selectedRap = shuffledRap.slice(0, 3).map(s => ({ ...s, genre: 'rap' }));
    const usedIds = new Set(selectedRap.map(s => s.id));

    // Pick 3 pop songs (excluding any already chosen as rap)
    const availablePop = popTracks.filter(s => !usedIds.has(s.id));
    const shuffledPop = deterministicShuffle(availablePop, rng);
    const selectedPop = shuffledPop.slice(0, 3).map(s => ({ ...s, genre: 'pop' }));
    selectedPop.forEach(s => usedIds.add(s.id));

    // Pick 4 from general top 100 (excluding already chosen songs)
    const availableGeneral = generalTracks.filter(s => !usedIds.has(s.id));
    const shuffledGeneral = deterministicShuffle(availableGeneral, rng);
    const selectedOther = shuffledGeneral.slice(0, 4).map(s => ({ ...s, genre: 'top' }));

    const combined = [...selectedRap, ...selectedPop, ...selectedOther];

    if (combined.length < 10) {
        console.warn(`song-daily: Only assembled ${combined.length} songs for ${dateStr} (expected 10)`);
    }

    // Shuffle the final order so genre isn't predictable by position
    const finalOrder = deterministicShuffle(combined, rng);

    return finalOrder.map(s => ({
        ...s,
        id: `daily-${dateStr}-${s.id}`,
    }));
}

module.exports = (req, res) => {
    corsMiddleware(req, res, async () => {
        try {
            const songs = await getDailySongs();
            if (songs && songs.length > 0) {
                res.status(200).json(songs);
            } else {
                res.status(404).json({ message: 'Could not fetch daily songs.' });
            }
        } catch (error) {
            console.error('song-daily: Unhandled error:', error);
            res.status(500).json({ message: 'Internal server error.' });
        }
    });
};
