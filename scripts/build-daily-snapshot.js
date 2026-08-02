#!/usr/bin/env node
/**
 * Builds dailysongs/daily-snapshot.json — the fixed calendar the daily
 * challenge is served from.
 *
 * The challenge used to be assembled at request time from the live iTunes
 * chart, which meant a past day replayed weeks later returned different songs
 * than it originally had. Freezing the calendar into a committed file fixes
 * that: once a day is written here it never changes.
 *
 * Usage:
 *   node scripts/build-daily-snapshot.js [--past=100] [--future=365] [--rebuild]
 *
 * Existing days are preserved by default; only missing dates are filled in, so
 * re-running to extend the calendar can never rewrite history. Pass --rebuild
 * to discard the current file and generate every day from scratch.
 *
 * Song pool: the live iTunes RSS charts when they're reachable, otherwise the
 * 1095 tracks already committed in dailysongs/songs.json. Both paths produce a
 * deterministic calendar, so a network-less run is still reproducible.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.join(__dirname, '..');
const SNAPSHOT_PATH = path.join(REPO_ROOT, 'dailysongs', 'daily-snapshot.json');
const FALLBACK_POOL_PATH = path.join(REPO_ROOT, 'dailysongs', 'songs.json');

// One challenge is one rap track, one pop track and one from the wider chart.
const SLOTS = ['rap', 'pop', 'top'];

// Slot assignment is indexed off a fixed epoch rather than the generation date,
// so a given date always resolves to the same pool position no matter when the
// generator runs.
const EPOCH = '2025-01-01';
const SHUFFLE_SEED = 'songless-daily-v1';

// ── Deterministic RNG (same LCG the API used for its date seeding) ───────────

function seededRandom(seedStr) {
    const hash = crypto.createHash('sha256').update(seedStr).digest('hex');
    let state = parseInt(hash.slice(0, 8), 16);
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function deterministicShuffle(arr, rng) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

// ── Dates (UTC throughout — the snapshot is calendar data, not local time) ───

function toDateStr(date) {
    return date.toISOString().split('T')[0];
}

function addDays(dateStr, days) {
    const date = new Date(`${dateStr}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return toDateStr(date);
}

function daysSinceEpoch(dateStr) {
    const date = new Date(`${dateStr}T00:00:00Z`).getTime();
    const epoch = new Date(`${EPOCH}T00:00:00Z`).getTime();
    return Math.round((date - epoch) / 86400000);
}

// ── Song pools ───────────────────────────────────────────────────────────────

function trackId(title, artist) {
    return crypto.createHash('sha1').update(`${title}|${artist}`).digest('hex').slice(0, 12);
}

/** Pull one iTunes RSS chart. Returns [] on any failure so callers can fall back. */
async function fetchChart(genreId, limit) {
    const url = genreId
        ? `https://itunes.apple.com/us/rss/topsongs/limit=${limit}/genre=${genreId}/json`
        : `https://itunes.apple.com/us/rss/topsongs/limit=${limit}/json`;
    try {
        const fetchFn = global.fetch || require('node-fetch');
        const response = await fetchFn(url);
        if (!response.ok) {
            console.warn(`  chart ${genreId || 'general'}: HTTP ${response.status}`);
            return [];
        }
        const data = await response.json();
        const entries = (data.feed && data.feed.entry) || [];
        return entries.map(entry => {
            const preview = entry.link.find(
                l => l.attributes && l.attributes.rel === 'enclosure' && l.attributes.type === 'audio/x-m4a'
            );
            const images = entry['im:image'];
            return {
                id: entry.id.attributes['im:id'],
                title: entry['im:name'].label,
                artist: entry['im:artist'].label,
                previewUrl: preview ? preview.attributes.href : null,
                albumArt: images && images.length ? images[images.length - 1].label : null,
            };
        }).filter(track => track.previewUrl);
    } catch (error) {
        console.warn(`  chart ${genreId || 'general'}: ${error.message}`);
        return [];
    }
}

async function buildLivePools() {
    console.log('Fetching live iTunes charts…');
    const [rap, pop, top] = await Promise.all([
        fetchChart('18', 200),   // Rap & Hip-Hop
        fetchChart('14', 200),   // Pop
        fetchChart(null, 200),   // Overall top songs
    ]);
    if (!rap.length || !pop.length || !top.length) return null;

    // Keep the slots disjoint so a day can't draw the same track twice.
    const claimed = new Set();
    const claim = tracks => tracks.filter(t => (claimed.has(t.id) ? false : claimed.add(t.id)));
    const pools = { rap: claim(rap), pop: claim(pop), top: claim(top) };

    if (SLOTS.some(slot => pools[slot].length === 0)) return null;
    console.log(`  pools — rap: ${pools.rap.length}, pop: ${pools.pop.length}, top: ${pools.top.length}`);
    return pools;
}

/** The 1095 tracks already committed to the repo, grouped into the three slots. */
function buildFallbackPools() {
    console.log(`Using committed pool: ${path.relative(REPO_ROOT, FALLBACK_POOL_PATH)}`);
    const raw = JSON.parse(fs.readFileSync(FALLBACK_POOL_PATH, 'utf8'));
    const slotForGenre = { rap: 'rap', pop: 'pop', random: 'top', top: 'top' };
    const pools = { rap: [], pop: [], top: [] };
    const seen = new Set();

    raw.dailySongs.forEach(day => {
        day.songs.forEach(song => {
            const slot = slotForGenre[song.genre];
            if (!slot || !song.preview_url) return;
            const id = trackId(song.title, song.artist);
            if (seen.has(id)) return;
            seen.add(id);
            pools[slot].push({
                id,
                title: song.title,
                artist: song.artist,
                previewUrl: song.preview_url,
                // The committed pool predates artwork capture; a live rebuild fills it in.
                albumArt: null,
            });
        });
    });

    if (SLOTS.some(slot => pools[slot].length === 0)) {
        throw new Error('Fallback pool is missing one of the rap/pop/top slots.');
    }
    console.log(`  pools — rap: ${pools.rap.length}, pop: ${pools.pop.length}, top: ${pools.top.length}`);
    return pools;
}

// ── Calendar ─────────────────────────────────────────────────────────────────

/**
 * Deals one day's songs. Each slot walks its shuffled pool in lockstep with the
 * date, so a track only comes back around after the whole pool is used.
 */
function songsForDate(dateStr, shuffled) {
    const index = daysSinceEpoch(dateStr);
    const used = new Set();
    const picks = [];

    SLOTS.forEach(slot => {
        const pool = shuffled[slot];
        // Step forward on the rare cross-slot duplicate rather than repeat a track.
        for (let offset = 0; offset < pool.length; offset++) {
            const track = pool[(((index + offset) % pool.length) + pool.length) % pool.length];
            if (used.has(track.id)) continue;
            used.add(track.id);
            picks.push({ ...track, genre: slot });
            return;
        }
    });

    // Shuffle within the day so the slot order isn't guessable from position.
    return deterministicShuffle(picks, seededRandom(`${dateStr}-order`));
}

function parseArgs(argv) {
    const opts = { past: 100, future: 365, rebuild: false };
    argv.slice(2).forEach(arg => {
        const num = /^--(past|future)=(\d+)$/.exec(arg);
        if (num) { opts[num[1]] = Number(num[2]); return; }
        if (arg === '--rebuild') { opts.rebuild = true; return; }
        throw new Error(`Unknown argument: ${arg}`);
    });
    return opts;
}

async function main() {
    const opts = parseArgs(process.argv);
    const today = toDateStr(new Date());
    const firstDate = addDays(today, -opts.past);
    const lastDate = addDays(today, opts.future);

    const pools = (await buildLivePools()) || buildFallbackPools();
    const shuffled = {};
    SLOTS.forEach(slot => {
        shuffled[slot] = deterministicShuffle(pools[slot], seededRandom(`${SHUFFLE_SEED}-${slot}`));
    });

    let existing = {};
    if (!opts.rebuild && fs.existsSync(SNAPSHOT_PATH)) {
        const prev = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
        existing = prev.days || {};
        console.log(`Preserving ${Object.keys(existing).length} day(s) already committed.`);
    }

    const days = {};
    let added = 0;
    for (let date = firstDate; date <= lastDate; date = addDays(date, 1)) {
        if (existing[date]) {
            days[date] = existing[date];
        } else {
            days[date] = songsForDate(date, shuffled);
            added++;
        }
    }
    // Days outside the new window stay put — the past shouldn't disappear.
    Object.keys(existing).forEach(date => { if (!days[date]) days[date] = existing[date]; });

    const ordered = {};
    Object.keys(days).sort().forEach(date => { ordered[date] = days[date]; });

    const snapshot = {
        version: 1,
        generatedAt: new Date().toISOString(),
        songsPerDay: SLOTS.length,
        firstDate: Object.keys(ordered)[0],
        lastDate: Object.keys(ordered)[Object.keys(ordered).length - 1],
        days: ordered,
    };

    fs.writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);

    const total = Object.keys(ordered).length;
    console.log(`\nWrote ${path.relative(REPO_ROOT, SNAPSHOT_PATH)}`);
    console.log(`  ${total} days (${snapshot.firstDate} → ${snapshot.lastDate}), ${added} newly generated`);
    console.log(`  ${(fs.statSync(SNAPSHOT_PATH).size / 1024).toFixed(0)} KB`);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
