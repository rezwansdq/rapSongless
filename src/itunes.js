// Everything that talks to iTunes lives here.
//
// Apple throttles per IP (it answers 403), and a Worker's outbound requests leave from Cloudflare's
// shared address pool, so a bare fetch() fails far more often than it did from Vercel. Every call
// therefore goes through cachedLoad(): good answers are kept at the edge, a refresh that fails falls
// back to the last good copy, and the request itself is retried a couple of times before giving up.

const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';
const USER_AGENT = 'Songdle/1.0 (+https://songdle.win)';

// How long an answer is served without asking Apple again, by kind of request.
const FRESH_SECONDS = { chart: 30 * 60, artist: 60 * 60, autocomplete: 10 * 60 };
// How long a copy is kept to fall back on when Apple refuses a refresh.
const KEEP_SECONDS = 24 * 60 * 60;

const RETRY_DELAYS_MS = [300, 700];
const RETRY_STATUSES = new Set([403, 429, 500, 502, 503, 504]);

export class UpstreamError extends Error {
    constructor(message, status = 0) {
        super(message);
        this.name = 'UpstreamError';
        this.status = status; // the HTTP status Apple answered with, or 0 if it never answered
    }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchJson(url) {
    let failure;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]);
        try {
            const response = await fetch(url, {
                headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
                signal: AbortSignal.timeout(4000),
            });
            if (response.ok) return await response.json();
            failure = new UpstreamError(`iTunes answered ${response.status} for ${url}`, response.status);
            if (!RETRY_STATUSES.has(response.status)) break;
        } catch (error) {
            failure = new UpstreamError(`iTunes request failed for ${url}: ${error.message}`);
        }
    }
    throw failure;
}

/**
 * Returns { data, source } where source is 'cache' (fresh copy, Apple not asked), 'live', or
 * 'stale' (Apple refused, so the last good copy was served). Only answers that pass isUsable()
 * are stored, so an error or an empty page can never replace a good copy.
 */
async function cachedLoad(url, freshSeconds, load, isUsable) {
    const cache = globalThis.caches?.default;
    const key = new Request(url);

    let stale = null;
    if (cache) {
        try {
            const hit = await cache.match(key);
            if (hit) {
                const { storedAt, data } = await hit.json();
                if (Date.now() - storedAt < freshSeconds * 1000) return { data, source: 'cache' };
                stale = data;
            }
        } catch (error) {
            console.warn(`itunes: cache read failed for ${url}:`, error);
        }
    }

    let data;
    try {
        data = await load();
    } catch (error) {
        if (stale === null) throw error;
        console.warn(`itunes: refresh failed, serving the last good copy of ${url}:`, error.message);
        return { data: stale, source: 'stale' };
    }

    if (!isUsable(data)) {
        // An empty answer right after a good one looks like throttling, not a real change.
        return stale === null ? { data, source: 'live' } : { data: stale, source: 'stale' };
    }

    if (cache) {
        try {
            await cache.put(key, new Response(JSON.stringify({ storedAt: Date.now(), data }), {
                headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${KEEP_SECONDS}` },
            }));
        } catch (error) {
            console.warn(`itunes: cache write failed for ${url}:`, error);
        }
    }
    return { data, source: 'live' };
}

// iTunes returns 100x100 artwork; the same URL accepts a larger size.
function highResArt(track) {
    return track.artworkUrl100 ? track.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg') : track.artworkUrl100;
}

function toAppTrack(track) {
    return {
        id: track.trackId ? track.trackId.toString() : Date.now().toString(),
        title: track.trackName,
        artist: track.artistName,
        previewUrl: track.previewUrl,
        albumArt: highResArt(track),
    };
}

// Keep only what we use, so cached copies stay small.
const trimTrack = t => ({
    trackId: t.trackId,
    trackName: t.trackName,
    artistName: t.artistName,
    previewUrl: t.previewUrl || null,
    artworkUrl100: t.artworkUrl100 || null,
});

function parseChartEntry(entry) {
    const links = [].concat(entry.link || []);
    const preview = links.find(
        l => l.attributes && l.attributes.rel === 'enclosure' && l.attributes.type === 'audio/x-m4a'
    );
    const images = entry['im:image'];
    return {
        trackId: entry.id.attributes['im:id'],
        trackName: entry['im:name'].label,
        artistName: entry['im:artist'].label,
        previewUrl: preview ? preview.attributes.href : null,
        artworkUrl100: images && images.length > 0 ? images[images.length - 1].label : null,
    };
}

// Top songs from the iTunes RSS chart (genreId=null is the general top chart), in the iTunes
// search shape (trackId, trackName, ...). Throws UpstreamError if Apple can't be reached and
// there is no earlier copy to fall back on.
export async function topSongsRss(genreId, limit = 100) {
    const url = genreId
        ? `https://itunes.apple.com/us/rss/topsongs/limit=${limit}/genre=${genreId}/json`
        : `https://itunes.apple.com/us/rss/topsongs/limit=${limit}/json`;
    const { data, source } = await cachedLoad(url, FRESH_SECONDS.chart, async () => {
        const feed = await fetchJson(url);
        return [].concat(feed?.feed?.entry || []).map(parseChartEntry).filter(t => t.previewUrl);
    }, tracks => tracks.length > 0);
    return { tracks: data, source };
}

async function searchTracks(term, { limit, attribute = null, freshSeconds }) {
    const params = new URLSearchParams();
    params.append('term', term.trim());
    params.append('country', 'US');
    params.append('media', 'music');
    params.append('entity', 'song');
    params.append('limit', String(limit));
    if (attribute) params.append('attribute', attribute);
    const url = `${ITUNES_SEARCH_URL}?${params}`;

    const { data, source } = await cachedLoad(url, freshSeconds, async () => {
        const body = await fetchJson(url);
        return (body.results || []).map(trimTrack);
    }, tracks => tracks.length > 0);
    return { tracks: data, source };
}

export async function getRandomSong({ genreId, artistName, excludeIds }) {
    let found;
    if (genreId) {
        found = await topSongsRss(genreId, 100);
    } else if (artistName) {
        found = await searchTracks(artistName, { limit: 50, attribute: 'artistTerm', freshSeconds: FRESH_SECONDS.artist });
    } else {
        return { song: null, source: null };
    }

    const available = found.tracks.filter(
        t => t.previewUrl && !excludeIds.has(t.trackId ? t.trackId.toString() : '')
    );
    if (available.length === 0) return { song: null, source: found.source };
    return { song: toAppTrack(available[Math.floor(Math.random() * available.length)]), source: found.source };
}

export async function searchForAutocomplete(term) {
    const { tracks, source } = await searchTracks(term, { limit: 10, freshSeconds: FRESH_SECONDS.autocomplete });
    const songs = tracks.map(t => ({
        id: t.trackId ? t.trackId.toString() : Date.now().toString(),
        title: t.trackName,
        artist: t.artistName,
        albumArt: highResArt(t),
    }));
    return { songs, source };
}
