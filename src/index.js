import { handleDaily } from './song-daily.js';
import { UpstreamError, getRandomSong, searchForAutocomplete } from './itunes.js';

const CORS = { 'Access-Control-Allow-Origin': '*' };
const NO_STORE = { 'Cache-Control': 'no-store' };

const json = (body, status = 200, headers = {}) =>
    Response.json(body, { status, headers: { ...CORS, ...headers } });

function failure(where, error, message) {
    console.error(`${where}: server error:`, error);
    if (error instanceof UpstreamError) {
        // Apple refused or didn't answer. upstreamStatus is what it said (0 = no answer at all).
        return json({
            message: "Couldn't reach iTunes right now. Please try again in a moment.",
            upstreamStatus: error.status,
        }, 502, NO_STORE);
    }
    return json({ message, error: error.message }, 500, NO_STORE);
}

async function handleRandom(url) {
    const genreId = url.searchParams.get('genreId') || url.searchParams.get('playlistId');
    const artistName = url.searchParams.get('artistName');
    const mode = url.searchParams.get('mode');
    const excludeIds = new Set(
        (url.searchParams.get('exclude_ids') || '').split(',').filter(id => id.trim() !== '')
    );

    if (mode === 'daily' ? !genreId : !genreId && !artistName) {
        return json({ message: 'Genre ID or Artist Name is required for fetching a random song.' }, 400);
    }
    // The genre ID goes into a URL path (and a cache key), so only accept what iTunes uses.
    if (genreId && !/^\d{1,6}$/.test(genreId)) {
        return json({ message: 'Invalid genre ID.' }, 400);
    }

    try {
        const { song, source } = await getRandomSong({ genreId, artistName, excludeIds });
        if (song) return json(song, 200, { 'X-Itunes-Source': source });
        const what = genreId ? `genre ${genreId}` : `artist '${artistName}'`;
        return json({ message: `Could not fetch a random song from ${what}.` }, 404, NO_STORE);
    } catch (error) {
        return failure('song-random', error, 'Error fetching random song');
    }
}

async function handleSearch(url) {
    const term = url.searchParams.get('term');
    if (!term || !term.trim()) return json({ message: 'Search term is required' }, 400);

    try {
        const { songs, source } = await searchForAutocomplete(term);
        return json(songs, 200, { 'X-Itunes-Source': source });
    } catch (error) {
        return failure('songs-search', error, 'Error searching songs');
    }
}

const routes = {
    '/api/song-daily': async url => {
        const res = await handleDaily(url);
        const out = new Response(res.body, res);
        out.headers.set('Access-Control-Allow-Origin', '*');
        return out;
    },
    '/api/song-random': handleRandom,
    '/api/songs-search': handleSearch,
};

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS', 'Access-Control-Allow-Headers': '*' },
            });
        }

        const route = routes[url.pathname];
        if (route) return route(url);
        if (url.pathname.startsWith('/api/')) return json({ message: 'API endpoint not found' }, 404);

        return env.ASSETS.fetch(request);
    },
};
