import { createHash } from 'node:crypto';
import snapshot from '../dailysongs/daily-snapshot.json';
import { topSongsRss } from './itunes.js';

// The frozen calendar of daily challenges. Committed to the repo so a past day
// always replays the exact songs it originally had, and so future days exist
// ahead of time without being reachable before they arrive.
// Regenerate/extend with: node scripts/build-daily-snapshot.js

// One daily challenge is one rap song, one pop song and one from the overall chart.
const SONGS_PER_DAY = snapshot.songsPerDay || 3;

// The earliest timezone on Earth is UTC+14, so a date becomes playable the
// moment it starts there — that's the "the day has arrived" line. Anything
// beyond it is a future day and stays sealed.
const EARLIEST_TZ_OFFSET_HOURS = 14;

// Seeded LCG PRNG — same seed always produces the same sequence
function seededRandom(seedStr) {
    const hash = createHash('sha256').update(seedStr).digest('hex');
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

// ── Dates ────────────────────────────────────────────────────────────────────

function toDateStr(date) {
    return date.toISOString().split('T')[0];
}

/** The server's own calendar date — what a caller gets when it asks for no date. */
function utcTodayStr() {
    return toDateStr(new Date());
}

/**
 * The latest date that has begun anywhere in the world. Used only as the upper
 * bound on what may be requested, so a player in UTC+13 can reach their local
 * today; it is deliberately not the default date.
 */
function latestArrivedDate() {
    return toDateStr(new Date(Date.now() + EARLIEST_TZ_OFFSET_HOURS * 3600000));
}

function isWellFormedDate(dateStr) {
    if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    const date = new Date(`${dateStr}T00:00:00Z`);
    return !isNaN(date.getTime()) && toDateStr(date) === dateStr;
}

// ── Live chart fallback (only for arrived dates missing from the snapshot) ───

// Same chart fetch as the random endpoint, mapped to the daily song shape.
async function fetchTopSongsFromRSS(genreId = null, limit = 100) {
    try {
        const { tracks } = await topSongsRss(genreId, limit);
        return tracks.map(t => ({
            id: t.trackId,
            title: t.trackName,
            artist: t.artistName,
            previewUrl: t.previewUrl,
            albumArt: t.artworkUrl100,
        }));
    } catch (error) {
        console.error(`song-daily: chart fetch failed for genreId=${genreId}:`, error);
        return [];
    }
}

/**
 * Assembles a day from the live chart. This is the safety net for when the
 * committed calendar runs out — days served this way are NOT stable across
 * requests, so extend the snapshot (scripts/build-daily-snapshot.js) rather
 * than leaning on this.
 */
async function buildDailySongsFromCharts(dateStr) {
    const rng = seededRandom(dateStr + '-v1');

    console.warn(`song-daily: ${dateStr} not in snapshot — falling back to live charts.`);

    const [rapTracks, popTracks, generalTracks] = await Promise.all([
        fetchTopSongsFromRSS('18', 100), // Rap & Hip-Hop
        fetchTopSongsFromRSS('14', 100), // Pop
        fetchTopSongsFromRSS(null, 100), // General top 100
    ]);

    // Pick 1 rap song
    const selectedRap = deterministicShuffle(rapTracks, rng).slice(0, 1).map(s => ({ ...s, genre: 'rap' }));
    const usedIds = new Set(selectedRap.map(s => s.id));

    // Pick 1 pop song (excluding any already chosen as rap)
    const availablePop = popTracks.filter(s => !usedIds.has(s.id));
    const selectedPop = deterministicShuffle(availablePop, rng).slice(0, 1).map(s => ({ ...s, genre: 'pop' }));
    selectedPop.forEach(s => usedIds.add(s.id));

    // Pick 1 from the general top 100 (excluding already chosen songs)
    const availableGeneral = generalTracks.filter(s => !usedIds.has(s.id));
    const selectedOther = deterministicShuffle(availableGeneral, rng).slice(0, 1).map(s => ({ ...s, genre: 'top' }));

    const combined = [...selectedRap, ...selectedPop, ...selectedOther];
    if (combined.length < SONGS_PER_DAY) {
        console.warn(`song-daily: Only assembled ${combined.length} songs for ${dateStr} (expected ${SONGS_PER_DAY})`);
    }

    // Shuffle the final order so genre isn't predictable by position
    return deterministicShuffle(combined, rng);
}

// ── Handler ──────────────────────────────────────────────────────────────────

async function getDailySongs(dateStr) {
    const fromSnapshot = snapshot.days[dateStr];
    const songs = fromSnapshot || await buildDailySongsFromCharts(dateStr);
    return songs.map(s => ({ ...s, id: `daily-${dateStr}-${s.id}` }));
}

export async function handleDaily(url) {
    const json = (body, status = 200, headers = {}) =>
        Response.json(body, { status, headers });

    try {
        const requestedDate = url.searchParams.get('date');
        const maxDate = latestArrivedDate();
        const dateStr = requestedDate || utcTodayStr();

        if (!isWellFormedDate(dateStr)) {
            return json({ message: 'Invalid date. Use YYYY-MM-DD.' }, 400);
        }

        // Future days are in the snapshot but stay sealed until they arrive.
        if (dateStr > maxDate) {
            return json({ message: "That day hasn't arrived yet." }, 403);
        }

        if (snapshot.firstDate && dateStr < snapshot.firstDate) {
            return json({ message: 'No daily challenge exists for that date.' }, 404);
        }

        const songs = await getDailySongs(dateStr);
        if (songs && songs.length > 0) {
            // A given date's songs never change, so let the CDN hold them.
            return json(songs, 200, { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' });
        }
        return json({ message: 'Could not fetch daily songs.' }, 404);
    } catch (error) {
        console.error('song-daily: Unhandled error:', error);
        return json({ message: 'Internal server error.' }, 500);
    }
}
