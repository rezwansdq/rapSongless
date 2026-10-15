import { handleDaily } from './song-daily.js';
import { getRandomSong, searchForAutocomplete } from './itunes.js';

const CORS = { 'Access-Control-Allow-Origin': '*' };

const json = (body, status = 200) => Response.json(body, { status, headers: CORS });

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

    try {
        const song = await getRandomSong({ genreId, artistName, excludeIds });
        if (song) return json(song);
        const what = genreId ? `genre ${genreId}` : `artist '${artistName}'`;
        return json({ message: `Could not fetch a random song from ${what}.` }, 404);
    } catch (error) {
        console.error('song-random: server error:', error);
        return json({ message: 'Error fetching random song', error: error.message }, 500);
    }
}

async function handleSearch(url) {
    const term = url.searchParams.get('term');
    if (!term) return json({ message: 'Search term is required' }, 400);
    return json(await searchForAutocomplete(term));
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
