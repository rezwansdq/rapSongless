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

// One daily challenge is one rap song, one pop song and one from the overall chart.
const SONGS_PER_DAY = 3;

// How far back the archive can be played. Keep in sync with ARCHIVE_DAYS in
// public/js/dailyStore.js — this is the server-side guard, that one is the UI.
const MAX_ARCHIVE_DAYS = 30;

function utcTodayStr() {
    return new Date().toISOString().split('T')[0];
}

/**
 * Accepts a well-formed YYYY-MM-DD inside the playable window.
 * A day of slack on the future side covers players in timezones ahead of UTC,
 * who reach their local "today" before the server does.
 */
function isPlayableDate(dateStr) {
    if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;

    const date = new Date(`${dateStr}T00:00:00Z`);
    if (isNaN(date.getTime()) || date.toISOString().split('T')[0] !== dateStr) return false;

    const today = new Date(`${utcTodayStr()}T00:00:00Z`);
    const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);
    return diffDays <= 1 && diffDays > -MAX_ARCHIVE_DAYS;
}

async function getDailySongs(dateStr) {
    const rng = seededRandom(dateStr + '-v1');

    console.log(`song-daily: Building daily set for ${dateStr}`);

    // Fetch all pools in parallel
    const [rapTracks, popTracks, generalTracks] = await Promise.all([
        fetchTopSongsFromRSS('18', 100), // Rap & Hip-Hop
        fetchTopSongsFromRSS('14', 100), // Pop
        fetchTopSongsFromRSS(null, 100), // General top 100
    ]);

    console.log(`song-daily: Pool sizes — rap: ${rapTracks.length}, pop: ${popTracks.length}, general: ${generalTracks.length}`);

    // Pick 1 rap song
    const shuffledRap = deterministicShuffle(rapTracks, rng);
    const selectedRap = shuffledRap.slice(0, 1).map(s => ({ ...s, genre: 'rap' }));
    const usedIds = new Set(selectedRap.map(s => s.id));

    // Pick 1 pop song (excluding any already chosen as rap)
    const availablePop = popTracks.filter(s => !usedIds.has(s.id));
    const shuffledPop = deterministicShuffle(availablePop, rng);
    const selectedPop = shuffledPop.slice(0, 1).map(s => ({ ...s, genre: 'pop' }));
    selectedPop.forEach(s => usedIds.add(s.id));

    // Pick 1 from the general top 100 (excluding already chosen songs)
    const availableGeneral = generalTracks.filter(s => !usedIds.has(s.id));
    const shuffledGeneral = deterministicShuffle(availableGeneral, rng);
    const selectedOther = shuffledGeneral.slice(0, 1).map(s => ({ ...s, genre: 'top' }));

    const combined = [...selectedRap, ...selectedPop, ...selectedOther];

    if (combined.length < SONGS_PER_DAY) {
        console.warn(`song-daily: Only assembled ${combined.length} songs for ${dateStr} (expected ${SONGS_PER_DAY})`);
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
            const requestedDate = new URL(req.url, `http://${req.headers.host}`).searchParams.get('date');

            let dateStr = utcTodayStr();
            if (requestedDate) {
                if (!isPlayableDate(requestedDate)) {
                    console.warn(`song-daily: Rejected date "${requestedDate}".`);
                    return res.status(400).json({
                        message: `Invalid date. Use YYYY-MM-DD within the last ${MAX_ARCHIVE_DAYS} days.`,
                    });
                }
                dateStr = requestedDate;
            }

            const songs = await getDailySongs(dateStr);
            if (songs && songs.length > 0) {
                // The set for a given date is stable, so let the CDN hold it.
                res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
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
